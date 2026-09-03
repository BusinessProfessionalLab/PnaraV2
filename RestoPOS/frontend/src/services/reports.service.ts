import { apiClient } from "@/api/client";
import type {
  HourlySalesRow,
  ProductPerformanceRow,
  SalesByCategoryRow,
  SalesByProductRow,
  StaffPerformanceRow,
  StockAlertRow,
} from "@/lib/types";

const reportParams = (fromUtc: string, toUtc: string) => ({ fromUtc, toUtc });

/** Reports & insights domain — pure API communication. */
export const reportsService = {
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

  staff: (fromUtc: string, toUtc: string) =>
    apiClient
      .get<StaffPerformanceRow[]>("/api/reports/staff", {
        params: reportParams(fromUtc, toUtc),
      })
      .then((r) => r.data),

  stockAlerts: () =>
    apiClient.get<StockAlertRow[]>("/api/reports/stock-alerts").then((r) => r.data),
};
