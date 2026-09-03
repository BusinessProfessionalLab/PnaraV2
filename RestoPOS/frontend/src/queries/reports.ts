import { useQuery } from "@tanstack/react-query";
import { reportsService } from "@/services/reports.service";
import { reportKeys } from "./keys";

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
