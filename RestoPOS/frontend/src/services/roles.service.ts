import { apiClient } from "@/api/client";
import type { PermissionCatalogDto, RoleDto } from "@/lib/types";

export interface CreateRoleRequest {
  name: string | null;
  description: string | null;
  permissions: string[] | null;
}

export interface UpdateRolePermissionsRequest {
  roleId: string;
  permissions: string[] | null;
}

/** Roles & permissions domain (`Roles` API group). */
export const rolesService = {
  list: () => apiClient.get<RoleDto[]>("/api/roles").then((r) => r.data),

  create: (payload: CreateRoleRequest) =>
    apiClient.post<string>("/api/roles", payload).then((r) => r.data),

  /** Flat catalogue of every permission the backend knows about. */
  permissions: () =>
    apiClient.get<PermissionCatalogDto[]>("/api/roles/permissions").then((r) => r.data),

  updatePermissions: (roleId: string, permissions: string[]) =>
    apiClient
      .put<void>(`/api/roles/${roleId}/permissions`, {
        roleId,
        permissions,
      } satisfies UpdateRolePermissionsRequest)
      .then((r) => r.data),
};
