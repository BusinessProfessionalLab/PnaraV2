"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { printOrderTickets } from "@/components/print/receipts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge, Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { useCartStore } from "@/lib/cart-store";
import { formatToman } from "@/lib/currency";
import { syncCartToServer } from "@/lib/sync-cart";

type PayMethod = "Cash" | "LocalPC_POS" | "CardToCard" | "Online";

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
  const [method, setMethod] = useState<PayMethod>("Cash");
  const [received, setReceived] = useState(amount);
  const [refNo, setRefNo] = useState("");
  const [deviceId, setDeviceId] = useState<string>("");
  const [waiting, setWaiting] = useState(false);
  const [width, setWidth] = useState<"80mm" | "58mm">("80mm");

  const orderId = cart.serverOrderId;
  const devices = useQuery({ queryKey: ["pos-devices"], queryFn: api.posDevices, enabled: open });
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.settings, enabled: open });
  const payments = useQuery({
    queryKey: ["payments-by-order", orderId],
    queryFn: () => api.paymentsByOrder(orderId!),
    enabled: open && !!orderId,
  });

  const finish = async (paidOrderId: string) => {
    const order = await api.getOrder(paidOrderId);
    if (settings.data) printOrderTickets(order, settings.data, width);
    cart.clear();
    qc.invalidateQueries({ queryKey: ["inventory"] });
    qc.invalidateQueries({ queryKey: ["customers"] });
    qc.invalidateQueries({ queryKey: ["payments-by-order"] });
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

  const onlineMut = useMutation({
    mutationFn: async () => {
      const order = await syncCartToServer();
      return api.payOnline(order.id, amount, refNo);
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
    onSuccess: (paidOrderId) => finish(paidOrderId),
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setWaiting(false),
  });

  const voidMut = useMutation({
    mutationFn: (paymentId: string) => api.voidPayment(paymentId, "لغو از صندوق"),
    onSuccess: () => {
      toast.success("پرداخت باطل شد");
      qc.invalidateQueries({ queryKey: ["payments-by-order", orderId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refundMut = useMutation({
    mutationFn: (p: { id: string; amount: number }) => api.refundPayment(p.id, p.amount, "استرداد از صندوق"),
    onSuccess: () => {
      toast.success("استرداد ثبت شد");
      qc.invalidateQueries({ queryKey: ["payments-by-order", orderId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>تسویه حساب</DialogTitle>
        <p className="text-2xl font-black text-primary">{formatToman(amount)}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["Cash", "نقدی"],
              ["LocalPC_POS", "کارتخوان"],
              ["CardToCard", "کارت به کارت"],
              ["Online", "آنلاین"],
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
        {method === "Online" ? (
          <div className="mt-4 space-y-2">
            <Input placeholder="کد پیگیری درگاه آنلاین" value={refNo} onChange={(e) => setRefNo(e.target.value)} />
            <Button className="w-full" size="lg" disabled={!refNo || onlineMut.isPending} onClick={() => onlineMut.mutate()}>
              ثبت پرداخت آنلاین
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

        {orderId ? (
          <div className="mt-4 space-y-2 rounded-2xl border p-3">
            <div className="font-bold">پرداخت‌های این سفارش</div>
            {(payments.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">هنوز پرداختی ثبت نشده</p>
            ) : (
              (payments.data ?? []).map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm">
                  <div>
                    <div className="font-bold">
                      {p.channel} · {formatToman(p.amount)}
                    </div>
                    <Badge variant={p.status === "Settled" ? "success" : "outline"}>{p.status}</Badge>
                  </div>
                  {p.status === "Settled" ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={voidMut.isPending} onClick={() => voidMut.mutate(p.id)}>
                        باطل
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={refundMut.isPending}
                        onClick={() => refundMut.mutate({ id: p.id, amount: p.amount })}
                      >
                        استرداد
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
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
