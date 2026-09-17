import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tablesService } from "@/services/tables.service";
import type {
  CreateDiningAreaRequest,
  CreateDiningTableRequest,
  UpdateDiningAreaRequest,
  UpdateDiningTableRequest,
} from "@/services/tables.service";
import type { TableStatus } from "@/lib/types";
import { orderKeys, tableKeys } from "./keys";

function invalidateTables(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: tableKeys.all });
  queryClient.invalidateQueries({ queryKey: orderKeys.all });
}

/* --------------------------------- areas --------------------------------- */

export function useDiningAreas(activeOnly = true) {
  return useQuery({
    queryKey: tableKeys.areas(activeOnly),
    queryFn: () => tablesService.areas(activeOnly),
  });
}

export function useDiningArea(id: string | null) {
  return useQuery({
    queryKey: tableKeys.area(id ?? "none"),
    queryFn: () => tablesService.area(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateDiningArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDiningAreaRequest) => tablesService.createArea(payload),
    onSuccess: () => invalidateTables(queryClient),
  });
}

export function useUpdateDiningArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Omit<UpdateDiningAreaRequest, "id"> }) =>
      tablesService.updateArea(id, payload),
    onSuccess: () => invalidateTables(queryClient),
  });
}

export function useDeleteDiningArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: tablesService.deleteArea,
    onSuccess: () => invalidateTables(queryClient),
  });
}

/* --------------------------------- tables -------------------------------- */

export function useDiningTables(activeOnly = true) {
  return useQuery({
    queryKey: tableKeys.list(activeOnly),
    queryFn: () => tablesService.tables(activeOnly),
  });
}

export function useDiningTable(id: string | null) {
  return useQuery({
    queryKey: tableKeys.detail(id ?? "none"),
    queryFn: () => tablesService.table(id as string),
    enabled: Boolean(id),
  });
}

export function useTablesByArea(areaId: string | null, activeOnly = true) {
  return useQuery({
    queryKey: tableKeys.byArea(areaId ?? "none", activeOnly),
    queryFn: () => tablesService.tablesByArea(areaId as string, activeOnly),
    enabled: Boolean(areaId),
  });
}

export function useCreateDiningTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDiningTableRequest) => tablesService.createTable(payload),
    onSuccess: () => invalidateTables(queryClient),
  });
}

export function useUpdateDiningTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Omit<UpdateDiningTableRequest, "id"> }) =>
      tablesService.updateTable(id, payload),
    onSuccess: () => invalidateTables(queryClient),
  });
}

export function useDeleteDiningTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: tablesService.deleteTable,
    onSuccess: () => invalidateTables(queryClient),
  });
}

export function useSetTableStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TableStatus }) =>
      tablesService.setTableStatus(id, status),
    onSuccess: () => invalidateTables(queryClient),
  });
}

/** Moves the open bill from one table to another. */
export function useTransferTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sourceTableId,
      targetTableId,
    }: {
      sourceTableId: string;
      targetTableId: string;
    }) => tablesService.transfer(sourceTableId, targetTableId),
    onSuccess: () => invalidateTables(queryClient),
  });
}
