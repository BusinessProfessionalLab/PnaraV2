"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/input";
import { api } from "@/lib/api";
import { playAlert } from "@/lib/theme";
import { createKitchenConnection, joinKitchen } from "@/lib/signalr";
import type { OrderDto } from "@/lib/types";
import { formatToman } from "@/lib/currency";

export function KdsBoard({ station }: { station: "kitchen" | "bar" }) {
  const qc = useQueryClient();
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

  return (
    <div className="min-h-screen bg-secondary p-4 text-white">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-black">{station === "bar" ? "نمایشگر باریستا" : "نمایشگر آشپزخانه"}</h1>
        <Badge variant={live === "on" ? "success" : live === "error" ? "danger" : "warning"}>
          SignalR {live === "on" ? "متصل" : live === "error" ? "قطع" : "در حال اتصال"}
        </Badge>
      </header>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tickets.map((order) => (
          <Card key={order.id} className="bg-white p-4 text-foreground">
            <div className="flex items-center justify-between">
              <div className="text-xl font-black">#{order.orderNumber}</div>
              <Badge>{order.status}</Badge>
            </div>
            <div className="text-sm text-muted-foreground">میز {order.tableNumber || "—"} · {formatToman(order.grandTotal)}</div>
            <ul className="mt-3 space-y-2">
              {(station === "bar" ? order.barItems : order.kitchenItems).map((item) => (
                <li key={item.id}>
                  <div className="text-lg font-black">
                    {item.quantity} × {item.title}
                  </div>
                  {item.modifiers.map((m) => (
                    <div key={m.id} className="text-sm">
                      • {m.name}
                    </div>
                  ))}
                  {item.notes ? <div className="font-bold text-primary">{item.notes}</div> : null}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              {order.status === "Submitted" ? (
                <Button onClick={() => statusMut.mutate({ id: order.id, status: "InPreparation" })}>شروع آماده‌سازی</Button>
              ) : null}
              {order.status === "InPreparation" ? (
                <Button variant="success" onClick={() => statusMut.mutate({ id: order.id, status: "Ready" })}>
                  آماده شد
                </Button>
              ) : null}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
