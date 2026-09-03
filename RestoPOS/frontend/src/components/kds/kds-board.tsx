"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChefHat,
  Coffee,
  LogOut,
  PlayCircle,
  Radio,
  Wifi,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { playAlert } from "@/lib/theme";
import { createKitchenConnection, joinKitchen } from "@/lib/signalr";
import type { OrderDto } from "@/lib/types";
import { formatToman } from "@/lib/currency";

const STATUS_META: Record<string, { label: string; badge: "default" | "warning" | "success" | "neutral" }> = {
  Submitted: { label: "در انتظار شروع", badge: "default" },
  InPreparation: { label: "در حال آماده‌سازی", badge: "warning" },
  Ready: { label: "آماده تحویل", badge: "success" },
};

export function KdsBoard({ station }: { station: "kitchen" | "bar" }) {
  const qc = useQueryClient();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const [live, setLive] = useState<"off" | "on" | "error">("off");
  const orders = useQuery({
    queryKey: ["active-orders"],
    queryFn: api.activeOrders,
    refetchInterval: 8000,
  });

  useEffect(() => {
    const connection = createKitchenConnection();
    let mounted = true;
    (async () => {
      try {
        await joinKitchen(connection, station);
        if (!mounted) return;
        setLive("on");
        const bump = (order: OrderDto) => {
          playAlert("new");
          toast.message(`سفارش جدید ${order.orderNumber}`);
          qc.invalidateQueries({ queryKey: ["active-orders"] });
        };
        connection.on("OrderUpdated", bump);
        connection.on("KitchenTicket", bump);
        connection.on("BarTicket", bump);
      } catch {
        if (mounted) setLive("error");
      }
    })();
    return () => {
      mounted = false;
      connection.stop();
    };
  }, [station, qc]);

  const tickets = (orders.data ?? []).filter((o) => {
    if (!["Submitted", "InPreparation", "Ready"].includes(o.status)) return false;
    const items = station === "bar" ? o.barItems : o.kitchenItems;
    return items.length > 0;
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.updateOrderStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["active-orders"] }),
  });

  const isBar = station === "bar";
  const title = isBar ? "نمایشگر بار" : "نمایشگر آشپزخانه";
  const Icon = isBar ? Coffee : ChefHat;

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[110rem] items-center gap-3 px-4 sm:px-6">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Icon className="size-[18px]" strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-bold leading-5">{title}</h1>
            <p className="text-[11px] text-muted-foreground">
              {tickets.length} سفارش فعال {isBar ? "· بار" : "· آشپزخانه"} · به‌روزرسانی زنده
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={live === "on" ? "success" : live === "error" ? "danger" : "warning"}
              className="gap-1.5"
            >
              {live === "on" ? (
                <Wifi className="size-3" aria-hidden />
              ) : (
                <WifiOff className="size-3" aria-hidden />
              )}
              {live === "on" ? "متصل" : live === "error" ? "قطع" : "در حال اتصال"}
            </Badge>
            <Link href="/pos" className="hidden sm:block">
              <Button size="sm" variant="ghost" className="text-muted-foreground">
                صندوق
              </Button>
            </Link>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              aria-label="خروج"
              onClick={() => {
                logout();
                router.push("/login");
              }}
            >
              <LogOut className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[110rem] p-4 sm:p-6">
        <div className="grid auto-rows-min grid-cols-1 content-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orders.isLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-3 rounded-2xl border border-border bg-card p-5">
                <div className="flex justify-between">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <Skeleton className="h-4 w-40" />
                <div className="space-y-2 pt-2">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-3/4" />
                </div>
                <Skeleton className="h-12 w-full" />
              </div>
            ))}

          {!orders.isLoading && tickets.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card/60 py-20 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Icon className="size-6" strokeWidth={1.6} aria-hidden />
              </div>
              <div>
                <p className="text-[15px] font-semibold">هیچ سفارش فعالی نیست</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  سفارش‌های جدید این نمایشگر به‌صورت زنده ظاهر می‌شوند
                </p>
              </div>
            </div>
          ) : null}

          {tickets.map((order) => {
            const meta = STATUS_META[order.status] ?? { label: order.status, badge: "neutral" as const };
            const items = isBar ? order.barItems : order.kitchenItems;
            const elapsed = Date.now() - new Date(order.submittedAt ?? order.createdAt).getTime();
            const minutes = Math.max(0, Math.floor(elapsed / 60_000));
            return (
              <Card
                key={order.id}
                className="flex flex-col gap-3 p-5 transition-shadow duration-150"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-2xl font-black tracking-tight tabular-nums">
                      #{order.orderNumber}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-muted-foreground">
                      <span>میز {order.tableNumber || "—"}</span>
                      <span aria-hidden>·</span>
                      <span className="font-medium text-foreground tabular-nums">
                        {formatToman(order.grandTotal)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge variant={meta.badge}>{meta.label}</Badge>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {minutes < 1 ? "همین حالا" : `${minutes} دقیقه`}
                    </span>
                  </div>
                </div>

                <ul className="divide-y divide-border/60 border-y border-border/60">
                  {items.map((item) => (
                    <li key={item.id} className="py-2.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[15px] font-bold leading-6">
                          <span className="tabular-nums">{item.quantity}×</span> {item.title}
                        </span>
                      </div>
                      {item.modifiers.length > 0 ? (
                        <div className="mt-1 space-y-0.5">
                          {item.modifiers.map((m) => (
                            <div key={m.id} className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                              <Radio className="size-3 rotate-90 text-border-strong" aria-hidden />
                              {m.name}
                              {m.quantity > 1 ? <span className="tabular-nums">× {m.quantity}</span> : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {item.notes ? (
                        <p className="mt-1.5 inline-flex rounded-lg bg-warning/10 px-2 py-1 text-[13px] font-semibold text-warning">
                          {item.notes}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto flex gap-2 pt-1">
                  {order.status === "Submitted" ? (
                    <Button
                      size="lg"
                      className="h-12 flex-1"
                      loading={statusMut.isPending}
                      onClick={() => statusMut.mutate({ id: order.id, status: "InPreparation" })}
                    >
                      <PlayCircle className="size-5" aria-hidden />
                      شروع آماده‌سازی
                    </Button>
                  ) : null}
                  {order.status === "InPreparation" ? (
                    <Button
                      size="lg"
                      variant="success"
                      className="h-12 flex-1"
                      loading={statusMut.isPending}
                      onClick={() => statusMut.mutate({ id: order.id, status: "Ready" })}
                    >
                      <CheckCircle2 className="size-5" aria-hidden />
                      آماده شد
                    </Button>
                  ) : null}
                  {order.status === "Ready" ? (
                    <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-success/25 bg-success/10 py-3 text-sm font-bold text-success">
                      <CheckCircle2 className="size-5" aria-hidden />
                      آماده تحویل است
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
