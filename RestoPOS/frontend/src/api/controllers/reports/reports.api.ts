import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/axios";
import { reportKeys, stockAlertKeys } from "@/api/keys";
import type {
  CategorySalesDetailDto,
  CustomerReturnRateReportDto,
  DashboardSummaryDto,
  HourlyHeatmapRowDto,
  HourlySalesRow,
  MenuItemPerformanceReportDto,
  PaymentBreakdownReportDto,
  ProductPerformanceRow,
  ProfitMarginReportDto,
  SalesByCategoryRow,
  SalesByProductRow,
  SalesTimelineDto,
  ShiftSummaryReportDto,
  StaffPerformanceRow,
  StockAlertRow,
  TerminalReconciliationDto,
  TimelineInterval,
  TimePeriodPreset,
} from "@/lib/types";

export interface RangeParams {
  fromUtc?: string | null;
  toUtc?: string | null;
}

export interface PresetParams extends RangeParams {
  preset: TimePeriodPreset;
}

/** Lets a tab keep a query dormant until it is actually visible. */
export interface ReportQueryOptions {
  enabled?: boolean;
}

/** ReportsController — `api/reports` (legacy + aggregated insights). */
export const reportsApi = {
  /* --------------------------------- legacy ------------------------------- */
  products: (fromUtc: string, toUtc: string) =>
    apiClient
      .get<SalesByProductRow[]>("/api/reports/sales/products", {
        params: { fromUtc, toUtc },
      })
      .then((r) => r.data),

  categories: (fromUtc: string, toUtc: string) =>
    apiClient
      .get<SalesByCategoryRow[]>("/api/reports/sales/categories", {
        params: { fromUtc, toUtc },
      })
      .then((r) => r.data),

  hourly: (fromUtc: string, toUtc: string) =>
    apiClient
      .get<HourlySalesRow[]>("/api/reports/sales/hourly", {
        params: { fromUtc, toUtc },
      })
      .then((r) => r.data),

  performance: (fromUtc: string, toUtc: string) =>
    apiClient
      .get<ProductPerformanceRow[]>("/api/reports/sales/performance", {
        params: { fromUtc, toUtc },
      })
      .then((r) => r.data),

  staff: (fromUtc: string, toUtc: string) =>
    apiClient
      .get<StaffPerformanceRow[]>("/api/reports/staff", {
        params: { fromUtc, toUtc },
      })
      .then((r) => r.data),

  stockAlerts: () =>
    apiClient
      .get<StockAlertRow[]>("/api/reports/stock-alerts")
      .then((r) => r.data),

  /* ------------------------------- aggregated ----------------------------- */
  dashboardSummary: (params: PresetParams) =>
    apiClient
      .get<DashboardSummaryDto>("/api/reports/dashboard/summary", {
        params,
      })
      .then((r) => r.data),

  salesTimeline: (params: PresetParams & { interval: TimelineInterval }) =>
    apiClient
      .get<SalesTimelineDto>("/api/reports/sales/timeline", { params })
      .then((r) => r.data),

  peakHoursHeatmap: (params: PresetParams) =>
    apiClient
      .get<HourlyHeatmapRowDto[]>("/api/reports/sales/peak-hours", { params })
      .then((r) => r.data),

  paymentBreakdown: (params: PresetParams) =>
    apiClient
      .get<PaymentBreakdownReportDto>("/api/reports/payments/breakdown", {
        params,
      })
      .then((r) => r.data),

  terminalReports: (params: PresetParams) =>
    apiClient
      .get<TerminalReconciliationDto[]>("/api/reports/payments/terminals", {
        params,
      })
      .then((r) => r.data),

  menuItemsPerformance: (params: PresetParams & { topCount: number }) =>
    apiClient
      .get<MenuItemPerformanceReportDto>("/api/reports/menu/items-performance", {
        params,
      })
      .then((r) => r.data),

  categorySalesDetail: (params: PresetParams) =>
    apiClient
      .get<CategorySalesDetailDto[]>("/api/reports/menu/category-sales", {
        params,
      })
      .then((r) => r.data),

  shiftZReport: (params: PresetParams & { cashierId?: string }) =>
    apiClient
      .get<ShiftSummaryReportDto[]>("/api/reports/shifts/z-report", { params })
      .then((r) => r.data),

  profitMargin: (params: PresetParams) =>
    apiClient
      .get<ProfitMarginReportDto>("/api/reports/cogs/profit-margin", { params })
      .then((r) => r.data),

  customerReturnRate: (params: PresetParams) =>
    apiClient
      .get<CustomerReturnRateReportDto>("/api/reports/customers/return-rate", {
        params,
      })
      .then((r) => r.data),
};

/* --------------------------------- hooks -------------------------------- */

/** All report reads key by their exact date range. */
export function useReportProducts(fromUtc: string, toUtc: string) {
  return useQuery({
    queryKey: reportKeys.products(fromUtc, toUtc),
    queryFn: () => reportsApi.products(fromUtc, toUtc),
  });
}

export function useReportCategories(fromUtc: string, toUtc: string) {
  return useQuery({
    queryKey: reportKeys.categories(fromUtc, toUtc),
    queryFn: () => reportsApi.categories(fromUtc, toUtc),
  });
}

export function useReportHourly(fromUtc: string, toUtc: string) {
  return useQuery({
    queryKey: reportKeys.hourly(fromUtc, toUtc),
    queryFn: () => reportsApi.hourly(fromUtc, toUtc),
  });
}

export function useReportPerformance(fromUtc: string, toUtc: string) {
  return useQuery({
    queryKey: reportKeys.performance(fromUtc, toUtc),
    queryFn: () => reportsApi.performance(fromUtc, toUtc),
  });
}

export function useReportStaff(
  fromUtc: string,
  toUtc: string,
  options?: ReportQueryOptions,
) {
  return useQuery({
    queryKey: reportKeys.staff(fromUtc, toUtc),
    queryFn: () => reportsApi.staff(fromUtc, toUtc),
    enabled: options?.enabled,
  });
}

export function useStockAlerts() {
  return useQuery({
    queryKey: stockAlertKeys.all,
    queryFn: reportsApi.stockAlerts,
  });
}

export function useDashboardSummary(
  preset: TimePeriodPreset = "Today",
  fromUtc?: string | null,
  toUtc?: string | null,
  options?: ReportQueryOptions,
) {
  return useQuery({
    queryKey: reportKeys.dashboard(preset, fromUtc, toUtc),
    queryFn: () => reportsApi.dashboardSummary({ preset, fromUtc, toUtc }),
    enabled: options?.enabled,
  });
}

export function useSalesTimeline(
  preset: TimePeriodPreset = "ThisMonth",
  interval: TimelineInterval = "Daily",
  fromUtc?: string | null,
  toUtc?: string | null,
  options?: ReportQueryOptions,
) {
  return useQuery({
    queryKey: reportKeys.timeline(preset, interval, fromUtc, toUtc),
    queryFn: () => reportsApi.salesTimeline({ preset, interval, fromUtc, toUtc }),
    enabled: options?.enabled,
  });
}

export function usePeakHoursHeatmap(
  preset: TimePeriodPreset = "ThisMonth",
  fromUtc?: string | null,
  toUtc?: string | null,
  options?: ReportQueryOptions,
) {
  return useQuery({
    queryKey: reportKeys.heatmap(preset, fromUtc, toUtc),
    queryFn: () => reportsApi.peakHoursHeatmap({ preset, fromUtc, toUtc }),
    enabled: options?.enabled,
  });
}

export function usePaymentBreakdown(
  preset: TimePeriodPreset = "Today",
  fromUtc?: string | null,
  toUtc?: string | null,
  options?: ReportQueryOptions,
) {
  return useQuery({
    queryKey: reportKeys.paymentBreakdown(preset, fromUtc, toUtc),
    queryFn: () => reportsApi.paymentBreakdown({ preset, fromUtc, toUtc }),
    enabled: options?.enabled,
  });
}

export function useTerminalReports(
  preset: TimePeriodPreset = "Today",
  fromUtc?: string | null,
  toUtc?: string | null,
  options?: ReportQueryOptions,
) {
  return useQuery({
    queryKey: reportKeys.terminals(preset, fromUtc, toUtc),
    queryFn: () => reportsApi.terminalReports({ preset, fromUtc, toUtc }),
    enabled: options?.enabled,
  });
}

export function useMenuItemsPerformance(
  preset: TimePeriodPreset = "ThisMonth",
  topCount = 10,
  fromUtc?: string | null,
  toUtc?: string | null,
  options?: ReportQueryOptions,
) {
  return useQuery({
    queryKey: reportKeys.menuPerformance(preset, topCount, fromUtc, toUtc),
    queryFn: () =>
      reportsApi.menuItemsPerformance({ preset, topCount, fromUtc, toUtc }),
    enabled: options?.enabled,
  });
}

export function useCategorySalesDetail(
  preset: TimePeriodPreset = "ThisMonth",
  fromUtc?: string | null,
  toUtc?: string | null,
  options?: ReportQueryOptions,
) {
  return useQuery({
    queryKey: reportKeys.categorySales(preset, fromUtc, toUtc),
    queryFn: () => reportsApi.categorySalesDetail({ preset, fromUtc, toUtc }),
    enabled: options?.enabled,
  });
}

export function useShiftZReport(
  preset: TimePeriodPreset = "Today",
  cashierId?: string,
  fromUtc?: string | null,
  toUtc?: string | null,
  options?: ReportQueryOptions,
) {
  return useQuery({
    queryKey: reportKeys.zReport(preset, cashierId, fromUtc, toUtc),
    queryFn: () =>
      reportsApi.shiftZReport({ preset, cashierId, fromUtc, toUtc }),
    enabled: options?.enabled,
  });
}

export function useProfitMargin(
  preset: TimePeriodPreset = "ThisMonth",
  fromUtc?: string | null,
  toUtc?: string | null,
  options?: ReportQueryOptions,
) {
  return useQuery({
    queryKey: reportKeys.profitMargin(preset, fromUtc, toUtc),
    queryFn: () => reportsApi.profitMargin({ preset, fromUtc, toUtc }),
    enabled: options?.enabled,
  });
}

export function useCustomerReturnRate(
  preset: TimePeriodPreset = "ThisMonth",
  fromUtc?: string | null,
  toUtc?: string | null,
  options?: ReportQueryOptions,
) {
  return useQuery({
    queryKey: reportKeys.customerReturn(preset, fromUtc, toUtc),
    queryFn: () => reportsApi.customerReturnRate({ preset, fromUtc, toUtc }),
    enabled: options?.enabled,
  });
}
