import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rolesService } from "@/services/roles.service";
import type { CreateRoleRequest } from "@/services/roles.service";
import { roleKeys, staffKeys } from "./keys";

/** All roles with their granted permissions. */
export function useRoles() {
  return useQuery({ queryKey: roleKeys.all, queryFn: rolesService.list });
}

/** Flat catalogue of every permission code the backend exposes. */
export function usePermissionCatalog() {
  return useQuery({ queryKey: roleKeys.permissions, queryFn: rolesService.permissions });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRoleRequest) => rolesService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.all });
      queryClient.invalidateQueries({ queryKey: staffKeys.roles });
    },
  });
}

export function useUpdateRolePermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, permissions }: { roleId: string; permissions: string[] }) =>
      rolesService.updatePermissions(roleId, permissions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.all });
      queryClient.invalidateQueries({ queryKey: staffKeys.roles });
    },
  });
}
