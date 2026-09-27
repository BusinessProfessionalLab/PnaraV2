import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { posDevicesService } from "@/services/pos-devices.service";
import type { CreatePosDeviceRequest, UpdatePosDeviceRequest } from "@/services/pos-devices.service";
import { paymentKeys, posDeviceKeys } from "./keys";

/** All registered bank-card terminals (admin view, inactive included). */
export function useAdminPosDevices(activeOnly = false) {
  return useQuery({
    queryKey: posDeviceKeys.list(activeOnly),
    queryFn: () => posDevicesService.list(activeOnly),
  });
}

export function useAdminPosDevice(id: string | null) {
  return useQuery({
    queryKey: posDeviceKeys.detail(id ?? "none"),
    queryFn: () => posDevicesService.get(id as string),
    enabled: Boolean(id),
  });
}

function invalidateDevices(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: posDeviceKeys.all });
  queryClient.invalidateQueries({ queryKey: paymentKeys.devices });
}

export function useCreatePosDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePosDeviceRequest) => posDevicesService.create(payload),
    onSuccess: () => invalidateDevices(queryClient),
  });
}

export function useUpdatePosDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Omit<UpdatePosDeviceRequest, "id"> }) =>
      posDevicesService.update(id, payload),
    onSuccess: () => invalidateDevices(queryClient),
  });
}

export function useDeletePosDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: posDevicesService.remove,
    onSuccess: () => invalidateDevices(queryClient),
  });
}

/** Sends a connectivity probe to the terminal and returns its result. */
export function useTestPosDevice() {
  return useMutation({ mutationFn: posDevicesService.test });
}
