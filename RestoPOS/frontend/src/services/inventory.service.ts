import { api } from "@/lib/api";
import type {
  BaseUnit,
  InventoryItemDto,
  InventoryTransactionDto,
  StorageLocation,
} from "@/lib/types";

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

/** Inventory domain: stock levels, purchases, waste and transactions. */
export const inventoryService = {
  list: () => api.inventory() as Promise<InventoryItemDto[]>,

  transactions: (inventoryItemId?: string) =>
    api.inventoryTx(inventoryItemId) as Promise<InventoryTransactionDto[]>,

  createItem: (payload: CreateInventoryItemRequest) =>
    api.createInventoryItem({
      name: payload.name,
      sku: payload.sku,
      barcode: payload.barcode ?? null,
      category: payload.category ?? null,
      baseUnit: (payload.baseUnit ?? payload.unitOfMeasure ?? "Gram") as BaseUnit,
      minimumAlertStock: payload.minimumAlertStock ?? payload.reorderPoint ?? 0,
      optimalStock: payload.optimalStock ?? payload.safetyStock ?? 0,
      openingStock: payload.openingStock,
      openingUnitCostRials: payload.openingUnitCostRials ?? payload.costPrice ?? 0,
      storageLocation: payload.storageLocation ?? "CentralStorage",
      conversions: null,
    }),

  receiveStock: (payload: ReceiveStockRequest) => api.receiveStock(payload),

  recordWaste: (payload: RecordWasteRequest) => api.recordWaste(payload),
};
