import { apiClient } from "@/api/client";
import type { DiningAreaDto, DiningTableDto, TableStatus } from "@/lib/types";

export interface CreateDiningAreaRequest {
  name: string | null;
  description: string | null;
  displayPriority: number;
  isActive: boolean;
}

export interface UpdateDiningAreaRequest extends CreateDiningAreaRequest {
  id: string;
}

export interface CreateDiningTableRequest {
  diningAreaId: string;
  code: string | null;
  name: string | null;
  capacity: number;
  displayPriority: number;
  isActive: boolean;
}

export interface UpdateDiningTableRequest extends CreateDiningTableRequest {
  id: string;
}

export interface TransferTableRequest {
  sourceTableId: string;
  targetTableId: string;
}

/** Dining areas & tables domain (`Tables` API group). */
export const tablesService = {
  areas: (activeOnly = true) =>
    apiClient
      .get<DiningAreaDto[]>("/api/tables/areas", { params: { activeOnly } })
      .then((r) => r.data),

  area: (id: string) =>
    apiClient.get<DiningAreaDto>(`/api/tables/areas/${id}`).then((r) => r.data),

  createArea: (payload: CreateDiningAreaRequest) =>
    apiClient.post<string>("/api/tables/areas", payload).then((r) => r.data),

  updateArea: (id: string, payload: Omit<UpdateDiningAreaRequest, "id">) =>
    apiClient
      .put<void>(`/api/tables/areas/${id}`, { ...payload, id } satisfies UpdateDiningAreaRequest)
      .then((r) => r.data),

  deleteArea: (id: string) =>
    apiClient.delete<void>(`/api/tables/areas/${id}`).then((r) => r.data),

  tables: (activeOnly = true) =>
    apiClient
      .get<DiningTableDto[]>("/api/tables", { params: { activeOnly } })
      .then((r) => r.data),

  table: (id: string) =>
    apiClient.get<DiningTableDto>(`/api/tables/${id}`).then((r) => r.data),

  tablesByArea: (areaId: string, activeOnly = true) =>
    apiClient
      .get<DiningTableDto[]>(`/api/tables/by-area/${areaId}`, { params: { activeOnly } })
      .then((r) => r.data),

  createTable: (payload: CreateDiningTableRequest) =>
    apiClient.post<string>("/api/tables", payload).then((r) => r.data),

  updateTable: (id: string, payload: Omit<UpdateDiningTableRequest, "id">) =>
    apiClient
      .put<void>(`/api/tables/${id}`, { ...payload, id } satisfies UpdateDiningTableRequest)
      .then((r) => r.data),

  deleteTable: (id: string) =>
    apiClient.delete<void>(`/api/tables/${id}`).then((r) => r.data),

  setTableStatus: (id: string, status: TableStatus) =>
    apiClient
      .post<DiningTableDto>(`/api/tables/${id}/status`, { status } satisfies {
        status: TableStatus;
      })
      .then((r) => r.data),

  transfer: (sourceTableId: string, targetTableId: string) =>
    apiClient
      .post<void>("/api/tables/transfer", {
        sourceTableId,
        targetTableId,
      } satisfies TransferTableRequest)
      .then((r) => r.data),
};
