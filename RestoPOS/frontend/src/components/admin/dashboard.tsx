"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, Badge } from "@/components/ui/input";
import { api } from "@/lib/api";
import { formatToman } from "@/lib/currency";

export function AdminDashboard() {
  const alerts = useQuery({ queryKey: ["stock-alerts"], queryFn: api.stockAlerts });
  const orders = useQuery({ queryKey: ["active-orders"], queryFn: api.activeOrders });
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const shift = useQuery({ queryKey: ["shift"], queryFn: api.currentShift });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">داشبورد {settings.data?.storeName}</h1>
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
