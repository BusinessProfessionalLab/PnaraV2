import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { staffService } from "@/services/staff.service";
import { staffKeys } from "./keys";

/** Active staff list (admin → personnel). */
export function useStaff() {
  return useQuery({ queryKey: staffKeys.all, queryFn: staffService.list });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: staffService.create,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: staffKeys.all }),
  });
}
