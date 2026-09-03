"use client";

import { MotionConfig } from "framer-motion";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { createQueryClient } from "@/lib/query-client";
import { TourHost } from "@/features/product-tour";
import { RouteView } from "./route-view";
import { ShortcutsFab } from "./shortcuts-fab";
import { ThemeEngine } from "./theme-engine";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={client}>
      {/* One motion knob for the whole app: reduced-motion systems get
          opacity-only transitions (no transforms) automatically. */}
      <MotionConfig reducedMotion="user">
        <ThemeEngine />
        {/* Whole-screen route switches (login/pos/admin/kds) rise in smoothly;
            nested templates handle transitions inside each shell. */}
        <RouteView>{children}</RouteView>
        {/* Bottom-left shortcuts launcher (POS + admin; includes the POS
            shortcut and global Ctrl/Cmd+Shift+N hotkeys). */}
        <ShortcutsFab />
        {/* First-login onboarding offers + refresh resume (client-side, safe no-op elsewhere). */}
        <TourHost />
        <Toaster position="top-center" dir="rtl" theme="light" closeButton />
      </MotionConfig>
    </QueryClientProvider>
  );
}
