import { apiClient } from "@/api/client";
import type {
  CategorySalesDetailDto,
  DashboardSummaryDto,
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
  TimePeriodPreset,
  TimelineInterval,
} from "@/lib/types";

/** Period filter shared by every report endpoint. */
export interface ReportPeriodParams {
  preset?: TimePeriodPreset;
  fromUtc?: string;
  toUtc?: string;
}

const reportParams = (fromUtc: string, toUtc: string) => ({ fromUtc, toUtc });

/** Reports & insights domain — pure API communication. */
export const reportsService = {
  /* ------------------------------- dashboard ------------------------------ */
  dashboardSummary: (params: ReportPeriodParams = {}) =>
    apiClient
      .get<DashboardSummaryDto>("/api/reports/dashboard/summary", { params })
      .then((r) => r.data),

  /* --------------------------------- sales -------------------------------- */
  salesTimeline: (params: ReportPeriodParams & { interval?: TimelineInterval } = {}) =>
    apiClient
      .get<SalesTimelineDto>("/api/reports/sales/timeline", { params })
      .then((r) => r.data),

  peakHours: (params: ReportPeriodParams = {}) =>
    apiClient
      .get<HourlySalesRow[]>("/api/reports/sales/peak-hours", { params })
      .then((r) => r.data),

  products: (fromUtc: string, toUtc: string) =>
    apiClient
      .get<SalesByProductRow[]>("/api/reports/sales/products", {
        params: reportParams(fromUtc, toUtc),
      })
      .then((r) => r.data),

  categories: (fromUtc: string, toUtc: string) =>
    apiClient
      .get<SalesByCategoryRow[]>("/api/reports/sales/categories", {
        params: reportParams(fromUtc, toUtc),
      })
      .then((r) => r.data),

  hourly: (fromUtc: string, toUtc: string) =>
    apiClient
      .get<HourlySalesRow[]>("/api/reports/sales/hourly", {
        params: reportParams(fromUtc, toUtc),
      })
      .then((r) => r.data),

  performance: (fromUtc: string, toUtc: string) =>
    apiClient
      .get<ProductPerformanceRow[]>("/api/reports/sales/performance", {
        params: reportParams(fromUtc, toUtc),
      })
      .then((r) => r.data),

  /* -------------------------------- payments ------------------------------ */
  paymentBreakdown: (params: ReportPeriodParams = {}) =>
    apiClient
      .get<PaymentBreakdownReportDto>("/api/reports/payments/breakdown", { params })
      .then((r) => r.data),

  terminalReconciliation: (params: ReportPeriodParams = {}) =>
    apiClient
      .get<TerminalReconciliationDto[]>("/api/reports/payments/terminals", { params })
      .then((r) => r.data),

  /* ---------------------------------- menu -------------------------------- */
  menuItemsPerformance: (params: ReportPeriodParams & { topCount?: number } = {}) =>
    apiClient
      .get<MenuItemPerformanceReportDto>("/api/reports/menu/items-performance", { params })
      .then((r) => r.data),

  menuCategorySales: (params: ReportPeriodParams = {}) =>
    apiClient
      .get<CategorySalesDetailDto[]>("/api/reports/menu/category-sales", { params })
      .then((r) => r.data),

  /* --------------------------------- shifts ------------------------------- */
  zReport: (params: ReportPeriodParams & { cashierId?: string } = {}) =>
    apiClient
      .get<ShiftSummaryReportDto[]>("/api/reports/shifts/z-report", { params })
      .then((r) => r.data),

  /* ---------------------------------- cost -------------------------------- */
  profitMargin: (params: ReportPeriodParams = {}) =>
    apiClient
      .get<ProfitMarginReportDto>("/api/reports/cogs/profit-margin", { params })
      .then((r) => r.data),

  /* --------------------------------- staff -------------------------------- */
  staff: (fromUtc: string, toUtc: string) =>
    apiClient
      .get<StaffPerformanceRow[]>("/api/reports/staff", {
        params: reportParams(fromUtc, toUtc),
      })
      .then((r) => r.data),

  stockAlerts: () =>
    apiClient.get<StockAlertRow[]>("/api/reports/stock-alerts").then((r) => r.data),
};
