"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { applyTheme } from "@/lib/theme";
import { useCartStore } from "@/lib/cart-store";
import { useUiStore } from "@/lib/ui-store";

export function ThemeEngine() {
  const token = useAuthStore((s) => s.session?.accessToken);
  const theme = useUiStore((s) => s.theme);
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: api.settings,
    enabled: Boolean(token),
  });

  useEffect(() => {
    if (!data) return;
    applyTheme(data.primaryColor);
    useCartStore.getState().setVatRate(data.vatRate);
  }, [data]);

  // Reflect the persisted light/dark preference on <html>.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return null;
}
