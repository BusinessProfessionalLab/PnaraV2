"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Package } from "lucide-react";
import { Card, Badge } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api";
import { formatToman } from "@/lib/currency";

function StatCard({
  label,
  loading,
  children,
}: {
  label: string;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-16" />
      ) : (
        <div className="mt-1">{children}</div>
      )}
    </Card>
  );
}

export function AdminDashboard() {
  const alerts = useQuery({ queryKey: ["stock-alerts"], queryFn: api.stockAlerts });
  const orders = useQuery({ queryKey: ["active-orders"], queryFn: api.activeOrders });
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const shift = useQuery({ queryKey: ["shift"], queryFn: api.currentShift });

  return (
    <div className="space-y-6 animate-fade-up">
      <h1 className="text-2xl font-extrabold text-balance">
        داشبورد {settings.data?.storeName}
      </h1>
      <div className="grid gap-3 md:grid-cols-3">
        <StatCard label="سفارش‌های فعال" loading={orders.isLoading}>
          <div className="text-3xl font-black">{orders.data?.length ?? 0}</div>
        </StatCard>
        <StatCard label="هشدار نقطه سفارش" loading={alerts.isLoading}>
          <div className="text-3xl font-black text-amber-700">{alerts.data?.length ?? 0}</div>
        </StatCard>
        <StatCard label="شیفت جاری" loading={shift.isLoading}>
          <div className="text-xl font-extrabold">{shift.data ? "باز" : "بسته"}</div>
          {shift.data ? (
            <div className="mt-0.5 text-xs text-muted-foreground">
              شروع با {formatToman(shift.data.openingCash)}
            </div>
          ) : null}
        </StatCard>
      </div>

      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
          <AlertTriangle className="size-4 text-amber-600" />
          کسری موجودی
        </h2>
        {alerts.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (alerts.data ?? []).length === 0 ? (
          <EmptyState
            icon={Package}
            title="موجودی کافی است"
            description="هیچ هشدار کسری وجود ندارد"
          />
        ) : (
          (alerts.data ?? []).map((a) => (
            <div key={a.inventoryItemId} className="flex justify-between border-b py-2 text-sm">
              <span>
                {a.name} ({a.sku})
              </span>
              <Badge variant="warning">موجودی {a.currentStock}</Badge>
            </div>
          ))
        )}
      </Card>

      <Link
        className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline"
        href="/pos"
      >
        <ArrowLeft className="size-4" />
        رفتن به صندوق لمسی
      </Link>
    </div>
  );
}
