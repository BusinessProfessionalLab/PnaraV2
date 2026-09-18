"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, Badge, Input, Label } from "@/components/ui/input";
import { api } from "@/lib/api";
import { formatToman } from "@/lib/currency";
import type { ShiftDto } from "@/lib/types";

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
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">هشدار نقطه سفارش</div>
          <div className="text-3xl font-black text-amber-700">{alerts.data?.length ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">شیفت جاری</div>
          <div className="text-xl font-black">{shift.data ? "باز" : "بسته"}</div>
          {shift.data ? <div className="text-sm">شروع با {formatToman(shift.data.openingCash)}</div> : null}
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
    </div>
  );
}

function normalizeShifts(data: PaginatedOrArray | undefined): ShiftDto[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.items ?? [];
}

type PaginatedOrArray = ShiftDto[] | { items?: ShiftDto[] };
