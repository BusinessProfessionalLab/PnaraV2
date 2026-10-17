using System.Globalization;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Exceptions;
using RestoPOS.Domain.Services;

namespace RestoPOS.Application.Features.Analytics;

public enum LoyaltyClubReportPeriod
{
    Last30Days,
    ThisMonth,
    Last3Months,
    CustomRange
}

public enum LoyaltyClubReportComparison
{
    PreviousPeriod,
    PreviousYear,
    None
}

public sealed record GetLoyaltyClubReportQuery(
    LoyaltyClubReportPeriod Period = LoyaltyClubReportPeriod.Last30Days,
    LoyaltyClubReportComparison Comparison = LoyaltyClubReportComparison.PreviousPeriod,
    DateTime? FromUtc = null,
    DateTime? ToUtc = null) : IRequest<LoyaltyClubReportDto>;

public sealed record LoyaltyClubReportDto(
    string PeriodLabelFa,
    decimal MemberSalesSharePercent,
    decimal MemberAverageTicketRials,
    decimal MemberAverageTicketPercentOfGuest,
    decimal MemberReturningRatePercent,
    decimal GuestReturningRatePercent,
    IReadOnlyList<LoyaltyRetentionMonthDto> RetentionByMonth,
    int SmsSentCount,
    int SmsAttributedOrderCount,
    decimal SmsAttributedRevenueRials,
    decimal SmsConversionRatePercent,
    decimal? SmsConversionChangePercentagePoints,
    IReadOnlyList<LoyaltyAtRiskCustomerDto> AtRiskCustomers,
    IReadOnlyList<LoyaltyPeakHourDto> PeakHours);

public sealed record LoyaltyRetentionMonthDto(string MonthLabel, decimal ReturningRatePercent, int ActiveMemberCount);
public sealed record LoyaltyAtRiskCustomerDto(Guid Id, string Name, string LastVisitShamsi, int DaysSinceLastVisit, int ExpectedReturnIntervalDays);
public sealed record LoyaltyPeakHourDto(int Hour, int OrderCount, int MemberOrderCount, int GuestOrderCount, decimal PercentOfPeak);

public sealed class GetLoyaltyClubReportHandler(IApplicationDbContext db)
    : IRequestHandler<GetLoyaltyClubReportQuery, LoyaltyClubReportDto>
{
    private static readonly int[] PeakHourBuckets = [8, 10, 12, 14, 16, 18, 20, 22];
    private static readonly string[] PersianMonthNames = [
        "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
        "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
    ];

    public async Task<LoyaltyClubReportDto> Handle(GetLoyaltyClubReportQuery request, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var (from, to, periodLabel) = ResolvePeriod(request, now);
        var comparison = ResolveComparison(request.Comparison, from, to);
        var retentionStarts = GetRetentionMonthStarts(now);
        var queryFrom = new[] { from, retentionStarts[^1], now.AddDays(-365) }
            .Concat(comparison is null ? [] : [comparison.Value.From])
            .Min();

        var orders = await db.Orders.AsNoTracking()
            .Where(o => o.Status == OrderStatus.Paid && o.PaidAt != null && o.PaidAt >= queryFrom && o.PaidAt <= now)
            .Select(o => new PaidOrderRow(o.CustomerId, o.CustomerPhone, o.GrandTotal, o.PaidAt!.Value))
            .ToListAsync(cancellationToken);
        var orderRows = orders.ToArray();

        var firstMemberVisits = await GetFirstMemberVisitsAsync(cancellationToken);
        var periodOrders = orderRows.Where(o => o.PaidAt >= from && o.PaidAt <= to).ToArray();
        var sales = CalculateSales(periodOrders, from, firstMemberVisits,
            await GetFirstGuestVisitsAsync(periodOrders, cancellationToken));
        var comparisonOrders = comparison is null ? [] : orderRows
            .Where(o => o.PaidAt >= comparison.Value.From && o.PaidAt <= comparison.Value.To).ToArray();
        var comparisonSales = comparison is null
            ? null
            : CalculateSales(comparisonOrders, comparison.Value.From, firstMemberVisits,
                await GetFirstGuestVisitsAsync(comparisonOrders, cancellationToken));

        var retention = BuildRetention(orderRows, retentionStarts, firstMemberVisits, now);
        var settings = await db.StoreSettings.AsNoTracking().FirstOrDefaultAsync(cancellationToken);
        var sms = await GetSmsEffectivenessAsync(from, to, orderRows, cancellationToken);
        var comparisonSms = comparison is null ? null
            : await GetSmsEffectivenessAsync(comparison.Value.From, comparison.Value.To, orderRows, cancellationToken);
        var atRisk = await GetAtRiskCustomersAsync(orderRows, settings?.LapsedCustomerDays ?? 30, now, cancellationToken);
        var peakHours = BuildPeakHours(periodOrders);

        return new LoyaltyClubReportDto(
            periodLabel,
            sales.MemberSalesSharePercent,
            sales.MemberAverageTicketRials,
            sales.GuestAverageTicketRials == 0
                ? (sales.MemberAverageTicketRials > 0 ? 100 : 0)
                : decimal.Round(sales.MemberAverageTicketRials / sales.GuestAverageTicketRials * 100m, 1),
            sales.MemberReturningRatePercent,
            sales.GuestReturningRatePercent,
            retention,
            sms.SentCount,
            sms.AttributedOrderCount,
            sms.AttributedRevenueRials,
            sms.ConversionRatePercent,
            comparisonSales is null || comparisonSms is null ? null : decimal.Round(sms.ConversionRatePercent - comparisonSms.ConversionRatePercent,
                1, MidpointRounding.AwayFromZero),
            atRisk,
            peakHours);
    }

    private static (DateTime From, DateTime To, string Label) ResolvePeriod(GetLoyaltyClubReportQuery request, DateTime now)
    {
        var from = request.Period switch
        {
            LoyaltyClubReportPeriod.Last30Days => now.AddDays(-30),
            LoyaltyClubReportPeriod.ThisMonth => PersianDateTime.StartOfJalaliMonthUtc(now),
            LoyaltyClubReportPeriod.Last3Months => now.AddMonths(-3),
            LoyaltyClubReportPeriod.CustomRange when request.FromUtc.HasValue && request.ToUtc.HasValue =>
                NormalizeUtc(request.FromUtc.Value) <= NormalizeUtc(request.ToUtc.Value)
                    ? NormalizeUtc(request.FromUtc.Value)
                    : throw new DomainException("تاریخ شروع بازه نمی‌تواند بعد از تاریخ پایان باشد."),
            LoyaltyClubReportPeriod.CustomRange => throw new DomainException("برای بازه دلخواه، تاریخ شروع و پایان را ارسال کنید."),
            _ => throw new DomainException("بازه گزارش معتبر نیست.")
        };
        var to = request.Period == LoyaltyClubReportPeriod.CustomRange ? NormalizeUtc(request.ToUtc!.Value) : now;
        if (to > now)
            throw new DomainException("پایان بازه گزارش نمی‌تواند در آینده باشد.");
        if (to - from > TimeSpan.FromDays(366))
            throw new DomainException("بازه گزارش نمی‌تواند بیشتر از ۳۶۶ روز باشد.");
        var label = request.Period switch
        {
            LoyaltyClubReportPeriod.Last30Days => "۳۰ روز اخیر",
            LoyaltyClubReportPeriod.ThisMonth => "ماه جاری",
            LoyaltyClubReportPeriod.Last3Months => "سه ماه اخیر",
            _ => $"{PersianDateTime.ToShamsi(from)} تا {PersianDateTime.ToShamsi(to)}"
        };
        return (from, to, label);
    }

    private static (DateTime From, DateTime To)? ResolveComparison(LoyaltyClubReportComparison comparison, DateTime from, DateTime to)
    {
        var duration = to - from;
        return comparison switch
        {
            LoyaltyClubReportComparison.PreviousPeriod => (from - duration, from.AddTicks(-1)),
            LoyaltyClubReportComparison.PreviousYear => (from.AddYears(-1), to.AddYears(-1)),
            LoyaltyClubReportComparison.None => null,
            _ => throw new DomainException("نوع مقایسه گزارش معتبر نیست.")
        };
    }

    private async Task<Dictionary<Guid, DateTime>> GetFirstMemberVisitsAsync(CancellationToken ct) =>
        await db.Orders.AsNoTracking()
            .Where(o => o.Status == OrderStatus.Paid && o.CustomerId != null && o.PaidAt != null)
            .GroupBy(o => o.CustomerId!.Value)
            .Select(g => new { CustomerId = g.Key, FirstVisit = g.Min(o => o.PaidAt!.Value) })
            .ToDictionaryAsync(x => x.CustomerId, x => x.FirstVisit, ct);

    private async Task<Dictionary<string, DateTime>> GetFirstGuestVisitsAsync(PaidOrderRow[] currentOrders, CancellationToken ct)
    {
        var phones = currentOrders.Where(o => o.CustomerId is null && !string.IsNullOrWhiteSpace(o.CustomerPhone))
            .Select(o => o.CustomerPhone!.Trim()).Distinct().ToArray();
        if (phones.Length == 0) return [];
        var firstRows = await db.Orders.AsNoTracking()
            .Where(o => o.Status == OrderStatus.Paid && o.CustomerId == null && o.CustomerPhone != null
                        && phones.Contains(o.CustomerPhone.Trim()) && o.PaidAt != null)
            .GroupBy(o => o.CustomerPhone!.Trim())
            .Select(g => new { Phone = g.Key, FirstVisit = g.Min(o => o.PaidAt!.Value) })
            .ToListAsync(ct);
        return firstRows.ToDictionary(x => x.Phone, x => x.FirstVisit, StringComparer.Ordinal);
    }

    private static SalesMetrics CalculateSales(PaidOrderRow[] orders, DateTime periodStart,
        IReadOnlyDictionary<Guid, DateTime> firstMemberVisits, IReadOnlyDictionary<string, DateTime> firstGuestVisits)
    {
        var members = orders.Where(o => o.CustomerId.HasValue).ToArray();
        var guests = orders.Where(o => !o.CustomerId.HasValue).ToArray();
        var memberSales = members.Sum(o => o.Total);
        var guestSales = guests.Sum(o => o.Total);
        var totalSales = memberSales + guestSales;
        var memberVisitCounts = members.GroupBy(o => o.CustomerId!.Value).ToDictionary(g => g.Key, g => g.Count());
        var returningMembers = memberVisitCounts.Count(x => x.Value > 1 ||
            (firstMemberVisits.TryGetValue(x.Key, out var firstVisit) && firstVisit < periodStart));
        var guestVisitCounts = guests.Where(o => !string.IsNullOrWhiteSpace(o.CustomerPhone))
            .GroupBy(o => o.CustomerPhone!.Trim(), StringComparer.Ordinal).ToDictionary(g => g.Key, g => g.Count(), StringComparer.Ordinal);
        var returningGuests = guestVisitCounts.Count(x => x.Value > 1 ||
            (firstGuestVisits.TryGetValue(x.Key, out var firstVisit) && firstVisit < periodStart));
        return new SalesMetrics(
            totalSales == 0 ? 0 : decimal.Round(memberSales / totalSales * 100m, 1),
            members.Length == 0 ? 0 : memberSales / members.Length,
            guests.Length == 0 ? 0 : guestSales / guests.Length,
            memberVisitCounts.Count == 0 ? 0 : decimal.Round(returningMembers / (decimal)memberVisitCounts.Count * 100m, 1),
            guestVisitCounts.Count == 0 ? 0 : decimal.Round(returningGuests / (decimal)guestVisitCounts.Count * 100m, 1));
    }

    private static IReadOnlyList<LoyaltyRetentionMonthDto> BuildRetention(PaidOrderRow[] orders,
        IReadOnlyList<DateTime> monthStarts, IReadOnlyDictionary<Guid, DateTime> firstVisits, DateTime now)
    {
        var calendar = new PersianCalendar();
        return monthStarts.OrderBy(x => x).Select(start =>
        {
            var end = PersianDateTime.EndOfJalaliMonthUtc(start);
            if (end > now) end = now;
            var active = orders.Where(o => o.CustomerId.HasValue && o.PaidAt >= start && o.PaidAt <= end)
                .Select(o => o.CustomerId!.Value).Distinct().ToArray();
            var returning = active.Count(id => firstVisits.TryGetValue(id, out var first) && first < start);
            var localStart = PersianDateTime.ToLocal(start);
            var monthName = PersianMonthNames[calendar.GetMonth(localStart) - 1];
            return new LoyaltyRetentionMonthDto(monthName,
                active.Length == 0 ? 0 : decimal.Round(returning / (decimal)active.Length * 100m, 1), active.Length);
        }).ToArray();
    }

    private async Task<SmsMetrics> GetSmsEffectivenessAsync(DateTime from, DateTime to,
        IReadOnlyList<PaidOrderRow> reportOrders, CancellationToken ct)
    {
        var messages = await db.LoyaltySmsMessages.AsNoTracking()
            .Where(m => !m.IsTransactional && m.SentAtUtc != null && m.SentAtUtc >= from && m.SentAtUtc <= to)
            .Select(m => new SmsMessageRow(m.Id, m.CustomerId, m.SentAtUtc!.Value, m.Campaign.AttributionWindowDays))
            .ToListAsync(ct);
        if (messages.Count == 0) return new SmsMetrics(0, 0, 0, 0);

        var recipients = messages.Select(x => x.CustomerId).Distinct().ToHashSet();
        var candidates = reportOrders.Where(o => o.CustomerId.HasValue && recipients.Contains(o.CustomerId.Value)).ToArray();
        var byCustomer = messages.GroupBy(x => x.CustomerId).ToDictionary(g => g.Key,
            g => g.OrderBy(x => x.SentAtUtc).ToArray());
        var convertedMessages = new HashSet<Guid>();
        var attributedOrders = 0;
        decimal attributedRevenue = 0;
        foreach (var order in candidates)
        {
            var attribution = byCustomer[order.CustomerId!.Value]
                .Where(m => m.SentAtUtc <= order.PaidAt && order.PaidAt <= m.SentAtUtc.AddDays(m.AttributionWindowDays))
                .OrderByDescending(m => m.SentAtUtc).FirstOrDefault();
            if (attribution is null) continue;
            convertedMessages.Add(attribution.Id);
            attributedOrders++;
            attributedRevenue += order.Total;
        }
        var rate = decimal.Round(convertedMessages.Count / (decimal)messages.Count * 100m, 1);
        return new SmsMetrics(messages.Count, attributedOrders, attributedRevenue, rate);
    }

    private async Task<IReadOnlyList<LoyaltyAtRiskCustomerDto>> GetAtRiskCustomersAsync(
        IReadOnlyList<PaidOrderRow> orders, int defaultLapsedDays, DateTime now, CancellationToken ct)
    {
        var customers = await db.Customers.AsNoTracking().Where(c => c.VisitCount > 0)
            .Select(c => new { c.Id, c.FullName, c.LastVisitAt })
            .ToListAsync(ct);
        var recentOrders = orders.Where(o => o.CustomerId.HasValue && o.PaidAt >= now.AddDays(-365))
            .GroupBy(o => o.CustomerId!.Value).ToDictionary(g => g.Key, g => g.Select(x => x.PaidAt).Order().ToArray());
        return customers.Select(customer =>
            {
                var dates = recentOrders.GetValueOrDefault(customer.Id) ?? [];
                var intervals = dates.Zip(dates.Skip(1), (left, right) => (right - left).TotalDays).Where(x => x > 0).ToArray();
                var usualInterval = intervals.Length == 0 ? defaultLapsedDays : (int)Math.Ceiling(intervals.Average());
                var riskThreshold = Math.Max(defaultLapsedDays, (int)Math.Ceiling(usualInterval * 1.5));
                var daysAway = Math.Max(0, (int)(now - customer.LastVisitAt).TotalDays);
                return new { Customer = customer, UsualInterval = usualInterval, RiskThreshold = riskThreshold, DaysAway = daysAway };
            })
            .Where(x => x.DaysAway >= x.RiskThreshold)
            .OrderByDescending(x => x.DaysAway - x.RiskThreshold).Take(10)
            .Select(x => new LoyaltyAtRiskCustomerDto(x.Customer.Id,
                string.IsNullOrWhiteSpace(x.Customer.FullName) ? "مشتری بدون نام" : x.Customer.FullName,
                PersianDateTime.ToShamsiDateTime(x.Customer.LastVisitAt), x.DaysAway, x.UsualInterval))
            .ToArray();
    }

    private static IReadOnlyList<LoyaltyPeakHourDto> BuildPeakHours(IEnumerable<PaidOrderRow> orders)
    {
        var counts = PeakHourBuckets.ToDictionary(x => x, _ => (Members: 0, Guests: 0));
        foreach (var order in orders)
        {
            var localHour = PersianDateTime.GetHour(order.PaidAt);
            var bucket = PeakHourBuckets.MinBy(hour => Math.Abs(hour - localHour));
            var count = counts[bucket];
            counts[bucket] = order.CustomerId.HasValue ? (count.Members + 1, count.Guests) : (count.Members, count.Guests + 1);
        }
        var max = Math.Max(1, counts.Values.Max(x => x.Members + x.Guests));
        return PeakHourBuckets.Select(hour =>
        {
            var count = counts[hour];
            var total = count.Members + count.Guests;
            return new LoyaltyPeakHourDto(hour, total, count.Members, count.Guests,
                decimal.Round(total / (decimal)max * 100m, 1));
        }).ToArray();
    }

    private static IReadOnlyList<DateTime> GetRetentionMonthStarts(DateTime now)
    {
        var starts = new List<DateTime>(6) { PersianDateTime.StartOfJalaliMonthUtc(now) };
        while (starts.Count < 6) starts.Add(PersianDateTime.StartOfPreviousJalaliMonthUtc(starts[^1]));
        return starts;
    }

    private static DateTime NormalizeUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
    };

    private sealed record PaidOrderRow(Guid? CustomerId, string? CustomerPhone, decimal Total, DateTime PaidAt);
    private sealed record SalesMetrics(decimal MemberSalesSharePercent, decimal MemberAverageTicketRials,
        decimal GuestAverageTicketRials, decimal MemberReturningRatePercent, decimal GuestReturningRatePercent);
    private sealed record SmsMessageRow(Guid Id, Guid CustomerId, DateTime SentAtUtc, int AttributionWindowDays);
    private sealed record SmsMetrics(int SentCount, int AttributedOrderCount, decimal AttributedRevenueRials, decimal ConversionRatePercent);
}
