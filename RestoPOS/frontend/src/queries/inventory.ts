import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { inventoryService } from "@/services/inventory.service";
import type {
  CardexParams,
  CreateInventoryItemRequest,
  CreateManualAdjustmentRequest,
  CreatePurchaseInvoiceRequest,
  CreateStockTransferRequest,
  CreateSupplierRequest,
  InventoryItemsParams,
  InventoryTransactionsParams,
  PurchaseListParams,
  RecordWasteBatchRequest,
  StartStockCountRequest,
  StockCountListParams,
  StockCountPhysicalInput,
  StockTransferListParams,
  SupplierListParams,
  UpdateDraftPurchaseRequest,
  UpdateInventoryItemRequest,
  UpdateSupplierRequest,
  WasteListParams,
  WasteReportParams,
} from "@/services/inventory.service";
import { reportsService } from "@/services/reports.service";
import { inventoryKeys, stockAlertKeys } from "./keys";

function invalidateStockAndAlerts(queryClient: QueryClient) {
  return () => {
    queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    queryClient.invalidateQueries({ queryKey: stockAlertKeys.all });
  };
}

/* --------------------------------- reads -------------------------------- */

export function useInventory(params: InventoryItemsParams = {}) {
  return useQuery({
    queryKey: inventoryKeys.list(params),
    queryFn: () => inventoryService.list(params),
  });
}

export function useInventoryItem(id: string | null) {
  return useQuery({
    queryKey: inventoryKeys.detail(id ?? "none"),
    queryFn: () => inventoryService.item(id as string),
    enabled: Boolean(id),
  });
}

export function useInventoryLowStock() {
  return useQuery({
    queryKey: inventoryKeys.lowStock,
    queryFn: inventoryService.lowStock,
  });
}

export function useInventoryValuation() {
  return useQuery({
    queryKey: inventoryKeys.valuation,
    queryFn: inventoryService.valuation,
  });
}

export function useInventoryTransactions(params: InventoryTransactionsParams = {}) {
  return useQuery({
    queryKey: inventoryKeys.transactions(params),
    queryFn: () => inventoryService.transactions(params),
  });
}

export function useInventoryCardex(itemId: string | null, params: CardexParams = {}) {
  return useQuery({
    queryKey: inventoryKeys.cardex(itemId ?? "none", params),
    queryFn: () => inventoryService.cardex(itemId as string, params),
    enabled: Boolean(itemId),
  });
}

export function useStockAlerts() {
  return useQuery({
    queryKey: stockAlertKeys.all,
    queryFn: reportsService.stockAlerts,
  });
}

/* --------------------------------- items -------------------------------- */

/** New goods plus purchase receipts — both change stock, tx log and alerts. */
export function useCreateInventoryItem() {
  const queryClient = useQueryClient();
  const invalidate = invalidateStockAndAlerts(queryClient);
  return useMutation({
    mutationFn: (payload: CreateInventoryItemRequest) => inventoryService.createItem(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateInventoryItem() {
  const queryClient = useQueryClient();
  const invalidate = invalidateStockAndAlerts(queryClient);
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Omit<UpdateInventoryItemRequest, "id"> }) =>
      inventoryService.updateItem(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteInventoryItem() {
  const queryClient = useQueryClient();
  const invalidate = invalidateStockAndAlerts(queryClient);
  return useMutation({
    mutationFn: inventoryService.deleteItem,
    onSuccess: invalidate,
  });
}

/** Manual stock correction (count results, breakage write-offs, …). */
export function useCreateAdjustment() {
  const queryClient = useQueryClient();
  const invalidate = invalidateStockAndAlerts(queryClient);
  return useMutation({
    mutationFn: (payload: CreateManualAdjustmentRequest) =>
      inventoryService.createAdjustment(payload),
    onSuccess: invalidate,
  });
}

/* ------------------------------- purchases ------------------------------ */

export function usePurchaseInvoices(params: PurchaseListParams = {}) {
  return useQuery({
    queryKey: inventoryKeys.purchases(params),
    queryFn: () => inventoryService.purchases(params),
  });
}

export function usePurchaseInvoice(id: string | null) {
  return useQuery({
    queryKey: inventoryKeys.purchase(id ?? "none"),
    queryFn: () => inventoryService.purchase(id as string),
    enabled: Boolean(id),
  });
}

export function useCreatePurchaseInvoice() {
  const queryClient = useQueryClient();
  const invalidate = invalidateStockAndAlerts(queryClient);
  return useMutation({
    mutationFn: (payload: CreatePurchaseInvoiceRequest) =>
      inventoryService.createPurchase(payload),
    onSuccess: invalidate,
  });
}

export function useCreateDraftPurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePurchaseInvoiceRequest) =>
      inventoryService.createDraftPurchase(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inventoryKeys.all }),
  });
}

export function useUpdateDraftPurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Omit<UpdateDraftPurchaseRequest, "id"> }) =>
      inventoryService.updateDraftPurchase(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inventoryKeys.all }),
  });
}

export function useApprovePurchase() {
  const queryClient = useQueryClient();
  const invalidate = invalidateStockAndAlerts(queryClient);
  return useMutation({
    mutationFn: inventoryService.approvePurchase,
    onSuccess: invalidate,
  });
}

export function useCancelPurchase() {
  const queryClient = useQueryClient();
  const invalidate = invalidateStockAndAlerts(queryClient);
  return useMutation({
    mutationFn: inventoryService.cancelPurchase,
    onSuccess: invalidate,
  });
}

/* --------------------------------- waste -------------------------------- */

export function useWasteRecords(params: WasteListParams = {}) {
  return useQuery({
    queryKey: inventoryKeys.waste(params),
    queryFn: () => inventoryService.wasteList(params),
  });
}

export function useWasteRecord(id: string | null) {
  return useQuery({
    queryKey: inventoryKeys.wasteDetail(id ?? "none"),
    queryFn: () => inventoryService.waste(id as string),
    enabled: Boolean(id),
  });
}

export function useWasteReports(params: WasteReportParams = {}) {
  return useQuery({
    queryKey: inventoryKeys.wasteReports(params),
    queryFn: () => inventoryService.wasteReports(params),
  });
}

/** Waste only touches stock levels and the transaction log. */
export function useRecordWaste() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RecordWasteBatchRequest) => inventoryService.recordWaste(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}

/* ------------------------------ stock counts ---------------------------- */

export function useStockCounts(params: StockCountListParams = {}) {
  return useQuery({
    queryKey: inventoryKeys.stockCounts(params),
    queryFn: () => inventoryService.stockCounts(params),
  });
}

export function useStockCount(id: string | null) {
  return useQuery({
    queryKey: inventoryKeys.stockCount(id ?? "none"),
    queryFn: () => inventoryService.stockCount(id as string),
    enabled: Boolean(id),
  });
}

export function useStartStockCount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: StartStockCountRequest) => inventoryService.startStockCount(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inventoryKeys.all }),
  });
}

export function useSaveStockCounts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, counts }: { id: string; counts: StockCountPhysicalInput[] }) =>
      inventoryService.saveStockCounts(id, counts),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inventoryKeys.all }),
  });
}

export function useApproveStockCount() {
  const queryClient = useQueryClient();
  const invalidate = invalidateStockAndAlerts(queryClient);
  return useMutation({
    mutationFn: inventoryService.approveStockCount,
    onSuccess: invalidate,
  });
}

/* -------------------------------- transfers ----------------------------- */

export function useStockTransfers(params: StockTransferListParams = {}) {
  return useQuery({
    queryKey: inventoryKeys.transfers(params),
    queryFn: () => inventoryService.transfers(params),
  });
}

export function useCreateTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateStockTransferRequest) => inventoryService.createTransfer(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inventoryKeys.all }),
  });
}

export function useCompleteTransfer() {
  const queryClient = useQueryClient();
  const invalidate = invalidateStockAndAlerts(queryClient);
  return useMutation({
    mutationFn: inventoryService.completeTransfer,
    onSuccess: invalidate,
  });
}

export function useCancelTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryService.cancelTransfer,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inventoryKeys.all }),
  });
}

/* ------------------------------- suppliers ------------------------------ */

export function useSuppliers(params: SupplierListParams = {}) {
  return useQuery({
    queryKey: inventoryKeys.suppliers(params),
    queryFn: () => inventoryService.suppliers(params),
  });
}

export function useSupplier(id: string | null) {
  return useQuery({
    queryKey: inventoryKeys.supplier(id ?? "none"),
    queryFn: () => inventoryService.supplier(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSupplierRequest) => inventoryService.createSupplier(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inventoryKeys.all }),
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Omit<UpdateSupplierRequest, "id"> }) =>
      inventoryService.updateSupplier(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inventoryKeys.all }),
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryService.deleteSupplier,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inventoryKeys.all }),
  });
}
