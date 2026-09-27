import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { staffService } from "@/services/staff.service";
import type { CreateStaffRequest, CreateRoleRequest, UpdateStaffRequest } from "@/services/staff.service";
import { roleKeys, staffKeys } from "./keys";

/** Staff list (admin → personnel). */
export function useStaff() {
  return useQuery({ queryKey: staffKeys.all, queryFn: staffService.list });
}

export function useStaffMember(staffId: string | null) {
  return useQuery({
    queryKey: staffKeys.detail(staffId ?? "none"),
    queryFn: () => staffService.byId(staffId as string),
    enabled: Boolean(staffId),
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateStaffRequest) => staffService.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: staffKeys.all }),
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ staffId, payload }: { staffId: string; payload: Omit<UpdateStaffRequest, "staffId"> }) =>
      staffService.update(staffId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: staffKeys.all }),
  });
}

export function useDeactivateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: staffService.deactivate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: staffKeys.all }),
  });
}

export function useChangeStaffPassword() {
  return useMutation({
    mutationFn: ({ staffId, newPassword }: { staffId: string; newPassword: string }) =>
      staffService.changePassword(staffId, newPassword),
  });
}

export function useAssignStaffRoles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ staffId, roles }: { staffId: string; roles: string[] }) =>
      staffService.assignRoles(staffId, roles),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: staffKeys.all }),
  });
}

/* --------------------------- roles & permissions -------------------------- */

/** Roles available on the staff form (`/api/staff/roles`). */
export function useStaffRoles() {
  return useQuery({ queryKey: staffKeys.roles, queryFn: staffService.roles });
}

export function useCreateStaffRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRoleRequest) => staffService.createRole(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.roles });
      queryClient.invalidateQueries({ queryKey: roleKeys.all });
    },
  });
}

export function useUpdateStaffRolePermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, permissions }: { roleId: string; permissions: string[] }) =>
      staffService.updateRolePermissions(roleId, permissions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.roles });
      queryClient.invalidateQueries({ queryKey: roleKeys.all });
    },
  });
}
