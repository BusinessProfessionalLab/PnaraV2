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
import { Skeleton } from "@/components/ui/skeleton";
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
import { fuzzyScore } from "@/lib/fuzzy-search";
import { CheckoutModal } from "./checkout-modal";
import { ModifierDrawer } from "./modifier-drawer";

export function PosRegister() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const logout = useAuthStore((s) => s.logout);
  const cart = useCartStore();
  const [clock, setClock] = useState(new Date());

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
  const pendingOrders = useQuery({
    queryKey: ["orders-unpaid"],
    queryFn: async () => {
      const orders = await api.activeOrders();
      return orders.filter(
        (order) => order.status !== "Paid" && order.status !== "Cancelled",
      );
    },
    refetchInterval: 10000,
  });

  const searchMatches = useMemo(() => {
    const items = menu.data ?? [];
    const term = q.trim();
    const skus = inventory.data ?? [];
    return items.map((item) => {
      // Build a rich haystack: title, description, category, recipe SKUs
      const skuText =
        item.recipe?.lines
          .map((l) => {
            const inv = skus.find((s) => s.id === l.inventoryItemId);
            return inv ? `${inv.sku} ${inv.name}` : "";
          })
          .join(" ") ?? "";
      const hay = `${item.title} ${item.description ?? ""} ${item.categoryName} ${skuText}`;
      const score = !term ? 1 : fuzzyScore(term, hay);
      return { item, score };
    });
  }, [menu.data, q, inventory.data]);

  const filtered = useMemo(
    () =>
      searchMatches
        .filter(
          ({ item, score }) =>
            (categoryId === "all" || item.categoryId === categoryId) &&
            score > 0,
        )
        .sort(
          (a, b) =>
            b.score - a.score ||
            a.item.displayPriority - b.item.displayPriority,
        )
        .map(({ item }) => item),
    [searchMatches, categoryId],
  );

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { item, score } of searchMatches) {
      if (score > 0)
        counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1);
    }
    return counts;
  }, [searchMatches]);

  const totals = cart.totals();

  const draftMut = useMutation({
    mutationFn: syncCartToServer,
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ["orders-unpaid"] });
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
      qc.invalidateQueries({ queryKey: ["orders-unpaid"] });
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
      qc.invalidateQueries({ queryKey: ["orders-unpaid"] });
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
    <div className="flex h-dvh flex-col bg-[hsl(30_20%_94%)]">
      <header className="flex items-center gap-3 border-b bg-secondary px-4 py-2 text-secondary-foreground">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="h-5 w-5 text-primary" strokeWidth={2} />
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
          <Badge
            variant={health.isSuccess ? "success" : "danger"}
            className="gap-1"
          >
            {health.isSuccess ? (
              <Wifi className="h-3 w-3" />
            ) : (
              <WifiOff className="h-3 w-3" />
            )}
            {health.isSuccess ? "POS آنلاین" : "قطع ارتباط"}
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
            <Button
              size="icon"
              variant="ghost"
              className="text-white"
              aria-label="پنل مدیریت"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </Link>
          <Button
            size="icon"
            variant="ghost"
            className="text-white"
            aria-label="خروج"
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
              .filter((c) => !c.isSystem)
              .slice()
              .sort((a, b) => a.displayPriority - b.displayPriority)
              .map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategoryId(c.id)}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${categoryId === c.id ? "bg-primary text-white" : "bg-card"}`}
                >
                  {c.name}
                  <span className="rounded-full bg-black/10 px-2 text-[11px]">
                    {c.displayPriority}
                  </span>
                </button>
              ))}
          </div>
          <div className="pos-scroll grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto md:grid-cols-3 2xl:grid-cols-4">
            {menu.isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="flex min-h-[180px] flex-col overflow-hidden rounded-2xl border bg-card"
                >
                  <Skeleton className="h-28 w-full flex-shrink-0 rounded-none" />
                  <div className="space-y-2 p-3">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            {!menu.isLoading && filtered.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                <Coffee className="size-10 opacity-40" />
                <p className="text-sm font-semibold">آیتمی یافت نشد</p>
                <p className="text-xs">
                  فیلتر جستجو یا دسته‌بندی را تغییر دهید
                </p>
              </div>
            )}
            {filtered.map((item) => {
              const stock = stockOf(item);
              const discountPercent =
                item.discountPercent > 0
                  ? item.discountPercent
                  : (item.categoryDiscountPercent ?? 0);
              const discountAmount = Math.round(
                (item.basePrice * Math.min(100, Math.max(0, discountPercent))) /
                  100,
              );
              const discountedPrice = item.basePrice - discountAmount;
              return (
                <motion.button
                  key={item.id}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    setRightPanelTab("cart");
                    setEditingLineIndex(null);
                    cart.addLine(item, 1, []);
                  }}
                  className="flex h-[220px] hover:cursor-pointer flex-col overflow-hidden rounded-2xl border bg-card text-right shadow-sm"
                >
                  <div className="relative h-28 flex-shrink-0 bg-muted">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="h-full w-full object-cover outline outline-1 outline-black/10"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Coffee className="size-10 text-muted-foreground" />
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
                  <div className="flex flex-1 flex-col justify-between p-3">
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

        <aside
          className="flex w-[380px] shrink-0 flex-col border-s bg-pos-ticket"
          dir="rtl"
        >
          <div className="border-b p-4">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
              <button
                type="button"
                className={`rounded-lg hover:cursor-pointer px-2 py-2 text-sm font-black transition-colors ${
                  rightPanelTab === "cart"
                    ? "bg-white text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setRightPanelTab("cart")}
              >
                صورت حساب زنده
              </button>
              <button
                type="button"
                className={`flex hover:cursor-pointer items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm font-black transition-colors ${
                  rightPanelTab === "drafts"
                    ? "bg-white text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setRightPanelTab("drafts")}
              >
                <span>در انتظار پرداخت</span>
                <Badge variant="warning">
                  {pendingOrders.data?.length ?? 0}
                </Badge>
              </button>
            </div>
            <div
              className={
                rightPanelTab === "cart"
                  ? "mt-3 flex items-center justify-between"
                  : "hidden"
              }
            >
              <h2 className="font-black">صورت حساب زنده</h2>
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
          </div>
          <div
            className={
              rightPanelTab === "drafts"
                ? "mt-3 flex min-h-0 flex-1 flex-col rounded-2xl bg-white/80 ring-1 ring-black/[0.04] backdrop-blur-sm p-3"
                : "hidden"
            }
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold tracking-tight">
                سفارش‌های در انتظار پرداخت
              </h3>
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-100 px-1.5 text-[11px] font-bold text-slate-600">
                {pendingOrders.data?.length ?? 0}
              </span>
            </div>
            <div className="pos-scroll flex-1 space-y-2 overflow-y-auto px-1 py-1">
              {(pendingOrders.data ?? []).map((draft, i) => {
                const isActive = cart.serverOrderId === draft.id;
                const orderTypeLabel =
                  draft.orderType === "DineIn"
                    ? "حضوری"
                    : draft.orderType === "Takeaway"
                      ? "بیرون‌بر"
                      : "بار";
                return (
                  <button
                    key={draft.id}
                    style={{ transitionDelay: `${i * 30}ms` }}
                    className={[
                      "hover:cursor-pointer",
                      "group w-full rounded-2xl bg-white px-3.5 py-3 text-right",
                      "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.06)]",
                      "transition-[box-shadow,background-color,transform] duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
                      "hover:shadow-[0_2px_8px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]",
                      "active:scale-[0.97] active:shadow-[0_0_0_rgba(0,0,0,0)]",
                      isActive
                        ? "ring-2 ring-primary bg-primary/10 shadow-[0_1px_3px_rgba(196,30,58,0.12),0_0_0_1px_rgba(196,30,58,0.08)]"
                        : "ring-1 ring-black/[0.06] hover:ring-black/[0.10]",
                    ].join(" ")}
                    onClick={() => loadDraftMut.mutate(draft.id)}
                    disabled={loadDraftMut.isPending}
                  >
                    {/* Row 1: order number + price badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex size-6 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-500 transition-colors duration-150 group-hover:bg-primary/10 group-hover:text-primary">
                          {i + 1}
                        </span>
                        <span className="text-[13px] font-bold text-slate-800">
                          سفارش {draft.orderNumber}
                        </span>
                      </div>
                      <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-bold text-white tabular-nums">
                        {formatToman(draft.grandTotal)}
                      </span>
                    </div>

                    {/* Row 2: meta tags */}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {orderTypeLabel}
                      </span>
                      {draft.tableNumber ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          میز {draft.tableNumber}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {draft.items.length} آیتم
                      </span>
                      {draft.customerPhone ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {draft.customerPhone}
                        </span>
                      ) : null}
                    </div>

                    {/* Row 3: items preview */}
                    {(draft.items.length > 0 || draft.notes) && (
                      <div className="mt-2 border-t border-slate-100 pt-2">
                        <p className="truncate text-[11px] leading-relaxed text-slate-400">
                          {draft.items
                            .slice(0, 2)
                            .map((item) => `${item.title} × ${item.quantity}`)
                            .join(" · ")}
                          {draft.items.length > 2 ? " · …" : ""}
                          {draft.notes ? (
                            <span className="text-slate-300">
                              {" "}
                              · {draft.notes}
                            </span>
                          ) : null}
                        </p>
                      </div>
                    )}
                  </button>
                );
              })}
              {!pendingOrders.data?.length ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100">
                    <svg
                      className="size-5 text-slate-300"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <p className="text-[11px] font-medium text-slate-400">
                    سفارشی در انتظار پرداخت وجود ندارد
                  </p>
                </div>
              ) : null}
            </div>
          </div>
          <div
            className={`pos-scroll flex-1 space-y-2 overflow-y-auto p-3 ${rightPanelTab === "cart" ? "" : "hidden"}`}
          >
            {cart.lines.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
                <LayoutGrid className="size-10 opacity-40" />
                <div className="text-center">
                  <p className="text-sm font-semibold">سبد خرید خالی است</p>
                  <p className="mt-1 text-xs text-pretty">
                    از فهرست محصولات سمت چپ آیتم انتخاب کنید
                  </p>
                </div>
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
                      className="hover:bg-gray-200/50 rounded-2xl p-2"
                      onClick={(event) => {
                        event.stopPropagation();
                        cart.removeLine(lineIndex);
                      }}
                    >
                      <Trash2 className="h-4 w-4 hover:cursor-pointer  text-destructive" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-12 rounded-full border-2 text-lg"
                        aria-label="کاهش تعداد"
                        onClick={(event) => {
                          event.stopPropagation();
                          cart.updateQty(lineIndex, line.quantity - 1);
                        }}
                      >
                        −
                      </Button>
                      <span className="w-10 text-center text-2xl font-black tabular-nums">
                        {line.quantity}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-12 rounded-full border-2 text-lg"
                        aria-label="افزایش تعداد"
                        onClick={(event) => {
                          event.stopPropagation();
                          cart.updateQty(lineIndex, line.quantity + 1);
                        }}
                      >
                        +
                      </Button>
                    </div>
                    <span className="text-lg font-black tabular-nums">
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
          <div
            className={`space-y-2 border-t bg-white p-4 [&>div:nth-child(2)]:hidden ${rightPanelTab === "cart" ? "" : "hidden"}`}
          >
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
                className="col-span-2"
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
