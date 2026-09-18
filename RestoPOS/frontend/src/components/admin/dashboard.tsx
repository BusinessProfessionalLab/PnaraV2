"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, Badge, Input, Label } from "@/components/ui/input";
import { api } from "@/lib/api";
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
import { useActiveOrders } from "@/queries/orders";
import { useStockAlerts } from "@/queries/inventory";
import { useSettings } from "@/queries/settings";
import { useCurrentShift } from "@/queries/shift";
import { formatToman } from "@/lib/currency";
import type { ShiftDto } from "@/lib/types";

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
  const qc = useQueryClient();
  const alerts = useQuery({ queryKey: ["stock-alerts"], queryFn: api.stockAlerts });
  const orders = useQuery({ queryKey: ["active-orders"], queryFn: api.activeOrders });
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const shift = useQuery({ queryKey: ["shift"], queryFn: api.currentShift });
  const summary = useQuery({ queryKey: ["dash-summary-today"], queryFn: () => api.dashboardSummary("Today") });
  const history = useQuery({ queryKey: ["shift-history"], queryFn: () => api.shiftHistory(1, 20) });
  const orderHist = useQuery({
    queryKey: ["order-history-dash"],
    queryFn: () => api.orderHistory({ page: 1, pageSize: 10 }),
  });
  const alerts = useStockAlerts();
  const orders = useActiveOrders();
  const settings = useSettings();
  const shift = useCurrentShift();

  const [dropAmount, setDropAmount] = useState("");
  const [dropReason, setDropReason] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [paidReason, setPaidReason] = useState("");

  const cashDropMut = useMutation({
    mutationFn: () => {
      if (!shift.data) throw new Error("شیفت باز نیست.");
      const toman = Number(dropAmount);
      if (!toman || toman <= 0) throw new Error("مبلغ نامعتبر است.");
      return api.cashDrop(shift.data.id, toman * 10, dropReason.trim() || "برداشت صندوق");
    },
    onSuccess: () => {
      toast.success("برداشت صندوق ثبت شد");
      setDropAmount("");
      setDropReason("");
      qc.invalidateQueries({ queryKey: ["shift"] });
      qc.invalidateQueries({ queryKey: ["shift-history"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const paidOutMut = useMutation({
    mutationFn: () => {
      if (!shift.data) throw new Error("شیفت باز نیست.");
      const toman = Number(paidAmount);
      if (!toman || toman <= 0) throw new Error("مبلغ نامعتبر است.");
      return api.paidOut(shift.data.id, toman * 10, paidReason.trim() || "پرداخت از صندوق");
    },
    onSuccess: () => {
      toast.success("پرداخت از صندوق ثبت شد");
      setPaidAmount("");
      setPaidReason("");
      qc.invalidateQueries({ queryKey: ["shift"] });
      qc.invalidateQueries({ queryKey: ["shift-history"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const shiftRows = normalizeShifts(history.data);
  const cmp = summary.data?.comparisonWithPreviousPeriod;

  const alertCount = alerts.data?.length ?? 0;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">داشبورد {settings.data?.storeName}</h1>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">فروش خالص امروز</div>
          <div className="text-2xl font-black">{formatToman(summary.data?.netSales.rials ?? 0)}</div>
          {typeof cmp?.netSalesChangePercent === "number" ? (
            <div className="text-xs text-muted-foreground">{cmp.netSalesChangePercent.toFixed(1)}٪ نسبت به دیروز</div>
          ) : null}
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">فروش ناخالص امروز</div>
          <div className="text-2xl font-black">{formatToman(summary.data?.grossSales.rials ?? 0)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">سفارش‌های امروز</div>
          <div className="text-2xl font-black">{summary.data?.totalOrders ?? 0}</div>
          <div className="text-xs text-muted-foreground">
            پرداخت‌شده {summary.data?.paidOrdersCount ?? 0} · در انتظار {summary.data?.pendingOrdersCount ?? 0}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">میانگین فاکتور</div>
          <div className="text-2xl font-black">{formatToman(summary.data?.averageTicketSize.rials ?? 0)}</div>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">سفارش‌های فعال</div>
          <div className="text-3xl font-black">{orders.data?.length ?? 0}</div>
    <div data-tour="dashboard" className="space-y-6">
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

      {shift.data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3 p-4">
            <h2 className="font-black">برداشت صندوق (Cash Drop)</h2>
            <div>
              <Label>مبلغ (تومان)</Label>
              <Input type="number" value={dropAmount} onChange={(e) => setDropAmount(e.target.value)} />
            </div>
            <div>
              <Label>دلیل</Label>
              <Input value={dropReason} onChange={(e) => setDropReason(e.target.value)} placeholder="مثلاً انتقال به گاوصندوق" />
            </div>
            <Button disabled={cashDropMut.isPending} onClick={() => cashDropMut.mutate()}>
              ثبت برداشت
            </Button>
          </Card>
          <Card className="space-y-3 p-4">
            <h2 className="font-black">پرداخت از صندوق (Paid Out)</h2>
            <div>
              <Label>مبلغ (تومان)</Label>
              <Input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
            </div>
            <div>
              <Label>دلیل</Label>
              <Input value={paidReason} onChange={(e) => setPaidReason(e.target.value)} placeholder="مثلاً خرید ملزومات" />
            </div>
            <Button variant="secondary" disabled={paidOutMut.isPending} onClick={() => paidOutMut.mutate()}>
              ثبت پرداخت
            </Button>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-2 font-black">تاریخچه شیفت‌ها</h2>
          <div className="max-h-72 space-y-2 overflow-y-auto text-sm">
            {shiftRows.length === 0 ? <p className="text-muted-foreground">شیفتی ثبت نشده</p> : null}
            {shiftRows.map((s) => (
              <div key={s.id} className="flex items-center justify-between border-b py-2">
                <div>
                  <div className="font-bold">{new Date(s.openedAt).toLocaleString("fa-IR")}</div>
                  <div className="text-xs text-muted-foreground">
                    افتتاح {formatToman(s.openingCash)}
                    {s.closingCash != null ? ` · اختتام ${formatToman(s.closingCash)}` : ""}
                  </div>
                </div>
                <Badge variant={s.status === "Open" ? "success" : "outline"}>{s.status === "Open" ? "باز" : "بسته"}</Badge>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <h2 className="mb-2 font-black">آخرین سفارش‌ها</h2>
          <div className="max-h-72 space-y-2 overflow-y-auto text-sm">
            {(orderHist.data?.items ?? []).map((o) => (
              <div key={o.id} className="flex items-center justify-between border-b py-2">
                <div>
                  <div className="font-bold">{o.orderNumber}</div>
                  <div className="text-xs text-muted-foreground">{o.createdAtShamsi}</div>
                </div>
                <div className="text-left">
                  <div className="font-bold">{formatToman(o.grandTotal)}</div>
                  <Badge variant="outline">{o.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="mb-2 font-black">کسری موجودی</h2>
        {(alerts.data ?? []).map((a) => (
          <div key={a.inventoryItemId} className="flex justify-between border-b py-2 text-sm">
            <span>
              {a.name} ({a.sku})
            </span>
            <Badge variant="warning">موجودی {a.currentStock}</Badge>
          </div>
        ))}
      </Card>
      <Link className="text-primary font-bold" href="/pos">
        رفتن به صندوق لمسی →
      </Link>

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

function normalizeShifts(data: PaginatedOrArray | undefined): ShiftDto[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.items ?? [];
}

type PaginatedOrArray = ShiftDto[] | { items?: ShiftDto[] };
