import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark";

type UiState = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
};

/**
 * Persisted UI preferences. The theme toggle lives here so every shell
 * (admin, POS, KDS, login) shares one source of truth.
 */
export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      theme: "light",
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === "dark" ? "light" : "dark" }),
    }),
    { name: "toastiran-ui" },
  ),
);
