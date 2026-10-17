using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Application.Features.Customers;

public sealed record GetCustomerPortalPreviewQuery(Guid CustomerId) : IRequest<CustomerPortalPreviewDto>;

public sealed record CustomerPortalPreviewDto(
    Guid CustomerId,
    string CustomerName,
    int LoyaltyPoints,
    decimal WalletBalanceRials,
    int VisitCount,
    string CurrentTierName,
    string? NextTierName,
    decimal NextTierProgressPercent,
    int VisitsToNextTier,
    IReadOnlyList<CustomerPortalRewardDto> Rewards,
    IReadOnlyList<CustomerPortalActivityDto> RecentActivities);

public sealed record CustomerPortalRewardDto(
    Guid Id,
    string Name,
    LoyaltyRewardType Type,
    int PointsCost,
    string? ProductName,
    bool CanRedeem,
    int PointsNeeded);

public sealed record CustomerPortalActivityDto(
    Guid Id,
    string Type,
    int PointsDelta,
    string? Notes,
    DateTime OccurredAtUtc);

public sealed class GetCustomerPortalPreviewHandler(IApplicationDbContext db)
    : IRequestHandler<GetCustomerPortalPreviewQuery, CustomerPortalPreviewDto>
{
    public async Task<CustomerPortalPreviewDto> Handle(GetCustomerPortalPreviewQuery request, CancellationToken ct)
    {
        var customer = await db.Customers.AsNoTracking()
            .Where(x => x.Id == request.CustomerId)
            .Select(x => new { x.Id, x.FullName, x.LoyaltyPoints, x.VisitCount, x.TotalSpent })
            .FirstOrDefaultAsync(ct) ?? throw new NotFoundException(nameof(Customer), request.CustomerId);

        var settings = await db.StoreSettings.AsNoTracking()
            .Select(x => x.LoyaltyTierRulesJson)
            .FirstAsync(ct);
        var tiers = DeserializeTiers(settings);
        var orderedTiers = tiers.OrderBy(x => x.MinimumVisits).ThenBy(x => x.MinimumSpendRials).ToArray();
        var currentIndex = Array.FindLastIndex(orderedTiers, tier =>
            customer.VisitCount >= tier.MinimumVisits || customer.TotalSpent >= tier.MinimumSpendRials);
        var currentTier = currentIndex >= 0 ? orderedTiers[currentIndex].Name : "عضو";
        var nextTier = currentIndex + 1 < orderedTiers.Length ? orderedTiers[currentIndex + 1] : null;
        var progress = nextTier is null ? 100m : CalculateProgress(customer.VisitCount, customer.TotalSpent, nextTier);
        var visitsRemaining = nextTier is null ? 0 : Math.Max(0, nextTier.MinimumVisits - customer.VisitCount);

        var walletBalance = await db.CustomerWalletLedgers.AsNoTracking()
            .Where(x => x.CustomerId == customer.Id)
            .OrderByDescending(x => x.OccurredAtUtc).ThenByDescending(x => x.Id)
            .Select(x => (decimal?)x.BalanceAfterRials)
            .FirstOrDefaultAsync(ct) ?? 0m;

        var rewards = await db.LoyaltyRewards.AsNoTracking().Where(x => x.IsActive)
            .OrderBy(x => x.PointsCost).ThenBy(x => x.Name)
            .Select(x => new { x.Id, x.Name, x.Type, x.PointsCost, x.ProductName })
            .ToListAsync(ct);
        var rewardDtos = rewards.Select(x => new CustomerPortalRewardDto(
            x.Id, x.Name, x.Type, x.PointsCost, x.ProductName,
            customer.LoyaltyPoints >= x.PointsCost,
            Math.Max(0, x.PointsCost - customer.LoyaltyPoints))).ToArray();

        var activities = await db.LoyaltyPointLedgers.AsNoTracking()
            .Where(x => x.CustomerId == customer.Id)
            .OrderByDescending(x => x.OccurredAtUtc).ThenByDescending(x => x.Id)
            .Take(5)
            .Select(x => new CustomerPortalActivityDto(x.Id, x.Type.ToString(), x.PointsDelta, x.Notes, x.OccurredAtUtc))
            .ToListAsync(ct);

        return new CustomerPortalPreviewDto(customer.Id,
            string.IsNullOrWhiteSpace(customer.FullName) ? "مشتری" : customer.FullName,
            customer.LoyaltyPoints, walletBalance, customer.VisitCount, currentTier,
            nextTier?.Name, progress, visitsRemaining, rewardDtos, activities);
    }

    private static decimal CalculateProgress(int visits, decimal spent, LoyaltyTierRuleDto tier)
    {
        var visitProgress = tier.MinimumVisits > 0 ? visits / (decimal)tier.MinimumVisits : 0m;
        var spendProgress = tier.MinimumSpendRials > 0 ? spent / tier.MinimumSpendRials : 0m;
        return decimal.Round(Math.Clamp(Math.Max(visitProgress, spendProgress) * 100m, 0m, 100m), 1);
    }

    private static LoyaltyTierRuleDto[] DeserializeTiers(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try { return JsonSerializer.Deserialize<LoyaltyTierRuleDto[]>(json) ?? []; }
        catch (JsonException) { return []; }
    }
}
