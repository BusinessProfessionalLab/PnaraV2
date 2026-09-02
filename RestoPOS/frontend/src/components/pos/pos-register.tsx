"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Coffee,
  CreditCard,
  LayoutGrid,
  LogOut,
  Search,
  Settings2,
  Trash2,
  UtensilsCrossed,
  Wifi,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useCartStore } from "@/lib/cart-store";
import { formatToman } from "@/lib/currency";
import { toShamsiClock, toShamsiDate, weekdayFa } from "@/lib/jalali";
import { syncCartToServer } from "@/lib/sync-cart";
import type { CustomerDto, MenuItemDto } from "@/lib/types";
import { CheckoutModal } from "./checkout-modal";
import { ModifierDrawer } from "./modifier-drawer";

function fuzzyScore(query: string, text: string) {
  const q = query.normalize("NFKC").replace(/\s+/g, " ").trim();
  const t = text.normalize("NFKC").toLowerCase();
  if (!q) return 1;
  if (t.includes(q)) return 1000 + q.length;
  let qi = 0;
  let score = 0;
  let streak = 0;
  for (let i = 0; i < t.length && qi < q.length; i += 1) {
    if (t[i] === q[qi]) {
      qi += 1;
      streak += 1;
      score += 10 + streak;
    } else {
      streak = 0;
    }
  }
  return qi === q.length ? score : 0;
}

export function PosRegister() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const logout = useAuthStore((s) => s.logout);
  const cart = useCartStore();
  const [clock, setClock] = useState(new Date());
  const [online, setOnline] = useState(true);
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [picked, setPicked] = useState<MenuItemDto | null>(null);
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<"cart" | "drafts">("cart");
  const [checkout, setCheckout] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const health = useQuery({
    queryKey: ["health"],
    queryFn: api.health,
    refetchInterval: 15000,
  });
  useEffect(() => setOnline(health.isSuccess), [health.isSuccess]);

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.categories(false),
  });
  const menu = useQuery({
    queryKey: ["menu"],
    queryFn: () => api.menuItems(true),
  });
  const inventory = useQuery({
    queryKey: ["inventory"],
    queryFn: api.inventory,
  });
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const shift = useQuery({ queryKey: ["shift"], queryFn: api.currentShift });
  const drafts = useQuery({
    queryKey: ["order-drafts"],
    queryFn: api.draftOrders,
    refetchInterval: 10000,
  });

  const searchMatches = useMemo(() => {
    const items = menu.data ?? [];
    const term = q.trim().toLowerCase();
    return items.map((item) => {
      const hay = `${item.title} ${item.description ?? ""} ${item.categoryName} ${item.recipe?.lines.map((l) => l.inventoryItemId).join(" ")}`.toLowerCase();
      const skuHit = (inventory.data ?? []).some(
        (inv) =>
          inv.sku.toLowerCase().includes(term) &&
          item.recipe?.lines.some((l) => l.inventoryItemId === inv.id),
      );
      const score = !term ? 1 : Math.max(fuzzyScore(term, hay), skuHit ? 100 : 0);
      return { item, score };
    });
  }, [menu.data, q, inventory.data]);

  const filtered = useMemo(
    () =>
      searchMatches
        .filter(({ item, score }) => (categoryId === "all" || item.categoryId === categoryId) && score > 0)
        .sort((a, b) => b.score - a.score || a.item.displayPriority - b.item.displayPriority)
        .map(({ item }) => item),
    [searchMatches, categoryId],
  );

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { item, score } of searchMatches) {
      if (score > 0) counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1);
    }
    return counts;
  }, [searchMatches]);

  const totals = cart.totals();

  const draftMut = useMutation({
    mutationFn: syncCartToServer,
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ["order-drafts"] });
      cart.clear();
      toast.success(`پیش‌نویس ${order.orderNumber} ذخیره شد`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const loadDraftMut = useMutation({
    mutationFn: (orderId: string) => api.getOrder(orderId),
    onSuccess: (order) => {
      cart.loadDraft(order);
      setCheckout(true);
      toast.success(`پیش‌نویس ${order.orderNumber} باز شد`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const discardMut = useMutation({
    mutationFn: async () => {
      if (cart.serverOrderId) await api.discardDraft(cart.serverOrderId);
      cart.clear();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-drafts"] });
      toast.message("فاکتور نیمه‌کاره حذف شد");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendMut = useMutation({
    mutationFn: async () => {
      const order = await syncCartToServer();
      return api.submitOrder(order.id);
    },
    onSuccess: (order) => {
      toast.success(`ارسال شد: ${order.orderNumber}`);
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["order-drafts"] });
      cart.clear();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function stockOf(item: MenuItemDto): "ok" | "low" | "out" {
    if (!item.recipe?.lines.length) return "ok";
    const inv = inventory.data ?? [];
    let worst: "ok" | "low" | "out" = "ok";
    for (const line of item.recipe.lines) {
      const raw = inv.find((i) => i.id === line.inventoryItemId);
      if (!raw || raw.currentStock <= 0) return "out";
      if (raw.isLowStock || raw.currentStock < line.quantity) worst = "low";
    }
    return worst;
  }

  return (
    <div className="flex h-screen flex-col bg-[hsl(30_20%_94%)]">
      <header className="flex items-center gap-3 border-b bg-secondary px-4 py-2 text-secondary-foreground">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="h-5 w-5 text-primary" />
          <div>
            <div className="text-sm font-black">
              {settings.data?.storeName ?? "ToastIran POS"}
            </div>
            <div className="text-[11px] opacity-70">
              صندوق · {session?.fullName}
            </div>
          </div>
        </div>
        <Select
          value={cart.orderType}
          onValueChange={(v) =>
            cart.setMeta({
              orderType: v as typeof cart.orderType,
              ...(v === "DineIn" ? {} : { tableNumber: "" }),
            })
          }
        >
          <SelectTrigger className="h-10 w-36 bg-white/10 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DineIn">حضوری</SelectItem>
            <SelectItem value="Takeaway">بیرون‌بر</SelectItem>
            <SelectItem value="Bar">سالن</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="شماره میز"
          className={`h-10 w-28 bg-white/10 text-white placeholder:text-white/60 ${cart.orderType === "Bar" ? "" : "hidden"}`}
          value={cart.tableNumber}
          onChange={(e) => cart.setMeta({ tableNumber: e.target.value })}
        />
        <div className="ms-auto flex items-center gap-3 text-center">
          <div>
            <div className="font-mono text-lg font-black leading-none">
              {toShamsiClock(clock)}
            </div>
            <div className="text-[11px] opacity-70">
              {weekdayFa(clock)} {toShamsiDate(clock)}
            </div>
          </div>
          <Badge variant={online ? "success" : "danger"} className="gap-1">
            {online ? (
              <Wifi className="h-3 w-3" />
            ) : (
              <WifiOff className="h-3 w-3" />
            )}
            {online ? "POS آنلاین" : "قطع ارتباط"}
          </Badge>
          <Badge variant={shift.data ? "success" : "warning"}>
            {shift.data ? "شیفت باز" : "بدون شیفت"}
          </Badge>
          <Link href="/kds">
            <Button size="sm" variant="ghost" className="text-white">
              نمایشگر بار
            </Button>
          </Link>
          <Link href="/admin">
            <Button size="icon" variant="ghost" className="text-white">
              <Settings2 className="h-4 w-4" />
            </Button>
          </Link>
          <Button
            size="icon"
            variant="ghost"
            className="text-white"
            onClick={() => {
              logout();
              router.push("/login");
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1" dir="ltr">
        <section className="flex min-w-0 flex-1 flex-col p-3" dir="rtl">
          <div className="mb-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pr-9"
                placeholder="جستجو بر اساس نام، دسته یا SKU مواد..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setCategoryId("all")}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${categoryId === "all" ? "bg-primary text-white" : "bg-card"}`}
            >
              همه
            </button>
            {(categories.data ?? [])
              .slice()
              .sort((a, b) => a.displayPriority - b.displayPriority)
              .map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategoryId(c.id)}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${categoryId === c.id ? "bg-primary text-white" : "bg-card"}`}
                >
                  {c.name}
                  <span className="rounded-full bg-black/10 px-2 text-[11px]">{c.displayPriority}</span>
                </button>
              ))}
          </div>
          <div className="pos-scroll grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto md:grid-cols-3 xl:grid-cols-4">
            {filtered.map((item) => {
              const stock = stockOf(item);
              const discountPercent =
                item.discountPercent > 0
                  ? item.discountPercent
                  : item.categoryDiscountPercent ?? 0;
              const discountAmount = Math.round(
                (item.basePrice * Math.min(100, Math.max(0, discountPercent))) / 100,
              );
              const discountedPrice = item.basePrice - discountAmount;
              return (
                <motion.button
                  key={item.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setRightPanelTab("cart");
                    setEditingLineIndex(null);
                    cart.addLine(item, 1, []);
                  }}
                  className="overflow-hidden rounded-2xl border bg-card text-right shadow-sm"
                >
                  <div className="relative h-28 bg-muted">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Coffee className="h-10 w-10 text-muted-foreground" />
                      </div>
                    )}
                    <Badge
                      variant={
                        stock === "ok"
                          ? "success"
                          : stock === "low"
                            ? "warning"
                            : "danger"
                      }
                      className="absolute left-2 top-2"
                    >
                      {stock === "ok"
                        ? "موجود"
                        : stock === "low"
                          ? "نزدیک اتمام"
                          : "ناموجود"}
                    </Badge>
                  </div>
                  <div className="p-3">
                    <div className="font-bold">{item.title}</div>
                    {discountPercent > 0 ? (
                      <div className="mt-1 space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground line-through">
                            {formatToman(item.basePrice)}
                          </span>
                          <Badge variant="danger" className="text-[10px]">
                            {discountPercent}٪ تخفیف
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-black text-primary">
                            {formatToman(discountedPrice)}
                          </span>
                          <span className="text-[11px] text-emerald-700">
                            {formatToman(discountAmount)} صرفه‌جویی
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-primary">
                        {formatToman(item.basePrice)}
                      </div>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>

        <aside className="flex w-[380px] shrink-0 flex-col border-s bg-pos-ticket" dir="rtl">
          <div className="border-b p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-black">صورتحساب زنده</h2>
              {cart.serverOrderNumber ? (
                <Badge>{cart.serverOrderNumber}</Badge>
              ) : (
                <Badge variant="outline">محلی</Badge>
              )}
            </div>
            <Input
              className="hidden"
              placeholder="موبایل مشتری ۰۹۱۲..."
              value={cart.customerPhone}
              onChange={(e) =>
                cart.setMeta({
                  customerPhone: e.target.value.replace(/\D/g, "").slice(0, 11),
                })
              }
            />
            {null}
            <div className={rightPanelTab === "drafts" ? "mt-3 flex min-h-0 flex-1 flex-col rounded-xl border bg-amber-50 p-2" : "hidden"}>
              <div className="mb-2 flex items-center justify-between text-sm font-black">
                <span>پیش‌نویس‌های ذخیره‌شده</span>
                <Badge variant="warning">{drafts.data?.length ?? 0}</Badge>
              </div>
              <div className="pos-scroll flex-1 space-y-1 overflow-y-auto">
                {(drafts.data ?? []).map((draft) => (
                  <button
                    key={draft.id}
                    className={`w-full rounded-lg px-2 py-2 text-right text-xs hover:bg-amber-100 ${
                      cart.serverOrderId === draft.id ? "bg-amber-200" : ""
                    }`}
                    onClick={() => loadDraftMut.mutate(draft.id)}
                    disabled={loadDraftMut.isPending}
                  >
                    <div className="flex items-center justify-between gap-2 font-black">
                      <span>سفارش {draft.orderNumber}</span>
                      <span>{formatToman(draft.grandTotal)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                      {draft.customerPhone ? (
                        <span>مشتری: {draft.customerPhone}</span>
                      ) : null}
                      {draft.tableNumber ? (
                        <span>میز: {draft.tableNumber}</span>
                      ) : null}
                      <span>
                        {draft.orderType === "DineIn"
                          ? "حضوری"
                          : draft.orderType === "Takeaway"
                            ? "بیرون‌بر"
                            : "بار"}
                      </span>
                      <span>{draft.items.length} آیتم</span>
                    </div>
                    <div className="mt-1 truncate text-[11px] text-muted-foreground">
                      {draft.items
                        .slice(0, 2)
                        .map((item) => `${item.title} × ${item.quantity}`)
                        .join("، ")}
                      {draft.items.length > 2 ? "، ..." : ""}
                      {draft.notes ? ` · ${draft.notes}` : ""}
                    </div>
                  </button>
                ))}
                {!drafts.data?.length ? (
                  <p className="text-xs text-muted-foreground">
                    پیش‌نویسی وجود ندارد
                  </p>
                ) : null}
              </div>
            </div>
          </div>
          <div className={`pos-scroll flex-1 space-y-2 overflow-y-auto p-3 ${rightPanelTab === "cart" ? "" : "hidden"}`}>
            {cart.lines.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <LayoutGrid className="h-10 w-10" />
                <p>آیتمی انتخاب نشده</p>
              </div>
            ) : (
              cart.lines.map((line, lineIndex) => (
                <div
                  key={`${line.menuItemId}-${lineIndex}`}
                  className="cursor-pointer rounded-2xl border bg-white p-3 transition-colors hover:border-primary"
                  onClick={() => {
                    const menuItem = (menu.data ?? []).find(
                      (item) => item.id === line.menuItemId,
                    );
                    if (!menuItem) return;
                    setEditingLineIndex(lineIndex);
                    setPicked(menuItem);
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold">{line.title}</div>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {line.modifiers.map((m) => (
                          <Badge key={m.id} variant="outline">
                            {m.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        cart.removeLine(lineIndex);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          cart.updateQty(lineIndex, line.quantity - 1);
                        }}
                      >
                        −
                      </Button>
                      <span className="w-6 text-center font-black">
                        {line.quantity}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          cart.updateQty(lineIndex, line.quantity + 1);
                        }}
                      >
                        +
                      </Button>
                    </div>
                    <span className="font-bold">
                      {formatToman(
                        line.unitPrice * line.quantity +
                          line.modifiers.reduce(
                            (s, m) => s + m.extraPrice * m.quantity,
                            0,
                          ) *
                            line.quantity,
                      )}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className={`space-y-2 border-t bg-white p-4 [&>div:nth-child(2)]:hidden ${rightPanelTab === "cart" ? "" : "hidden"}`}>
            <Tot
              k={`جمع جزء (${cart.discountPercent}٪ تخفیف)`}
              v={formatToman(totals.subtotal)}
            />
            <Tot k="افزودنی" v={formatToman(totals.modifiersTotal)} />
            <div className="hidden">
              <Input
                type="number"
                placeholder="% تخفیف"
                value={cart.discountPercent || ""}
                onChange={(e) =>
                  cart.setMeta({ discountPercent: Number(e.target.value) || 0 })
                }
              />
              <Input
                type="number"
                placeholder="مبلغ تخفیف (ریال)"
                value={cart.discountAmount || ""}
                onChange={(e) =>
                  cart.setMeta({ discountAmount: Number(e.target.value) || 0 })
                }
              />
            </div>
            <Tot
              k={`ارزش افزوده (${Math.round(cart.vatRate * 100)}٪)`}
              v={formatToman(totals.taxAmount)}
            />
            <Tot k="قابل پرداخت" v={formatToman(totals.grandTotal)} big />
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                variant="outline"
                disabled={
                  !cart.lines.length ||
                  draftMut.isPending ||
                  sendMut.isPending ||
                  discardMut.isPending
                }
                onClick={() => draftMut.mutate()}
              >
                ثبت موقت
              </Button>
              <Button
                variant="destructive"
                disabled={
                  (!cart.lines.length && !cart.serverOrderId) ||
                  draftMut.isPending ||
                  sendMut.isPending ||
                  discardMut.isPending
                }
                onClick={() => discardMut.mutate()}
              >
                حذف نیمه‌کاره
              </Button>
              <Button
                className="hidden"
                variant="secondary"
                disabled={
                  !cart.lines.length ||
                  sendMut.isPending ||
                  draftMut.isPending ||
                  discardMut.isPending
                }
                onClick={() => sendMut.mutate()}
              >
                ارسال به بار/آشپزخانه
              </Button>
              <Button
                disabled={!cart.lines.length}
                onClick={() => setCheckout(true)}
              >
                <CreditCard className="h-4 w-4" />
                تسویه و پرداخت
              </Button>
            </div>
          </div>
        </aside>
      </div>

      <ModifierDrawer
        key={`${picked?.id ?? "none"}-${editingLineIndex ?? "new"}`}
        item={picked}
        initialQuantity={
          editingLineIndex === null ? 1 : cart.lines[editingLineIndex]?.quantity
        }
        initialNotes={
          editingLineIndex === null ? "" : cart.lines[editingLineIndex]?.notes
        }
        initialModifiers={
          editingLineIndex === null
            ? []
            : cart.lines[editingLineIndex]?.modifiers
        }
        onClose={() => {
          setPicked(null);
          setEditingLineIndex(null);
        }}
        onConfirm={(item, qty, mods, notes) => {
          if (editingLineIndex === null) cart.addLine(item, qty, mods, notes);
          else cart.updateLine(editingLineIndex, qty, mods, notes);
          setPicked(null);
          setEditingLineIndex(null);
        }}
      />
      <CheckoutModal
        open={checkout}
        onOpenChange={setCheckout}
        amount={totals.grandTotal}
      />
    </div>
  );
}

function Tot({ k, v, big }: { k: string; v: string; big?: boolean }) {
  return (
    <div
      className={`flex justify-between ${big ? "text-lg font-black text-primary" : "text-sm"}`}
    >
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CustomerBadge({
  phone,
  customer,
  error,
}: {
  phone: string;
  customer?: CustomerDto;
  error: unknown;
}) {
  if (!/^09\d{9}$/.test(phone)) return null;
  if (customer) {
    return (
      <div className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        مشتری وفادار — {customer.visitCount} سفارش قبلی ·{" "}
        {formatToman(customer.totalSpent)} خرید · {customer.loyaltyPoints}{" "}
        امتیاز
      </div>
    );
  }
  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className="mt-2 text-xs text-muted-foreground">
        مشتری جدید — در تسویه وارد باشگاه می‌شود
      </div>
    );
  }
  return null;
}
