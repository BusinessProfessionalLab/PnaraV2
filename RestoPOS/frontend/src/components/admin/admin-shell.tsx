"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";

import {
  BarChart3,
  Boxes,
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  MonitorSmartphone,
  Settings,
  Store,
  Tag,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { appConfig } from "@/config/app";
import { TourTrigger } from "@/features/product-tour";
import { useSettings } from "@/queries/settings";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "@/components/ui/theme-toggle";

type NavItem = { href: string; label: string; icon: typeof Store };
type NavSection = { title: string; items: NavItem[] };

const NAV: NavSection[] = [
  {
    title: "فروشگاه",
    items: [
      { href: "/admin", label: "داشبورد", icon: LayoutDashboard },
      { href: "/admin/menu", label: "منو و رسپی", icon: UtensilsCrossed },
      { href: "/admin/discounts", label: "تخفیف‌ها", icon: Tag },
      { href: "/admin/inventory", label: "انبار", icon: Boxes },
    ],
  },
  {
    title: "مدیریت",
    items: [
      { href: "/admin/customers", label: "باشگاه مشتریان", icon: Users },
      { href: "/admin/reports", label: "گزارش‌ها", icon: BarChart3 },
      { href: "/admin/staff", label: "پرسنل", icon: ClipboardList },
      { href: "/admin/settings", label: "تنظیمات", icon: Settings },
    ],
  },
];

function BrandMark({ className }: { className?: string }) {
  return (
    <div className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
      <Store className="size-[18px]" strokeWidth={2} aria-hidden />
    </div>
  );
}

function SidebarNav({
  storeName,
  onNavigate,
}: {
  storeName?: string;
  onNavigate?: () => void;
}) {
  const path = usePathname();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <BrandMark />
        <div className="min-w-0">
          <div className="truncate text-[15px] font-bold tracking-tight text-foreground">
            {storeName || "ToastIran POS"}
          </div>
          <div className="text-[11px] font-medium text-muted-foreground">
            پنل مدیریت
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {NAV.map((section) => (
          <div key={section.title} className="mb-4">
            <div className="px-3 pb-1.5 text-[11px] font-semibold text-muted-foreground">
              {section.title}
            </div>
            <nav className="space-y-0.5">
              {section.items.map((item) => {
                const active = path === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/50",
                      active
                        ? "bg-primary-soft font-semibold text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-[18px] shrink-0",
                        active
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground",
                      )}
                      strokeWidth={active ? 2.2 : 1.8}
                      aria-hidden
                    />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}

        <div className="rounded-xl bg-muted/60 p-2">
          <div className="px-3 pb-1.5 pt-2 text-[11px] font-semibold text-muted-foreground">
            صندوق و نمایشگر
          </div>
          <div className="space-y-0.5">
            <Link
              href="/pos"
              onClick={onNavigate}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-foreground outline-none transition-colors duration-150 hover:bg-card hover:shadow-xs focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <MonitorSmartphone
                className="size-[18px] text-muted-foreground"
                strokeWidth={1.8}
                aria-hidden
              />
              صندوق لمسی
            </Link>
            <Link
              href="/kds"
              onClick={onNavigate}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-foreground outline-none transition-colors duration-150 hover:bg-card hover:shadow-xs focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <MonitorSmartphone
                className="size-[18px] text-muted-foreground"
                strokeWidth={1.8}
                aria-hidden
              />
              نمایشگر بار
            </Link>
            <Link
              href="/kds/kitchen"
              onClick={onNavigate}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-foreground outline-none transition-colors duration-150 hover:bg-card hover:shadow-xs focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <MonitorSmartphone
                className="size-[18px] text-muted-foreground"
                strokeWidth={1.8}
                aria-hidden
              />
              نمایشگر آشپزخانه
            </Link>
          </div>
        </div>
      </div>

      {/* Product metadata: version → change log. Quiet, but interactive. */}
      <div className="border-b border-border px-2">
        <Link
          data-tour="version"
          href="/admin/version"
          onClick={onNavigate}
          aria-label="نسخه برنامه و تاریخچه تغییرات"
          aria-current={path === "/admin/version" ? "page" : undefined}
          className={cn(
            "group flex items-center gap-2.5 rounded-xl px-3 py-2 text-start outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/50",
            path === "/admin/version"
              ? "bg-primary-soft/60 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-150",
              path === "/admin/version"
                ? "bg-primary-soft text-primary"
                : "bg-muted text-muted-foreground group-hover:bg-card group-hover:text-foreground",
            )}
          >
            <History className="size-4" strokeWidth={1.9} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] leading-4 font-semibold">
              نسخه برنامه
            </span>
            <span className="mt-0.5 block text-[10px] leading-3 text-muted-foreground/80">
              مشاهده تغییرات هر نسخه
            </span>
          </span>
          <span
            dir="ltr"
            className="font-mono text-xs font-bold text-muted-foreground tabular-nums"
          >
            v{appConfig.version}
          </span>
        </Link>

        <div className="flex items-center gap-1 border-t border-border/70 px-2.5 py-2.5">
          <TourTrigger label="آموزش برنامه" className="size-9" />
          <ThemeToggle />
          <button
            type="button"
            onClick={() => {
              onNavigate?.();
              logout();
              router.push("/login");
            }}
            className="flex h-9 flex-1 items-center gap-2 rounded-xl px-2.5 text-sm font-medium text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <LogOut className="size-[18px]" strokeWidth={1.8} aria-hidden />
            خروج از حساب
          </button>
        </div>
      </div>
    </div>
  );
}

/*
 * Compact icon-only sidebar for tablets (768–1023px). The full navigation
 * lives on desktop (≥1024px) and inside the mobile drawer (<768px); this
 * rail keeps every destination reachable without eating content width.
 */
function RailNav({
  storeName,
  onNavigate,
}: {
  storeName?: string;
  onNavigate?: () => void;
}) {
  const path = usePathname();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const flat = NAV.flatMap((s) => s.items);
  const registerLinks = [
    { href: "/pos", label: "صندوق لمسی", icon: MonitorSmartphone },
    { href: "/kds", label: "نمایشگر بار", icon: MonitorSmartphone },
    {
      href: "/kds/kitchen",
      label: "نمایشگر آشپزخانه",
      icon: MonitorSmartphone,
    },
  ];
  const all = [...flat, ...registerLinks];
  return (
    <div className="flex h-full flex-col items-center">
      <div className="flex h-[4.5rem] shrink-0 items-center justify-center">
        <BrandMark />
      </div>
      <nav
        className="flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto px-2 pb-3"
        aria-label="ناوبری پنل مدیریت"
      >
        {all.map((item) => {
          const active = path === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/50",
                active
                  ? "bg-primary-soft text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon
                className="size-[18px]"
                strokeWidth={active ? 2.2 : 1.8}
                aria-hidden
              />
            </Link>
          );
        })}
      </nav>
      <div className="flex w-full flex-col items-center gap-1 border-t border-border px-2 py-2.5">
        <Link
          data-tour="version"
          href="/admin/version"
          onClick={onNavigate}
          title="نسخه برنامه و تغییرات"
          aria-label="نسخه برنامه و تغییرات"
          aria-current={path === "/admin/version" ? "page" : undefined}
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/50",
            path === "/admin/version"
              ? "bg-primary-soft text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <History className="size-[18px]" strokeWidth={1.8} aria-hidden />
        </Link>
        <TourTrigger label="آموزش برنامه" className="size-10" />
        <ThemeToggle className="size-10" />
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            logout();
            router.push("/login");
          }}
          title="خروج از حساب"
          aria-label="خروج از حساب"
          className="flex size-10 items-center justify-center rounded-xl text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <LogOut className="size-[18px]" strokeWidth={1.8} aria-hidden />
        </button>
      </div>
      <span className="sr-only">{storeName || "ToastIran POS"}</span>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const settings = useSettings();
  const storeName = settings.data?.storeName;

  return (
    <div className="min-h-dvh bg-background md:flex">
      {/* Desktop sidebar — appears on the inline-start (right in RTL). */}
      <aside
        data-tour="admin-nav"
        className="sticky top-0 hidden h-dvh w-64 shrink-0 border-e border-border bg-card lg:block"
      >
        <SidebarNav storeName={storeName} />
      </aside>

      {/* Tablet icon rail (768–1023px) */}
      <aside className="sticky top-0 hidden h-dvh w-[4.5rem] shrink-0 border-e border-border bg-card md:flex lg:hidden">
        <RailNav storeName={storeName} />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-card/90 px-3 backdrop-blur md:hidden sm:px-4">
        <BrandMark />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">
            {storeName || "ToastIran POS"}
          </div>
          <div className="text-[11px] text-muted-foreground">پنل مدیریت</div>
        </div>
        <TourTrigger label="آموزش برنامه" className="size-10" placement="bottom" />
        <ThemeToggle />
        <DialogPrimitive.Root open={navOpen} onOpenChange={setNavOpen}>
          <DialogPrimitive.Trigger asChild>
            <button
              type="button"
              aria-label="باز کردن منو"
              className="flex size-10 items-center justify-center rounded-xl text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <Menu className="size-5" aria-hidden />
            </button>
          </DialogPrimitive.Trigger>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="animate-overlay fixed inset-0 z-50 bg-slate-950/40" />
            <DialogPrimitive.Content className="animate-from-end fixed inset-y-0 start-0 z-50 w-[min(86vw,20rem)] border-e border-border bg-card shadow-xl outline-none">
              <DialogPrimitive.Title className="sr-only">
                منوی مدیریت
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="sr-only">
                ناوبری پنل مدیریت
              </DialogPrimitive.Description>
              <button
                type="button"
                aria-label="بستن منو"
                onClick={() => setNavOpen(false)}
                className="absolute end-3 top-5 flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" aria-hidden />
              </button>
              <SidebarNav
                storeName={storeName}
                onNavigate={() => setNavOpen(false)}
              />
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </header>

      {/* Main column */}
      <main className="flex-1 min-w-0">
        <div className="mx-auto w-full max-w-[90rem] space-y-6 p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
