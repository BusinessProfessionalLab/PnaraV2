"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Label } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/cn";

export function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/pos";
  const setSession = useAuthStore((s) => s.setSession);
  const [userName, setUserName] = useState("admin");
  const [password, setPassword] = useState("Admin@12345");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userName.trim() || !password) {
      toast.error("نام کاربری و رمز عبور را وارد کنید");
      return;
    }
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
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-4 py-10">
      {/* Soft radial tint — calm, barely-there brand presence */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[-30%] mx-auto h-72 w-[min(90vw,42rem)] rounded-full opacity-[0.5]"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--color-primary) 9%, transparent), transparent)",
        }}
      />
      <Card className="relative w-full max-w-sm animate-fade-up rounded-2xl p-7 shadow-md sm:p-8">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <Store className="size-6" strokeWidth={2} aria-hidden />
          </div>
          <h1 className="text-[1.4rem] font-bold tracking-tight">ToastIran POS</h1>
          <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">
            صندوق فروشگاهی و مدیریت رستوران و کافه
          </p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <Field label="نام کاربری" htmlFor="username">
            <Input
              id="username"
              name="username"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              autoComplete="username"
              placeholder="admin"
            />
          </Field>
          <Field label="رمز عبور" htmlFor="password">
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="pe-11"
                placeholder="••••••••"
              />
              <button
                type="button"
                aria-label={showPassword ? "پنهان کردن رمز" : "نمایش رمز"}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute end-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              </button>
            </div>
          </Field>
          <Button
            type="submit"
            className="w-full"
            size="lg"
            loading={loading}
          >
            {loading ? "در حال ورود…" : "ورود"}
          </Button>
        </form>

        <p className={cn("mt-6 text-center text-[11px] text-muted-foreground")}>
          ورود صندوق‌دار / مدیر · Pnara
        </p>
      </Card>
    </div>
  );
}
