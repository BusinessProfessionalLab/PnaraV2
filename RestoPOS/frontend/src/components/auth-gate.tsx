"use client";

import { useAuthStore } from "@/lib/auth-store";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Store } from "lucide-react";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const session = useAuthStore((s) => s.session);
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => setReady(true));
    if (useAuthStore.persist.hasHydrated()) setReady(true);
    return unsub;
  }, []);

  useEffect(() => {
    if (ready && !session) router.replace("/login");
  }, [ready, session, router]);

  if (!ready || !session) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6">
        <div className="flex size-12 animate-pulse items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Store className="size-6" strokeWidth={1.8} aria-hidden />
        </div>
        <p className="text-sm text-muted-foreground">در حال آماده‌سازی…</p>
      </div>
    );
  }
  return <>{children}</>;
}
