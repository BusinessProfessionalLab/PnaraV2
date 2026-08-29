import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthResponse } from "./types";

const COOKIE = "ti_session";

function setSessionCookie(on: boolean) {
  if (typeof document === "undefined") return;
  if (on) document.cookie = `${COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 14}; SameSite=Lax`;
  else document.cookie = `${COOKIE}=; path=/; max-age=0`;
}

type AuthState = {
  session: AuthResponse | null;
  setSession: (session: AuthResponse | null) => void;
  hasPermission: (code: string) => boolean;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      setSession: (session) => {
        setSessionCookie(Boolean(session));
        set({ session });
      },
      hasPermission: (code) => {
        const s = get().session;
        if (!s) return false;
        return s.roles.includes("SuperAdmin") || s.permissions.includes(code);
      },
      logout: () => {
        setSessionCookie(false);
        set({ session: null });
      },
    }),
    { name: "toastiran-auth" },
  ),
);

export function getAccessToken() {
  return useAuthStore.getState().session?.accessToken ?? null;
}

export function getRefreshToken() {
  return useAuthStore.getState().session?.refreshToken ?? null;
}
