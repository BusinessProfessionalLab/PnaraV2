import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { inventoryService } from "@/services/inventory.service";
import { reportsService } from "@/services/reports.service";
import { inventoryKeys, stockAlertKeys } from "./keys";

export function useInventory() {
  return useQuery({ queryKey: inventoryKeys.all, queryFn: inventoryService.list });
}

export function useInventoryTransactions(inventoryItemId?: string) {
  return useQuery({
    queryKey: inventoryKeys.transactions(inventoryItemId),
    queryFn: () => inventoryService.transactions(inventoryItemId),
  });
}

export function useStockAlerts() {
  return useQuery({
    queryKey: stockAlertKeys.all,
    queryFn: reportsService.stockAlerts,
  });
}

function invalidateStockAndAlerts(queryClient: QueryClient) {
  return () => {
    queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    queryClient.invalidateQueries({ queryKey: stockAlertKeys.all });
  };
}

/** New goods plus purchase receipts — both change stock, tx log and alerts. */
export function useCreateInventoryItem() {
  const queryClient = useQueryClient();
  const invalidate = invalidateStockAndAlerts(queryClient);
  return useMutation({
    mutationFn: inventoryService.createItem,
    onSuccess: invalidate,
  });
}

export function useReceiveStock() {
  const queryClient = useQueryClient();
  const invalidate = invalidateStockAndAlerts(queryClient);
  return useMutation({
    mutationFn: inventoryService.receiveStock,
    onSuccess: invalidate,
  });
}

/** Waste only touches stock levels and the transaction log. */
export function useRecordWaste() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryService.recordWaste,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}
