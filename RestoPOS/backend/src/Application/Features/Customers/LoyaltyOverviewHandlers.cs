using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Services;

namespace RestoPOS.Application.Features.Customers;

public sealed record LoyaltyOverviewQuery : IRequest<LoyaltyOverviewDto>;

public sealed record LoyaltyOverviewDto(
    int TotalMembers,
    int ActiveMembersLast30Days,
    int ActiveMembersPrevious30Days,
    int NewMembersThisMonth,
    int PointsIssuedThisMonth,
    decimal WalletOutstandingRials,
    IReadOnlyList<LoyaltyOverviewHourDto> HourlyOrders,
    int? PeakHour,
    IReadOnlyList<LoyaltyOverviewTierDto> TierDistribution,
    IReadOnlyList<LoyaltyOverviewLapsedCustomerDto> LapsedCustomers,
    decimal MemberSalesSharePercent,
    decimal GuestSalesSharePercent,
    decimal MemberAverageTicketRials,
    decimal GuestAverageTicketRials,
    decimal ReturningMemberRatePercent);

public sealed record LoyaltyOverviewHourDto(int Hour, int OrderCount);
public sealed record LoyaltyOverviewTierDto(string Name, int MemberCount, decimal MemberSharePercent);
public sealed record LoyaltyOverviewLapsedCustomerDto(Guid Id, string Name, string PhoneNumber, string LastVisitShamsi, int DaysSinceLastVisit);

public sealed class LoyaltyOverviewQueryHandler(IApplicationDbContext db)
    : IRequestHandler<LoyaltyOverviewQuery, LoyaltyOverviewDto>
{
    private static readonly int[] ChartHours = [8, 10, 12, 14, 16, 18, 20, 22];

    public async Task<LoyaltyOverviewDto> Handle(LoyaltyOverviewQuery request, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var thirtyDaysAgo = now.AddDays(-30);
        var sixtyDaysAgo = now.AddDays(-60);
        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var customers = await db.Customers.AsNoTracking()
            .Select(c => new { c.Id, c.FullName, c.PhoneNumber, c.VisitCount, c.TotalSpent, c.LoyaltyPoints, c.FirstVisitAt, c.LastVisitAt })
            .ToListAsync(cancellationToken);
        var activeCustomers = customers.Where(c => c.VisitCount > 0).ToArray();
        var activeCurrent = activeCustomers.Count(c => c.LastVisitAt >= thirtyDaysAgo);
        var activePrevious = activeCustomers.Count(c => c.LastVisitAt >= sixtyDaysAgo && c.LastVisitAt < thirtyDaysAgo);

        var pointsIssued = await db.LoyaltyPointLedgers.AsNoTracking()
            .Where(x => x.OccurredAtUtc >= monthStart && x.PointsDelta > 0)
            .SumAsync(x => (int?)x.PointsDelta, cancellationToken) ?? 0;

        var walletRows = await db.CustomerWalletLedgers.AsNoTracking()
            .OrderBy(x => x.CustomerId).ThenByDescending(x => x.OccurredAtUtc)
            .Select(x => new { x.CustomerId, x.BalanceAfterRials })
            .ToListAsync(cancellationToken);
        var walletOutstanding = walletRows.GroupBy(x => x.CustomerId).Sum(g => g.First().BalanceAfterRials);

        var settings = await db.StoreSettings.AsNoTracking().FirstOrDefaultAsync(cancellationToken);
        var lapsedDays = settings?.LapsedCustomerDays ?? 30;
        var rules = ReadTierRules(settings?.LoyaltyTierRulesJson);
        var tierCounts = rules.Select(rule => new
        {
            rule.Name,
            Count = customers.Count(c => (c.VisitCount >= rule.MinimumVisits || c.TotalSpent >= rule.MinimumSpendRials)
                                         && !rules.Any(higher => IsAbove(higher, rule)
                                             && (c.VisitCount >= higher.MinimumVisits || c.TotalSpent >= higher.MinimumSpendRials)))
        }).ToArray();

        var paidOrders = await db.Orders.AsNoTracking()
            .Where(o => o.Status == OrderStatus.Paid && o.PaidAt >= thirtyDaysAgo && o.PaidAt <= now)
            .Select(o => new { o.PaidAt, o.CustomerId, o.GrandTotal })
            .ToListAsync(cancellationToken);
        var hourlyCounts = ChartHours.ToDictionary(hour => hour, _ => 0);
        foreach (var order in paidOrders)
        {
            var localHour = order.PaidAt!.Value.ToLocalTime().Hour;
            var chartHour = ChartHours.OrderBy(hour => Math.Abs(hour - localHour)).First();
            hourlyCounts[chartHour]++;
        }
        int? peakHour = hourlyCounts.Values.All(x => x == 0)
            ? null
            : hourlyCounts.OrderByDescending(x => x.Value).ThenBy(x => x.Key).First().Key;

        var memberOrders = paidOrders.Where(x => x.CustomerId is not null).ToArray();
        var guestOrders = paidOrders.Where(x => x.CustomerId is null).ToArray();
        var totalSales = paidOrders.Sum(x => x.GrandTotal);
        var memberSales = memberOrders.Sum(x => x.GrandTotal);
        var guestSales = guestOrders.Sum(x => x.GrandTotal);
        var memberShare = totalSales == 0 ? 0 : decimal.Round(memberSales / totalSales * 100m, 1);
        var guestShare = totalSales == 0 ? 0 : decimal.Round(guestSales / totalSales * 100m, 1);

        var returningCustomerIds = await db.Orders.AsNoTracking()
            .Where(o => o.Status == OrderStatus.Paid && o.CustomerId != null && o.PaidAt >= thirtyDaysAgo && o.PaidAt <= now)
            .GroupBy(o => o.CustomerId!.Value)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key)
            .ToListAsync(cancellationToken);
        var visitedMemberIds = memberOrders.Select(o => o.CustomerId!.Value).Distinct().ToArray();
        List<Guid> previousVisitIds = visitedMemberIds.Length == 0 ? [] : await db.Orders.AsNoTracking()
            .Where(o => o.Status == OrderStatus.Paid && o.CustomerId != null && visitedMemberIds.Contains(o.CustomerId.Value)
                        && o.PaidAt != null && o.PaidAt < thirtyDaysAgo)
            .Select(o => o.CustomerId!.Value).Distinct().ToListAsync(cancellationToken);
        var previousVisitIdSet = previousVisitIds.ToHashSet();
        var returningRate = visitedMemberIds.Length == 0 ? 0 : decimal.Round(
            visitedMemberIds.Count(id => returningCustomerIds.Contains(id) || previousVisitIdSet.Contains(id))
            / (decimal)visitedMemberIds.Length * 100m, 1);

        var lapsedCutoff = now.AddDays(-lapsedDays);
        var lapsedCustomers = activeCustomers.Where(c => c.LastVisitAt < lapsedCutoff)
            .OrderBy(c => c.LastVisitAt).Take(3)
            .Select(c => new LoyaltyOverviewLapsedCustomerDto(
                c.Id, string.IsNullOrWhiteSpace(c.FullName) ? "مشتری بدون نام" : c.FullName,
                c.PhoneNumber, PersianDateTime.ToShamsiDateTime(c.LastVisitAt), (int)(now - c.LastVisitAt).TotalDays))
            .ToArray();

        return new LoyaltyOverviewDto(
            customers.Count, activeCurrent, activePrevious,
            customers.Count(c => c.FirstVisitAt >= monthStart), pointsIssued, walletOutstanding,
            ChartHours.Select(hour => new LoyaltyOverviewHourDto(hour, hourlyCounts[hour])).ToArray(), peakHour,
            tierCounts.Select(x => new LoyaltyOverviewTierDto(x.Name, x.Count,
                customers.Count == 0 ? 0 : decimal.Round(x.Count / (decimal)customers.Count * 100m, 1))).ToArray(),
            lapsedCustomers, memberShare, guestShare,
            memberOrders.Length == 0 ? 0 : memberSales / memberOrders.Length,
            guestOrders.Length == 0 ? 0 : guestSales / guestOrders.Length,
            returningRate);
    }

    private static LoyaltyTierRuleDto[] ReadTierRules(string? json)
    {
        if (!string.IsNullOrWhiteSpace(json))
        {
            try
            {
                var configured = JsonSerializer.Deserialize<LoyaltyTierRuleDto[]>(json);
                if (configured is { Length: > 0 }) return configured;
            }
            catch (JsonException) { }
        }

        // Match the same starter tiers shown by the loyalty settings screen when
        // no custom tier rules have been saved yet.
        return
        [
            new LoyaltyTierRuleDto("برنزی", 0, 0, 1, 0),
            new LoyaltyTierRuleDto("نقره‌ای", 8, 50_000_000, 1.2m, 3),
            new LoyaltyTierRuleDto("طلایی", 20, 150_000_000, 1.5m, 5)
        ];
    }

    private static bool IsAbove(LoyaltyTierRuleDto candidate, LoyaltyTierRuleDto current) =>
        candidate.MinimumVisits > current.MinimumVisits || candidate.MinimumSpendRials > current.MinimumSpendRials;

}
