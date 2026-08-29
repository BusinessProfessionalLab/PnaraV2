using MediatR;
using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Services;

namespace RestoPOS.Application.Features.Analytics;

public sealed record SalesByProductRow(Guid MenuItemId, string Title, Guid CategoryId, string CategoryName, int Quantity, decimal NetSales);
public sealed record SalesByCategoryRow(Guid CategoryId, string CategoryName, int Quantity, decimal NetSales);
public sealed record HourlySalesRow(int Hour, int OrderCount, decimal NetSales);
public sealed record ProductPerformanceRow(Guid MenuItemId, string Title, int Quantity, decimal NetSales, string Band);
public sealed record StaffPerformanceRow(Guid StaffId, string StaffName, int OrderCount, decimal NetSales, decimal AverageTicket);
public sealed record StockAlertRow(Guid InventoryItemId, string Name, string Sku, decimal CurrentStock, decimal ReorderPoint, decimal SafetyStock, decimal Deficit);

public sealed record GetSalesByProductQuery(DateTime FromUtc, DateTime ToUtc) : IRequest<IReadOnlyList<SalesByProductRow>>;
public sealed record GetSalesByCategoryQuery(DateTime FromUtc, DateTime ToUtc) : IRequest<IReadOnlyList<SalesByCategoryRow>>;
public sealed record GetHourlySalesQuery(DateTime FromUtc, DateTime ToUtc) : IRequest<IReadOnlyList<HourlySalesRow>>;
public sealed record GetPeakHoursQuery(DateTime FromUtc, DateTime ToUtc) : IRequest<IReadOnlyList<HourlySalesRow>>;
public sealed record GetStarVsUnderperformingQuery(DateTime FromUtc, DateTime ToUtc) : IRequest<IReadOnlyList<ProductPerformanceRow>>;
public sealed record GetStaffPerformanceQuery(DateTime FromUtc, DateTime ToUtc) : IRequest<IReadOnlyList<StaffPerformanceRow>>;
public sealed record GetStockAlertsQuery : IRequest<IReadOnlyList<StockAlertRow>>;

internal static class AnalyticsScope
{
    public static IQueryable<Domain.Entities.Order> PaidOrders(IApplicationDbContext db, DateTime from, DateTime to) =>
        db.Orders.AsNoTracking().Where(o => o.Status == OrderStatus.Paid && o.PaidAt >= from && o.PaidAt <= to);
}

public sealed class GetSalesByProductQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetSalesByProductQuery, IReadOnlyList<SalesByProductRow>>
{
    public async Task<IReadOnlyList<SalesByProductRow>> Handle(GetSalesByProductQuery request, CancellationToken cancellationToken)
    {
        return await AnalyticsScope.PaidOrders(db, request.FromUtc, request.ToUtc)
            .SelectMany(o => o.Items)
            .GroupBy(i => new { i.MenuItemId, i.Title, CategoryId = i.MenuItem!.CategoryId, CategoryName = i.MenuItem.Category.Name })
            .Select(g => new SalesByProductRow(g.Key.MenuItemId, g.Key.Title, g.Key.CategoryId, g.Key.CategoryName, g.Sum(x => x.Quantity), g.Sum(x => x.LineTotal)))
            .OrderByDescending(x => x.NetSales)
            .ToListAsync(cancellationToken);
    }
}

public sealed class GetSalesByCategoryQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetSalesByCategoryQuery, IReadOnlyList<SalesByCategoryRow>>
{
    public async Task<IReadOnlyList<SalesByCategoryRow>> Handle(GetSalesByCategoryQuery request, CancellationToken cancellationToken)
    {
        return await AnalyticsScope.PaidOrders(db, request.FromUtc, request.ToUtc)
            .SelectMany(o => o.Items)
            .GroupBy(i => new { i.MenuItem!.CategoryId, i.MenuItem.Category.Name })
            .Select(g => new SalesByCategoryRow(g.Key.CategoryId, g.Key.Name, g.Sum(x => x.Quantity), g.Sum(x => x.LineTotal)))
            .OrderByDescending(x => x.NetSales)
            .ToListAsync(cancellationToken);
    }
}

public sealed class GetHourlySalesQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetHourlySalesQuery, IReadOnlyList<HourlySalesRow>>
{
    public async Task<IReadOnlyList<HourlySalesRow>> Handle(GetHourlySalesQuery request, CancellationToken cancellationToken)
    {
        var paid = await AnalyticsScope.PaidOrders(db, request.FromUtc, request.ToUtc).ToListAsync(cancellationToken);
        return paid
            .GroupBy(o => PersianDateTime.GetHour(o.PaidAt ?? o.CreatedAt))
            .Select(g => new HourlySalesRow(g.Key, g.Count(), g.Sum(x => x.GrandTotal)))
            .OrderBy(x => x.Hour)
            .ToList();
    }
}

public sealed class GetPeakHoursQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetPeakHoursQuery, IReadOnlyList<HourlySalesRow>>
{
    private readonly GetHourlySalesQueryHandler _inner = new(db);

    public async Task<IReadOnlyList<HourlySalesRow>> Handle(GetPeakHoursQuery request, CancellationToken cancellationToken)
    {
        var hourly = await _inner.Handle(new GetHourlySalesQuery(request.FromUtc, request.ToUtc), cancellationToken);
        return hourly.OrderByDescending(x => x.NetSales).Take(5).ToList();
    }
}

public sealed class GetStarVsUnderperformingQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetStarVsUnderperformingQuery, IReadOnlyList<ProductPerformanceRow>>
{
    public async Task<IReadOnlyList<ProductPerformanceRow>> Handle(GetStarVsUnderperformingQuery request, CancellationToken cancellationToken)
    {
        var rows = await AnalyticsScope.PaidOrders(db, request.FromUtc, request.ToUtc)
            .SelectMany(o => o.Items)
            .GroupBy(i => new { i.MenuItemId, i.Title })
            .Select(g => new { g.Key.MenuItemId, g.Key.Title, Qty = g.Sum(x => x.Quantity), Sales = g.Sum(x => x.LineTotal) })
            .OrderByDescending(x => x.Sales)
            .ToListAsync(cancellationToken);

        if (rows.Count == 0)
            return [];

        var max = rows[0].Sales;
        return rows.Select(r =>
        {
            var ratio = max == 0 ? 0 : r.Sales / max;
            var band = ratio >= 0.6m ? "Star" : ratio <= 0.15m ? "Underperforming" : "Core";
            return new ProductPerformanceRow(r.MenuItemId, r.Title, r.Qty, r.Sales, band);
        }).ToList();
    }
}

public sealed class GetStaffPerformanceQueryHandler(IApplicationDbContext db, IIdentityService identity)
    : IRequestHandler<GetStaffPerformanceQuery, IReadOnlyList<StaffPerformanceRow>>
{
    public async Task<IReadOnlyList<StaffPerformanceRow>> Handle(GetStaffPerformanceQuery request, CancellationToken cancellationToken)
    {
        var grouped = await AnalyticsScope.PaidOrders(db, request.FromUtc, request.ToUtc)
            .GroupBy(o => o.CashierId)
            .Select(g => new { StaffId = g.Key, Count = g.Count(), Sales = g.Sum(x => x.GrandTotal) })
            .ToListAsync(cancellationToken);

        var result = new List<StaffPerformanceRow>();
        foreach (var row in grouped.OrderByDescending(x => x.Sales))
        {
            var name = await identity.GetStaffDisplayNameAsync(row.StaffId, cancellationToken) ?? row.StaffId.ToString();
            var avg = row.Count == 0 ? 0 : row.Sales / row.Count;
            result.Add(new StaffPerformanceRow(row.StaffId, name, row.Count, row.Sales, decimal.Round(avg, 0)));
        }

        return result;
    }
}

public sealed class GetStockAlertsQueryHandler(IApplicationDbContext db) : IRequestHandler<GetStockAlertsQuery, IReadOnlyList<StockAlertRow>>
{
    public async Task<IReadOnlyList<StockAlertRow>> Handle(GetStockAlertsQuery request, CancellationToken cancellationToken)
    {
        return await db.InventoryItems.AsNoTracking()
            .Where(i => i.IsActive && i.CurrentStock <= i.ReorderPoint)
            .Select(i => new StockAlertRow(i.Id, i.Name, i.Sku, i.CurrentStock, i.ReorderPoint, i.SafetyStock, i.ReorderPoint - i.CurrentStock))
            .OrderBy(x => x.CurrentStock)
            .ToListAsync(cancellationToken);
    }
}
