"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { printOrderTickets } from "@/components/print/receipts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { useCartStore } from "@/lib/cart-store";
import { formatToman } from "@/lib/currency";
import { syncCartToServer } from "@/lib/sync-cart";

export function CheckoutModal({
  open,
  onOpenChange,
  amount,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  amount: number;
}) {
  const cart = useCartStore();
  const qc = useQueryClient();
  const [method, setMethod] = useState<"Cash" | "LocalPC_POS" | "CardToCard">("Cash");
  const [received, setReceived] = useState(amount);
  const [refNo, setRefNo] = useState("");
  const [deviceId, setDeviceId] = useState<string>("");
  const [waiting, setWaiting] = useState(false);
  const [width, setWidth] = useState<"80mm" | "58mm">("80mm");

  const devices = useQuery({ queryKey: ["pos-devices"], queryFn: api.posDevices, enabled: open });
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.settings, enabled: open });

  const finish = async (orderId: string) => {
    const order = await api.getOrder(orderId);
    if (settings.data) printOrderTickets(order, settings.data, width);
    cart.clear();
    qc.invalidateQueries({ queryKey: ["inventory"] });
    qc.invalidateQueries({ queryKey: ["customers"] });
    qc.invalidateQueries({ queryKey: ["orders-unpaid"] });
    onOpenChange(false);
    toast.success("تسویه انجام شد و فیش‌ها ارسال شدند");
  };

  const cashMut = useMutation({
    mutationFn: async () => {
      const order = await syncCartToServer();
      return api.payCash(order.id, amount);
    },
    onSuccess: (order) => finish(order.id),
    onError: (e: Error) => toast.error(e.message),
  });

  const c2cMut = useMutation({
    mutationFn: async () => {
      const order = await syncCartToServer();
      return api.payCardToCard(order.id, amount, refNo);
    },
    onSuccess: (order) => finish(order.id),
    onError: (e: Error) => toast.error(e.message),
  });

  const posMut = useMutation({
    mutationFn: async () => {
      if (!deviceId) throw new Error("کارتخوان را انتخاب کنید.");
      setWaiting(true);
      const order = await syncCartToServer();
      const submitted = order.status === "Draft" ? await api.submitOrder(order.id) : order;
      const payment = await api.initiatePos(submitted.id, deviceId);
      if (payment.status === "Settled") return submitted.id;
      const started = Date.now();
      while (Date.now() - started < 45_000) {
        await new Promise((r) => setTimeout(r, 1500));
        const polled = await api.pollPos(payment.id);
        if (polled.status === "Settled") return submitted.id;
        if (polled.status === "Failed") throw new Error("تراکنش کارتخوان ناموفق بود.");
      }
      throw new Error("زمان انتظار کارتخوان به پایان رسید.");
    },
    onSuccess: (orderId) => finish(orderId),
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setWaiting(false),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>تسویه حساب</DialogTitle>
        <p className="text-2xl font-black text-primary">{formatToman(amount)}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {(
            [
              ["Cash", "نقدی"],
              ["LocalPC_POS", "کارتخوان"],
              ["CardToCard", "کارت به کارت"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setMethod(id)}
              className={`rounded-2xl border py-4 font-bold ${method === id ? "border-primary bg-primary/10" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>
        {method === "Cash" ? (
          <div className="mt-4 space-y-2">
            <Input type="number" value={received} onChange={(e) => setReceived(Number(e.target.value))} />
            <p className="text-sm">باقی‌مانده / بقیه: {formatToman(Math.max(0, received - amount))}</p>
            <Button className="w-full" size="lg" disabled={cashMut.isPending} onClick={() => cashMut.mutate()}>
              تأیید دریافت نقد
            </Button>
          </div>
        ) : null}
        {method === "CardToCard" ? (
          <div className="mt-4 space-y-2">
            <Input placeholder="شماره پیگیری کارت‌به‌کارت" value={refNo} onChange={(e) => setRefNo(e.target.value)} />
            <Button className="w-full" size="lg" disabled={!refNo || c2cMut.isPending} onClick={() => c2cMut.mutate()}>
              ثبت کارت به کارت
            </Button>
          </div>
        ) : null}
        {method === "LocalPC_POS" ? (
          <div className="mt-4 space-y-2">
            <Select value={deviceId} onValueChange={setDeviceId}>
              <SelectTrigger>
                <SelectValue placeholder="انتخاب کارتخوان" />
              </SelectTrigger>
              <SelectContent>
                {(devices.data ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name} — {d.psp}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="w-full" size="lg" disabled={posMut.isPending} onClick={() => posMut.mutate()}>
              ارسال مبلغ به دستگاه کارتخوان
            </Button>
          </div>
        ) : null}
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span>عرض فیش:</span>
          <Button size="sm" variant={width === "80mm" ? "default" : "outline"} onClick={() => setWidth("80mm")}>
            80mm
          </Button>
          <Button size="sm" variant={width === "58mm" ? "default" : "outline"} onClick={() => setWidth("58mm")}>
            58mm
          </Button>
        </div>
        {waiting ? (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-amber-50 p-4 text-amber-900">
            <Loader2 className="h-5 w-5 animate-spin" />
            در انتظار پاسخ کارتخوان... در صورت Timeout تراکنش لغو می‌شود.
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
