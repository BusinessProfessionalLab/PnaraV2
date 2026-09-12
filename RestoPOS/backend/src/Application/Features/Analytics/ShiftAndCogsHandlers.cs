using MediatR;
using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Enums;

namespace RestoPOS.Application.Features.Analytics;

public sealed class GetShiftSummaryReportsQueryHandler(IApplicationDbContext db, IIdentityService identity)
    : IRequestHandler<GetShiftSummaryReportsQuery, IReadOnlyList<ShiftSummaryReportDto>>
{
    public async Task<IReadOnlyList<ShiftSummaryReportDto>> Handle(GetShiftSummaryReportsQuery request, CancellationToken cancellationToken)
    {
        var period = TimePeriodHelper.Resolve(request.Preset, request.FromUtc, request.ToUtc);

        var shiftsQuery = db.CashierShifts.AsNoTracking()
            .Where(s => s.OpenedAt >= period.FromUtc && s.OpenedAt <= period.ToUtc);
        if (request.CashierId is Guid cashierId)
            shiftsQuery = shiftsQuery.Where(s => s.StaffId == cashierId);

        var shifts = await shiftsQuery.OrderByDescending(s => s.OpenedAt).ToListAsync(cancellationToken);
        if (shifts.Count == 0)
            return [];

        var shiftIds = shifts.Select(s => s.Id).ToList();
        var paidOrders = await db.Orders.AsNoTracking()
            .Where(o => o.Status == OrderStatus.Paid && o.ShiftId != null && shiftIds.Contains(o.ShiftId.Value))
            .Select(o => new
            {
                ShiftId = o.ShiftId!.Value,
                o.Subtotal,
                o.ModifiersTotal,
                o.DiscountAmount,
                o.GrandTotal,
                Payments = o.Payments
                    .Where(p => p.Status == PaymentStatus.Settled)
                    .Select(p => new { p.Channel, p.Amount })
            })
            .ToListAsync(cancellationToken);

        var ordersByShift = paidOrders.GroupBy(o => o.ShiftId).ToDictionary(g => g.Key, g => g.ToList());
        var result = new List<ShiftSummaryReportDto>();

        foreach (var shift in shifts)
        {
            ordersByShift.TryGetValue(shift.Id, out var orders);
            orders ??= [];

            var gross = orders.Sum(o => o.Subtotal + o.ModifiersTotal);
            var net = orders.Sum(o => o.Subtotal + o.ModifiersTotal - o.DiscountAmount);
            var paymentGroups = orders.SelectMany(o => o.Payments)
                .GroupBy(p => ReportMoney.ToReportMethod(p.Channel))
                .Select(g => new ShiftPaymentBreakdownDto(
                    g.Key,
                    ReportMoney.MethodLabelFa(g.Key),
                    MoneyAmountDto.FromRials(g.Sum(x => x.Amount)),
                    g.Count()))
                .OrderByDescending(p => p.Amount.Rials)
                .ToList();

            MoneyAmountDto? variance = null;
            if (shift.ClosingCash is not null && shift.ExpectedCash is not null)
                variance = MoneyAmountDto.FromRials(shift.ClosingCash.Value - shift.ExpectedCash.Value);

            var name = await identity.GetStaffDisplayNameAsync(shift.StaffId, cancellationToken)
                       ?? shift.StaffId.ToString();

            result.Add(new ShiftSummaryReportDto(
                shift.Id,
                shift.StaffId,
                name,
                shift.OpenedAt,
                shift.ClosedAt,
                shift.Status,
                MoneyAmountDto.FromRials(shift.OpeningCash),
                shift.ClosingCash is null ? null : MoneyAmountDto.FromRials(shift.ClosingCash.Value),
                shift.ExpectedCash is null ? null : MoneyAmountDto.FromRials(shift.ExpectedCash.Value),
                variance,
                MoneyAmountDto.FromRials(gross),
                MoneyAmountDto.FromRials(net),
                orders.Count,
                paymentGroups,
                shift.Notes));
        }

        return result;
    }
}

public sealed class GetProfitMarginReportQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetProfitMarginReportQuery, ProfitMarginReportDto>
{
    public async Task<ProfitMarginReportDto> Handle(GetProfitMarginReportQuery request, CancellationToken cancellationToken)
    {
        var period = TimePeriodHelper.Resolve(request.Preset, request.FromUtc, request.ToUtc);
        var (menuCogs, modifierCogs) = await AnalyticsScope.BuildAllRecipeUnitCostsAsync(db, cancellationToken);

        var items = await AnalyticsScope.PaidOrders(db, period.FromUtc, period.ToUtc)
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

        var lines = items
            .GroupBy(i => new { i.MenuItemId, i.Title, i.CategoryId, i.CategoryName })
            .Select(g =>
            {
                var qty = g.Sum(x => x.Quantity);
                var revenue = g.Sum(x => x.LineTotal);
                menuCogs.TryGetValue(g.Key.MenuItemId, out var unit);
                var cogs = unit * qty;
                foreach (var line in g)
                {
                    foreach (var mod in line.Modifiers)
                    {
                        modifierCogs.TryGetValue(mod.MenuItemModifierId, out var modUnit);
                        cogs += modUnit * mod.Quantity * line.Quantity;
                    }
                }

                cogs = decimal.Round(cogs, 0, MidpointRounding.AwayFromZero);
                var profit = revenue - cogs;
                var margin = revenue <= 0 ? 0 : decimal.Round(profit / revenue * 100m, 2, MidpointRounding.AwayFromZero);
                return new ProfitMarginLineDto(
                    g.Key.MenuItemId,
                    g.Key.Title,
                    g.Key.CategoryId,
                    g.Key.CategoryName,
                    qty,
                    MoneyAmountDto.FromRials(revenue),
                    MoneyAmountDto.FromRials(cogs),
                    MoneyAmountDto.FromRials(profit),
                    margin);
            })
            .OrderByDescending(l => l.GrossProfit.Rials)
            .ToList();

        var totalRevenue = lines.Sum(l => l.Revenue.Rials);
        var totalCogs = lines.Sum(l => l.Cogs.Rials);
        var grossProfit = totalRevenue - totalCogs;
        var overallMargin = totalRevenue <= 0
            ? 0
            : decimal.Round(grossProfit / totalRevenue * 100m, 2, MidpointRounding.AwayFromZero);

        return new ProfitMarginReportDto(
            period.LabelFa,
            period.FromUtc,
            period.ToUtc,
            MoneyAmountDto.FromRials(totalRevenue),
            MoneyAmountDto.FromRials(totalCogs),
            MoneyAmountDto.FromRials(grossProfit),
            overallMargin,
            lines);
    }
}
