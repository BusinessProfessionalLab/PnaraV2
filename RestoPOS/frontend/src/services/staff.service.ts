import { apiClient } from "@/api/client";
import type { StaffDto } from "@/lib/types";

export interface CreateStaffRequest {
  userName: string;
  password: string;
  fullName: string;
  email: string | null;
  phoneNumber: string | null;
  personnelCode: string | null;
  roles: string[];
}

/** Staff (users & roles) domain — pure API communication. */
export const staffService = {
  list: () =>
    apiClient.get<StaffDto[]>("/api/staff").then((r) => r.data),

  create: (payload: CreateStaffRequest) =>
    apiClient.post<string>("/api/staff", payload).then((r) => r.data),
};
