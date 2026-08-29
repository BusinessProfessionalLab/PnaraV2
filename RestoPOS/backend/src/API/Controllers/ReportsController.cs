using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestoPOS.Application.Features.Analytics;
using RestoPOS.Domain.Common;

namespace RestoPOS.API.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize]
public sealed class ReportsController(ISender sender) : ControllerBase
{
    [HttpGet("sales/products")]
    [Authorize(Policy = Permissions.ReportsViewSales)]
    public Task<IReadOnlyList<SalesByProductRow>> Products([FromQuery] DateTime fromUtc, [FromQuery] DateTime toUtc, CancellationToken ct) =>
        sender.Send(new GetSalesByProductQuery(fromUtc, toUtc), ct);

    [HttpGet("sales/categories")]
    [Authorize(Policy = Permissions.ReportsViewSales)]
    public Task<IReadOnlyList<SalesByCategoryRow>> Categories([FromQuery] DateTime fromUtc, [FromQuery] DateTime toUtc, CancellationToken ct) =>
        sender.Send(new GetSalesByCategoryQuery(fromUtc, toUtc), ct);

    [HttpGet("sales/hourly")]
    [Authorize(Policy = Permissions.ReportsViewSales)]
    public Task<IReadOnlyList<HourlySalesRow>> Hourly([FromQuery] DateTime fromUtc, [FromQuery] DateTime toUtc, CancellationToken ct) =>
        sender.Send(new GetHourlySalesQuery(fromUtc, toUtc), ct);

    [HttpGet("sales/peak-hours")]
    [Authorize(Policy = Permissions.ReportsViewSales)]
    public Task<IReadOnlyList<HourlySalesRow>> Peak([FromQuery] DateTime fromUtc, [FromQuery] DateTime toUtc, CancellationToken ct) =>
        sender.Send(new GetPeakHoursQuery(fromUtc, toUtc), ct);

    [HttpGet("sales/performance")]
    [Authorize(Policy = Permissions.ReportsViewSales)]
    public Task<IReadOnlyList<ProductPerformanceRow>> Performance([FromQuery] DateTime fromUtc, [FromQuery] DateTime toUtc, CancellationToken ct) =>
        sender.Send(new GetStarVsUnderperformingQuery(fromUtc, toUtc), ct);

    [HttpGet("staff")]
    [Authorize(Policy = Permissions.ReportsViewStaff)]
    public Task<IReadOnlyList<StaffPerformanceRow>> Staff([FromQuery] DateTime fromUtc, [FromQuery] DateTime toUtc, CancellationToken ct) =>
        sender.Send(new GetStaffPerformanceQuery(fromUtc, toUtc), ct);

    [HttpGet("stock-alerts")]
    [Authorize(Policy = Permissions.InventoryView)]
    public Task<IReadOnlyList<StockAlertRow>> StockAlerts(CancellationToken ct) =>
        sender.Send(new GetStockAlertsQuery(), ct);
}
