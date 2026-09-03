import { apiClient } from "@/api/client";
import type { InventoryItemDto, InventoryTransactionDto, UnitOfMeasure } from "@/lib/types";

export interface CreateInventoryItemRequest {
  name: string;
  sku: string;
  unitOfMeasure: UnitOfMeasure;
  reorderPoint: number;
  safetyStock: number;
  openingStock: number;
  costPrice: number;
}

export interface ReceiveStockRequest {
  inventoryItemId: string;
  quantity: number;
  unitCost: number;
  notes: string;
  batchReference?: string;
}

export interface RecordWasteRequest {
  inventoryItemId: string;
  quantity: number;
  notes: string;
}

/** Inventory domain: stock levels, purchases, waste and transactions. */
export const inventoryService = {
  list: () =>
    apiClient.get<InventoryItemDto[]>("/api/inventory").then((r) => r.data),

  transactions: (inventoryItemId?: string) =>
    apiClient
      .get<InventoryTransactionDto[]>("/api/inventory/transactions", {
        params: inventoryItemId ? { inventoryItemId } : undefined,
      })
      .then((r) => r.data),

  createItem: (payload: CreateInventoryItemRequest) =>
    apiClient
      .post<string>("/api/inventory/items", payload)
      .then((r) => r.data),

  receiveStock: (payload: ReceiveStockRequest) =>
    apiClient
      .post<string>("/api/inventory/receive", payload)
      .then((r) => r.data),

  recordWaste: (payload: RecordWasteRequest) =>
    apiClient.post<string>("/api/inventory/waste", payload).then((r) => r.data),
};
