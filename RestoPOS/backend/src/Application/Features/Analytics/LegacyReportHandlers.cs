using MediatR;
using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Services;

namespace RestoPOS.Application.Features.Analytics;

/// <summary>Legacy report endpoints kept for existing Next.js admin UI.</summary>
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
        var paid = await AnalyticsScope.PaidOrders(db, request.FromUtc, request.ToUtc)
            .Select(o => new { PaidAt = o.PaidAt ?? o.CreatedAt, o.GrandTotal })
            .ToListAsync(cancellationToken);

        var byHour = paid
            .GroupBy(o => PersianDateTime.GetHour(o.PaidAt))
            .ToDictionary(g => g.Key, g => (Count: g.Count(), Sales: g.Sum(x => x.GrandTotal)));

        return Enumerable.Range(0, 24)
            .Select(h =>
            {
                byHour.TryGetValue(h, out var cell);
                return new HourlySalesRow(h, cell.Count, cell.Sales);
            })
            .ToList();
    }
}

public sealed class GetPeakHoursQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetPeakHoursQuery, IReadOnlyList<HourlySalesRow>>
{
    public async Task<IReadOnlyList<HourlySalesRow>> Handle(GetPeakHoursQuery request, CancellationToken cancellationToken)
    {
        var hourly = await new GetHourlySalesQueryHandler(db)
            .Handle(new GetHourlySalesQuery(request.FromUtc, request.ToUtc), cancellationToken);
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

public sealed class GetStockAlertsQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetStockAlertsQuery, IReadOnlyList<StockAlertRow>>
{
    public async Task<IReadOnlyList<StockAlertRow>> Handle(GetStockAlertsQuery request, CancellationToken cancellationToken)
    {
        return await db.InventoryItems.AsNoTracking()
            .Where(i => i.IsActive && i.CurrentStock <= i.MinimumAlertStock)
            .Select(i => new StockAlertRow(i.Id, i.Name, i.Sku, i.CurrentStock, i.MinimumAlertStock, i.OptimalStock, i.MinimumAlertStock - i.CurrentStock))
            .OrderBy(x => x.CurrentStock)
            .ToListAsync(cancellationToken);
    }
}
