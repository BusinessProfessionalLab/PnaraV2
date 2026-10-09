import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/api/axios";
import { inventoryKeys, stockAlertKeys } from "@/api/keys";
import type {
  ApiResult,
  BaseUnit,
  CardexRowDto,
  InventoryItemDetailDto,
  InventoryItemDto,
  InventoryItemListDto,
  InventoryTransactionDto,
  InventoryTransactionListDto,
  InventoryValuationDto,
  PaginatedList,
  PurchaseInvoiceDetailDto,
  PurchaseInvoiceListDto,
  StockCountDetailDto,
  StockCountListDto,
  StockCountStatus,
  StockTransferDto,
  StockTransferStatus,
  StorageLocation,
  SupplierDto,
  WasteDetailDto,
  WasteReason,
  WasteReportRowDto,
} from "@/lib/types";

/* ----------------------------- Result envelope ---------------------------- */

/**
 * The InventoryController wraps every response in the backend `Result<T>`
 * envelope, so reads must unwrap `value` (and surface `errors` as failures).
 */
export function unwrapResult<T>(result: ApiResult<T> | T): T {
  if (
    result &&
    typeof result === "object" &&
    "succeeded" in (result as object)
  ) {
    const r = result as ApiResult<T>;
    if (!r.succeeded)
      throw new Error((r.errors ?? ["عملیات ناموفق"]).join(" | "));
    return r.value as T;
  }
  return result as T;
}

/* ------------------------------- request types ---------------------------- */

export interface CreateInventoryItemRequest {
  name: string;
  sku: string;
  /** Legacy alias — mapped to baseUnit */
  unitOfMeasure?: BaseUnit | string;
  baseUnit?: BaseUnit;
  reorderPoint?: number;
  minimumAlertStock?: number;
  safetyStock?: number;
  optimalStock?: number;
  openingStock: number;
  costPrice?: number;
  openingUnitCostRials?: number;
  barcode?: string | null;
  category?: string | null;
  storageLocation?: StorageLocation;
}

export interface InventoryItemsParams {
  page?: number;
  pageSize?: number;
  category?: string;
  storageLocation?: StorageLocation;
  search?: string;
  activeOnly?: boolean;
}

export interface ReceiveStockRequest {
  inventoryItemId: string;
  quantity: number;
  unitCost: number;
  notes?: string;
  batchReference?: string;
}

export interface RecordWasteRequest {
  inventoryItemId: string;
  quantity: number;
  notes?: string;
}

export interface WasteListParams {
  fromUtc?: string;
  toUtc?: string;
  page?: number;
  pageSize?: number;
}

export interface WasteReportParams {
  fromUtc?: string;
  toUtc?: string;
  reason?: WasteReason;
}

export interface PurchaseListParams {
  page?: number;
  pageSize?: number;
  supplierId?: string;
  status?: string;
}

export interface StockCountListParams {
  status?: StockCountStatus;
  page?: number;
  pageSize?: number;
}

export interface StockTransferListParams {
  status?: StockTransferStatus;
  inventoryItemId?: string;
  page?: number;
  pageSize?: number;
}

export interface SupplierListParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

/* --------------------------------- helpers -------------------------------- */

function mapInventoryItem(i: InventoryItemListDto): InventoryItemDto {
  return {
    ...i,
    unitOfMeasure: i.baseUnit,
    reorderPoint: i.minimumAlertStock,
    safetyStock: i.optimalStock,
    costPrice: i.lastPurchasePriceRials,
    averageCost: i.weightedAverageCostRials,
  };
}

/** InventoryController — `api/inventory`. */
export const inventoryApi = {
  /* --------------------------------- items -------------------------------- */
  list: async (): Promise<InventoryItemDto[]> => {
    const res = await apiClient.get<
      | ApiResult<PaginatedList<InventoryItemListDto>>
      | PaginatedList<InventoryItemListDto>
      | InventoryItemListDto[]
    >("/api/inventory/items", {
      params: { page: 1, pageSize: 200, activeOnly: true },
    });
    const unwrapped = unwrapResult(
      res.data as
        | ApiResult<PaginatedList<InventoryItemListDto>>
        | PaginatedList<InventoryItemListDto>,
    );
    const items = Array.isArray(unwrapped)
      ? unwrapped
      : (unwrapped.items ?? []);
    return items.map(mapInventoryItem);
  },

  itemsPaged: async (params: InventoryItemsParams = {}) => {
    const res = await apiClient.get<
      ApiResult<PaginatedList<InventoryItemListDto>>
    >("/api/inventory/items", { params });
    return unwrapResult(res.data);
  },

  item: async (id: string) => {
    const res = await apiClient.get<ApiResult<InventoryItemDetailDto>>(
      `/api/inventory/items/${id}`,
    );
    return unwrapResult(res.data);
  },

  createItem: async (payload: CreateInventoryItemRequest) => {
    const res = await apiClient.post<ApiResult<string>>("/api/inventory/items", {
      name: payload.name,
      sku: payload.sku,
      barcode: payload.barcode ?? null,
      category: payload.category ?? null,
      baseUnit: (payload.baseUnit ?? payload.unitOfMeasure ?? "Gram") as BaseUnit,
      minimumAlertStock:
        payload.minimumAlertStock ?? payload.reorderPoint ?? 0,
      optimalStock: payload.optimalStock ?? payload.safetyStock ?? 0,
      openingStock: payload.openingStock,
      openingUnitCostRials:
        payload.openingUnitCostRials ?? payload.costPrice ?? 0,
      storageLocation: payload.storageLocation ?? "CentralStorage",
      conversions: null,
    });
    return unwrapResult(res.data);
  },

  updateItem: async (id: string, payload: Record<string, unknown>) => {
    const res = await apiClient.put<ApiResult>(
      `/api/inventory/items/${id}`,
      { ...payload, id },
    );
    return unwrapResult(res.data);
  },

  deleteItem: async (id: string) => {
    const res = await apiClient.delete<ApiResult>(
      `/api/inventory/items/${id}`,
    );
    return unwrapResult(res.data);
  },

  lowStock: async () => {
    const res = await apiClient.get<ApiResult<InventoryItemListDto[]>>(
      "/api/inventory/low-stock",
    );
    return unwrapResult(res.data).map(mapInventoryItem);
  },

  valuation: async () => {
    const res = await apiClient.get<ApiResult<InventoryValuationDto>>(
      "/api/inventory/valuation",
    );
    return unwrapResult(res.data);
  },

  /* ------------------------------- purchases ------------------------------ */
  createPurchase: async (payload: Record<string, unknown>) => {
    const res = await apiClient.post<ApiResult<string>>(
      "/api/inventory/purchases",
      payload,
    );
    return unwrapResult(res.data);
  },

  /** Maps legacy receive UI → approved purchase invoice */
  receiveStock: async (payload: ReceiveStockRequest) => {
    const res = await apiClient.post<ApiResult<string>>(
      "/api/inventory/purchases",
      {
        invoiceNumber: payload.batchReference || `RCV-${Date.now()}`,
        supplierName: "دریافت سریع",
        taxRials: 0,
        discountRials: 0,
        paymentStatus: "Paid",
        notes: payload.notes,
        items: [
          {
            inventoryItemId: payload.inventoryItemId,
            quantity: payload.quantity,
            unitPriceRials: payload.unitCost,
            lineDiscountRials: 0,
          },
        ],
      },
    );
    return unwrapResult(res.data);
  },

  listPurchases: async (params: PurchaseListParams = {}) => {
    const res = await apiClient.get<
      ApiResult<PaginatedList<PurchaseInvoiceListDto>>
    >("/api/inventory/purchases", { params });
    return unwrapResult(res.data);
  },

  getPurchase: async (id: string) => {
    const res = await apiClient.get<ApiResult<PurchaseInvoiceDetailDto>>(
      `/api/inventory/purchases/${id}`,
    );
    return unwrapResult(res.data);
  },

  createDraftPurchase: async (payload: Record<string, unknown>) => {
    const res = await apiClient.post<ApiResult<string>>(
      "/api/inventory/purchases/draft",
      payload,
    );
    return unwrapResult(res.data);
  },

  updateDraftPurchase: async (id: string, payload: Record<string, unknown>) => {
    const res = await apiClient.put<ApiResult>(
      `/api/inventory/purchases/${id}/draft`,
      { ...payload, id },
    );
    return unwrapResult(res.data);
  },

  approvePurchase: async (id: string) => {
    const res = await apiClient.post<ApiResult>(
      `/api/inventory/purchases/${id}/approve`,
    );
    return unwrapResult(res.data);
  },

  cancelPurchase: async (id: string) => {
    const res = await apiClient.post<ApiResult>(
      `/api/inventory/purchases/${id}/cancel`,
    );
    return unwrapResult(res.data);
  },

  /* --------------------------------- waste -------------------------------- */
  recordWaste: async (
    payload:
      | RecordWasteRequest
      | { notes?: string; items: unknown[] },
  ) => {
    const body =
      "items" in payload
        ? payload
        : {
            notes: payload.notes,
            items: [
              {
                inventoryItemId: payload.inventoryItemId,
                quantityInBase: payload.quantity,
                reason: "Spoilage" as WasteReason,
                notes: payload.notes,
              },
            ],
          };
    const res = await apiClient.post<ApiResult<string>>(
      "/api/inventory/waste",
      body,
    );
    return unwrapResult(res.data);
  },

  wasteReports: async (params: WasteReportParams = {}) => {
    const res = await apiClient.get<ApiResult<WasteReportRowDto[]>>(
      "/api/inventory/waste/reports",
      { params },
    );
    return unwrapResult(res.data);
  },

  listWaste: async (params: WasteListParams = {}) => {
    const res = await apiClient.get<ApiResult<PaginatedList<WasteDetailDto>>>(
      "/api/inventory/waste",
      { params },
    );
    return unwrapResult(res.data);
  },

  getWaste: async (id: string) => {
    const res = await apiClient.get<ApiResult<WasteDetailDto>>(
      `/api/inventory/waste/${id}`,
    );
    return unwrapResult(res.data);
  },

  /* ------------------------------ stock counts ----------------------------- */
  startStockCount: async (payload: Record<string, unknown>) => {
    const res = await apiClient.post<ApiResult<string>>(
      "/api/inventory/stock-counts/start",
      payload,
    );
    return unwrapResult(res.data);
  },

  listStockCounts: async (params: StockCountListParams = {}) => {
    const res = await apiClient.get<
      ApiResult<PaginatedList<StockCountListDto>>
    >("/api/inventory/stock-counts", { params });
    return unwrapResult(res.data);
  },

  getStockCount: async (id: string) => {
    const res = await apiClient.get<ApiResult<StockCountDetailDto>>(
      `/api/inventory/stock-counts/${id}`,
    );
    return unwrapResult(res.data);
  },

  submitStockCounts: async (
    id: string,
    counts: { inventoryItemId: string; physicalCountQty: number }[],
  ) => {
    const res = await apiClient.put<ApiResult>(
      `/api/inventory/stock-counts/${id}/counts`,
      counts,
    );
    return unwrapResult(res.data);
  },

  approveStockCount: async (id: string) => {
    const res = await apiClient.post<ApiResult>(
      `/api/inventory/stock-counts/${id}/approve`,
    );
    return unwrapResult(res.data);
  },

  /* -------------------------------- transfers ------------------------------ */
  createTransfer: async (payload: Record<string, unknown>) => {
    const res = await apiClient.post<ApiResult<string>>(
      "/api/inventory/transfers",
      payload,
    );
    return unwrapResult(res.data);
  },

  listTransfers: async (params: StockTransferListParams = {}) => {
    const res = await apiClient.get<ApiResult<PaginatedList<StockTransferDto>>>(
      "/api/inventory/transfers",
      { params },
    );
    return unwrapResult(res.data);
  },

  completeTransfer: async (id: string) => {
    const res = await apiClient.post<ApiResult>(
      `/api/inventory/transfers/${id}/complete`,
    );
    return unwrapResult(res.data);
  },

  cancelTransfer: async (id: string) => {
    const res = await apiClient.post<ApiResult>(
      `/api/inventory/transfers/${id}/cancel`,
    );
    return unwrapResult(res.data);
  },

  /* --------------------------------- ledger -------------------------------- */
  cardex: async (itemId: string, fromUtc?: string, toUtc?: string) => {
    const res = await apiClient.get<ApiResult<CardexRowDto[]>>(
      `/api/inventory/cardex/${itemId}`,
      { params: { fromUtc, toUtc } },
    );
    return unwrapResult(res.data);
  },

  transactions: async (
    inventoryItemId?: string,
    page = 1,
    pageSize = 100,
  ): Promise<InventoryTransactionDto[]> => {
    const res = await apiClient.get<
      | ApiResult<PaginatedList<InventoryTransactionListDto>>
      | InventoryTransactionListDto[]
    >("/api/inventory/transactions", {
      params: { inventoryItemId, page, pageSize },
    });
    const data = unwrapResult(
      res.data as ApiResult<PaginatedList<InventoryTransactionListDto>>,
    );
    const items = Array.isArray(data) ? data : (data.items ?? []);
    return items.map((t) => ({
      ...t,
      type: t.transactionType,
      quantity: t.quantityDelta,
      unitCost: t.unitCostRials,
      occurredAt: t.createdAtUtc,
    }));
  },

  /* -------------------------------- suppliers ------------------------------ */
  listSuppliers: async (params: SupplierListParams = {}) => {
    const res = await apiClient.get<
      ApiResult<PaginatedList<SupplierDto> | SupplierDto[]>
    >("/api/inventory/suppliers", { params });
    return unwrapResult(res.data);
  },

  getSupplier: async (id: string) => {
    const res = await apiClient.get<ApiResult<SupplierDto>>(
      `/api/inventory/suppliers/${id}`,
    );
    return unwrapResult(res.data);
  },

  createSupplier: async (payload: Record<string, unknown>) => {
    const res = await apiClient.post<ApiResult<string>>(
      "/api/inventory/suppliers",
      payload,
    );
    return unwrapResult(res.data);
  },

  updateSupplier: async (id: string, payload: Record<string, unknown>) => {
    const res = await apiClient.put<ApiResult>(
      `/api/inventory/suppliers/${id}`,
      { ...payload, id },
    );
    return unwrapResult(res.data);
  },

  deleteSupplier: async (id: string) => {
    const res = await apiClient.delete<ApiResult>(
      `/api/inventory/suppliers/${id}`,
    );
    return unwrapResult(res.data);
  },

  /* ------------------------------- adjustments ----------------------------- */
  manualAdjustment: async (payload: {
    inventoryItemId: string;
    quantityDelta: number;
    notes?: string;
  }) => {
    const res = await apiClient.post<ApiResult<string>>(
      "/api/inventory/adjustments",
      payload,
    );
    return unwrapResult(res.data);
  },
};

/* ------------------------------ invalidation ----------------------------- */

function invalidateStockAndAlerts(queryClient: QueryClient) {
  return () => {
    queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    queryClient.invalidateQueries({ queryKey: stockAlertKeys.all });
  };
}

/* ---------------------------------- reads --------------------------------- */

export function useInventory() {
  return useQuery({ queryKey: inventoryKeys.all, queryFn: inventoryApi.list });
}

export function useInventoryItemsPaged(params: InventoryItemsParams = {}) {
  return useQuery({
    queryKey: [...inventoryKeys.all, "items", params] as const,
    queryFn: () => inventoryApi.itemsPaged(params),
  });
}

export function useInventoryItem(id: string | null) {
  return useQuery({
    queryKey: inventoryKeys.item(id ?? ""),
    queryFn: () => inventoryApi.item(id as string),
    enabled: Boolean(id),
  });
}

export function useLowStock() {
  return useQuery({
    queryKey: inventoryKeys.lowStock,
    queryFn: inventoryApi.lowStock,
  });
}

export function useInventoryValuation() {
  return useQuery({
    queryKey: inventoryKeys.valuation,
    queryFn: inventoryApi.valuation,
  });
}

export function useInventoryTransactions(inventoryItemId?: string) {
  return useQuery({
    queryKey: inventoryKeys.transactions(inventoryItemId),
    queryFn: () => inventoryApi.transactions(inventoryItemId),
  });
}

export function useCardex(itemId: string | null, fromUtc?: string, toUtc?: string) {
  return useQuery({
    queryKey: inventoryKeys.cardex(itemId ?? "", fromUtc, toUtc),
    queryFn: () => inventoryApi.cardex(itemId as string, fromUtc, toUtc),
    enabled: Boolean(itemId),
  });
}

export function usePurchases(params: PurchaseListParams = {}) {
  return useQuery({
    queryKey: inventoryKeys.purchases(params as Record<string, unknown>),
    queryFn: () => inventoryApi.listPurchases(params),
  });
}

export function usePurchase(id: string | null) {
  return useQuery({
    queryKey: inventoryKeys.purchase(id ?? ""),
    queryFn: () => inventoryApi.getPurchase(id as string),
    enabled: Boolean(id),
  });
}

export function useWasteList(params: WasteListParams = {}) {
  return useQuery({
    queryKey: inventoryKeys.waste(params as Record<string, unknown>),
    queryFn: () => inventoryApi.listWaste(params),
  });
}

export function useWasteReports(params: WasteReportParams = {}) {
  return useQuery({
    queryKey: inventoryKeys.wasteReports(
      params as Record<string, unknown>,
    ),
    queryFn: () => inventoryApi.wasteReports(params),
  });
}

export function useWaste(id: string | null) {
  return useQuery({
    queryKey: inventoryKeys.wasteDetail(id ?? ""),
    queryFn: () => inventoryApi.getWaste(id as string),
    enabled: Boolean(id),
  });
}

export function useStockCounts(params: StockCountListParams = {}) {
  return useQuery({
    queryKey: inventoryKeys.stockCounts(params as Record<string, unknown>),
    queryFn: () => inventoryApi.listStockCounts(params),
  });
}

export function useStockCount(id: string | null) {
  return useQuery({
    queryKey: inventoryKeys.stockCount(id ?? ""),
    queryFn: () => inventoryApi.getStockCount(id as string),
    enabled: Boolean(id),
  });
}

export function useTransfers(params: StockTransferListParams = {}) {
  return useQuery({
    queryKey: inventoryKeys.transfers(params as Record<string, unknown>),
    queryFn: () => inventoryApi.listTransfers(params),
  });
}

export function useSuppliers(params: SupplierListParams = {}) {
  return useQuery({
    queryKey: inventoryKeys.suppliers(params as Record<string, unknown>),
    queryFn: () => inventoryApi.listSuppliers(params),
  });
}

export function useSupplier(id: string | null) {
  return useQuery({
    queryKey: inventoryKeys.supplier(id ?? ""),
    queryFn: () => inventoryApi.getSupplier(id as string),
    enabled: Boolean(id),
  });
}

/* -------------------------------- mutations ------------------------------ */

export function useCreateInventoryItem() {
  const queryClient = useQueryClient();
  const invalidate = invalidateStockAndAlerts(queryClient);
  return useMutation({
    mutationFn: inventoryApi.createItem,
    onSuccess: invalidate,
  });
}

export function useUpdateInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Record<string, unknown>;
    }) => inventoryApi.updateItem(id, payload),
    onSuccess: invalidateStockAndAlerts(queryClient),
  });
}

export function useDeleteInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.deleteItem,
    onSuccess: invalidateStockAndAlerts(queryClient),
  });
}

export function useReceiveStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.receiveStock,
    onSuccess: invalidateStockAndAlerts(queryClient),
  });
}

export function useManualAdjustment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.manualAdjustment,
    onSuccess: invalidateStockAndAlerts(queryClient),
  });
}

/** Waste only touches stock levels and the transaction log. */
export function useRecordWaste() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.recordWaste,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}

function invalidatePurchases(queryClient: QueryClient) {
  return () => {
    queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    queryClient.invalidateQueries({ queryKey: stockAlertKeys.all });
  };
}

export function useCreatePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.createPurchase,
    onSuccess: invalidatePurchases(queryClient),
  });
}

export function useCreateDraftPurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.createDraftPurchase,
    onSuccess: invalidatePurchases(queryClient),
  });
}

export function useUpdateDraftPurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Record<string, unknown>;
    }) => inventoryApi.updateDraftPurchase(id, payload),
    onSuccess: invalidatePurchases(queryClient),
  });
}

export function useApprovePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.approvePurchase,
    onSuccess: invalidatePurchases(queryClient),
  });
}

export function useCancelPurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.cancelPurchase,
    onSuccess: invalidatePurchases(queryClient),
  });
}

function invalidateStockCounts(queryClient: QueryClient) {
  return () => {
    queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    queryClient.invalidateQueries({ queryKey: stockAlertKeys.all });
  };
}

export function useStartStockCount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.startStockCount,
    onSuccess: invalidateStockCounts(queryClient),
  });
}

export function useSubmitStockCounts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      counts,
    }: {
      id: string;
      counts: { inventoryItemId: string; physicalCountQty: number }[];
    }) => inventoryApi.submitStockCounts(id, counts),
    onSuccess: invalidateStockCounts(queryClient),
  });
}

export function useApproveStockCount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.approveStockCount,
    onSuccess: invalidateStockCounts(queryClient),
  });
}

function invalidateTransfers(queryClient: QueryClient) {
  return () => {
    queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
  };
}

export function useCreateTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.createTransfer,
    onSuccess: invalidateTransfers(queryClient),
  });
}

export function useCompleteTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.completeTransfer,
    onSuccess: invalidateTransfers(queryClient),
  });
}

export function useCancelTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.cancelTransfer,
    onSuccess: invalidateTransfers(queryClient),
  });
}

function invalidateSuppliers(queryClient: QueryClient) {
  return () =>
    queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.createSupplier,
    onSuccess: invalidateSuppliers(queryClient),
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Record<string, unknown>;
    }) => inventoryApi.updateSupplier(id, payload),
    onSuccess: invalidateSuppliers(queryClient),
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.deleteSupplier,
    onSuccess: invalidateSuppliers(queryClient),
  });
}
