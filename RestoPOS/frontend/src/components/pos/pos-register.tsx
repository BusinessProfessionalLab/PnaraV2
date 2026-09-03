"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Coffee,
  CreditCard,
  LayoutGrid,
  LogOut,
  Minus,
  MonitorSmartphone,
  Plus,
  Search,
  Settings2,
  ShoppingBasket,
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useCartStore } from "@/lib/cart-store";
import { formatToman } from "@/lib/currency";
import { toShamsiClock, toShamsiDate, weekdayFa } from "@/lib/jalali";
import { syncCartToServer } from "@/lib/sync-cart";
import type { MenuItemDto } from "@/lib/types";
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
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="z-20 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <UtensilsCrossed className="size-[18px]" strokeWidth={2} aria-hidden />
          </div>
          <div className="hidden min-w-0 sm:block">
            <div className="truncate text-sm font-bold leading-5">
              {settings.data?.storeName ?? "ToastIran POS"}
            </div>
            <div className="text-[11px] text-muted-foreground">
              صندوق · {session?.fullName}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={cart.orderType}
            onValueChange={(v) =>
              cart.setMeta({
                orderType: v as typeof cart.orderType,
                ...(v === "DineIn" ? {} : { tableNumber: "" }),
              })
            }
          >
            <SelectTrigger aria-label="نوع سفارش" className="h-9 w-auto min-w-[6.5rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DineIn">حضوری</SelectItem>
              <SelectItem value="Takeaway">بیرون‌بر</SelectItem>
              <SelectItem value="Bar">سالن</SelectItem>
            </SelectContent>
          </Select>
          {cart.orderType !== "DineIn" ? (
            <Input
              aria-label="شماره میز"
              placeholder="میز"
              inputMode="numeric"
              className="h-9 w-20 text-center"
              value={cart.tableNumber}
              onChange={(e) => cart.setMeta({ tableNumber: e.target.value })}
            />
          ) : null}
        </div>

        <div className="ms-auto flex items-center gap-1.5 sm:gap-2">
          <div className="hidden text-center md:block">
            <div className="font-mono text-base font-bold leading-5 tabular-nums">
              {toShamsiClock(clock)}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {weekdayFa(clock)} {toShamsiDate(clock)}
            </div>
          </div>
          <Badge
            variant={health.isSuccess ? "success" : "danger"}
            className="hidden sm:inline-flex"
          >
            {health.isSuccess ? (
              <Wifi className="size-3" aria-hidden />
            ) : (
              <WifiOff className="size-3" aria-hidden />
            )}
            {health.isSuccess ? "آنلاین" : "قطع ارتباط"}
          </Badge>
          <Badge variant={shift.data ? "neutral" : "warning"} className="hidden md:inline-flex">
            {shift.data ? "شیفت باز" : "بدون شیفت"}
          </Badge>
          <Link href="/kds" className="hidden lg:block">
            <Button size="sm" variant="ghost" className="text-muted-foreground">
              <MonitorSmartphone className="size-4" aria-hidden />
              نمایشگر
            </Button>
          </Link>
          <Link href="/admin" className="hidden md:block">
            <Button
              size="icon-sm"
              variant="ghost"
              className="text-muted-foreground"
              aria-label="پنل مدیریت"
            >
              <Settings2 className="size-4" aria-hidden />
            </Button>
          </Link>
          <Button
            size="icon-sm"
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
      </header>

      {/* ── Workspace: catalog + cart ───────────────────────────── */}
      <div className="flex min-h-0 flex-1" dir="ltr">
        {/* Catalog */}
        <section className="flex min-w-0 flex-1 flex-col gap-3 p-3 sm:p-4" dir="rtl">
          <div className="relative">
            <Search
              className="absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              className="h-11 ps-10 pe-10"
              placeholder="جستجو بر اساس نام، دسته یا SKU مواد…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q ? (
              <button
                type="button"
                aria-label="پاک کردن جستجو"
                onClick={() => setQ("")}
                className="absolute end-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground"
              >
                <span aria-hidden className="text-lg leading-none">×</span>
              </button>
            ) : null}
          </div>

          {/* Category rail */}
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
            <button
              type="button"
              onClick={() => setCategoryId("all")}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors duration-150 ${
                categoryId === "all"
                  ? "border-transparent bg-primary text-primary-foreground shadow-xs"
                  : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground"
              }`}
            >
              همه
              <span
                className={`rounded-full px-1.5 py-px text-[10px] font-bold ${
                  categoryId === "all"
                    ? "bg-white/20 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {filtered.length}
              </span>
            </button>
            {(categories.data ?? [])
              .filter((c) => !c.isSystem)
              .slice()
              .sort((a, b) => a.displayPriority - b.displayPriority)
              .map((c) => {
                const active = categoryId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryId(c.id)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors duration-150 ${
                      active
                        ? "border-transparent bg-primary text-primary-foreground shadow-xs"
                        : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground"
                    }`}
                  >
                    {c.name}
                    <span
                      className={`rounded-full px-1.5 py-px text-[10px] font-bold ${
                        active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {categoryCounts.get(c.id) ?? 0}
                    </span>
                  </button>
                );
              })}
          </div>

          {/* Product grid */}
          <div className="pos-scroll grid min-h-0 flex-1 auto-rows-min grid-cols-2 content-start gap-3 overflow-y-auto pb-1 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {menu.isLoading &&
              Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card"
                >
                  <Skeleton className="h-28 w-full flex-shrink-0 rounded-none border-b-0" />
                  <div className="flex flex-1 flex-col justify-between gap-2 p-3">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            {!menu.isLoading && filtered.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center gap-3 py-16">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Coffee className="size-5" strokeWidth={1.75} aria-hidden />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold">آیتمی یافت نشد</p>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    عبارت جستجو یا دسته‌بندی را تغییر دهید
                  </p>
                </div>
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
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    setRightPanelTab("cart");
                    setEditingLineIndex(null);
                    cart.addLine(item, 1, []);
                  }}
                  className="group flex h-full min-h-[13rem] cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card text-start shadow-xs transition-[border-color,box-shadow] duration-150 hover:border-border-strong hover:shadow-card-hover"
                >
                  <div className="relative h-28 flex-shrink-0 bg-muted/70">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Coffee
                          className="size-9 text-muted-foreground/60"
                          strokeWidth={1.4}
                          aria-hidden
                        />
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
                      className="absolute end-2 top-2 backdrop-blur-sm"
                    >
                      {stock === "ok"
                        ? "موجود"
                        : stock === "low"
                          ? "نزدیک اتمام"
                          : "ناموجود"}
                    </Badge>
                  </div>
                  <div className="flex flex-1 flex-col justify-between gap-1.5 p-3">
                    <div className="text-sm font-bold leading-5">{item.title}</div>
                    {discountPercent > 0 ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-muted-foreground line-through">
                            {formatToman(item.basePrice)}
                          </span>
                          <Badge variant="danger" className="px-1.5 py-0.5 text-[10px]">
                            {discountPercent}٪
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-bold text-primary">
                            {formatToman(discountedPrice)}
                          </span>
                          <span className="text-[10px] text-success">
                            {formatToman(discountAmount)} صرفه‌جویی
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[13px] font-bold text-primary">
                        {formatToman(item.basePrice)}
                      </div>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* Cart column */}
        <aside
          className="flex w-[21.5rem] shrink-0 flex-col border-s border-border bg-card max-md:w-[19rem]"
          dir="rtl"
        >
          <div className="shrink-0 space-y-3 border-b border-border p-3">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
              <button
                type="button"
                className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[13px] font-semibold transition-all duration-150 ${
                  rightPanelTab === "cart"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setRightPanelTab("cart")}
              >
                <ShoppingBasket className="size-4" aria-hidden />
                صورت حساب
              </button>
              <button
                type="button"
                className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[13px] font-semibold transition-all duration-150 ${
                  rightPanelTab === "drafts"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setRightPanelTab("drafts")}
              >
                در انتظار پرداخت
                <span
                  className={`rounded-full px-1.5 text-[10px] font-bold ${
                    rightPanelTab === "drafts"
                      ? "bg-primary-soft text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {pendingOrders.data?.length ?? 0}
                </span>
              </button>
            </div>
            {rightPanelTab === "cart" ? (
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold">صورت حساب زنده</h2>
                {cart.serverOrderNumber ? (
                  <Badge variant="neutral">{cart.serverOrderNumber}</Badge>
                ) : (
                  <Badge variant="outline">فاکتور محلی</Badge>
                )}
              </div>
            ) : null}
          </div>

          {/* Pending-payment drafts */}
          {rightPanelTab === "drafts" ? (
            <div className="pos-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
              {(pendingOrders.data ?? []).map((draft, i) => {
                const isActive = cart.serverOrderId === draft.id;
                const orderTypeLabel =
                  draft.orderType === "DineIn"
                    ? "حضوری"
                    : draft.orderType === "Takeaway"
                      ? "بیرون‌بر"
                      : "سالن";
                return (
                  <button
                    key={draft.id}
                    type="button"
                    style={{ transitionDelay: `${i * 25}ms` }}
                    className={`animate-fade-in group w-full cursor-pointer rounded-xl border p-3 text-start transition-[border-color,background-color,transform] duration-150 active:scale-[0.99] ${
                      isActive
                        ? "border-primary/40 bg-primary-soft/60"
                        : "border-border bg-card hover:border-border-strong"
                    }`}
                    onClick={() => loadDraftMut.mutate(draft.id)}
                    disabled={loadDraftMut.isPending}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex size-6 items-center justify-center rounded-lg text-[10px] font-bold transition-colors ${
                            isActive
                              ? "bg-primary text-white"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {i + 1}
                        </span>
                        <span className="text-[13px] font-bold">سفارش {draft.orderNumber}</span>
                      </div>
                      <span className="rounded-lg bg-foreground px-2 py-1 text-xs font-bold text-background tabular-nums">
                        {formatToman(draft.grandTotal)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {orderTypeLabel}
                      </span>
                      {draft.tableNumber ? (
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          میز {draft.tableNumber}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {draft.items.length} آیتم
                      </span>
                      {draft.customerPhone ? (
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {draft.customerPhone}
                        </span>
                      ) : null}
                    </div>
                    {(draft.items.length > 0 || draft.notes) && (
                      <p className="mt-2 truncate border-t border-border/70 pt-2 text-[11px] leading-5 text-muted-foreground">
                        {draft.items
                          .slice(0, 2)
                          .map((item) => `${item.title} × ${item.quantity}`)
                          .join(" · ")}
                        {draft.items.length > 2 ? " · …" : ""}
                        {draft.notes ? ` · ${draft.notes}` : ""}
                      </p>
                    )}
                  </button>
                );
              })}
              {!pendingOrders.data?.length ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground/60">
                    <LayoutGrid className="size-4" aria-hidden />
                  </div>
                  <p className="text-[13px] font-medium text-muted-foreground">
                    سفارشی در انتظار پرداخت نیست
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Cart lines */}
          {rightPanelTab === "cart" ? (
            <div className="pos-scroll min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {cart.lines.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 py-10 text-center">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground/60">
                    <ShoppingBasket className="size-5" strokeWidth={1.75} aria-hidden />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">سبد خالی است</p>
                    <p className="mt-1 max-w-[16rem] text-[13px] leading-5 text-muted-foreground text-pretty">
                      برای شروع، یک آیتم از فهرست سمت راست انتخاب کنید
                    </p>
                  </div>
                </div>
              ) : (
                cart.lines.map((line, lineIndex) => (
                  <div
                    key={`${line.menuItemId}-${lineIndex}`}
                    className="cursor-pointer rounded-xl border border-border bg-card p-3 transition-colors duration-150 hover:border-border-strong"
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
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold leading-5">{line.title}</div>
                        {line.modifiers.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {line.modifiers.map((m) => (
                              <Badge key={m.id} variant="neutral">
                                {m.name}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-muted-foreground outline-none transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
                        aria-label={`حذف ${line.title}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          cart.removeLine(lineIndex);
                        }}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="کاهش تعداد"
                          className="flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground outline-none transition-colors duration-150 hover:border-border-strong hover:bg-muted hover:text-foreground"
                          onClick={(event) => {
                            event.stopPropagation();
                            cart.updateQty(lineIndex, line.quantity - 1);
                          }}
                        >
                          <Minus className="size-3.5" aria-hidden />
                        </button>
                        <span className="w-8 text-center text-base font-bold tabular-nums">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label="افزایش تعداد"
                          className="flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground outline-none transition-colors duration-150 hover:border-border-strong hover:bg-muted hover:text-foreground"
                          onClick={(event) => {
                            event.stopPropagation();
                            cart.updateQty(lineIndex, line.quantity + 1);
                          }}
                        >
                          <Plus className="size-3.5" aria-hidden />
                        </button>
                      </div>
                      <span className="text-sm font-bold tabular-nums">
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
          ) : null}

          {/* Totals + actions */}
          {rightPanelTab === "cart" ? (
            <div className="shrink-0 space-y-1.5 border-t border-border bg-card p-3">
              <input type="hidden" value={cart.customerPhone} readOnly />
              <input
                type="hidden"
                value={cart.discountPercent || ""}
                onChange={(e) =>
                  cart.setMeta({ discountPercent: Number(e.target.value) || 0 })
                }
              />
              <input
                type="hidden"
                value={cart.discountAmount || ""}
                onChange={(e) =>
                  cart.setMeta({ discountAmount: Number(e.target.value) || 0 })
                }
              />
              <TotRow
                k={`جمع جزء${cart.discountPercent ? ` (${cart.discountPercent}٪ تخفیف)` : ""}`}
                v={formatToman(totals.subtotal)}
              />
              <TotRow
                k={`ارزش افزوده (${Math.round(cart.vatRate * 100)}٪)`}
                v={formatToman(totals.taxAmount)}
              />
              <div className="flex items-center justify-between border-t border-border/70 pt-2">
                <span className="text-base font-bold">قابل پرداخت</span>
                <span className="text-lg font-black text-primary tabular-nums">
                  {formatToman(totals.grandTotal)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11"
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
                  variant="ghost"
                  size="sm"
                  className="h-11 text-danger hover:bg-danger/10 hover:text-danger"
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
                  className="col-span-2 h-12"
                  size="lg"
                  disabled={!cart.lines.length}
                  onClick={() => setCheckout(true)}
                >
                  <CreditCard className="size-5" aria-hidden />
                  تسویه و پرداخت
                </Button>
              </div>
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
            </div>
          ) : null}
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

function TotRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between text-[13px] text-muted-foreground">
      <span>{k}</span>
      <span className="font-medium text-foreground tabular-nums">{v}</span>
    </div>
  );
}
