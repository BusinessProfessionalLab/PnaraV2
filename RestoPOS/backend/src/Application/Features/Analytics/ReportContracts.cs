using MediatR;
using RestoPOS.Domain.Enums;

namespace RestoPOS.Application.Features.Analytics;

// ───────────────────────── Shared KPI / money shape ─────────────────────────

public sealed record MoneyAmountDto(decimal Rials, long Tomans)
{
    public static MoneyAmountDto FromRials(decimal rials) =>
        new(decimal.Round(rials, 0, MidpointRounding.AwayFromZero), ReportMoney.ToTomanLong(rials));
}

public sealed record PeriodComparisonDto(
    decimal GrossSalesChangePercent,
    decimal NetSalesChangePercent,
    decimal OrdersChangePercent,
    decimal AverageTicketChangePercent,
    decimal TotalVatChangePercent,
    decimal TotalDiscountsChangePercent);

public sealed record DashboardSummaryDto(
    string PeriodLabelFa,
    DateTime FromUtc,
    DateTime ToUtc,
    DateTime ComparisonFromUtc,
    DateTime ComparisonToUtc,
    MoneyAmountDto GrossSales,
    MoneyAmountDto NetSales,
    MoneyAmountDto TotalDiscounts,
    MoneyAmountDto TotalVat,
    MoneyAmountDto AverageTicketSize,
    int TotalOrders,
    int PaidOrdersCount,
    int PendingOrdersCount,
    int CancelledOrdersCount,
    PeriodComparisonDto ComparisonWithPreviousPeriod);

public sealed record SalesTimelinePointDto(
    DateTime BucketStartUtc,
    string Label,
    string LabelFa,
    MoneyAmountDto NetSales,
    MoneyAmountDto GrossSales,
    int OrderCount,
    MoneyAmountDto? PreviousNetSales);

public sealed record SalesTimelineDto(
    TimelineInterval Interval,
    string PeriodLabelFa,
    DateTime FromUtc,
    DateTime ToUtc,
    IReadOnlyList<SalesTimelinePointDto> Points);

public sealed record HourlyHeatmapRowDto(
    int DayOfWeek,
    string DayOfWeekFa,
    int Hour,
    int OrderCount,
    MoneyAmountDto NetSales,
    decimal DensityScore);

public sealed record PaymentMethodShareDto(
    ReportPaymentMethod Method,
    string MethodLabelFa,
    int PaymentCount,
    MoneyAmountDto Amount,
    decimal PercentageShare);

public sealed record PaymentBreakdownReportDto(
    string PeriodLabelFa,
    DateTime FromUtc,
    DateTime ToUtc,
    MoneyAmountDto TotalSettled,
    int TotalPaymentCount,
    IReadOnlyList<PaymentMethodShareDto> Methods);

public sealed record TerminalReconciliationDto(
    string? TerminalId,
    IranianPsp Psp,
    string PspLabel,
    int TransactionCount,
    MoneyAmountDto Amount,
    MoneyAmountDto AverageTicket);

public sealed record MenuItemPerformanceRowDto(
    int Rank,
    Guid MenuItemId,
    string Title,
    Guid CategoryId,
    string CategoryName,
    int Quantity,
    MoneyAmountDto Revenue,
    MoneyAmountDto EstimatedCogs,
    MoneyAmountDto GrossProfit,
    decimal GrossMarginPercent,
    string Band);

public sealed record MenuItemPerformanceReportDto(
    string PeriodLabelFa,
    DateTime FromUtc,
    DateTime ToUtc,
    IReadOnlyList<MenuItemPerformanceRowDto> TopSellingItems,
    IReadOnlyList<MenuItemPerformanceRowDto> LowestSellingItems,
    IReadOnlyList<MenuItemPerformanceRowDto> AllItems);

public sealed record CategorySalesItemDto(
    Guid MenuItemId,
    string Title,
    int Quantity,
    MoneyAmountDto Revenue,
    decimal CategorySharePercent);

public sealed record CategorySalesDetailDto(
    Guid CategoryId,
    string CategoryName,
    int Quantity,
    MoneyAmountDto Revenue,
    decimal SharePercent,
    IReadOnlyList<CategorySalesItemDto> Items);

public sealed record ShiftPaymentBreakdownDto(
    ReportPaymentMethod Method,
    string MethodLabelFa,
    MoneyAmountDto Amount,
    int Count);

public sealed record ShiftSummaryReportDto(
    Guid ShiftId,
    Guid CashierId,
    string CashierName,
    DateTime OpenedAtUtc,
    DateTime? ClosedAtUtc,
    ShiftStatus Status,
    MoneyAmountDto OpeningCash,
    MoneyAmountDto? ClosingCash,
    MoneyAmountDto? ExpectedCash,
    MoneyAmountDto? CashVariance,
    MoneyAmountDto GrossSales,
    MoneyAmountDto NetSales,
    int PaidOrderCount,
    IReadOnlyList<ShiftPaymentBreakdownDto> PaymentsByMethod,
    string? Notes);

public sealed record ProfitMarginLineDto(
    Guid MenuItemId,
    string Title,
    Guid CategoryId,
    string CategoryName,
    int QuantitySold,
    MoneyAmountDto Revenue,
    MoneyAmountDto Cogs,
    MoneyAmountDto GrossProfit,
    decimal GrossMarginPercent);

public sealed record ProfitMarginReportDto(
    string PeriodLabelFa,
    DateTime FromUtc,
    DateTime ToUtc,
    MoneyAmountDto TotalRevenue,
    MoneyAmountDto TotalCogs,
    MoneyAmountDto GrossProfit,
    decimal GrossMarginPercent,
    IReadOnlyList<ProfitMarginLineDto> Lines);

// ───────────────────────── Legacy rows (frontend compatibility) ─────────────────────────

public sealed record SalesByProductRow(Guid MenuItemId, string Title, Guid CategoryId, string CategoryName, int Quantity, decimal NetSales);
public sealed record SalesByCategoryRow(Guid CategoryId, string CategoryName, int Quantity, decimal NetSales);
public sealed record HourlySalesRow(int Hour, int OrderCount, decimal NetSales);
public sealed record ProductPerformanceRow(Guid MenuItemId, string Title, int Quantity, decimal NetSales, string Band);
public sealed record StaffPerformanceRow(Guid StaffId, string StaffName, int OrderCount, decimal NetSales, decimal AverageTicket);
public sealed record StockAlertRow(Guid InventoryItemId, string Name, string Sku, decimal CurrentStock, decimal MinimumAlertStock, decimal OptimalStock, decimal Deficit);

// ───────────────────────── Queries ─────────────────────────

public sealed record GetDashboardSummaryQuery(TimePeriodPreset Preset, DateTime? FromUtc, DateTime? ToUtc)
    : IRequest<DashboardSummaryDto>;

public sealed record GetSalesTimelineQuery(TimePeriodPreset Preset, TimelineInterval Interval, DateTime? FromUtc, DateTime? ToUtc)
    : IRequest<SalesTimelineDto>;

public sealed record GetPeakHoursHeatmapQuery(TimePeriodPreset Preset, DateTime? FromUtc, DateTime? ToUtc)
    : IRequest<IReadOnlyList<HourlyHeatmapRowDto>>;

public sealed record GetPaymentBreakdownQuery(TimePeriodPreset Preset, DateTime? FromUtc, DateTime? ToUtc)
    : IRequest<PaymentBreakdownReportDto>;

public sealed record GetTerminalReportsQuery(TimePeriodPreset Preset, DateTime? FromUtc, DateTime? ToUtc)
    : IRequest<IReadOnlyList<TerminalReconciliationDto>>;

public sealed record GetMenuItemPerformanceQuery(TimePeriodPreset Preset, int TopCount, DateTime? FromUtc, DateTime? ToUtc)
    : IRequest<MenuItemPerformanceReportDto>;

public sealed record GetCategorySalesQuery(TimePeriodPreset Preset, DateTime? FromUtc, DateTime? ToUtc)
    : IRequest<IReadOnlyList<CategorySalesDetailDto>>;

public sealed record GetShiftSummaryReportsQuery(TimePeriodPreset Preset, Guid? CashierId, DateTime? FromUtc, DateTime? ToUtc)
    : IRequest<IReadOnlyList<ShiftSummaryReportDto>>;

public sealed record GetProfitMarginReportQuery(TimePeriodPreset Preset, DateTime? FromUtc, DateTime? ToUtc)
    : IRequest<ProfitMarginReportDto>;

// Legacy
public sealed record GetSalesByProductQuery(DateTime FromUtc, DateTime ToUtc) : IRequest<IReadOnlyList<SalesByProductRow>>;
public sealed record GetSalesByCategoryQuery(DateTime FromUtc, DateTime ToUtc) : IRequest<IReadOnlyList<SalesByCategoryRow>>;
public sealed record GetHourlySalesQuery(DateTime FromUtc, DateTime ToUtc) : IRequest<IReadOnlyList<HourlySalesRow>>;
public sealed record GetPeakHoursQuery(DateTime FromUtc, DateTime ToUtc) : IRequest<IReadOnlyList<HourlySalesRow>>;
public sealed record GetStarVsUnderperformingQuery(DateTime FromUtc, DateTime ToUtc) : IRequest<IReadOnlyList<ProductPerformanceRow>>;
public sealed record GetStaffPerformanceQuery(DateTime FromUtc, DateTime ToUtc) : IRequest<IReadOnlyList<StaffPerformanceRow>>;
public sealed record GetStockAlertsQuery : IRequest<IReadOnlyList<StockAlertRow>>;
