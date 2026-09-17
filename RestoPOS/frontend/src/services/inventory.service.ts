import { apiClient } from "@/api/client";
import { unwrap, unwrapVoid } from "@/api/result";
import type {
  BaseUnit,
  CardexRowDto,
  InventoryItemDetailDto,
  InventoryItemListDto,
  InventoryTransactionListDto,
  InventoryTransactionType,
  InventoryValuationDto,
  PaginatedList,
  PurchaseInvoiceDetailDto,
  PurchaseInvoiceListDto,
  PurchaseInvoiceStatus,
  PurchasePaymentStatus,
  Result,
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

export interface InventoryItemsParams {
  page?: number;
  pageSize?: number;
  category?: string;
  storageLocation?: StorageLocation;
  search?: string;
  activeOnly?: boolean;
}

export interface CreateInventoryItemRequest {
  name: string | null;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  baseUnit: BaseUnit;
  minimumAlertStock: number;
  optimalStock: number;
  openingStock: number;
  openingUnitCostRials: number;
  storageLocation: StorageLocation;
  conversions: { unitName: string | null; factorToBase: number }[] | null;
}

export interface UpdateInventoryItemRequest {
  id: string;
  name: string | null;
  barcode: string | null;
  category: string | null;
  minimumAlertStock: number;
  optimalStock: number;
  storageLocation: StorageLocation;
  isActive: boolean;
  conversions: { unitName: string | null; factorToBase: number }[] | null;
}

export interface CreatePurchaseLineInput {
  inventoryItemId: string;
  quantity: number;
  unitPriceRials: number;
  purchaseUnit: BaseUnit;
  namedPurchaseUnit: string | null;
  lineDiscountRials: number;
}

export interface CreatePurchaseInvoiceRequest {
  invoiceNumber: string | null;
  supplierId: string | null;
  supplierName: string | null;
  supplierPhone: string | null;
  supplierContactPerson: string | null;
  supplierAddress: string | null;
  taxRials: number;
  discountRials: number;
  paymentStatus: PurchasePaymentStatus;
  notes: string | null;
  items: CreatePurchaseLineInput[] | null;
}

export interface UpdateDraftPurchaseRequest {
  id: string;
  taxRials: number;
  discountRials: number;
  paymentStatus: PurchasePaymentStatus;
  notes: string | null;
  items: CreatePurchaseLineInput[] | null;
}

export interface PurchaseListParams {
  page?: number;
  pageSize?: number;
  supplierId?: string;
  status?: PurchaseInvoiceStatus;
}

export interface WasteLineInput {
  inventoryItemId: string;
  quantityInBase: number;
  reason: WasteReason;
  notes: string | null;
}

export interface RecordWasteBatchRequest {
  notes: string | null;
  items: WasteLineInput[] | null;
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

export interface StartStockCountRequest {
  title: string | null;
  locationFilter: StorageLocation;
  notes: string | null;
}

export interface StockCountListParams {
  status?: StockCountStatus;
  page?: number;
  pageSize?: number;
}

export interface StockCountPhysicalInput {
  inventoryItemId: string;
  physicalCountQty: number;
}

export interface CreateStockTransferRequest {
  inventoryItemId: string;
  fromLocation: StorageLocation;
  toLocation: StorageLocation;
  quantityInBase: number;
  notes: string | null;
}

export interface StockTransferListParams {
  status?: StockTransferStatus;
  inventoryItemId?: string;
  page?: number;
  pageSize?: number;
}

export interface CardexParams {
  fromUtc?: string;
  toUtc?: string;
}

export interface InventoryTransactionsParams {
  inventoryItemId?: string;
  transactionType?: InventoryTransactionType;
  fromUtc?: string;
  toUtc?: string;
  page?: number;
  pageSize?: number;
}

export interface SupplierListParams {
  activeOnly?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateSupplierRequest {
  name: string | null;
  phone: string | null;
  contactPerson: string | null;
  address: string | null;
  isActive: boolean;
}

export interface UpdateSupplierRequest extends CreateSupplierRequest {
  id: string;
}

export interface CreateManualAdjustmentRequest {
  inventoryItemId: string;
  quantityDelta: number;
  notes: string | null;
}

/** Inventory domain: stock, purchasing, waste, counts, transfers, suppliers. */
export const inventoryService = {
  /* --------------------------------- items -------------------------------- */
  list: (params: InventoryItemsParams = {}) =>
    apiClient
      .get<Result<PaginatedList<InventoryItemListDto>>>("/api/inventory/items", { params })
      .then((r) => unwrap(r.data)),

  item: (id: string) =>
    apiClient
      .get<Result<InventoryItemDetailDto>>(`/api/inventory/items/${id}`)
      .then((r) => unwrap(r.data)),

  createItem: (payload: CreateInventoryItemRequest) =>
    apiClient
      .post<Result<string>>("/api/inventory/items", payload)
      .then((r) => unwrap(r.data)),

  updateItem: (id: string, payload: Omit<UpdateInventoryItemRequest, "id">) =>
    apiClient
      .put<Result>(`/api/inventory/items/${id}`, {
        ...payload,
        id,
      } satisfies UpdateInventoryItemRequest)
      .then((r) => unwrapVoid(r.data)),

  deleteItem: (id: string) =>
    apiClient.delete<Result>(`/api/inventory/items/${id}`).then((r) => unwrapVoid(r.data)),

  lowStock: () =>
    apiClient
      .get<Result<InventoryItemListDto[]>>("/api/inventory/low-stock")
      .then((r) => unwrap(r.data)),

  valuation: () =>
    apiClient
      .get<Result<InventoryValuationDto>>("/api/inventory/valuation")
      .then((r) => unwrap(r.data)),

  /* ------------------------------- purchases ------------------------------ */
  purchases: (params: PurchaseListParams = {}) =>
    apiClient
      .get<Result<PaginatedList<PurchaseInvoiceListDto>>>("/api/inventory/purchases", {
        params,
      })
      .then((r) => unwrap(r.data)),

  purchase: (id: string) =>
    apiClient
      .get<Result<PurchaseInvoiceDetailDto>>(`/api/inventory/purchases/${id}`)
      .then((r) => unwrap(r.data)),

  createPurchase: (payload: CreatePurchaseInvoiceRequest) =>
    apiClient
      .post<Result<string>>("/api/inventory/purchases", payload)
      .then((r) => unwrap(r.data)),

  createDraftPurchase: (payload: CreatePurchaseInvoiceRequest) =>
    apiClient
      .post<Result<string>>("/api/inventory/purchases/draft", payload)
      .then((r) => unwrap(r.data)),

  updateDraftPurchase: (id: string, payload: Omit<UpdateDraftPurchaseRequest, "id">) =>
    apiClient
      .put<Result>(`/api/inventory/purchases/${id}/draft`, {
        ...payload,
        id,
      } satisfies UpdateDraftPurchaseRequest)
      .then((r) => unwrapVoid(r.data)),

  approvePurchase: (id: string) =>
    apiClient
      .post<Result>(`/api/inventory/purchases/${id}/approve`)
      .then((r) => unwrapVoid(r.data)),

  cancelPurchase: (id: string) =>
    apiClient
      .post<Result>(`/api/inventory/purchases/${id}/cancel`)
      .then((r) => unwrapVoid(r.data)),

  /* --------------------------------- waste -------------------------------- */
  recordWaste: (payload: RecordWasteBatchRequest) =>
    apiClient
      .post<Result<string>>("/api/inventory/waste", payload)
      .then((r) => unwrap(r.data)),

  wasteList: (params: WasteListParams = {}) =>
    apiClient
      .get<Result<PaginatedList<WasteDetailDto>>>("/api/inventory/waste", { params })
      .then((r) => unwrap(r.data)),

  waste: (id: string) =>
    apiClient
      .get<Result<WasteDetailDto>>(`/api/inventory/waste/${id}`)
      .then((r) => unwrap(r.data)),

  wasteReports: (params: WasteReportParams = {}) =>
    apiClient
      .get<Result<WasteReportRowDto[]>>("/api/inventory/waste/reports", { params })
      .then((r) => unwrap(r.data)),

  /* ------------------------------ stock counts ---------------------------- */
  startStockCount: (payload: StartStockCountRequest) =>
    apiClient
      .post<Result<string>>("/api/inventory/stock-counts/start", payload)
      .then((r) => unwrap(r.data)),

  saveStockCounts: (id: string, counts: StockCountPhysicalInput[]) =>
    apiClient
      .put<Result>(`/api/inventory/stock-counts/${id}/counts`, counts)
      .then((r) => unwrapVoid(r.data)),

  approveStockCount: (id: string) =>
    apiClient
      .post<Result>(`/api/inventory/stock-counts/${id}/approve`)
      .then((r) => unwrapVoid(r.data)),

  stockCount: (id: string) =>
    apiClient
      .get<Result<StockCountDetailDto>>(`/api/inventory/stock-counts/${id}`)
      .then((r) => unwrap(r.data)),

  stockCounts: (params: StockCountListParams = {}) =>
    apiClient
      .get<Result<PaginatedList<StockCountListDto>>>("/api/inventory/stock-counts", {
        params,
      })
      .then((r) => unwrap(r.data)),

  /* -------------------------------- transfers ----------------------------- */
  createTransfer: (payload: CreateStockTransferRequest) =>
    apiClient
      .post<Result<string>>("/api/inventory/transfers", payload)
      .then((r) => unwrap(r.data)),

  transfers: (params: StockTransferListParams = {}) =>
    apiClient
      .get<Result<PaginatedList<StockTransferDto>>>("/api/inventory/transfers", { params })
      .then((r) => unwrap(r.data)),

  completeTransfer: (id: string) =>
    apiClient
      .post<Result>(`/api/inventory/transfers/${id}/complete`)
      .then((r) => unwrapVoid(r.data)),

  cancelTransfer: (id: string) =>
    apiClient
      .post<Result>(`/api/inventory/transfers/${id}/cancel`)
      .then((r) => unwrapVoid(r.data)),

  /* ------------------------------ stock ledger ---------------------------- */
  cardex: (itemId: string, params: CardexParams = {}) =>
    apiClient
      .get<Result<CardexRowDto[]>>(`/api/inventory/cardex/${itemId}`, { params })
      .then((r) => unwrap(r.data)),

  transactions: (params: InventoryTransactionsParams = {}) =>
    apiClient
      .get<Result<PaginatedList<InventoryTransactionListDto>>>("/api/inventory/transactions", {
        params,
      })
      .then((r) => unwrap(r.data)),

  createAdjustment: (payload: CreateManualAdjustmentRequest) =>
    apiClient
      .post<Result<string>>("/api/inventory/adjustments", payload)
      .then((r) => unwrap(r.data)),

  /* ------------------------------- suppliers ------------------------------ */
  suppliers: (params: SupplierListParams = {}) =>
    apiClient
      .get<Result<PaginatedList<SupplierDto>>>("/api/inventory/suppliers", { params })
      .then((r) => unwrap(r.data)),

  supplier: (id: string) =>
    apiClient
      .get<Result<SupplierDto>>(`/api/inventory/suppliers/${id}`)
      .then((r) => unwrap(r.data)),

  createSupplier: (payload: CreateSupplierRequest) =>
    apiClient
      .post<Result<string>>("/api/inventory/suppliers", payload)
      .then((r) => unwrap(r.data)),

  updateSupplier: (id: string, payload: Omit<UpdateSupplierRequest, "id">) =>
    apiClient
      .put<Result>(`/api/inventory/suppliers/${id}`, {
        ...payload,
        id,
      } satisfies UpdateSupplierRequest)
      .then((r) => unwrapVoid(r.data)),

  deleteSupplier: (id: string) =>
    apiClient
      .delete<Result>(`/api/inventory/suppliers/${id}`)
      .then((r) => unwrapVoid(r.data)),
};
