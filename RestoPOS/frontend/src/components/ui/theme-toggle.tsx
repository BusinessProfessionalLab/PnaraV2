"use client";

import { Moon, Sun } from "lucide-react";
import { useUiStore } from "@/lib/ui-store";
import { cn } from "@/lib/cn";

/**
 * Light/dark switch. Uses the shared UI store so the choice is persisted
 * and applied consistently across admin, POS, KDS and login.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const dark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? "فعال‌سازی تم روشن" : "فعال‌سازی تم تیره"}
      title={dark ? "تم روشن" : "تم تیره"}
      onClick={toggleTheme}
      className={cn(
        "flex size-9 items-center justify-center rounded-xl text-muted-foreground outline-none transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
        className,
      )}
    >
      {dark ? (
        <Sun className="size-[18px]" strokeWidth={1.8} aria-hidden />
      ) : (
        <Moon className="size-[18px]" strokeWidth={1.8} aria-hidden />
      )}
    </button>
  );
}
