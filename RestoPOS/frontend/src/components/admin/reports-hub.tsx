"use client";


import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarRange, Clock3, Crown, ListOrdered, TrendingUp, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/input";
import { JalaliDatePicker } from "@/components/ui/jalali-date-picker";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  useReportCategories,
  useReportHourly,
  useReportPerformance,
  useReportProducts,
  useReportStaff,
} from "@/queries/reports";
import { formatToman, rialToToman } from "@/lib/currency";
import { daysAgoUtc } from "@/lib/jalali";
import { cn } from "@/lib/cn";

const COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)", "var(--color-chart-6)"];
const BAND_COLOR: Record<string, string> = {
  Star: "var(--color-chart-4)",
  Underperforming: "var(--color-chart-1)",
  default: "var(--color-chart-3)",
};

const tooltipStyle: React.CSSProperties = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  boxShadow: "var(--shadow-lg)",
  color: "var(--color-foreground)",
  fontSize: 12,
  padding: "8px 12px",
};
const tickStyle = { fontSize: 11, fill: "var(--color-muted-foreground)" };

const PRESETS = [
  { label: "۷ روز", days: 7 },
  { label: "۱۴ روز", days: 14 },
  { label: "۳۰ روز", days: 30 },
];

function cardTitle(icon: React.ReactNode, title: string, sub?: string) {
  return (
    <div className="flex items-center gap-2 border-b border-border/70 px-5 py-4">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
        {icon}
      </span>
      <div>
        <h2 className="text-[15px] font-bold">{title}</h2>
        {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
      </div>
    </div>
  );
}

/** Start of the LOCAL day an ISO timestamp points at (inclusive from-date). */
function dayStartIso(noonIso: string) {
  const d = new Date(noonIso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).toISOString();
}

/** End of the LOCAL day an ISO timestamp points at (inclusive to-date). */
function dayEndIso(noonIso: string) {
  const d = new Date(noonIso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).toISOString();
}

export function ReportsHub() {
  const [from, setFrom] = useState(daysAgoUtc(14));
  const [to, setTo] = useState(new Date().toISOString());
  const products = useReportProducts(from, to);
  const cats = useReportCategories(from, to);
  const hourly = useReportHourly(from, to);
  const perf = useReportPerformance(from, to);
  const staff = useReportStaff(from, to);

  const heat = useMemo(() => {
    const map = new Map((hourly.data ?? []).map((h) => [h.hour, h]));
    return Array.from({ length: 24 }, (_, hour) => {
      const row = map.get(hour);
      return { hour, orderCount: row?.orderCount ?? 0, toman: rialToToman(row?.netSales ?? 0) };
    });
  }, [hourly.data]);
  const maxToman = Math.max(1, ...heat.map((h) => h.toman));

  const anyLoading = products.isLoading || cats.isLoading || hourly.isLoading || perf.isLoading || staff.isLoading;
  const totalSales = (products.data ?? []).reduce((s, p) => s + p.netSales, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="گزارش‌ها"
        description="تحلیل فروش بر اساس دوره انتخابی — مقادیر به تومان نمایش داده می‌شوند"
        actions={
          <div className="flex gap-1 rounded-xl bg-muted p-1">
            {PRESETS.map((p) => (
              <button
                key={p.days}
                type="button"
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150",
                  (from === daysAgoUtc(p.days) ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"),
                )}
                onClick={() => {
                  setFrom(daysAgoUtc(p.days));
                  setTo(new Date().toISOString());
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      />

      {/* Range picker */}
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end">
        <Field label="از تاریخ" className="w-full sm:max-w-60">
          <JalaliDatePicker
            value={from}
            maxIso={to}
            onChange={(noonIso) => setFrom(dayStartIso(noonIso))}
          />
        </Field>
        <Field label="تا تاریخ" className="w-full sm:max-w-60">
          <JalaliDatePicker
            value={to}
            minIso={from}
            onChange={(noonIso) => setTo(dayEndIso(noonIso))}
          />
        </Field>
        <div className="flex items-center gap-2 pb-1 text-[13px] text-muted-foreground sm:ms-auto">
          <CalendarRange className="size-4" aria-hidden />
          <span className="tabular-nums">{formatToman(totalSales)} فروش در این بازه</span>
        </div>
      </Card>

      {/* Peak hours */}
      <Card className="overflow-hidden">
        {cardTitle(<Clock3 className="size-4" aria-hidden />, "ساعات پیک فروش", "داغی ساعات بر اساس فروش (تومان)")}
        <div className="p-5">
          {hourly.isLoading ? (
            <div className="flex h-32 items-end gap-1">
              {Array.from({ length: 24 }).map((_, i) => (
                <Skeleton key={i} className="h-24 flex-1 rounded-md" />
              ))}
            </div>
          ) : (
            <>
              <div className="flex h-36 items-end gap-1">
                {heat.map((h) => {
                  const intensity = h.toman / maxToman;
                  return (
                    <div key={h.hour} className="group relative flex h-full flex-1 items-end" title={`${h.hour}:00 — ${h.orderCount} سفارش · ${formatToman(h.toman * 10)}`}>
                      <div
                        className="w-full rounded-md bg-primary transition-opacity duration-150 group-hover:opacity-90"
                        style={{
                          height: `${Math.max(4, Math.round(intensity * 100))}%`,
                          opacity: 0.18 + intensity * 0.62,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-1">
                {heat.map((h) => (
                  <div key={h.hour} className="flex-1 text-center text-[9px] leading-4 text-muted-foreground tabular-nums">
                    {h.hour % 3 === 0 ? h.hour : ""}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          {cardTitle(<TrendingUp className="size-4" aria-hidden />, "توزیع درآمد دسته‌ها")}
          <div className="h-72 p-4">
            {(cats.data ?? []).length === 0 ? (
              <ChartEmpty loading={cats.isLoading} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={cats.data ?? []} dataKey="netSales" nameKey="categoryName" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="none">
                    {(cats.data ?? []).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatToman(Number(v))} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--color-muted-foreground)" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          {cardTitle(<Crown className="size-4" aria-hidden />, "پرفروش در برابر کم‌فروش")}
          <div className="h-72 p-4">
            {(perf.data ?? []).length === 0 ? (
              <ChartEmpty loading={perf.isLoading} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perf.data ?? []} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="title" hide />
                  <YAxis tickLine={false} axisLine={false} width={44} tick={tickStyle} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatToman(Number(v))} cursor={{ fill: "var(--color-muted)" }} />
                  <Bar dataKey="netSales" radius={[6, 6, 0, 0]}>
                    {(perf.data ?? []).map((p, i) => (
                      <Cell key={i} fill={BAND_COLOR[p.band] ?? BAND_COLOR.default} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* Staff audit */}
        <Card className="overflow-hidden">
          {cardTitle(<Users className="size-4" aria-hidden />, "ممیزی عملکرد صندوق‌دار")}
          {anyLoading ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (staff.data ?? []).length === 0 ? (
            <div className="p-5">
              <EmptyState compact icon={Users} title="داده‌ای در این بازه نیست" description="بازه زمانی دیگری انتخاب کنید" />
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {(staff.data ?? []).map((s) => (
                <li key={s.staffId} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground tabular-nums">
                    {String(s.staffName?.trim().charAt(0) ?? "؟")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{s.staffName}</div>
                    <div className="text-[11px] text-muted-foreground tabular-nums">{s.orderCount} سفارش</div>
                  </div>
                  <div className="text-end">
                    <div className="text-sm font-bold tabular-nums">{formatToman(s.netSales)}</div>
                    <div className="text-[11px] text-muted-foreground tabular-nums">
                      میانگین {formatToman(s.averageTicket)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Top products */}
        <Card className="overflow-hidden">
          {cardTitle(<ListOrdered className="size-4" aria-hidden />, "فروش کالا")}
          {products.isLoading ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (products.data ?? []).length === 0 ? (
            <div className="p-5">
              <EmptyState compact icon={ListOrdered} title="فروشی ثبت نشده" description="در این بازه فروشی وجود ندارد" />
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {(products.data ?? [])
                .slice()
                .sort((a, b) => b.netSales - a.netSales)
                .slice(0, 10)
                .map((p, i) => (
                  <li key={p.menuItemId} className="flex items-center gap-3 px-5 py-2.5">
                    <span className={cn("w-5 text-center text-xs font-black tabular-nums", i === 0 ? "text-warning" : "text-muted-foreground")}>
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{p.title}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {p.categoryName} · {p.quantity} عدد
                      </div>
                    </div>
                    <span className="text-[13px] font-bold tabular-nums">{formatToman(p.netSales)}</span>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function ChartEmpty({ loading }: { loading: boolean }) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Skeleton className="h-40 w-40 rounded-full" />
      </div>
    );
  }
  return (
    <div className="flex h-full items-center justify-center text-[13px] text-muted-foreground">
      داده‌ای برای نمایش نیست
    </div>
  );
}
