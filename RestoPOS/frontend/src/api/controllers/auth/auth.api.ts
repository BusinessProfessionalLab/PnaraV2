import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/axios";
import type { AuthResponse } from "@/lib/types";

export interface LoginRequest {
  userName: string;
  password: string;
}

export interface LoginVariables {
  userName: string;
  password: string;
}

/** AuthController — `api/auth`. */
export const authApi = {
  login: (userName: string, password: string) =>
    apiClient
      .post<AuthResponse>("/api/auth/login", {
        userName,
        password,
      } satisfies LoginRequest)
      .then((r) => r.data),

  refresh: (refreshToken: string) =>
    apiClient
      .post<AuthResponse>("/api/auth/refresh", { refreshToken })
      .then((r) => r.data),
};

/** Signs the cashier/manager in. Session persistence is handled by auth-store. */
export function useLogin() {
  return useMutation({
    mutationFn: ({ userName, password }: LoginVariables) =>
      authApi.login(userName, password),
  });
}
