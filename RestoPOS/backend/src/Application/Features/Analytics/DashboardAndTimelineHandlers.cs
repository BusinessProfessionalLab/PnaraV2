using MediatR;
using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Services;

namespace RestoPOS.Application.Features.Analytics;

public sealed class GetDashboardSummaryQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetDashboardSummaryQuery, DashboardSummaryDto>
{
    public async Task<DashboardSummaryDto> Handle(GetDashboardSummaryQuery request, CancellationToken cancellationToken)
    {
        var period = TimePeriodHelper.Resolve(request.Preset, request.FromUtc, request.ToUtc);
        var current = await AggregateAsync(db, period.FromUtc, period.ToUtc, cancellationToken);
        var previous = await AggregateAsync(db, period.ComparisonFromUtc, period.ComparisonToUtc, cancellationToken);

        var comparison = new PeriodComparisonDto(
            TimePeriodHelper.PercentChange(current.Gross, previous.Gross),
            TimePeriodHelper.PercentChange(current.Net, previous.Net),
            TimePeriodHelper.PercentChange(current.PaidCount, previous.PaidCount),
            TimePeriodHelper.PercentChange(current.AvgTicket, previous.AvgTicket),
            TimePeriodHelper.PercentChange(current.Vat, previous.Vat),
            TimePeriodHelper.PercentChange(current.Discounts, previous.Discounts));

        return new DashboardSummaryDto(
            period.LabelFa,
            period.FromUtc,
            period.ToUtc,
            period.ComparisonFromUtc,
            period.ComparisonToUtc,
            MoneyAmountDto.FromRials(current.Gross),
            MoneyAmountDto.FromRials(current.Net),
            MoneyAmountDto.FromRials(current.Discounts),
            MoneyAmountDto.FromRials(current.Vat),
            MoneyAmountDto.FromRials(current.AvgTicket),
            current.TotalOrders,
            current.PaidCount,
            current.PendingCount,
            current.CancelledCount,
            comparison);
    }

    private static async Task<Agg> AggregateAsync(
        IApplicationDbContext db, DateTime from, DateTime to, CancellationToken ct)
    {
        var paid = await AnalyticsScope.PaidOrders(db, from, to)
            .Select(o => new
            {
                o.DiscountAmount,
                o.TaxAmount,
                o.GrandTotal
            })
            .ToListAsync(ct);

        var discounts = paid.Sum(o => o.DiscountAmount);
        var vat = paid.Sum(o => o.TaxAmount);
        var net = (await AnalyticsScope.SettledPayments(db, from, to)
            .Select(p => p.Amount)
            .ToListAsync(ct))
            .Sum();
        var gross = net - vat;
        var paidCount = paid.Count;
        var avg = paidCount == 0 ? 0 : paid.Sum(o => o.GrandTotal) / paidCount;

        var totalOrders = await AnalyticsScope.OrdersCreated(db, from, to).CountAsync(ct);
        var pending = await db.Orders.AsNoTracking()
            .CountAsync(o =>
                (o.Status == OrderStatus.Submitted || o.Status == OrderStatus.InPreparation || o.Status == OrderStatus.Ready) &&
                o.CreatedAt >= from && o.CreatedAt <= to, ct);
        var cancelled = await db.Orders.AsNoTracking()
            .CountAsync(o => o.Status == OrderStatus.Cancelled && o.CancelledAt != null && o.CancelledAt >= from && o.CancelledAt <= to, ct);

        return new Agg(gross, net, discounts, vat, avg, totalOrders, paidCount, pending, cancelled);
    }

    private sealed record Agg(
        decimal Gross, decimal Net, decimal Discounts, decimal Vat, decimal AvgTicket,
        int TotalOrders, int PaidCount, int PendingCount, int CancelledCount);
}

public sealed class GetSalesTimelineQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetSalesTimelineQuery, SalesTimelineDto>
{
    public async Task<SalesTimelineDto> Handle(GetSalesTimelineQuery request, CancellationToken cancellationToken)
    {
        var period = TimePeriodHelper.Resolve(request.Preset, request.FromUtc, request.ToUtc);
        var currentOrders = await AnalyticsScope.PaidOrders(db, period.FromUtc, period.ToUtc)
            .Select(o => new { PaidAt = o.PaidAt!.Value, o.TaxAmount })
            .ToListAsync(cancellationToken);

        var currentPayments = await AnalyticsScope.SettledPayments(db, period.FromUtc, period.ToUtc)
            .Select(p => new { PaidAt = p.PaidAt!.Value, p.Amount })
            .ToListAsync(cancellationToken);

        var previousPayments = await AnalyticsScope.SettledPayments(db, period.ComparisonFromUtc, period.ComparisonToUtc)
            .Select(p => new { PaidAt = p.PaidAt!.Value, p.Amount })
            .ToListAsync(cancellationToken);

        var orderBuckets = currentOrders
            .GroupBy(o => AnalyticsScope.BucketKey(o.PaidAt, request.Interval))
            .ToDictionary(g => g.Key, g => (Vat: g.Sum(x => x.TaxAmount), Count: g.Count()));

        var paymentBuckets = currentPayments
            .GroupBy(p => AnalyticsScope.BucketKey(p.PaidAt, request.Interval))
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));

        var duration = period.ToUtc - period.FromUtc;
        var previousBuckets = previousPayments
            .GroupBy(o => AnalyticsScope.BucketKey(o.PaidAt, request.Interval))
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));

        var points = new List<SalesTimelinePointDto>();
        foreach (var bucket in AnalyticsScope.EnumerateBuckets(period.FromUtc, period.ToUtc, request.Interval))
        {
            orderBuckets.TryGetValue(bucket, out var curOrders);
            paymentBuckets.TryGetValue(bucket, out var netSales);
            var previousBucket = bucket - duration;
            previousBuckets.TryGetValue(AnalyticsScope.AlignBucketStart(previousBucket, request.Interval), out var prevNet);
            // Also try exact aligned key from comparison window shift
            var shiftedKey = AnalyticsScope.BucketKey(bucket.AddTicks(-(period.ToUtc - period.FromUtc).Ticks), request.Interval);
            if (!previousBuckets.ContainsKey(AnalyticsScope.AlignBucketStart(previousBucket, request.Interval)))
                previousBuckets.TryGetValue(shiftedKey, out prevNet);

            points.Add(new SalesTimelinePointDto(
                bucket,
                AnalyticsScope.BucketLabelIso(bucket, request.Interval),
                AnalyticsScope.BucketLabel(bucket, request.Interval),
                MoneyAmountDto.FromRials(netSales),
                MoneyAmountDto.FromRials(netSales - curOrders.Vat),
                curOrders.Count,
                MoneyAmountDto.FromRials(prevNet)));
        }

        return new SalesTimelineDto(request.Interval, period.LabelFa, period.FromUtc, period.ToUtc, points);
    }
}

public sealed class GetPeakHoursHeatmapQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetPeakHoursHeatmapQuery, IReadOnlyList<HourlyHeatmapRowDto>>
{
    public async Task<IReadOnlyList<HourlyHeatmapRowDto>> Handle(GetPeakHoursHeatmapQuery request, CancellationToken cancellationToken)
    {
        var period = TimePeriodHelper.Resolve(request.Preset, request.FromUtc, request.ToUtc);
        var paidOrders = await AnalyticsScope.PaidOrders(db, period.FromUtc, period.ToUtc)
            .Select(o => new { PaidAt = o.PaidAt!.Value })
            .ToListAsync(cancellationToken);

        var payments = await AnalyticsScope.SettledPayments(db, period.FromUtc, period.ToUtc)
            .Select(p => new { PaidAt = p.PaidAt!.Value, p.Amount })
            .ToListAsync(cancellationToken);

        var orderCounts = paidOrders
            .GroupBy(o => (Day: PersianDateTime.GetDayOfWeek(o.PaidAt), Hour: PersianDateTime.GetHour(o.PaidAt)))
            .ToDictionary(g => g.Key, g => g.Count());
        var salesByHour = payments
            .GroupBy(p => (Day: PersianDateTime.GetDayOfWeek(p.PaidAt), Hour: PersianDateTime.GetHour(p.PaidAt)))
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));

        var maxSales = salesByHour.Count == 0 ? 0 : salesByHour.Values.Max();
        var rows = new List<HourlyHeatmapRowDto>(7 * 24);
        for (var dow = 0; dow <= 6; dow++)
        {
            for (var hour = 0; hour < 24; hour++)
            {
                orderCounts.TryGetValue((dow, hour), out var orderCount);
                salesByHour.TryGetValue((dow, hour), out var sales);
                var density = maxSales <= 0
                    ? 0
                    : decimal.Round(sales / maxSales, 4, MidpointRounding.AwayFromZero);
                rows.Add(new HourlyHeatmapRowDto(
                    dow,
                    AnalyticsScope.DayOfWeekFa(dow),
                    hour,
                    orderCount,
                    MoneyAmountDto.FromRials(sales),
                    density));
            }
        }

        return rows;
    }
}
