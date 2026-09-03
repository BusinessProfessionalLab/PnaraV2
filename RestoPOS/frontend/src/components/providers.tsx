"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { createQueryClient } from "@/lib/query-client";
import { ThemeEngine } from "./theme-engine";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={client}>
      <ThemeEngine />
      {children}
      <Toaster position="top-center" dir="rtl" theme="light" closeButton />
    </QueryClientProvider>
  );
}
