import { useQuery } from "@tanstack/react-query";
import { reportsService } from "@/services/reports.service";
import type { ReportPeriodParams } from "@/services/reports.service";
import type { TimelineInterval } from "@/lib/types";
import { reportKeys } from "./keys";

/* ------------------------------ date-range reads ------------------------- */

/** All report reads key by their exact date range. */
export function useReportProducts(fromUtc: string, toUtc: string) {
  return useQuery({
    queryKey: reportKeys.products(fromUtc, toUtc),
    queryFn: () => reportsService.products(fromUtc, toUtc),
  });
}

export function useReportCategories(fromUtc: string, toUtc: string) {
  return useQuery({
    queryKey: reportKeys.categories(fromUtc, toUtc),
    queryFn: () => reportsService.categories(fromUtc, toUtc),
  });
}

export function useReportHourly(fromUtc: string, toUtc: string) {
  return useQuery({
    queryKey: reportKeys.hourly(fromUtc, toUtc),
    queryFn: () => reportsService.hourly(fromUtc, toUtc),
  });
}

export function useReportPerformance(fromUtc: string, toUtc: string) {
  return useQuery({
    queryKey: reportKeys.performance(fromUtc, toUtc),
    queryFn: () => reportsService.performance(fromUtc, toUtc),
  });
}

export function useReportStaff(fromUtc: string, toUtc: string) {
  return useQuery({
    queryKey: reportKeys.staff(fromUtc, toUtc),
    queryFn: () => reportsService.staff(fromUtc, toUtc),
  });
}

/* ------------------------------ preset reads ----------------------------- */

export function useDashboardSummary(params: ReportPeriodParams = {}) {
  return useQuery({
    queryKey: reportKeys.dashboard(params),
    queryFn: () => reportsService.dashboardSummary(params),
  });
}

export function useSalesTimeline(
  params: ReportPeriodParams & { interval?: TimelineInterval } = {},
) {
  return useQuery({
    queryKey: reportKeys.timeline(params),
    queryFn: () => reportsService.salesTimeline(params),
  });
}

export function usePeakHours(params: ReportPeriodParams = {}) {
  return useQuery({
    queryKey: reportKeys.peakHours(params),
    queryFn: () => reportsService.peakHours(params),
  });
}

export function usePaymentBreakdown(params: ReportPeriodParams = {}) {
  return useQuery({
    queryKey: reportKeys.paymentBreakdown(params),
    queryFn: () => reportsService.paymentBreakdown(params),
  });
}

export function useTerminalReconciliation(params: ReportPeriodParams = {}) {
  return useQuery({
    queryKey: reportKeys.terminals(params),
    queryFn: () => reportsService.terminalReconciliation(params),
  });
}

export function useMenuItemPerformance(
  params: ReportPeriodParams & { topCount?: number } = {},
) {
  return useQuery({
    queryKey: reportKeys.menuItemsPerformance(params),
    queryFn: () => reportsService.menuItemsPerformance(params),
  });
}

export function useMenuCategorySales(params: ReportPeriodParams = {}) {
  return useQuery({
    queryKey: reportKeys.menuCategorySales(params),
    queryFn: () => reportsService.menuCategorySales(params),
  });
}

/** Z-report: per-shift cash reconciliation rows. */
export function useShiftZReport(params: ReportPeriodParams & { cashierId?: string } = {}) {
  return useQuery({
    queryKey: reportKeys.zReport(params),
    queryFn: () => reportsService.zReport(params),
  });
}

export function useProfitMargin(params: ReportPeriodParams = {}) {
  return useQuery({
    queryKey: reportKeys.profitMargin(params),
    queryFn: () => reportsService.profitMargin(params),
  });
}
