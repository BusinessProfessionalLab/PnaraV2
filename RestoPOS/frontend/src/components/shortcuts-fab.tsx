"use client";

import {
  ArrowLeft,
  CircleHelp,
  Coffee,
  LayoutDashboard,
  MonitorSmartphone,
  Settings,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import { useProductTour } from "@/features/product-tour";

/**
 * Shortcut rows shown in the FAB dialog. `keys` maps to a global keyboard
 * shortcut (Ctrl/Cmd+Shift+N) and is shown as a hint chip on the row.
 */
type ShortcutRow = {
  id: string;
  title: string;
  description: string;
  icon: typeof Coffee;
  /** Route navigation targets. */
  to?: string;
  /** Instead of navigating, replays the guided tour. */
  tour?: "onboarding";
  /** Digit for the Ctrl/Cmd+Shift+N shortcut (undefined = no hotkey). */
  keyNum?: string;
};

const ROWS: ShortcutRow[] = [
  {
    id: "pos",
    title: "صندوق فروش",
    description: "ثبت سفارش، پیش‌نویس و تسویه حساب",
    icon: Coffee,
    to: "/pos",
    keyNum: "1",
  },
  {
    id: "dashboard",
    title: "داشبورد مدیریت",
    description: "نمای کلی فروش، سفارش‌ها و گزارش‌ها",
    icon: LayoutDashboard,
    to: "/admin",
    keyNum: "2",
  },
  {
    id: "settings",
    title: "تنظیمات فروشگاه",
    description: "برند، تم، چاپگر و واحد پول",
    icon: Settings,
    to: "/admin/settings",
    keyNum: "3",
  },
  {
    id: "menu",
    title: "منوی محصولات",
    description: "دسته‌ها، آیتم‌ها، قیمت‌ها و مواد اولیه",
    icon: UtensilsCrossed,
    to: "/admin/menu",
  },
  {
    id: "kds",
    title: "نمایشگر آشپزخانه",
    description: "صف سفارش‌ها برای بار و آشپزخانه",
    icon: MonitorSmartphone,
    to: "/kds",
    keyNum: "4",
  },
  {
    id: "tour",
    title: "راهنمای تعاملی",
    description: "آموزش گام‌به‌گام محیط برنامه",
    icon: CircleHelp,
    tour: "onboarding",
  },
];

/** Screens the FAB + shortcuts live on (POS and the admin panel). */
function visibleOn(pathname: string): boolean {
  const segment = pathname.split("/")[1] ?? "";
  return segment === "pos" || segment === "admin";
}

export function ShortcutsFab() {
  const router = useRouter();
  const pathname = usePathname();
  const { startTour } = useProductTour();
  const [open, setOpen] = useState(false);
  const [modKey, setModKey] = useState("Ctrl");

  // macOS shows ⌘ instead of Ctrl (post-hydration, to keep SSR markup stable).
  useEffect(() => {
    if (typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)) {
      setModKey("⌘");
    }
  }, []);

  // Global keyboard shortcuts:
  //   ?                → open this shortcuts dialog
  //   Ctrl/Cmd+Shift+1..4 → jump to POS / admin / settings / KDS
  // Digits are matched by PHYSICAL key (e.code), so they keep working on a
  // Persian layout (whose top row types ۱۲۳۴ instead of 1234) — with a
  // Persian/Arabic-digit fallback for keyboards that report e.key only.
  // Everything is ignored while typing or while another dialog is open
  // (e.g. the checkout modal), and on display/login screens.
  useEffect(() => {
    if (!visibleOn(pathname)) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (document.querySelector('[role="dialog"]')) return;

      // ? (Shift+Slash) opens the shortcuts dialog — also accept the
      // Persian question mark typed on fa layouts.
      if (
        (e.key === "?" || e.key === "؟") &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        setOpen(true);
        return;
      }

      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
      const byDigit: Record<string, string | undefined> = {
        "1": "/pos",
        "2": "/admin",
        "3": "/admin/settings",
        "4": "/kds",
      };
      let digit: string | undefined;
      if (e.code.startsWith("Digit")) {
        digit = e.code.slice("Digit".length);
      } else {
        // Fallback: some layouts report the produced character (e.key).
        const fa = "۰۱۲۳۴۵۶۷۸۹";
        const ar = "٠١٢٣٤٥٦٧٨٩";
        const fai = fa.indexOf(e.key);
        const ari = ar.indexOf(e.key);
        if (fai !== -1) digit = String(fai);
        else if (ari !== -1) digit = String(ari);
        else if (/^\d$/.test(e.key)) digit = e.key;
      }
      const to = digit ? byDigit[digit] : undefined;
      if (!to || to === pathname) return;
      e.preventDefault();
      router.push(to);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname, router]);

  if (!visibleOn(pathname)) return null;

  const run = (row: ShortcutRow) => {
    setOpen(false);
    if (row.tour) {
      startTour(row.tour, "manual");
      return;
    }
    if (row.to && row.to !== pathname) router.push(row.to);
  };

  // On POS phones the persistent bottom cart bar occupies the bottom edge,
  // so the launcher floats just above it (max-md only).
  const onPosMobile = pathname.startsWith("/pos");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="میانبرهای سریع"
          title="میانبرهای سریع (?) (Ctrl/Cmd+Shift+1…4)"
          className={cn(
            "fixed bottom-5 left-4 z-40 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 outline-none transition-transform duration-150 hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-95 md:left-5",
            onPosMobile && "max-md:bottom-[4.9rem]",
          )}
        >
          <Zap className="size-5" strokeWidth={2.1} aria-hidden />
        </button>
      </DialogTrigger>

      <DialogContent className="sm:w-[min(94vw,30rem)]">
        <DialogHeader>
          <DialogTitle>میانبرهای سریع</DialogTitle>
          <DialogDescription>
            دسترسی یک‌کلیک به بخش‌های پرکاربرد برنامه. میانبر صفحه‌کلید هر بخش کنارش نوشته شده و با
            کلید «؟» دوباره همین پنجره باز می‌شود.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-2">
          {ROWS.map((row) => {
            const Icon = row.icon;
            const current = Boolean(row.to && row.to === pathname);
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => run(row)}
                aria-current={current ? "page" : undefined}
                disabled={current}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-xl border p-3 text-start outline-none transition-[border-color,background-color] duration-150 focus-visible:ring-2 focus-visible:ring-ring/50",
                  current
                    ? "cursor-default border-primary/30 bg-primary-soft/60"
                    : "cursor-pointer border-border bg-card hover:border-border-strong hover:bg-muted/40",
                )}
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                    current ? "bg-primary-fill/90 text-primary-foreground" : "bg-primary-soft text-primary",
                  )}
                >
                  <Icon className="size-5" strokeWidth={1.9} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{row.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {row.description}
                  </span>
                </span>

                {current ? (
                  <span className="shrink-0 rounded-lg bg-card px-2.5 py-1 text-[11px] font-bold text-primary shadow-xs">
                    صفحه جاری
                  </span>
                ) : row.keyNum ? (
                  <kbd
                    aria-hidden
                    className="hidden shrink-0 items-center gap-1 rounded-lg border border-border bg-muted px-2 py-1 font-sans text-[10px] font-semibold text-muted-foreground sm:flex"
                  >
                    {modKey}
                    <span className="text-[8px] opacity-70">+</span>
                    Shift
                    <span className="text-[8px] opacity-70">+</span>
                    {row.keyNum}
                  </kbd>
                ) : null}

                {!current ? (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors group-hover:bg-card group-hover:text-primary">
                    <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
                  </span>
                ) : null}
              </button>
            );
          })}
          <p className="px-1 pt-2 text-[11px] leading-5 text-muted-foreground">
            میانبرهای صفحه‌کلید فقط بیرون از کادرهای متنی و پنجره‌ها کار می‌کنند.
          </p>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
