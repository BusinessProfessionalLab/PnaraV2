"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  MonitorSmartphone,
  Settings,
  Store,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const links = [
  { href: "/admin", label: "داشبورد", icon: Store },
  { href: "/admin/menu", label: "منو و رسپی", icon: UtensilsCrossed },
  { href: "/admin/inventory", label: "انبار", icon: Boxes },
  { href: "/admin/customers", label: "باشگاه مشتریان", icon: Users },
  { href: "/admin/reports", label: "گزارش‌ها", icon: BarChart3 },
  { href: "/admin/staff", label: "پرسنل", icon: ClipboardList },
  { href: "/admin/settings", label: "تنظیمات فروشگاه", icon: Settings },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  return (
    <div className="flex min-h-screen bg-[hsl(30_20%_95%)]">
      <aside className="w-64 shrink-0 border-e bg-secondary p-4 text-secondary-foreground">
        <div className="mb-6 px-2">
          <div className="text-xs opacity-70">پنل مدیریت</div>
          <div className="text-lg font-black">{settings.data?.storeName ?? "ToastIran POS"}</div>
        </div>
        <nav className="space-y-1">
          {links.map((l) => {
            const active = path === l.href;
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold",
                  active ? "bg-primary text-white" : "hover:bg-white/10",
                )}
              >
                <Icon className="h-4 w-4" />
                {l.label}
              </Link>
            );
          })}
          <Link href="/admin/discounts" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-white/10">
            <ClipboardList className="h-4 w-4" />
            تخفیف‌ها
          </Link>
        </nav>
        <Link href="/pos" className="mt-8 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm">
          <MonitorSmartphone className="h-4 w-4" />
          بازگشت به صندوق
        </Link>
      </aside>
      <main className="min-w-0 flex-1 p-6">{children}</main>
    </div>
  );
}
