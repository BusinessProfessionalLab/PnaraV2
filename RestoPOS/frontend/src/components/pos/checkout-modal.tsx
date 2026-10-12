"use client";

import { useMutation } from "@tanstack/react-query";
import { Banknote, Loader2, Printer, Smartphone, Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { printOrderTickets } from "@/components/print/receipts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { errorMessage } from "@/api/errors";
import { useCartStore } from "@/lib/cart-store";
import { formatToman, formatTomanAmount, rialToToman } from "@/lib/currency";
import { syncCartToServer } from "@/lib/sync-cart";
import { cn } from "@/lib/cn";
import { useOrder, usePayCardToCard, usePayCash, usePosDevices, useSettleWithPos } from "@/api";
import { useSettings } from "@/api";
import type { OrderDto } from "@/lib/types";

type PaymentMethod = "Cash" | "LocalPC_POS" | "CardToCard";

const METHODS: { id: PaymentMethod; label: string; icon: typeof Banknote; hint: string }[] = [
  { id: "Cash", label: "نقدی", icon: Banknote, hint: "دریافت پول نقد" },
  { id: "LocalPC_POS", label: "کارتخوان", icon: Smartphone, hint: "دستگاه متصل" },
  { id: "CardToCard", label: "کارت به کارت", icon: Smartphone, hint: "شماره پیگیری" },
];

function remainingFor(order: OrderDto) {
  if (order.status === "Paid") return 0;
  const paid = order.payments
    .filter((payment) => payment.status === "Settled")
    .reduce((total, payment) => total + payment.amount, 0);
  return Math.max(0, order.grandTotal - paid);
}

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
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  // Cash is tendered in toman (the field label says so); cart math is in rial.
  // Kept as raw digits (no separators) so the input can be emptied while typing.
  // Deliberately starts empty — it is seeded every time the dialog opens.
  const [received, setReceived] = useState("");
  const [refNo, setRefNo] = useState("");
  const [deviceId, setDeviceId] = useState<string>("");
  const [waiting, setWaiting] = useState(false);
  const [width, setWidth] = useState<"80mm" | "58mm">("80mm");
  const [remainingRials, setRemainingRials] = useState(amount);

  /*
   * Settlement-state lifecycle.
   *
   * This component stays mounted for the whole POS session — only the Radix
   * dialog content mounts/unmounts — so its useState values survive across
   * opens and would otherwise leak from one settlement into the next.
   *
   * - Closing the dialog clears every piece of transient state (typed digits,
   *   reference number, selected device, POS polling flag) so the next open
   *   always starts clean.
   * - Opening it seeds the fields from the order that is on screen at that
   *   moment. The amount prop is read through a ref (not an effect dependency)
   *   so the seed always reflects the latest render and nothing resets the
   *   field while the user is editing inside an open dialog.
   */
  const amountRef = useRef(amount);
  amountRef.current = amount;
  const serverOrderIdRef = useRef(cart.serverOrderId);
  serverOrderIdRef.current = cart.serverOrderId;
  const linkedOrder = useOrder(cart.serverOrderId);
  const linkedOrderRef = useRef(linkedOrder.data);
  linkedOrderRef.current = linkedOrder.data;

  useEffect(() => {
    if (!open) {
      setMethod("Cash");
      setReceived("");
      setRefNo("");
      setDeviceId("");
      setWaiting(false);
      setRemainingRials(amountRef.current);
      return;
    }
    // Prefill the received field with the payable (converted to toman) so the
    // change row is correct immediately; a previous settlement's value can
    // never survive into this one.
    setMethod("Cash");
    const existingOrder = linkedOrderRef.current;
    const due = existingOrder && existingOrder.id === serverOrderIdRef.current
      ? remainingFor(existingOrder)
      : amountRef.current;
    setRemainingRials(due);
    setReceived(String(rialToToman(due)));
    setRefNo("");
    setDeviceId("");
    setWaiting(false);
  }, [open]);

  useEffect(() => {
    if (!open || !linkedOrder.data || linkedOrder.data.id !== cart.serverOrderId) return;
    const due = remainingFor(linkedOrder.data);
    setRemainingRials(due);
    setReceived(String(rialToToman(due)));
  }, [open, linkedOrder.data, cart.serverOrderId]);

  const devices = usePosDevices({ enabled: open });
  const settings = useSettings({ enabled: open });
  const payCash = usePayCash();
  const payCardToCard = usePayCardToCard();
  const settleWithPos = useSettleWithPos();

  const tenderedRials = Math.max(0, Math.round((Number(received) || 0) * 10));
  const amountToPayRials = Math.min(remainingRials, tenderedRials);
  const change = Math.max(0, (tenderedRials - remainingRials) / 10);

  const finish = async (order: OrderDto) => {
    const due = remainingFor(order);
    setRemainingRials(due);
    if (due > 0) {
      setReceived(String(rialToToman(due)));
      setRefNo("");
      toast.success(`بخشی از پرداخت ثبت شد؛ مانده ${formatToman(due)} است.`);
      return;
    }
    try {
      if (settings.data) printOrderTickets(order, settings.data, width);
    } catch {
      // Printing must never hide a successful settlement.
    }
    cart.clear();
    onOpenChange(false);
    toast.success("تسویه انجام شد و فیش‌ها ارسال شدند");
  };

  const cashMut = useMutation({
    mutationFn: async () => {
      const tendered = Number(received) || 0;
      if (tendered <= 0) {
        throw new Error("مبلغ پرداختی را وارد کنید.");
      }
      const order = await syncCartToServer();
      if (order.orderType === "Bar" && !order.diningTableId) {
        throw new Error("برای سفارش سالن، انتخاب میز الزامی است.");
      }
      const due = remainingFor(order);
      return payCash.mutateAsync({
        orderId: order.id,
        amount: Math.min(due, Math.round(tendered * 10)),
      });
    },
    onSuccess: (order) => finish(order),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const c2cMut = useMutation({
    mutationFn: async () => {
      const tracking = refNo.trim();
      if (!tracking) {
        throw new Error("شماره پیگیری را وارد کنید.");
      }
      if (amountToPayRials <= 0) throw new Error("مبلغ پرداختی را وارد کنید.");
      const order = await syncCartToServer();
      if (order.orderType === "Bar" && !order.diningTableId) {
        throw new Error("برای سفارش سالن، انتخاب میز الزامی است.");
      }
      return payCardToCard.mutateAsync({
        orderId: order.id,
        amount: Math.min(remainingFor(order), amountToPayRials),
        referenceNumber: tracking,
      });
    },
    onSuccess: (order) => finish(order),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const posMut = useMutation({
    mutationFn: async () => {
      if (!deviceId) throw new Error("کارت‌خوان را انتخاب کنید.");
      if (amountToPayRials <= 0) throw new Error("مبلغ پرداختی را وارد کنید.");
      setWaiting(true);
      const order = await syncCartToServer();
      if (order.orderType === "Bar" && !order.diningTableId) {
        throw new Error("برای سفارش سالن، انتخاب میز الزامی است.");
      }
      return settleWithPos.mutateAsync({ order, deviceId, amount: Math.min(remainingFor(order), amountToPayRials) });
    },
    onSuccess: (order) => finish(order),
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: () => setWaiting(false),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0">
        <DialogHeader>
          <DialogTitle>تسویه حساب</DialogTitle>
          <DialogDescription>
            روش پرداخت را انتخاب کنید و مبلغ را تأیید کنید.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5 py-5">
          <div className="flex items-end justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
            <div>
              <div className="text-[11px] font-medium text-muted-foreground">مانده قابل پرداخت</div>
              <div className="mt-0.5 text-2xl font-black text-primary tabular-nums">
                {formatToman(remainingRials)}
              </div>
            </div>
            {cart.orderType === "Bar" && cart.tableNumber ? (
              <span className="text-[11px] text-muted-foreground">میز {cart.tableNumber}</span>
            ) : null}
          </div>

          <Field label="مبلغ این بخش (تومان)">
            <MoneyInput value={received} onValueChange={setReceived} className="font-bold" />
          </Field>
          {tenderedRials > 0 && tenderedRials < remainingRials ? (
            <p className="-mt-3 text-xs text-muted-foreground">
              این پرداخت بخشی از سفارش را تسویه می‌کند؛ می‌توانید مانده را با روش دیگری بپردازید.
            </p>
          ) : null}

          {/* Payment method */}
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map((m) => {
              const active = method === m.id;
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  aria-pressed={active}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-[13px] font-semibold outline-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-ring/50",
                    active
                      ? "border-primary/40 bg-primary-soft text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
                  )}
                >
                  <Icon className="size-5" strokeWidth={1.9} aria-hidden />
                  {m.label}
                </button>
              );
            })}
          </div>

          {method === "Cash" ? (
            <div className="space-y-3 rounded-xl border border-border p-4">
              <div
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2 text-sm",
                  change > 0 ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
                )}
              >
                <span>بقیه</span>
                <span className="font-bold tabular-nums">{formatTomanAmount(change)}</span>
              </div>
              <Button
                className="w-full"
                size="lg"
                loading={cashMut.isPending}
                disabled={amountToPayRials <= 0}
                onClick={() => cashMut.mutate()}
              >
                تأیید دریافت نقد
              </Button>
            </div>
          ) : null}

          {method === "CardToCard" ? (
            <div className="space-y-3 rounded-xl border border-border p-4">
              <Field label="شماره پیگیری کارت به کارت">
                <Input
                  value={refNo}
                  onChange={(e) => setRefNo(e.target.value)}
                  placeholder="مثلاً ۱۲۳۴۵۶۷۸۹۰"
                />
              </Field>
              <Button
                className="w-full"
                size="lg"
                loading={c2cMut.isPending}
                disabled={!refNo.trim() || amountToPayRials <= 0}
                onClick={() => c2cMut.mutate()}
              >
                ثبت کارت به کارت
              </Button>
            </div>
          ) : null}

          {method === "LocalPC_POS" ? (
            <div className="space-y-3 rounded-xl border border-border p-4">
              <Field label="کارتخوان">
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
              </Field>
              {devices.isLoading ? (
                <p className="text-xs text-muted-foreground">در حال دریافت دستگاه‌ها…</p>
              ) : null}
              <Button
                className="w-full"
                size="lg"
                loading={posMut.isPending}
                disabled={!deviceId || amountToPayRials <= 0}
                onClick={() => posMut.mutate()}
              >
                ارسال مبلغ به دستگاه
              </Button>
            </div>
          ) : null}

          {waiting ? (
            <div className="flex items-center gap-3 rounded-xl border border-warning/25 bg-warning/10 p-4 text-warning">
              <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden />
              <div className="text-[13px] leading-5">
                <span className="font-bold">در انتظار پاسخ کارتخوان…</span>
                <span className="mt-0.5 flex items-center gap-1 text-xs opacity-80">
                  <Timer className="size-3.5" aria-hidden />
                  در صورت گذشت زمان، تراکنش لغو می‌شود
                </span>
              </div>
            </div>
          ) : null}

          {/* Receipt width */}
          <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-4">
            <span className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
              <Printer className="size-4" aria-hidden />
              عرض فیش
            </span>
            <div className="flex rounded-xl bg-muted p-1">
              {(["80mm", "58mm"] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  aria-pressed={width === w}
                  onClick={() => setWidth(w)}
                  className={cn(
                    "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-150",
                    width === w
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
