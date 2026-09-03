import { apiClient } from "@/api/client";
import type { AuthResponse } from "@/lib/types";

export interface LoginRequest {
  userName: string;
  password: string;
}

/** Authentication domain — pure API communication. */
export const authService = {
  login: (userName: string, password: string) =>
    apiClient
      .post<AuthResponse>("/api/auth/login", { userName, password } satisfies LoginRequest)
      .then((r) => r.data),

  refresh: (refreshToken: string) =>
    apiClient
      .post<AuthResponse>("/api/auth/refresh", { refreshToken })
      .then((r) => r.data),
};
