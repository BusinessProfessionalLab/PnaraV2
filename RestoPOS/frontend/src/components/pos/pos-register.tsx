"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Clock3,
  Coffee,
  CreditCard,
  Hourglass,
  ListPlus,
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
  X,
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
import { errorMessage } from "@/api/errors";
import { orderKeys } from "@/queries/keys";
import {
  useActiveUnpaidOrders,
  useDiscardDraft,
  useGetOrder,
  useSubmitOrder,
} from "@/queries/orders";
import { useCategories, useMenuItems } from "@/queries/menu";
import { useCurrentShift } from "@/queries/shift";
import { useHealth } from "@/queries/health";
import { useInventory } from "@/queries/inventory";
import { useSettings } from "@/queries/settings";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuthStore } from "@/lib/auth-store";
import { useCartStore } from "@/lib/cart-store";
import { formatToman } from "@/lib/currency";
import { toShamsiClock, toShamsiDate, weekdayFa } from "@/lib/jalali";
import { syncCartToServer } from "@/lib/sync-cart";
import type { MenuItemDto, OrderDto } from "@/lib/types";
import { fuzzyScore } from "@/lib/fuzzy-search";
import { CheckoutModal } from "./checkout-modal";
import { ModifierDrawer } from "./modifier-drawer";
import { TourTrigger } from "@/features/product-tour";

type RightPanelTab = "cart" | "drafts";

/** App motion token (--ease-out-quart) used for tab/page transitions. */
const EASE_OUT_QUART: [number, number, number, number] = [0.25, 1, 0.5, 1];

export function PosRegister() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const logout = useAuthStore((s) => s.logout);
  const cart = useCartStore();
  const [clock, setClock] = useState(new Date());

  const [q, setQ] = useState(() => {
    // Restore the search term persisted in the URL (?q=…), so a refresh or a
    // shared link lands on the same results. Safe to read here: PosRegister
    // mounts client-side only after the auth gate hydrates, so there is no
    // SSR markup to mismatch.
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("q") ?? "";
  });
  const [categoryId, setCategoryId] = useState<string>("all");
  const [picked, setPicked] = useState<MenuItemDto | null>(null);
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>("cart");
  const [checkout, setCheckout] = useState(false);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  // Multi-add mode: pick several products at once and append them together.
  const [multiMode, setMultiMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchQty, setBatchQty] = useState(1);
  const qc = useQueryClient();

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Mirror the live search term into the URL (?q=…) via history.replaceState —
  // no router navigation, so typing never remounts the page or flashes.
  useEffect(() => {
    const url = new URL(window.location.href);
    const value = q.trim();
    if (value) url.searchParams.set("q", value);
    else url.searchParams.delete("q");
    const next = url.pathname + url.search;
    const current = window.location.pathname + window.location.search;
    if (next !== current) window.history.replaceState(null, "", next);
  }, [q]);

  const health = useHealth();
  const categories = useCategories(false);
  const menu = useMenuItems(true);
  const inventory = useInventory();
  const settings = useSettings();
  const shift = useCurrentShift();
  const pendingOrders = useActiveUnpaidOrders();

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

  const getOrder = useGetOrder();
  const discardDraft = useDiscardDraft();
  const submitOrder = useSubmitOrder();

  const draftMut = useMutation({
    mutationFn: syncCartToServer,
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: orderKeys.unpaid });
      cart.clear();
      toast.success(`پیش‌نویس ${order.orderNumber} ذخیره شد`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function loadDraftOrder(orderId: string) {
    try {
      const order = await getOrder.mutateAsync(orderId);
      cart.loadDraft(order);
      setCheckout(true);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  function discardCart() {
    // «حذف همه» always clears every line card from the current order first,
    // so the cart empties instantly no matter what the server says.
    const linkedOrderId = cart.serverOrderId;
    cart.clear();
    if (!linkedOrderId) {
      toast.message("همه آیتم‌های این سفارش حذف شد");
      return;
    }
    // Best-effort server cleanup: a true draft gets deleted with no trace;
    // an already-submitted order cannot be deleted by design (it must be
    // cancelled instead), so that rejection is swallowed silently and the
    // order stays listed until it is paid or cancelled.
    discardDraft.mutate(linkedOrderId, {
      onSuccess: () => {
        toast.message("همه آیتم‌های این سفارش حذف شد");
      },
      onError: () => {
        // Draft delete refused — nothing to do, the local cart is already clear.
      },
    });
  }

  const sendMut = useMutation({
    mutationFn: async () => {
      const order = await syncCartToServer();
      return submitOrder.mutateAsync(order.id);
    },
    onSuccess: (order) => {
      toast.success(`ارسال شد: ${order.orderNumber}`);
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

  /** Reopen an existing cart line inside the modifier sheet. */
  function openEditLine(lineIndex: number) {
    const menuItem = (menu.data ?? []).find(
      (item) => item.id === cart.lines[lineIndex]?.menuItemId,
    );
    if (!menuItem) return;
    setEditingLineIndex(lineIndex);
    setPicked(menuItem);
  }

  function openCheckoutFromCart() {
    setCartSheetOpen(false);
    setCheckout(true);
  }

  function openDraft(orderId: string) {
    setCartSheetOpen(false);
    loadDraftOrder(orderId);
  }

  /* ── Multi-add (floating dock) ─────────────────────────────── */

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  function toggleSelect(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : [...current, id],
    );
  }

  function exitMultiMode() {
    setMultiMode(false);
    setSelectedIds([]);
    setBatchQty(1);
  }

  /** Append every selected product (each with `batchQty`) to the order. */
  function confirmBatch() {
    const chosen = selectedIds
      .map((id) => (menu.data ?? []).find((item) => item.id === id))
      .filter((item): item is MenuItemDto => Boolean(item));
    if (chosen.length === 0 || batchQty < 1) return;
    for (const item of chosen) cart.addLine(item, batchQty, []);
    setRightPanelTab("cart");
    setEditingLineIndex(null);
    exitMultiMode();
    toast.success(
      batchQty === 1
        ? `${chosen.length} محصول به سفارش اضافه شد`
        : `${chosen.length} محصول (هرکدام ${batchQty} عدد) به سفارش اضافه شد`,
    );
  }

  const itemCount = cart.lines.reduce((sum, l) => sum + l.quantity, 0);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-3 sm:h-16 sm:gap-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <UtensilsCrossed
              className="size-[18px]"
              strokeWidth={2}
              aria-hidden
            />
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

        <div className="ms-auto flex items-center gap-1 sm:gap-2">
          {/* Live date & time — one line, designed like the rest of the
              header controls. Weekday appears only on wide screens so the
              chip stays compact on md/lg. */}
          <div
            className="hidden items-center md:flex"
            role="timer"
            aria-label="تاریخ و ساعت جاری"
          >
            <div className="flex items-center gap-2 rounded-xl border border-input bg-card px-2.5 py-1.5 shadow-xs">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Clock3 className="size-3.5" strokeWidth={1.9} aria-hidden />
              </span>
              <span className="flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold leading-none tracking-tight tabular-nums text-foreground">
                <span className="hidden xl:inline">{weekdayFa(clock)}</span>
                <span
                  aria-hidden
                  className="hidden text-muted-foreground/70 xl:inline"
                >
                  ·
                </span>
                <span>{toShamsiDate(clock)}</span>
                <span aria-hidden className="text-muted-foreground/70">
                  ·
                </span>
                <span className="font-mono  font-semibold text-sm">
                  {toShamsiClock(clock)}
                </span>
              </span>
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
          <Badge
            variant={shift.data ? "neutral" : "warning"}
            className="hidden xl:inline-flex"
          >
            {shift.data ? "شیفت باز" : "بدون شیفت"}
          </Badge>
          <Link href="/kds" className="hidden lg:block">
            <Button size="sm" variant="ghost" className="text-muted-foreground">
              <MonitorSmartphone className="size-4" aria-hidden />
              نمایشگر
            </Button>
          </Link>
          <TourTrigger
            tourId="register"
            label="آموزش صندوق"
            className="size-9"
            placement="bottom"
          />
          <ThemeToggle className="size-9" />

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
        <section
          className="relative flex min-w-0 flex-1 flex-col gap-3 p-3 sm:p-4"
          dir="rtl"
        >
          <div data-tour="pos-search" className="relative">
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
                className="absolute end-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground"
              >
                <span aria-hidden className="text-lg leading-none">
                  ×
                </span>
              </button>
            ) : null}
          </div>

          {/* Category rail */}
          <div
            data-tour="pos-categories"
            className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5"
          >
            <button
              type="button"
              onClick={() => setCategoryId("all")}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors duration-150 ${
                categoryId === "all"
                  ? "border-transparent bg-primary-fill text-primary-foreground shadow-xs"
                  : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground"
              }`}
            >
              همه
              <span
                className={`rounded-full px-1.5 py-px text-[10px] font-bold ${
                  categoryId === "all"
                    ? "bg-primary-foreground/15 text-primary-foreground"
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
                        ? "border-transparent bg-primary-fill text-primary-foreground shadow-xs"
                        : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground"
                    }`}
                  >
                    {c.name}
                    <span
                      className={`rounded-full px-1.5 py-px text-[10px] font-bold ${
                        active
                          ? "bg-primary-foreground/15 text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {categoryCounts.get(c.id) ?? 0}
                    </span>
                  </button>
                );
              })}
          </div>

          {/* Product grid */}
          <div
            data-tour="pos-products"
            className="pos-scroll grid min-h-0 flex-1 auto-rows-min grid-cols-2 content-start gap-2 overflow-y-auto pb-1 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7"
          >
            {menu.isLoading &&
              Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-2.5 sm:p-3"
                >
                  <Skeleton className="aspect-square w-full rounded-xl" />
                  <div className="flex flex-1 flex-col gap-2.5 p-2 sm:p-3">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-5 w-1/3" />
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
              const discountedPrice =
                item.basePrice -
                Math.round(
                  (item.basePrice *
                    Math.min(100, Math.max(0, discountPercent))) /
                    100,
                );
              const isSelected = multiMode && selectedSet.has(item.id);
              return (
                <motion.button
                  key={item.id}
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    if (multiMode) {
                      toggleSelect(item.id);
                      return;
                    }
                    setRightPanelTab("cart");
                    setEditingLineIndex(null);
                    cart.addLine(item, 1, []);
                  }}
                  aria-pressed={multiMode ? isSelected : undefined}
                  className={`group flex h-full cursor-pointer select-none flex-col overflow-hidden rounded-2xl border bg-card text-start shadow-xs outline-none transition-[border-color,box-shadow] duration-150 hover:border-border-strong hover:shadow-card-hover focus-visible:ring-2 focus-visible:ring-primary/30 ${
                    multiMode
                      ? isSelected
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border"
                      : "border-border"
                  }`}
                >
                  <div className="relative mx-2.5 mt-2.5 sm:mx-3 sm:mt-3">
                    <MenuItemImage
                      src={item.imageUrl}
                      className="aspect-square w-full"
                    />
                    {multiMode ? (
                      <span
                        aria-hidden
                        className={`absolute start-2 top-2 flex size-6 items-center justify-center rounded-full border-2 backdrop-blur-sm transition-colors duration-150 ${
                          isSelected
                            ? "border-primary bg-primary-fill text-primary-foreground shadow-xs"
                            : "border-foreground/60 bg-card/85 text-transparent"
                        }`}
                      >
                        <Check className="size-3.5" strokeWidth={3} />
                      </span>
                    ) : null}
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
                  <div className="flex min-h-0 flex-1 flex-col p-3 pb-3.5 sm:p-3.5 sm:pb-4">
                    <div className="line-clamp-2 text-[15px] leading-6 font-bold break-words">
                      {item.title}
                    </div>
                    {discountPercent > 0 ? (
                      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
                        <div className="flex min-w-0 flex-col leading-none">
                          <span className="text-xs font-medium text-muted-foreground line-through tabular-nums">
                            {formatToman(item.basePrice)}
                          </span>
                          <span className="mt-1.5 truncate text-[15px] font-extrabold text-primary tabular-nums sm:text-base">
                            {formatToman(discountedPrice)}
                          </span>
                        </div>
                        <Badge
                          variant="danger"
                          title={`${discountPercent}٪ تخفیف`}
                          className="shrink-0 px-2 py-1 text-[11px]"
                        >
                          {discountPercent}٪
                        </Badge>
                      </div>
                    ) : (
                      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
                        <span className="truncate text-[15px] font-extrabold text-primary tabular-nums sm:text-base">
                          {formatToman(item.basePrice)}
                        </span>
                      </div>
                    )}
                  </div>
                </motion.button>
              );
            })}
            {/* Extra bottom space so the floating dock never hides the
                last row of cards while multi-select is active. */}
            {multiMode ? (
              <div className="col-span-full h-24 sm:h-20" aria-hidden />
            ) : null}
          </div>

          {/* Multi-add launcher — parked right next to the global shortcuts
              FAB (fixed bottom-left), so both float together. */}
          {!multiMode ? (
            <Button
              type="button"
              onClick={() => setMultiMode(true)}
              aria-label="افزودن چند محصول به سفارش"
              title="افزودن چند محصول به سفارش"
              className="fixed bottom-5 left-[4.5rem] z-40 h-12 gap-2 rounded-full px-4 shadow-lg shadow-primary/25 max-md:bottom-[4.9rem] md:left-[4.75rem]"
            >
              <ListPlus className="size-5" aria-hidden />
              <span className="hidden text-[13px] sm:inline">
                افزودن چند محصول
              </span>
            </Button>
          ) : null}

          {/* Multi-add toolbar — bottom-center of the catalog while selecting. */}
          {multiMode ? (
            <div className="pointer-events-none absolute inset-x-3 bottom-2 z-30 flex justify-center sm:bottom-4">
              <div
                className="animate-scale-in pointer-events-auto flex max-w-full items-center gap-1.5 rounded-2xl border border-border bg-card p-1.5 shadow-card-hover ring-1 ring-primary/25 sm:gap-2 sm:p-2"
                role="toolbar"
                aria-label="افزودن چند محصول به سفارش"
              >
                <span className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-primary-soft px-2.5 text-[13px] font-bold text-primary tabular-nums">
                  <Check className="size-4" aria-hidden />
                  {selectedIds.length}
                </span>
                <div
                  className="flex h-9 items-center rounded-xl border border-border bg-muted/40 px-1"
                  title="تعداد هر آیتم"
                >
                  <button
                    type="button"
                    aria-label="کم کردن تعداد هر آیتم"
                    className="flex size-7 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                    onClick={() => setBatchQty((n) => Math.max(1, n - 1))}
                  >
                    <Minus className="size-3.5" aria-hidden />
                  </button>
                  <span className="w-8 text-center text-sm font-black tabular-nums">
                    {batchQty}
                  </span>
                  <button
                    type="button"
                    aria-label="بیشتر کردن تعداد هر آیتم"
                    className="flex size-7 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                    onClick={() => setBatchQty((n) => Math.min(99, n + 1))}
                  >
                    <Plus className="size-3.5" aria-hidden />
                  </button>
                </div>
                <Button
                  size="sm"
                  className="h-9 gap-1.5 px-3 sm:px-4"
                  disabled={selectedIds.length === 0}
                  onClick={confirmBatch}
                >
                  <Check className="size-4" aria-hidden />
                  تایید
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9"
                  onClick={exitMultiMode}
                >
                  انصراف
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        {/* Cart column — visible from md (tablets + desktops) */}
        <aside
          data-tour="pos-cart-pane"
          className="hidden h-full w-[20rem] shrink-0 flex-col overflow-hidden border-s border-border bg-card md:flex xl:w-[21.5rem]"
          dir="rtl"
        >
          <CartPane
            rightPanelTab={rightPanelTab}
            onTabChange={setRightPanelTab}
            drafts={pendingOrders.data}
            loadPending={getOrder.isPending}
            draftPending={draftMut.isPending}
            sendPending={sendMut.isPending}
            discardPending={discardDraft.isPending}
            onLoadDraft={openDraft}
            onSaveDraft={() => draftMut.mutate()}
            onDiscard={discardCart}
            onSendToKitchen={() => sendMut.mutate()}
            onCheckout={openCheckoutFromCart}
            onEditLine={openEditLine}
          />
        </aside>
      </div>

      {/* Mobile cart summary bar — phones get a persistent mini-bar instead
          of a squeezed side column. Opens the full cart sheet below. */}
      <div
        data-tour="pos-cart-bar"
        className="flex shrink-0 items-center gap-2 border-t border-border bg-card px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] md:hidden"
      >
        <button
          type="button"
          onClick={() => setCartSheetOpen(true)}
          disabled={!cart.lines.length}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl text-start outline-none transition-opacity disabled:opacity-60"
          aria-label="نمایش سبد سفارش"
        >
          <span className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <ShoppingBasket className="size-5" aria-hidden />
            {itemCount > 0 ? (
              <span className="absolute -end-1.5 -top-1.5 flex min-w-5 items-center justify-center rounded-full bg-primary-fill px-1 py-0.5 text-[10px] font-bold text-primary-foreground tabular-nums">
                {itemCount}
              </span>
            ) : null}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold leading-4">
              {itemCount > 0
                ? `${itemCount} آیتم · ${cart.lines.length} ردیف`
                : "سبد سفارش خالی است"}
            </span>
            <span className="mt-0.5 block truncate text-[15px] font-black text-primary tabular-nums">
              {formatToman(totals.grandTotal)}
            </span>
          </span>
        </button>
        <Button
          size="sm"
          variant="outline"
          className="h-11 shrink-0"
          disabled={!cart.lines.length}
          onClick={() => setCartSheetOpen(true)}
        >
          سبد
        </Button>
        <Button
          data-tour="pos-checkout-mobile"
          size="sm"
          className="h-11 shrink-0 px-4"
          disabled={!cart.lines.length}
          onClick={openCheckoutFromCart}
        >
          <CreditCard className="size-4" aria-hidden />
          تسویه
        </Button>
      </div>

      {/* Mobile cart sheet */}
      <MobileCartSheet
        open={cartSheetOpen}
        onClose={() => setCartSheetOpen(false)}
      >
        <CartPane
          rightPanelTab={rightPanelTab}
          onTabChange={setRightPanelTab}
          drafts={pendingOrders.data}
          loadPending={getOrder.isPending}
          draftPending={draftMut.isPending}
          sendPending={sendMut.isPending}
          discardPending={discardDraft.isPending}
          onLoadDraft={openDraft}
          onSaveDraft={() => draftMut.mutate()}
          onDiscard={discardCart}
          onSendToKitchen={() => sendMut.mutate()}
          onCheckout={openCheckoutFromCart}
          onEditLine={openEditLine}
          className="h-full min-h-0"
        />
      </MobileCartSheet>

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

/* ──────────────────────────────────────────────────────────────── */

/** Shared cart surface used by the desktop side column and the mobile sheet. */
function CartPane({
  className,
  rightPanelTab,
  onTabChange,
  drafts,
  loadPending,
  draftPending,
  sendPending,
  discardPending,
  onLoadDraft,
  onSaveDraft,
  onDiscard,
  onSendToKitchen,
  onCheckout,
  onEditLine,
}: {
  className?: string;
  rightPanelTab: RightPanelTab;
  onTabChange: (tab: RightPanelTab) => void;
  drafts?: OrderDto[];
  loadPending: boolean;
  draftPending: boolean;
  sendPending: boolean;
  discardPending: boolean;
  onLoadDraft: (orderId: string) => void;
  onSaveDraft: () => void;
  onDiscard: () => void;
  onSendToKitchen: () => void;
  onCheckout: () => void;
  onEditLine: (lineIndex: number) => void;
}) {
  const cart = useCartStore();
  const totals = cart.totals();

  // Smooth rise-and-crossfade between the cart ⇄ drafts panels. Both panels
  // occupy the SAME absolutely-positioned box (see below), so the switch has
  // no flex reflow — the only movement is the animation itself. The app-wide
  // <MotionConfig reducedMotion="user"> disables the y-movement for
  // reduced-motion systems while keeping this short opacity fade.
  const panelMotion = {
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: { duration: 0.26, ease: EASE_OUT_QUART },
  };

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="shrink-0 space-y-3 border-b border-border p-3">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
          <button
            type="button"
            aria-pressed={rightPanelTab === "cart"}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[13px] font-semibold transition-all duration-150 ${
              rightPanelTab === "cart"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onTabChange("cart")}
          >
            <ShoppingBasket className="size-4" aria-hidden />
            صورت حساب
          </button>
          <button
            type="button"
            aria-pressed={rightPanelTab === "drafts"}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[13px] font-semibold transition-all duration-150 ${
              rightPanelTab === "drafts"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onTabChange("drafts")}
          >
            <Hourglass className="size-4" aria-hidden />
            در انتظار پرداخت
            <span
              className={`rounded-full px-1.5 text-[10px] font-bold ${
                rightPanelTab === "drafts"
                  ? "bg-primary-soft text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {drafts?.length ?? 0}
            </span>
          </button>
        </div>

        {/* Constant-height subheader: keeps the region above the panels
            stable so the tab switch never shifts the layout. */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">
            {rightPanelTab === "cart"
              ? "صورت حساب زنده"
              : "در انتظار پرداخت"}
          </h2>
          {rightPanelTab === "cart" ? (
            <div className="flex items-center gap-1.5">
              {cart.serverOrderNumber ? (
                <Badge variant="neutral">{cart.serverOrderNumber}</Badge>
              ) : null}
              <button
                type="button"
                onClick={onDiscard}
                disabled={
                  (!cart.lines.length && !cart.serverOrderId) ||
                  draftPending ||
                  sendPending ||
                  discardPending
                }
                aria-label="حذف همه و شروع دوباره"
                title="حذف همه آیتم‌های این سفارش"
                className="flex h-6 shrink-0 items-center gap-1 rounded-lg px-1.5 text-xs font-semibold text-danger outline-none transition-colors duration-150 hover:bg-danger/10 focus-visible:ring-2 focus-visible:ring-danger/40 disabled:pointer-events-none disabled:opacity-40"
              >
                <Trash2 className="size-3.5" aria-hidden />
                حذف همه
              </button>
            </div>
          ) : (
            <Badge variant="neutral">{drafts?.length ?? 0} سفارش</Badge>
          )}
        </div>
      </div>

      {/* Content region — both panels live in the SAME box as stacked
          absolute layers, so switching tabs is a pure crossfade + rise with
          zero layout reflow. */}
      <div className="relative min-h-0 flex-1">
        <AnimatePresence initial={false}>
          {rightPanelTab === "drafts" ? (
            <motion.div
              key="drafts"
              {...panelMotion}
              className="pos-scroll absolute inset-0 flex flex-col gap-2 overflow-y-auto p-3"
            >
          {(drafts ?? []).map((draft, i) => {
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
                onClick={() => onLoadDraft(draft.id)}
                disabled={loadPending}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex size-6 items-center justify-center rounded-lg text-[10px] font-bold transition-colors ${
                        isActive
                          ? "bg-primary-fill text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="text-[13px] font-bold">
                      سفارش {draft.orderNumber}
                    </span>
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
          {!drafts?.length ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
              <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground/60">
                <LayoutGrid className="size-4" aria-hidden />
              </div>
              <p className="text-[13px] font-medium text-muted-foreground">
                سفارشی در انتظار پرداخت نیست
              </p>
            </div>
          ) : null}
            </motion.div>
          ) : (
            <motion.div
              key="cart"
              {...panelMotion}
              className="absolute inset-0 flex min-h-0 flex-col"
            >
              {/* Order context — order type + table. Lives inside the live-cart
                  panel so it crossfades with the صورت حساب tab only and never
                  changes the header height. */}
              <div className="flex shrink-0 items-center gap-1.5 border-b border-border bg-muted/25 p-2.5">
                <Select
                  value={cart.orderType}
                  onValueChange={(v) =>
                    cart.setMeta({
                      orderType: v as typeof cart.orderType,
                      ...(v === "DineIn" ? {} : { tableNumber: "" }),
                    })
                  }
                >
                  <SelectTrigger
                    aria-label="نوع سفارش"
                    className="h-9 min-w-0 flex-1"
                  >
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
                    className="h-9 w-16 shrink-0 text-center sm:w-20"
                    value={cart.tableNumber}
                    onChange={(e) =>
                      cart.setMeta({ tableNumber: e.target.value })
                    }
                  />
                ) : null}
              </div>
              <div className="pos-scroll min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {cart.lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground/60">
                <ShoppingBasket
                  className="size-5"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </div>
              <div>
                <p className="text-sm font-semibold">سبد خالی است</p>
                <p className="mt-1 max-w-[16rem] text-[13px] leading-5 text-muted-foreground text-pretty">
                  برای شروع، یک آیتم از فهرست منو انتخاب کنید
                </p>
              </div>
            </div>
          ) : (
            cart.lines.map((line, lineIndex) => (
              <div
                key={`${line.menuItemId}-${lineIndex}`}
                className="cursor-pointer rounded-xl border border-border bg-card p-3 transition-colors duration-150 hover:border-border-strong"
                onClick={() => onEditLine(lineIndex)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold leading-5">
                      {line.title}
                    </div>
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
              {/* Totals + actions — pinned under the cart lines */}
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
                draftPending ||
                sendPending ||
                discardPending
              }
              onClick={onSaveDraft}
            >
              ثبت موقت
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-11 text-danger hover:bg-danger/10 hover:text-danger"
              disabled={
                (!cart.lines.length && !cart.serverOrderId) ||
                draftPending ||
                sendPending ||
                discardPending
              }
              onClick={onDiscard}
            >
              حذف نیمه‌کاره
            </Button>
            <Button
              data-tour="pos-checkout-desktop"
              className="col-span-2 h-12"
              size="lg"
              disabled={!cart.lines.length}
              onClick={onCheckout}
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
              sendPending ||
              draftPending ||
              discardPending
            }
            onClick={onSendToKitchen}
          >
            ارسال به بار/آشپزخانه
          </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Bottom sheet wrapper for the mobile cart. */
function MobileCartSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col justify-end md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="سبد سفارش"
    >
      <div
        className="animate-fade-in absolute inset-0 bg-slate-950/40"
        onClick={onClose}
        aria-hidden
      />
      <div className="animate-sheet relative flex max-h-[88dvh] min-h-0 flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl pb-[env(safe-area-inset-bottom)]">
        <div className="relative flex h-11 shrink-0 items-center justify-center border-b border-border/60">
          <span className="h-1.5 w-10 rounded-full bg-border" aria-hidden />
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن سبد سفارش"
            className="absolute end-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
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

/**
 * Menu-item artwork on a soft, ringed square stage. `object-cover` fills
 * the 1:1 box edge-to-edge so the dish reads clearly at a glance; the
 * placeholder icon takes over when the URL is missing or fails to load,
 * keeping the card geometry stable.
 */
function MenuItemImage({
  src,
  className,
}: {
  src: string | null | undefined;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const show = !!src && !failed;

  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-xl bg-muted/80 ring-1 ring-inset ring-border/50",
        className,
      )}
    >
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src as string}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Coffee
            className="size-8 text-muted-foreground/45 sm:size-9"
            strokeWidth={1.4}
            aria-hidden
          />
        </div>
      )}
    </div>
  );
}
