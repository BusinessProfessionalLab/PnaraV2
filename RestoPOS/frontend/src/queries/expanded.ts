import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  CardexRowDto,
  CategorySalesDetailDto,
  CustomerDto,
  CustomerReturnRateReportDto,
  DashboardSummaryDto,
  DiningAreaDto,
  DiningTableDto,
  HourlyHeatmapRowDto,
  MenuItemPerformanceReportDto,
  PaymentBreakdownReportDto,
  PermissionCatalogItem,
  PosDeviceDto,
  ProfitMarginReportDto,
  PurchaseInvoiceDetailDto,
  PurchaseInvoiceListDto,
  RecipeDto,
  RoleDto,
  SalesTimelineDto,
  ShiftSummaryReportDto,
  StaffDto,
  StockCountDetailDto,
  StockCountListDto,
  StockTransferDto,
  SupplierDto,
  TerminalReconciliationDto,
  WasteDetailDto,
  WasteReportRowDto,
  PaginatedList,
} from "@/lib/types";
import type { TimePeriodPreset, TimelineInterval } from "@/lib/types";

type QueryOptions = { enabled?: boolean };

function useRead<T>(key: QueryKey, queryFn: () => Promise<T>, options?: QueryOptions) {
  return useQuery({ queryKey: key, queryFn, enabled: options?.enabled });
}

function useWrite<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  invalidates: QueryKey[],
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all(invalidates.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
  });
}

const customerRoot = ["customers"] as const;
const menuRoot = ["menu"] as const;
const inventoryRoot = ["inventory"] as const;
const reportRoot = ["reports"] as const;
const staffRoot = ["staff"] as const;
const roleRoot = ["roles"] as const;
const tableRoot = ["tables"] as const;
const paymentRoot = ["payments"] as const;

// Customer profile and paged history.
export const useCustomersPaged = (page = 1, pageSize = 50, term?: string) =>
  useRead<PaginatedList<CustomerDto>>([...customerRoot, "paged", page, pageSize, term ?? ""], () =>
    api.customersPaged(page, pageSize, term));

export const useCustomer = (id: string | null) =>
  useRead<CustomerDto>([...customerRoot, "detail", id ?? "none"], () => api.customerById(id!), { enabled: Boolean(id) });

export const useCustomerOrders = (id: string | null) =>
  useRead<PaginatedList<import("@/lib/types").OrderDto>>([...customerRoot, id ?? "none", "orders"], () =>
    api.customerOrders(id!), { enabled: Boolean(id) });

export const useCreateCustomer = () => useWrite<unknown, CustomerDto>(api.createCustomer, [customerRoot]);
export const useUpdateCustomer = () => useWrite<{ id: string; payload: unknown }, CustomerDto>(
  ({ id, payload }) => api.updateCustomer(id, payload), [customerRoot]);
export const useDeleteCustomer = () => useWrite<string, void>(api.deleteCustomer, [customerRoot]);
export const useAdjustLoyalty = () => useWrite<{
  id: string;
  pointsDelta: number;
  notes?: string;
}, CustomerDto>(({ id, pointsDelta, notes }) => api.adjustLoyalty(id, pointsDelta, notes), [customerRoot]);

// Inventory views and actions added after the original query layer.
export const useLowStock = () => useRead(["stock-alerts"], api.lowStock);
export const useInventoryValuation = () => useRead([...inventoryRoot, "valuation"], api.inventoryValuation);
export const useCardex = (id: string | null) => useRead<CardexRowDto[]>(
  [...inventoryRoot, "cardex", id ?? "none"], () => api.cardex(id!), { enabled: Boolean(id) });
export const useUpdateInventoryItem = () => useWrite<{ id: string; payload: unknown }, unknown>(
  ({ id, payload }) => api.updateInventoryItem(id, payload), [inventoryRoot]);
export const useDeleteInventoryItem = () => useWrite<string, unknown>(api.deleteInventoryItem, [inventoryRoot]);
export const useManualAdjustment = () => useWrite<{
  inventoryItemId: string;
  quantityDelta: number;
  notes?: string;
}, string>(api.manualAdjustment, [inventoryRoot, ["stock-alerts"]]);
export const usePurchases = (params: { page?: number; pageSize?: number; supplierId?: string; status?: string }) =>
  useRead<PaginatedList<PurchaseInvoiceListDto>>([...inventoryRoot, "purchases", params], () => api.listPurchases(params));
export const usePurchase = (id: string | null) => useRead<PurchaseInvoiceDetailDto>(
  [...inventoryRoot, "purchase", id ?? "none"], () => api.getPurchase(id!), { enabled: Boolean(id) });
export const useCreatePurchase = () => useWrite<unknown, string>(api.createPurchase, [inventoryRoot]);
export const useCreateDraftPurchase = () => useWrite<unknown, string>(api.createDraftPurchase, [inventoryRoot]);
export const useApprovePurchase = () => useWrite<string, unknown>(api.approvePurchase, [inventoryRoot]);
export const useCancelPurchase = () => useWrite<string, unknown>(api.cancelPurchase, [inventoryRoot]);
export const useWasteList = (params: { page?: number; pageSize?: number; fromUtc?: string; toUtc?: string }) =>
  useRead<PaginatedList<WasteDetailDto>>([...inventoryRoot, "waste", params], () => api.listWaste(params));
export const useWasteReports = () => useRead<WasteReportRowDto[]>([...inventoryRoot, "waste-reports"], api.wasteReports);
export const useStockCounts = (params: { page?: number; pageSize?: number; status?: import("@/lib/types").StockCountStatus }) =>
  useRead<PaginatedList<StockCountListDto>>([...inventoryRoot, "stock-counts", params], () => api.listStockCounts(params));
export const useStockCount = (id: string | null) => useRead<StockCountDetailDto>(
  [...inventoryRoot, "stock-count", id ?? "none"], () => api.getStockCount(id!), { enabled: Boolean(id) });
export const useStartStockCount = () => useWrite<unknown, string>(api.startStockCount, [inventoryRoot]);
export const useSubmitStockCounts = () => useWrite<{
  id: string;
  counts: { inventoryItemId: string; physicalCountQty: number }[];
}, unknown>(({ id, counts }) => api.submitStockCounts(id, counts), [inventoryRoot]);
export const useApproveStockCount = () => useWrite<string, unknown>(api.approveStockCount, [inventoryRoot]);
export const useTransfers = (params: { page?: number; pageSize?: number; status?: import("@/lib/types").StockTransferStatus; inventoryItemId?: string }) =>
  useRead<PaginatedList<StockTransferDto>>([...inventoryRoot, "transfers", params], () => api.listTransfers(params));
export const useCreateTransfer = () => useWrite<unknown, string>(api.createTransfer, [inventoryRoot]);
export const useCompleteTransfer = () => useWrite<string, unknown>(api.completeTransfer, [inventoryRoot]);
export const useCancelTransfer = () => useWrite<string, unknown>(api.cancelTransfer, [inventoryRoot]);
export const useSuppliers = (params: { page?: number; pageSize?: number; search?: string }) =>
  useRead<PaginatedList<SupplierDto> | SupplierDto[]>([...inventoryRoot, "suppliers", params], () => api.listSuppliers(params));
export const useSupplier = (id: string | null) => useRead<SupplierDto>(
  [...inventoryRoot, "supplier", id ?? "none"], () => api.getSupplier(id!), { enabled: Boolean(id) });
export const useCreateSupplier = () => useWrite<unknown, string>(api.createSupplier, [inventoryRoot]);
export const useUpdateSupplier = () => useWrite<{ id: string; payload: unknown }, unknown>(
  ({ id, payload }) => api.updateSupplier(id, payload), [inventoryRoot]);
export const useDeleteSupplier = () => useWrite<string, unknown>(api.deleteSupplier, [inventoryRoot]);

// Menu recipe and modifier-group operations.
export const useCategory = (id: string | null) => useRead(
  [...menuRoot, "category", id ?? "none"], () => api.categoryById(id!), { enabled: Boolean(id) });
export const useModifierGroups = (menuItemId: string | null) => useRead(
  [...menuRoot, "modifier-groups", menuItemId ?? "none"], () => api.modifierGroups(menuItemId!), { enabled: Boolean(menuItemId) });
export const useRecipe = (menuItemId: string | null) => useRead<RecipeDto | null>(
  [...menuRoot, "recipe", menuItemId ?? "none"], () => api.getRecipe(menuItemId!), { enabled: Boolean(menuItemId) });
export const useToggleSoldOut = () => useWrite<{ id: string; isSoldOut: boolean }, void>(
  ({ id, isSoldOut }) => api.toggleSoldOut(id, isSoldOut), [menuRoot]);
export const useCreateModifierGroup = () => useWrite<unknown, string>(api.createModifierGroup, [menuRoot]);
export const useUpdateModifierGroup = () => useWrite<{ id: string; payload: unknown }, void>(
  ({ id, payload }) => api.updateModifierGroup(id, payload), [menuRoot]);
export const useDeleteModifierGroup = () => useWrite<string, void>(api.deleteModifierGroup, [menuRoot]);
export const useAddModifierGroupOption = () => useWrite<{ groupId: string; payload: unknown }, string>(
  ({ groupId, payload }) => api.addModifierGroupOption(groupId, payload), [menuRoot]);
export const useDeleteRecipe = () => useWrite<string, unknown>(api.deleteRecipe, [menuRoot]);

// Higher-level reporting endpoints.
export const useDashboardSummary = (preset: TimePeriodPreset, fromUtc?: string, toUtc?: string) =>
  useRead<DashboardSummaryDto>([...reportRoot, "dashboard", preset, fromUtc, toUtc], () => api.dashboardSummary(preset, fromUtc, toUtc));
export const useSalesTimeline = (preset: TimePeriodPreset, interval: TimelineInterval, fromUtc?: string, toUtc?: string, options?: QueryOptions) =>
  useRead<SalesTimelineDto>([...reportRoot, "timeline", preset, interval, fromUtc, toUtc], () => api.salesTimeline(preset, interval, fromUtc, toUtc), options);
export const usePeakHoursHeatmap = (preset: TimePeriodPreset, fromUtc?: string, toUtc?: string, options?: QueryOptions) =>
  useRead<HourlyHeatmapRowDto[]>([...reportRoot, "peak-hours", preset, fromUtc, toUtc], () => api.peakHoursHeatmap(preset, fromUtc, toUtc), options);
export const usePaymentBreakdown = (preset: TimePeriodPreset, fromUtc?: string, toUtc?: string, options?: QueryOptions) =>
  useRead<PaymentBreakdownReportDto>([...reportRoot, "payments", preset, fromUtc, toUtc], () => api.paymentBreakdown(preset, fromUtc, toUtc), options);
export const useMenuItemsPerformance = (preset: TimePeriodPreset, limit = 10, fromUtc?: string, toUtc?: string, options?: QueryOptions) =>
  useRead<MenuItemPerformanceReportDto>([...reportRoot, "menu-performance", preset, limit, fromUtc, toUtc], () => api.menuItemsPerformance(preset, limit, fromUtc, toUtc), options);
export const useCategorySalesDetail = (preset: TimePeriodPreset, fromUtc?: string, toUtc?: string, options?: QueryOptions) =>
  useRead<CategorySalesDetailDto[]>([...reportRoot, "category-sales", preset, fromUtc, toUtc], () => api.categorySalesDetail(preset, fromUtc, toUtc), options);
export const useTerminalReports = (preset: TimePeriodPreset, fromUtc?: string, toUtc?: string, options?: QueryOptions) =>
  useRead<TerminalReconciliationDto[]>([...reportRoot, "terminals", preset, fromUtc, toUtc], () => api.terminalReports(preset, fromUtc, toUtc), options);
export const useShiftZReport = (preset: TimePeriodPreset, cashierId?: string, fromUtc?: string, toUtc?: string, options?: QueryOptions) =>
  useRead<ShiftSummaryReportDto[]>([...reportRoot, "shift-z", preset, cashierId, fromUtc, toUtc], () => api.shiftZReport(preset, cashierId, fromUtc, toUtc), options);
export const useProfitMargin = (preset: TimePeriodPreset, fromUtc?: string, toUtc?: string, options?: QueryOptions) =>
  useRead<ProfitMarginReportDto>([...reportRoot, "profit-margin", preset, fromUtc, toUtc], () => api.profitMargin(preset, fromUtc, toUtc), options);
export const useCustomerReturnRate = (preset: TimePeriodPreset, fromUtc?: string, toUtc?: string, options?: QueryOptions) =>
  useRead<CustomerReturnRateReportDto>([...reportRoot, "customer-return-rate", preset, fromUtc, toUtc], () => api.customerReturnRate(preset, fromUtc, toUtc), options);

// POS terminal administration.
export const usePosDevicesAdmin = () => useRead<PosDeviceDto[]>([...paymentRoot, "admin-devices"], api.listPosDevices);
export const useCreatePosDevice = () => useWrite<unknown, string>(api.createPosDevice, [paymentRoot]);
export const useDeletePosDevice = () => useWrite<string, void>(api.deletePosDevice, [paymentRoot]);
export const useTestPosDevice = () => useWrite<string, string | { ok?: boolean; message?: string }>(api.testPosDevice, [paymentRoot]);

// Staff and role administration.
export const useStaffMember = (id: string | null) => useRead<StaffDto>(
  [...staffRoot, "detail", id ?? "none"], () => api.staffById(id!), { enabled: Boolean(id) });
export const useUpdateStaff = () => useWrite<{ staffId: string; payload: unknown }, unknown>(
  ({ staffId, payload }) => api.updateStaff(staffId, payload), [staffRoot]);
export const useDeactivateStaff = () => useWrite<string, void>(api.deactivateStaff, [staffRoot]);
export const useChangeStaffPassword = () => useWrite<{ staffId: string; newPassword: string }, unknown>(
  ({ staffId, newPassword }) => api.changeStaffPassword(staffId, newPassword), [staffRoot]);
export const useAssignStaffRoles = () => useWrite<{ staffId: string; roles: string[] }, unknown>(
  ({ staffId, roles }) => api.assignStaffRoles(staffId, roles), [staffRoot]);
export const useRoles = () => useRead<RoleDto[]>(roleRoot, api.roles);
export const usePermissionCatalog = () => useRead<PermissionCatalogItem[]>([...roleRoot, "permissions"], api.permissionCatalog);
export const useCreateRole = () => useWrite<unknown, string>(api.createRole, [roleRoot]);
export const useUpdateRolePermissions = () => useWrite<{ roleId: string; permissions: string[] }, unknown>(
  ({ roleId, permissions }) => api.updateRolePermissions(roleId, permissions), [roleRoot]);

// Dining-area and table management.
export const useDiningAreas = (activeOnly = true) => useRead<DiningAreaDto[]>([...tableRoot, "areas", activeOnly], () => api.diningAreas(activeOnly));
export const useDiningArea = (id: string | null) => useRead<DiningAreaDto>(
  [...tableRoot, "area", id ?? "none"], () => api.diningAreaById(id!), { enabled: Boolean(id) });
export const useCreateDiningArea = () => useWrite<unknown, string>(api.createDiningArea, [tableRoot]);
export const useUpdateDiningArea = () => useWrite<{ id: string; payload: unknown }, void>(
  ({ id, payload }) => api.updateDiningArea(id, payload), [tableRoot]);
export const useDeleteDiningArea = () => useWrite<string, void>(api.deleteDiningArea, [tableRoot]);
export const useDiningTables = (activeOnly = true) => useRead<DiningTableDto[]>([...tableRoot, "list", activeOnly], () => api.diningTables(activeOnly));
export const useTablesByArea = (areaId: string | null, activeOnly = true) => useRead<DiningTableDto[]>(
  [...tableRoot, "area-tables", areaId ?? "none", activeOnly], () => api.tablesByArea(areaId!, activeOnly), { enabled: Boolean(areaId) });
export const useDiningTable = (id: string | null) => useRead<DiningTableDto>(
  [...tableRoot, "table", id ?? "none"], () => api.diningTableById(id!), { enabled: Boolean(id) });
export const useCreateDiningTable = () => useWrite<unknown, string>(api.createDiningTable, [tableRoot]);
export const useUpdateDiningTable = () => useWrite<{ id: string; payload: unknown }, void>(
  ({ id, payload }) => api.updateDiningTable(id, payload), [tableRoot]);
export const useDeleteDiningTable = () => useWrite<string, void>(api.deleteDiningTable, [tableRoot]);
export const useUpdateTableStatus = () => useWrite<{ id: string; status: import("@/lib/types").TableStatus }, void>(
  ({ id, status }) => api.updateTableStatus(id, status), [tableRoot]);
export const useTransferTable = () => useWrite<{ fromTableId: string; toTableId: string }, void>(
  ({ fromTableId, toTableId }) => api.transferTable(fromTableId, toTableId), [tableRoot]);
