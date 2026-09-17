using MediatR;
using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Enums;

namespace RestoPOS.Application.Features.Analytics;

public sealed class GetPaymentBreakdownQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetPaymentBreakdownQuery, PaymentBreakdownReportDto>
{
    public async Task<PaymentBreakdownReportDto> Handle(GetPaymentBreakdownQuery request, CancellationToken cancellationToken)
    {
        var period = TimePeriodHelper.Resolve(request.Preset, request.FromUtc, request.ToUtc);
        var rows = await AnalyticsScope.SettledPayments(db, period.FromUtc, period.ToUtc)
            .GroupBy(p => p.Channel)
            .Select(g => new { Channel = g.Key, Count = g.Count(), Amount = g.Sum(x => x.Amount) })
            .ToListAsync(cancellationToken);

        var byMethod = rows
            .GroupBy(r => ReportMoney.ToReportMethod(r.Channel))
            .Select(g => new { Method = g.Key, Count = g.Sum(x => x.Count), Amount = g.Sum(x => x.Amount) })
            .ToDictionary(x => x.Method, x => x);

        var totalAmount = byMethod.Values.Sum(x => x.Amount);
        var totalCount = byMethod.Values.Sum(x => x.Count);

        var methods = Enum.GetValues<ReportPaymentMethod>()
            .Select(method =>
            {
                byMethod.TryGetValue(method, out var row);
                var amount = row?.Amount ?? 0;
                var count = row?.Count ?? 0;
                var share = totalAmount <= 0 ? 0 : decimal.Round(amount / totalAmount * 100m, 2, MidpointRounding.AwayFromZero);
                return new PaymentMethodShareDto(
                    method,
                    ReportMoney.MethodLabelFa(method),
                    count,
                    MoneyAmountDto.FromRials(amount),
                    share);
            })
            .OrderByDescending(m => m.Amount.Rials)
            .ToList();

        return new PaymentBreakdownReportDto(
            period.LabelFa,
            period.FromUtc,
            period.ToUtc,
            MoneyAmountDto.FromRials(totalAmount),
            totalCount,
            methods);
    }
}

public sealed class GetTerminalReportsQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetTerminalReportsQuery, IReadOnlyList<TerminalReconciliationDto>>
{
    public async Task<IReadOnlyList<TerminalReconciliationDto>> Handle(GetTerminalReportsQuery request, CancellationToken cancellationToken)
    {
        var period = TimePeriodHelper.Resolve(request.Preset, request.FromUtc, request.ToUtc);
        var rows = await AnalyticsScope.SettledPayments(db, period.FromUtc, period.ToUtc)
            .Where(p => p.Channel == PaymentChannel.LocalPC_POS || p.Channel == PaymentChannel.OnlineGateway)
            .GroupBy(p => new { p.TerminalId, p.Psp })
            .Select(g => new
            {
                g.Key.TerminalId,
                g.Key.Psp,
                Count = g.Count(),
                Amount = g.Sum(x => x.Amount)
            })
            .OrderByDescending(x => x.Amount)
            .ToListAsync(cancellationToken);

        return rows.Select(r =>
        {
            var avg = r.Count == 0 ? 0 : r.Amount / r.Count;
            return new TerminalReconciliationDto(
                string.IsNullOrWhiteSpace(r.TerminalId) ? null : r.TerminalId,
                r.Psp,
                AnalyticsScope.PspLabel(r.Psp),
                r.Count,
                MoneyAmountDto.FromRials(r.Amount),
                MoneyAmountDto.FromRials(avg));
        }).ToList();
    }
}

public sealed class GetMenuItemPerformanceQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetMenuItemPerformanceQuery, MenuItemPerformanceReportDto>
{
    public async Task<MenuItemPerformanceReportDto> Handle(GetMenuItemPerformanceQuery request, CancellationToken cancellationToken)
    {
        var period = TimePeriodHelper.Resolve(request.Preset, request.FromUtc, request.ToUtc);
        var topCount = Math.Clamp(request.TopCount, 1, 100);
        var (menuCogs, modifierCogs) = await AnalyticsScope.BuildAllRecipeUnitCostsAsync(db, cancellationToken);

        var itemRows = await AnalyticsScope.PaidOrders(db, period.FromUtc, period.ToUtc)
            .SelectMany(o => o.Items)
            .Select(i => new
            {
                i.MenuItemId,
                i.Title,
                CategoryId = i.MenuItem!.CategoryId,
                CategoryName = i.MenuItem.Category.Name,
                i.Quantity,
                i.LineTotal,
                Modifiers = i.Modifiers.Select(m => new { m.MenuItemModifierId, m.Quantity })
            })
            .ToListAsync(cancellationToken);

        var aggregated = itemRows
            .GroupBy(i => new { i.MenuItemId, i.Title, i.CategoryId, i.CategoryName })
            .Select(g =>
            {
                var qty = g.Sum(x => x.Quantity);
                var revenue = g.Sum(x => x.LineTotal);
                menuCogs.TryGetValue(g.Key.MenuItemId, out var unitCogs);
                var cogs = unitCogs * qty;
                foreach (var line in g)
                {
                    foreach (var mod in line.Modifiers)
                    {
                        if (mod.MenuItemModifierId is { } modifierId && modifierCogs.TryGetValue(modifierId, out var modUnit))
                            cogs += modUnit * mod.Quantity * line.Quantity;
                    }
                }

                cogs = decimal.Round(cogs, 0, MidpointRounding.AwayFromZero);
                var profit = revenue - cogs;
                var margin = revenue <= 0 ? 0 : decimal.Round(profit / revenue * 100m, 2, MidpointRounding.AwayFromZero);
                return new
                {
                    g.Key.MenuItemId,
                    g.Key.Title,
                    g.Key.CategoryId,
                    g.Key.CategoryName,
                    Qty = qty,
                    Revenue = revenue,
                    Cogs = cogs,
                    Profit = profit,
                    Margin = margin
                };
            })
            .OrderByDescending(x => x.Revenue)
            .ToList();

        var max = aggregated.Count == 0 ? 0 : aggregated[0].Revenue;
        var all = aggregated.Select((r, index) =>
        {
            var ratio = max == 0 ? 0 : r.Revenue / max;
            var band = ratio >= 0.6m ? "Star" : ratio <= 0.15m ? "Underperforming" : "Core";
            return new MenuItemPerformanceRowDto(
                index + 1,
                r.MenuItemId,
                r.Title,
                r.CategoryId,
                r.CategoryName,
                r.Qty,
                MoneyAmountDto.FromRials(r.Revenue),
                MoneyAmountDto.FromRials(r.Cogs),
                MoneyAmountDto.FromRials(r.Profit),
                r.Margin,
                band);
        }).ToList();

        var top = all.Take(topCount).ToList();
        var lowest = all.OrderBy(x => x.Revenue.Rials).ThenBy(x => x.Quantity).Take(topCount)
            .Select((r, i) => r with { Rank = i + 1 })
            .ToList();

        return new MenuItemPerformanceReportDto(period.LabelFa, period.FromUtc, period.ToUtc, top, lowest, all);
    }
}

public sealed class GetCategorySalesQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetCategorySalesQuery, IReadOnlyList<CategorySalesDetailDto>>
{
    public async Task<IReadOnlyList<CategorySalesDetailDto>> Handle(GetCategorySalesQuery request, CancellationToken cancellationToken)
    {
        var period = TimePeriodHelper.Resolve(request.Preset, request.FromUtc, request.ToUtc);
        var lines = await AnalyticsScope.PaidOrders(db, period.FromUtc, period.ToUtc)
            .SelectMany(o => o.Items)
            .Select(i => new
            {
                i.MenuItemId,
                i.Title,
                CategoryId = i.MenuItem!.CategoryId,
                CategoryName = i.MenuItem.Category.Name,
                i.Quantity,
                i.LineTotal
            })
            .ToListAsync(cancellationToken);

        var grand = lines.Sum(l => l.LineTotal);
        return lines
            .GroupBy(l => new { l.CategoryId, l.CategoryName })
            .Select(g =>
            {
                var catRevenue = g.Sum(x => x.LineTotal);
                var catQty = g.Sum(x => x.Quantity);
                var share = grand <= 0 ? 0 : decimal.Round(catRevenue / grand * 100m, 2, MidpointRounding.AwayFromZero);
                var items = g.GroupBy(x => new { x.MenuItemId, x.Title })
                    .Select(ig =>
                    {
                        var rev = ig.Sum(x => x.LineTotal);
                        var itemShare = catRevenue <= 0 ? 0 : decimal.Round(rev / catRevenue * 100m, 2, MidpointRounding.AwayFromZero);
                        return new CategorySalesItemDto(
                            ig.Key.MenuItemId,
                            ig.Key.Title,
                            ig.Sum(x => x.Quantity),
                            MoneyAmountDto.FromRials(rev),
                            itemShare);
                    })
                    .OrderByDescending(i => i.Revenue.Rials)
                    .ToList();

                return new CategorySalesDetailDto(
                    g.Key.CategoryId,
                    g.Key.CategoryName,
                    catQty,
                    MoneyAmountDto.FromRials(catRevenue),
                    share,
                    items);
            })
            .OrderByDescending(c => c.Revenue.Rials)
            .ToList();
    }
}
