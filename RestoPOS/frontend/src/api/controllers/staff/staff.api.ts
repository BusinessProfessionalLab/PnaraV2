import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/axios";
import { roleKeys, staffKeys } from "@/api/keys";
import type {
  PermissionCatalogItem,
  RoleDto,
  StaffDto,
} from "@/lib/types";

export interface CreateStaffRequest {
  userName: string;
  password: string;
  fullName: string;
  email: string | null;
  phoneNumber: string | null;
  personnelCode: string | null;
  roles: string[];
}

/**
 * StaffController — `api/staff` and `api/roles`.
 * Users, role assignment and the permission catalog.
 */
export const staffApi = {
  list: () => apiClient.get<StaffDto[]>("/api/staff").then((r) => r.data),

  byId: (staffId: string) =>
    apiClient.get<StaffDto>(`/api/staff/${staffId}`).then((r) => r.data),

  create: (payload: CreateStaffRequest) =>
    apiClient.post<string>("/api/staff", payload).then((r) => r.data),

  update: (staffId: string, payload: Record<string, unknown>) =>
    apiClient
      .put<void>(`/api/staff/${staffId}`, { ...payload, staffId })
      .then((r) => r.data),

  deactivate: (staffId: string) =>
    apiClient
      .post<void>(`/api/staff/${staffId}/deactivate`)
      .then((r) => r.data),

  changePassword: (staffId: string, newPassword: string) =>
    apiClient
      .post<void>(`/api/staff/${staffId}/password`, { staffId, newPassword })
      .then((r) => r.data),

  assignRoles: (staffId: string, roles: string[]) =>
    apiClient
      .post<void>(`/api/staff/${staffId}/roles`, { staffId, roles })
      .then((r) => r.data),

  staffRoles: () =>
    apiClient.get<RoleDto[]>("/api/staff/roles").then((r) => r.data),

  createStaffRole: (payload: Record<string, unknown>) =>
    apiClient.post<string>("/api/staff/roles", payload).then((r) => r.data),

  updateStaffRolePermissions: (roleId: string, permissions: string[]) =>
    apiClient
      .put<void>(`/api/staff/roles/${roleId}/permissions`, {
        roleId,
        permissions,
      })
      .then((r) => r.data),

  roles: () => apiClient.get<RoleDto[]>("/api/roles").then((r) => r.data),

  permissionCatalog: () =>
    apiClient
      .get<PermissionCatalogItem[]>("/api/roles/permissions")
      .then((r) => r.data),

  createRole: (payload: Record<string, unknown>) =>
    apiClient.post<string>("/api/roles", payload).then((r) => r.data),

  updateRolePermissions: (roleId: string, permissions: string[]) =>
    apiClient
      .put<void>(`/api/roles/${roleId}/permissions`, { roleId, permissions })
      .then((r) => r.data),
};

/* --------------------------------- hooks -------------------------------- */

/** Active staff list (admin → personnel). */
export function useStaff() {
  return useQuery({ queryKey: staffKeys.all, queryFn: staffApi.list });
}

export function useStaffMember(staffId: string | null) {
  return useQuery({
    queryKey: staffKeys.detail(staffId ?? ""),
    queryFn: () => staffApi.byId(staffId as string),
    enabled: Boolean(staffId),
  });
}

/** Role list — `/api/roles` with a `/api/staff/roles` fallback. */
export function useRoles() {
  return useQuery({
    queryKey: roleKeys.list,
    queryFn: async () => {
      try {
        return await staffApi.roles();
      } catch {
        return await staffApi.staffRoles();
      }
    },
  });
}

export function useStaffRoles() {
  return useQuery({
    queryKey: staffKeys.roles,
    queryFn: staffApi.staffRoles,
  });
}

export function usePermissionCatalog() {
  return useQuery({
    queryKey: roleKeys.permissions,
    queryFn: staffApi.permissionCatalog,
  });
}

function invalidateStaff(queryClient: ReturnType<typeof useQueryClient>) {
  return () => queryClient.invalidateQueries({ queryKey: staffKeys.all });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: staffApi.create,
    onSuccess: invalidateStaff(queryClient),
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      staffId,
      payload,
    }: {
      staffId: string;
      payload: Record<string, unknown>;
    }) => staffApi.update(staffId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: staffKeys.all });
      queryClient.invalidateQueries({
        queryKey: staffKeys.detail(variables.staffId),
      });
    },
  });
}

export function useDeactivateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: staffApi.deactivate,
    onSuccess: invalidateStaff(queryClient),
  });
}

export function useChangeStaffPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      staffId,
      newPassword,
    }: {
      staffId: string;
      newPassword: string;
    }) => staffApi.changePassword(staffId, newPassword),
    onSuccess: invalidateStaff(queryClient),
  });
}

export function useAssignStaffRoles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ staffId, roles }: { staffId: string; roles: string[] }) =>
      staffApi.assignRoles(staffId, roles),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: staffKeys.all });
      queryClient.invalidateQueries({
        queryKey: staffKeys.detail(variables.staffId),
      });
    },
  });
}

export function useCreateStaffRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: staffApi.createStaffRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.roles });
      queryClient.invalidateQueries({ queryKey: roleKeys.all });
    },
  });
}

export function useUpdateStaffRolePermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roleId,
      permissions,
    }: {
      roleId: string;
      permissions: string[];
    }) => staffApi.updateStaffRolePermissions(roleId, permissions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.roles });
      queryClient.invalidateQueries({ queryKey: roleKeys.all });
    },
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: staffApi.createRole,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roleKeys.all }),
  });
}

export function useUpdateRolePermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roleId,
      permissions,
    }: {
      roleId: string;
      permissions: string[];
    }) => staffApi.updateRolePermissions(roleId, permissions),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roleKeys.all }),
  });
}
