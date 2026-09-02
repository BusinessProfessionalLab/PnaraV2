"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Input, Label } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/pos";
  const setSession = useAuthStore((s) => s.setSession);
  const [userName, setUserName] = useState("admin");
  const [password, setPassword] = useState("Admin@12345");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const session = await api.login(userName, password);
      setSession(session);
      toast.success(`خوش آمدید ${session.fullName}`);
      router.replace(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ورود ناموفق");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-secondary p-6">
      <Card className="w-full max-w-md animate-fade-up p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10">
            <UtensilsCrossed className="size-6 text-primary" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-balance">
            ToastIran POS
          </h1>
          <p className="mt-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Pnara
          </p>
          <p className="mt-3 text-sm text-muted-foreground text-pretty">
            ورود صندوق‌دار / مدیر
          </p>
        </div>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <Label>نام کاربری</Label>
            <Input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div>
            <Label>رمز عبور</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <Button className="w-full" size="lg" disabled={loading}>
            {loading ? "در حال ورود..." : "ورود"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
