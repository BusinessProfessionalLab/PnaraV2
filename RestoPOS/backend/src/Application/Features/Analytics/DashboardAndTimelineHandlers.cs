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
                o.Subtotal,
                o.ModifiersTotal,
                o.DiscountAmount,
                o.TaxAmount,
                o.GrandTotal
            })
            .ToListAsync(ct);

        var gross = paid.Sum(o => o.Subtotal + o.ModifiersTotal);
        var discounts = paid.Sum(o => o.DiscountAmount);
        var vat = paid.Sum(o => o.TaxAmount);
        var net = gross - discounts;
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
            .Select(o => new { PaidAt = o.PaidAt!.Value, o.Subtotal, o.ModifiersTotal, o.DiscountAmount, o.GrandTotal })
            .ToListAsync(cancellationToken);

        var previousOrders = await AnalyticsScope.PaidOrders(db, period.ComparisonFromUtc, period.ComparisonToUtc)
            .Select(o => new { PaidAt = o.PaidAt!.Value, Net = o.Subtotal + o.ModifiersTotal - o.DiscountAmount })
            .ToListAsync(cancellationToken);

        var currentBuckets = currentOrders
            .GroupBy(o => AnalyticsScope.BucketKey(o.PaidAt, request.Interval))
            .ToDictionary(
                g => g.Key,
                g => (
                    Net: g.Sum(x => x.Subtotal + x.ModifiersTotal - x.DiscountAmount),
                    Gross: g.Sum(x => x.Subtotal + x.ModifiersTotal),
                    Count: g.Count()));

        var duration = period.ToUtc - period.FromUtc;
        var previousBuckets = previousOrders
            .GroupBy(o => AnalyticsScope.BucketKey(o.PaidAt, request.Interval))
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Net));

        var points = new List<SalesTimelinePointDto>();
        foreach (var bucket in AnalyticsScope.EnumerateBuckets(period.FromUtc, period.ToUtc, request.Interval))
        {
            currentBuckets.TryGetValue(bucket, out var cur);
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
                MoneyAmountDto.FromRials(cur.Net),
                MoneyAmountDto.FromRials(cur.Gross),
                cur.Count,
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
        var paid = await AnalyticsScope.PaidOrders(db, period.FromUtc, period.ToUtc)
            .Select(o => new { PaidAt = o.PaidAt!.Value, Net = o.Subtotal + o.ModifiersTotal - o.DiscountAmount })
            .ToListAsync(cancellationToken);

        var grouped = paid
            .GroupBy(o => new { Dow = PersianDateTime.GetDayOfWeek(o.PaidAt), Hour = PersianDateTime.GetHour(o.PaidAt) })
            .ToDictionary(g => (g.Key.Dow, g.Key.Hour), g => (Count: g.Count(), Net: g.Sum(x => x.Net)));

        var maxCount = grouped.Count == 0 ? 1 : Math.Max(1, grouped.Values.Max(x => x.Count));
        var rows = new List<HourlyHeatmapRowDto>(7 * 24);
        for (var dow = 0; dow <= 6; dow++)
        {
            for (var hour = 0; hour < 24; hour++)
            {
                grouped.TryGetValue((dow, hour), out var cell);
                var density = decimal.Round(cell.Count / (decimal)maxCount, 4, MidpointRounding.AwayFromZero);
                rows.Add(new HourlyHeatmapRowDto(
                    dow,
                    AnalyticsScope.DayOfWeekFa(dow),
                    hour,
                    cell.Count,
                    MoneyAmountDto.FromRials(cell.Net),
                    density));
            }
        }

        return rows;
    }
}
