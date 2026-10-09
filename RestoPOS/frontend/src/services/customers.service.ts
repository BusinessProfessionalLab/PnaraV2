import { apiClient } from "@/api/client";
import type { CustomerDto } from "@/lib/types";

/** Loyalty customers domain — pure API communication. */
export const customersService = {
  list: (term?: string) =>
    apiClient
      .get<CustomerDto[]>("/api/customers", {
        params: term ? { term } : undefined,
      })
      .then((r) => r.data),

  byPhone: (phone: string) =>
    apiClient
      .get<CustomerDto>(`/api/customers/${encodeURIComponent(phone)}`)
      .then((r) => r.data),
};
