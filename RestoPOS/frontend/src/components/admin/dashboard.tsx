"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  MonitorSmartphone,
  Package,
  ReceiptText,
  UtensilsCrossed,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api";
import { formatToman } from "@/lib/currency";

function StatSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className="h-8 w-16" />
    </div>
  );
}

const QUICK_LINKS = [
  {
    href: "/pos",
    icon: MonitorSmartphone,
    title: "صندوق لمسی",
    description: "ثبت سفارش و تسویه فروش",
  },
  {
    href: "/admin/reports",
    icon: BarChart3,
    title: "گزارش فروش",
    description: "عملکرد روزانه و دوره‌ای",
  },
  {
    href: "/admin/menu",
    icon: UtensilsCrossed,
    title: "منو و رسپی",
    description: "محصولات، افزودنی و BOM",
  },
  {
    href: "/admin/inventory",
    icon: Boxes,
    title: "انبار",
    description: "موجودی و گردش کالا",
  },
];

export function AdminDashboard() {
  const alerts = useQuery({ queryKey: ["stock-alerts"], queryFn: api.stockAlerts });
  const orders = useQuery({ queryKey: ["active-orders"], queryFn: api.activeOrders });
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const shift = useQuery({ queryKey: ["shift"], queryFn: api.currentShift });

  const alertCount = alerts.data?.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`داشبورد${settings.data?.storeName ? ` · ${settings.data.storeName}` : ""}`}
        description="نمای کلی وضعیت فروشگاه، موجودی و شیفت جاری"
        actions={
          <Button asChild>
            <Link href="/pos">
              صندوق لمسی
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
        }
      />

      {/* Primary metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <div className="text-[13px] font-medium text-muted-foreground">سفارش‌های فعال</div>
              {orders.isLoading ? (
                <StatSkeleton />
              ) : (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-3xl font-black tracking-tight tabular-nums">
                    {orders.data?.length ?? 0}
                  </span>
                  <span className="text-xs text-muted-foreground">در جریان</span>
                </div>
              )}
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <ReceiptText className="size-5" strokeWidth={1.75} aria-hidden />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <div className="text-[13px] font-medium text-muted-foreground">هشدار نقطه سفارش</div>
              {alerts.isLoading ? (
                <StatSkeleton />
              ) : (
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={`text-3xl font-black tracking-tight tabular-nums ${
                      alertCount > 0 ? "text-warning" : "text-foreground"
                    }`}
                  >
                    {alertCount}
                  </span>
                  <span className="text-xs text-muted-foreground">کالای رو به اتمام</span>
                </div>
              )}
            </div>
            <div
              className={`flex size-10 items-center justify-center rounded-xl ${
                alertCount > 0 ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"
              }`}
            >
              <AlertTriangle className="size-5" strokeWidth={1.75} aria-hidden />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <div className="text-[13px] font-medium text-muted-foreground">شیفت جاری</div>
              {shift.isLoading ? (
                <StatSkeleton />
              ) : shift.data ? (
                <>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-flex size-2.5 rounded-full bg-success" aria-hidden />
                    <span className="text-2xl font-black tracking-tight">باز</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                    صندوق افتتاح: {formatToman(shift.data.openingCash)}
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-flex size-2.5 rounded-full bg-muted-foreground/40" aria-hidden />
                    <span className="text-2xl font-black tracking-tight">بسته</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    شیفتی در جریان نیست — قبل از فروش باز کنید
                  </div>
                </>
              )}
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <CheckCircle2 className="size-5" strokeWidth={1.75} aria-hidden />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Low-stock alerts */}
        <Card className="self-start">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-5 py-4">
            <h2 className="flex items-center gap-2 text-[15px] font-bold">
              کسری موجودی
            </h2>
            {alerts.data?.length ? (
              <Badge variant="warning">{alertCount} کالا</Badge>
            ) : null}
          </div>
          {alerts.isLoading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : alertCount === 0 ? (
            <div className="p-5">
              <EmptyState
                compact
                icon={Package}
                title="موجودی همه کالاها کافی است"
                description="هشدار کسری ندارید؛ نقطه سفارش مجدد در انبار قابل تنظیم است"
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link href="/admin/inventory">مدیریت انبار</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {(alerts.data ?? []).map((a) => (
                <li key={a.inventoryItemId} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
                    <AlertTriangle className="size-4" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{a.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {a.sku} · نقطه سفارش {a.reorderPoint}
                    </div>
                  </div>
                  <Badge variant="warning" className="tabular-nums">
                    موجودی {a.currentStock}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Quick actions */}
        <Card className="self-start">
          <div className="border-b border-border/70 px-5 py-4">
            <h2 className="text-[15px] font-bold">دسترسی سریع</h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">مسیرهای پرکاربرد</p>
          </div>
          <div className="p-2.5">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group flex items-center gap-3 rounded-xl px-3 py-3 outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors duration-150 group-hover:bg-card group-hover:shadow-xs">
                    <Icon className="size-[18px]" strokeWidth={1.8} aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{link.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{link.description}</div>
                  </div>
                  <ChevronLeft
                    className="size-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground"
                    aria-hidden
                  />
                </Link>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
