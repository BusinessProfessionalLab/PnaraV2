import { apiClient } from "@/api/client";
import type { RoleDto, StaffDto } from "@/lib/types";

export interface CreateStaffRequest {
  userName: string | null;
  password: string | null;
  fullName: string | null;
  email: string | null;
  phoneNumber: string | null;
  personnelCode: string | null;
  roles: string[] | null;
}

export interface UpdateStaffRequest {
  staffId: string;
  fullName: string | null;
  email: string | null;
  phoneNumber: string | null;
  personnelCode: string | null;
  isActive: boolean;
}

export interface ChangePasswordRequest {
  staffId: string;
  newPassword: string | null;
}

export interface AssignRolesRequest {
  staffId: string;
  roles: string[] | null;
}

export interface CreateRoleRequest {
  name: string | null;
  description: string | null;
  permissions: string[] | null;
}

export interface UpdateRolePermissionsRequest {
  roleId: string;
  permissions: string[] | null;
}

/** Staff (users & roles) domain — pure API communication. */
export const staffService = {
  list: () => apiClient.get<StaffDto[]>("/api/staff").then((r) => r.data),

  byId: (staffId: string) =>
    apiClient.get<StaffDto>(`/api/staff/${staffId}`).then((r) => r.data),

  create: (payload: CreateStaffRequest) =>
    apiClient.post<string>("/api/staff", payload).then((r) => r.data),

  update: (staffId: string, payload: Omit<UpdateStaffRequest, "staffId">) =>
    apiClient
      .put<void>(`/api/staff/${staffId}`, {
        ...payload,
        staffId,
      } satisfies UpdateStaffRequest)
      .then((r) => r.data),

  deactivate: (staffId: string) =>
    apiClient.post<void>(`/api/staff/${staffId}/deactivate`).then((r) => r.data),

  changePassword: (staffId: string, newPassword: string) =>
    apiClient
      .post<void>(`/api/staff/${staffId}/password`, {
        staffId,
        newPassword,
      } satisfies ChangePasswordRequest)
      .then((r) => r.data),

  assignRoles: (staffId: string, roles: string[]) =>
    apiClient
      .post<void>(`/api/staff/${staffId}/roles`, {
        staffId,
        roles,
      } satisfies AssignRolesRequest)
      .then((r) => r.data),

  /* ------------------------- roles (staff-scoped) ------------------------- */
  roles: () => apiClient.get<RoleDto[]>("/api/staff/roles").then((r) => r.data),

  createRole: (payload: CreateRoleRequest) =>
    apiClient.post<string>("/api/staff/roles", payload).then((r) => r.data),

  updateRolePermissions: (roleId: string, permissions: string[]) =>
    apiClient
      .put<void>(`/api/staff/roles/${roleId}/permissions`, {
        roleId,
        permissions,
      } satisfies UpdateRolePermissionsRequest)
      .then((r) => r.data),
};
