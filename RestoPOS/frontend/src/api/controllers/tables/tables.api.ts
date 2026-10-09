import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/axios";
import { diningAreaKeys, diningTableKeys } from "@/api/keys";
import type { DiningAreaDto, DiningTableDto, TableStatus } from "@/lib/types";

/** TablesController — `api/tables` (dining areas, tables, floor status). */
export const tablesApi = {
  /* ------------------------------ dining areas --------------------------- */
  areas: (activeOnly = true) =>
    apiClient
      .get<DiningAreaDto[]>("/api/tables/areas", { params: { activeOnly } })
      .then((r) => r.data),

  areaById: (id: string) =>
    apiClient.get<DiningAreaDto>(`/api/tables/areas/${id}`).then((r) => r.data),

  createArea: (payload: Record<string, unknown>) =>
    apiClient
      .post<string>("/api/tables/areas", payload)
      .then((r) => r.data),

  updateArea: (id: string, payload: Record<string, unknown>) =>
    apiClient
      .put<void>(`/api/tables/areas/${id}`, { ...payload, id })
      .then((r) => r.data),

  deleteArea: (id: string) =>
    apiClient.delete<void>(`/api/tables/areas/${id}`).then((r) => r.data),

  /* --------------------------------- tables ------------------------------ */
  tables: (activeOnly = true) =>
    apiClient
      .get<DiningTableDto[]>("/api/tables", { params: { activeOnly } })
      .then((r) => r.data),

  tablesByArea: (areaId: string, activeOnly = true) =>
    apiClient
      .get<DiningTableDto[]>(`/api/tables/by-area/${areaId}`, {
        params: { activeOnly },
      })
      .then((r) => r.data),

  tableById: (id: string) =>
    apiClient.get<DiningTableDto>(`/api/tables/${id}`).then((r) => r.data),

  createTable: (payload: Record<string, unknown>) =>
    apiClient.post<string>("/api/tables", payload).then((r) => r.data),

  updateTable: (id: string, payload: Record<string, unknown>) =>
    apiClient
      .put<void>(`/api/tables/${id}`, { ...payload, id })
      .then((r) => r.data),

  deleteTable: (id: string) =>
    apiClient.delete<void>(`/api/tables/${id}`).then((r) => r.data),

  updateTableStatus: (id: string, status: TableStatus) =>
    apiClient
      .post<void>(`/api/tables/${id}/status`, { id, status })
      .then((r) => r.data),

  transferTable: (fromTableId: string, toTableId: string) =>
    apiClient
      .post<void>("/api/tables/transfer", { fromTableId, toTableId })
      .then((r) => r.data),
};

/* --------------------------------- hooks -------------------------------- */

function invalidateAreas(queryClient: ReturnType<typeof useQueryClient>) {
  return () =>
    queryClient.invalidateQueries({ queryKey: diningAreaKeys.all });
}

function invalidateTables(queryClient: ReturnType<typeof useQueryClient>) {
  return () =>
    queryClient.invalidateQueries({ queryKey: diningTableKeys.all });
}

/* areas */

export function useDiningAreas(activeOnly = false) {
  return useQuery({
    queryKey: diningAreaKeys.list(activeOnly),
    queryFn: () => tablesApi.areas(activeOnly),
  });
}

export function useDiningArea(id: string | null) {
  return useQuery({
    queryKey: diningAreaKeys.detail(id ?? ""),
    queryFn: () => tablesApi.areaById(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateDiningArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: tablesApi.createArea,
    onSuccess: invalidateAreas(queryClient),
  });
}

export function useUpdateDiningArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Record<string, unknown>;
    }) => tablesApi.updateArea(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: diningAreaKeys.all });
      queryClient.invalidateQueries({ queryKey: diningTableKeys.all });
    },
  });
}

export function useDeleteDiningArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: tablesApi.deleteArea,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: diningAreaKeys.all });
      queryClient.invalidateQueries({ queryKey: diningTableKeys.all });
    },
  });
}

/* tables */

export function useDiningTables(activeOnly = false) {
  return useQuery({
    queryKey: diningTableKeys.list(activeOnly),
    queryFn: () => tablesApi.tables(activeOnly),
  });
}

export function useTablesByArea(areaId: string | null, activeOnly = false) {
  return useQuery({
    queryKey: diningTableKeys.byArea(areaId ?? "", activeOnly),
    queryFn: () => tablesApi.tablesByArea(areaId as string, activeOnly),
    enabled: Boolean(areaId),
  });
}

export function useDiningTable(id: string | null) {
  return useQuery({
    queryKey: diningTableKeys.detail(id ?? ""),
    queryFn: () => tablesApi.tableById(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateDiningTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: tablesApi.createTable,
    onSuccess: invalidateTables(queryClient),
  });
}

export function useUpdateDiningTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Record<string, unknown>;
    }) => tablesApi.updateTable(id, payload),
    onSuccess: invalidateTables(queryClient),
  });
}

export function useDeleteDiningTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: tablesApi.deleteTable,
    onSuccess: invalidateTables(queryClient),
  });
}

export function useUpdateTableStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TableStatus }) =>
      tablesApi.updateTableStatus(id, status),
    onSuccess: invalidateTables(queryClient),
  });
}

export function useTransferTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      fromTableId,
      toTableId,
    }: {
      fromTableId: string;
      toTableId: string;
    }) => tablesApi.transferTable(fromTableId, toTableId),
    onSuccess: invalidateTables(queryClient),
  });
}
