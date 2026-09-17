import { apiClient } from "@/api/client";
import type { IranianPsp, PosDeviceDto, PosDeviceTestResult, PosProtocol } from "@/lib/types";

export interface CreatePosDeviceRequest {
  name: string | null;
  protocol: PosProtocol;
  psp: IranianPsp;
  ipAddress: string | null;
  port: number | null;
  comPort: string | null;
  baudRate: number | null;
  terminalId: string | null;
  merchantId: string | null;
  isActive: boolean;
}

export interface UpdatePosDeviceRequest extends CreatePosDeviceRequest {
  id: string;
}

/** Bank-card terminal administration (`PosDevices` API group). */
export const posDevicesService = {
  list: (activeOnly = false) =>
    apiClient.get<PosDeviceDto[]>("/api/pos-devices", { params: { activeOnly } }).then((r) => r.data),

  get: (id: string) =>
    apiClient.get<PosDeviceDto>(`/api/pos-devices/${id}`).then((r) => r.data),

  create: (payload: CreatePosDeviceRequest) =>
    apiClient.post<string>("/api/pos-devices", payload).then((r) => r.data),

  update: (id: string, payload: Omit<UpdatePosDeviceRequest, "id">) =>
    apiClient
      .put<void>(`/api/pos-devices/${id}`, { ...payload, id } satisfies UpdatePosDeviceRequest)
      .then((r) => r.data),

  remove: (id: string) =>
    apiClient.delete<void>(`/api/pos-devices/${id}`).then((r) => r.data),

  /** Connectivity probe against the configured terminal. */
  test: (id: string) =>
    apiClient
      .post<PosDeviceTestResult>(`/api/pos-devices/${id}/test`)
      .then((r) => r.data),
};
