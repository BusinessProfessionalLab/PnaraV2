import { useMutation } from "@tanstack/react-query";
import { authService } from "@/services/auth.service";

/** Signs the cashier/manager in. Session persistence is handled by auth-store. */
export function useLogin() {
  return useMutation({
    mutationFn: ({
      userName,
      password,
    }: {
      userName: string;
      password: string;
    }) => authService.login(userName, password),
  });
}
