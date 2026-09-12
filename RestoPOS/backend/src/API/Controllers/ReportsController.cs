using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestoPOS.Application.Features.Analytics;
using RestoPOS.Domain.Common;
using RestoPOS.Domain.Enums;

namespace RestoPOS.API.Controllers;

/// <summary>Toast-style reporting &amp; analytics for sales, payments, shifts, COGS, and inventory alerts.</summary>
[ApiController]
[Route("api/reports")]
[Authorize]
[Produces("application/json")]
public sealed class ReportsController(ISender sender) : ControllerBase
{
    // ==========================================
    // 1. Dashboard Executive Summary & KPI Cards
    // ==========================================

    /// <summary>Executive KPI cards: gross/net sales, tickets, VAT, discounts, and period-over-period deltas.</summary>
    [HttpGet("dashboard/summary")]
    [Authorize(Policy = Permissions.ReportsViewSales)]
    [ProducesResponseType(typeof(DashboardSummaryDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<DashboardSummaryDto>> GetDashboardSummary(
        [FromQuery] TimePeriodPreset preset = TimePeriodPreset.Today,
        [FromQuery] DateTime? fromUtc = null,
        [FromQuery] DateTime? toUtc = null,
        CancellationToken ct = default) =>
        Ok(await sender.Send(new GetDashboardSummaryQuery(preset, fromUtc, toUtc), ct));

    // ==========================================
    // 2. Trend & Time-Series Charts (Line / Bar)
    // ==========================================

    /// <summary>Continuous sales timeline (hourly/daily/weekly) with previous-period overlay for line charts.</summary>
    [HttpGet("sales/timeline")]
    [Authorize(Policy = Permissions.ReportsViewSales)]
    [ProducesResponseType(typeof(SalesTimelineDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<SalesTimelineDto>> GetSalesTimeline(
        [FromQuery] TimePeriodPreset preset = TimePeriodPreset.ThisMonth,
        [FromQuery] TimelineInterval interval = TimelineInterval.Daily,
        [FromQuery] DateTime? fromUtc = null,
        [FromQuery] DateTime? toUtc = null,
        CancellationToken ct = default) =>
        Ok(await sender.Send(new GetSalesTimelineQuery(preset, interval, fromUtc, toUtc), ct));

    /// <summary>Peak-hours heatmap: day-of-week × hour density for heatmaps.</summary>
    [HttpGet("sales/peak-hours")]
    [Authorize(Policy = Permissions.ReportsViewSales)]
    [ProducesResponseType(typeof(IReadOnlyList<HourlyHeatmapRowDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(IReadOnlyList<HourlySalesRow>), StatusCodes.Status200OK)]
    public async Task<ActionResult> GetPeakHours(
        [FromQuery] TimePeriodPreset? preset = null,
        [FromQuery] DateTime? fromUtc = null,
        [FromQuery] DateTime? toUtc = null,
        CancellationToken ct = default)
    {
        // Legacy: fromUtc+toUtc without preset → top-5 hourly rows for existing UI.
        if (preset is null && fromUtc is not null && toUtc is not null)
            return Ok(await sender.Send(new GetPeakHoursQuery(fromUtc.Value, toUtc.Value), ct));

        return Ok(await sender.Send(new GetPeakHoursHeatmapQuery(preset ?? TimePeriodPreset.ThisMonth, fromUtc, toUtc), ct));
    }

    // ==========================================
    // 3. Payment Methods & Tenders (Pie / Donut)
    // ==========================================

    /// <summary>Settled payments breakdown by tender (cash / POS / card-to-card / wallet / online).</summary>
    [HttpGet("payments/breakdown")]
    [Authorize(Policy = Permissions.ReportsViewFinancial)]
    [ProducesResponseType(typeof(PaymentBreakdownReportDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<PaymentBreakdownReportDto>> GetPaymentBreakdown(
        [FromQuery] TimePeriodPreset preset = TimePeriodPreset.Today,
        [FromQuery] DateTime? fromUtc = null,
        [FromQuery] DateTime? toUtc = null,
        CancellationToken ct = default) =>
        Ok(await sender.Send(new GetPaymentBreakdownQuery(preset, fromUtc, toUtc), ct));

    /// <summary>PSP / terminal reconciliation for bank settlement.</summary>
    [HttpGet("payments/terminals")]
    [Authorize(Policy = Permissions.ReportsViewFinancial)]
    [ProducesResponseType(typeof(IReadOnlyList<TerminalReconciliationDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<TerminalReconciliationDto>>> GetTerminalReports(
        [FromQuery] TimePeriodPreset preset = TimePeriodPreset.Today,
        [FromQuery] DateTime? fromUtc = null,
        [FromQuery] DateTime? toUtc = null,
        CancellationToken ct = default) =>
        Ok(await sender.Send(new GetTerminalReportsQuery(preset, fromUtc, toUtc), ct));

    // ==========================================
    // 4. Menu & Category Sales Performance
    // ==========================================

    /// <summary>Stars vs underperforming menu items with revenue, estimated COGS, and margin.</summary>
    [HttpGet("menu/items-performance")]
    [Authorize(Policy = Permissions.ReportsViewSales)]
    [ProducesResponseType(typeof(MenuItemPerformanceReportDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<MenuItemPerformanceReportDto>> GetMenuItemPerformance(
        [FromQuery] TimePeriodPreset preset = TimePeriodPreset.ThisMonth,
        [FromQuery] int topCount = 10,
        [FromQuery] DateTime? fromUtc = null,
        [FromQuery] DateTime? toUtc = null,
        CancellationToken ct = default) =>
        Ok(await sender.Send(new GetMenuItemPerformanceQuery(preset, topCount, fromUtc, toUtc), ct));

    /// <summary>Category sales with nested product drilldown for pie + table.</summary>
    [HttpGet("menu/category-sales")]
    [Authorize(Policy = Permissions.ReportsViewSales)]
    [ProducesResponseType(typeof(IReadOnlyList<CategorySalesDetailDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<CategorySalesDetailDto>>> GetCategorySales(
        [FromQuery] TimePeriodPreset preset = TimePeriodPreset.ThisMonth,
        [FromQuery] DateTime? fromUtc = null,
        [FromQuery] DateTime? toUtc = null,
        CancellationToken ct = default) =>
        Ok(await sender.Send(new GetCategorySalesQuery(preset, fromUtc, toUtc), ct));

    // ==========================================
    // 5. Shift & Cash Drawer Audit (Z-Report)
    // ==========================================

    /// <summary>Cashier shift Z-report: drawer variance, sales, and tender mix.</summary>
    [HttpGet("shifts/z-report")]
    [Authorize(Policy = Permissions.ReportsViewFinancial)]
    [ProducesResponseType(typeof(IReadOnlyList<ShiftSummaryReportDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<ShiftSummaryReportDto>>> GetShiftZReports(
        [FromQuery] TimePeriodPreset preset = TimePeriodPreset.Today,
        [FromQuery] Guid? cashierId = null,
        [FromQuery] DateTime? fromUtc = null,
        [FromQuery] DateTime? toUtc = null,
        CancellationToken ct = default) =>
        Ok(await sender.Send(new GetShiftSummaryReportsQuery(preset, cashierId, fromUtc, toUtc), ct));

    // ==========================================
    // 6. Cost of Goods Sold (COGS) & Profitability
    // ==========================================

    /// <summary>Profit margin from order lines × recipe BOM × inventory WAC.</summary>
    [HttpGet("cogs/profit-margin")]
    [Authorize(Policy = Permissions.ReportsViewFinancial)]
    [ProducesResponseType(typeof(ProfitMarginReportDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ProfitMarginReportDto>> GetProfitMarginReport(
        [FromQuery] TimePeriodPreset preset = TimePeriodPreset.ThisMonth,
        [FromQuery] DateTime? fromUtc = null,
        [FromQuery] DateTime? toUtc = null,
        CancellationToken ct = default) =>
        Ok(await sender.Send(new GetProfitMarginReportQuery(preset, fromUtc, toUtc), ct));

    // ==========================================
    // Legacy endpoints (existing Next.js reports hub)
    // ==========================================

    [HttpGet("sales/products")]
    [Authorize(Policy = Permissions.ReportsViewSales)]
    [ProducesResponseType(typeof(IReadOnlyList<SalesByProductRow>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<SalesByProductRow>>> Products(
        [FromQuery] DateTime fromUtc, [FromQuery] DateTime toUtc, CancellationToken ct) =>
        Ok(await sender.Send(new GetSalesByProductQuery(fromUtc, toUtc), ct));

    [HttpGet("sales/categories")]
    [Authorize(Policy = Permissions.ReportsViewSales)]
    [ProducesResponseType(typeof(IReadOnlyList<SalesByCategoryRow>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<SalesByCategoryRow>>> Categories(
        [FromQuery] DateTime fromUtc, [FromQuery] DateTime toUtc, CancellationToken ct) =>
        Ok(await sender.Send(new GetSalesByCategoryQuery(fromUtc, toUtc), ct));

    [HttpGet("sales/hourly")]
    [Authorize(Policy = Permissions.ReportsViewSales)]
    [ProducesResponseType(typeof(IReadOnlyList<HourlySalesRow>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<HourlySalesRow>>> Hourly(
        [FromQuery] DateTime fromUtc, [FromQuery] DateTime toUtc, CancellationToken ct) =>
        Ok(await sender.Send(new GetHourlySalesQuery(fromUtc, toUtc), ct));

    [HttpGet("sales/performance")]
    [Authorize(Policy = Permissions.ReportsViewSales)]
    [ProducesResponseType(typeof(IReadOnlyList<ProductPerformanceRow>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<ProductPerformanceRow>>> Performance(
        [FromQuery] DateTime fromUtc, [FromQuery] DateTime toUtc, CancellationToken ct) =>
        Ok(await sender.Send(new GetStarVsUnderperformingQuery(fromUtc, toUtc), ct));

    [HttpGet("staff")]
    [Authorize(Policy = Permissions.ReportsViewStaff)]
    [ProducesResponseType(typeof(IReadOnlyList<StaffPerformanceRow>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<StaffPerformanceRow>>> Staff(
        [FromQuery] DateTime fromUtc, [FromQuery] DateTime toUtc, CancellationToken ct) =>
        Ok(await sender.Send(new GetStaffPerformanceQuery(fromUtc, toUtc), ct));

    [HttpGet("stock-alerts")]
    [Authorize(Policy = Permissions.InventoryView)]
    [ProducesResponseType(typeof(IReadOnlyList<StockAlertRow>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<StockAlertRow>>> StockAlerts(CancellationToken ct) =>
        Ok(await sender.Send(new GetStockAlertsQuery(), ct));
}
