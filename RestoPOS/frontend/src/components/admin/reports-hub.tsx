"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Banknote,
  ChevronLeft,
  Clock3,
  CreditCard,
  Download,
  Hourglass,
  PieChart,
  Printer,
  ReceiptText,
  RefreshCw,
  Scale,
  Search,
  Sparkles,
  Tag,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
  LayoutGrid,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ReportAmChart, type ReportChartPoint } from "@/components/admin/report-amcharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { stockAlertKeys } from "@/queries/keys";
import { useStockAlerts } from "@/queries/inventory";
import { api } from "@/lib/api";
import { formatToman, formatTomanAmount } from "@/lib/currency";
import { daysAgoUtc } from "@/lib/jalali";
import type { TimePeriodPreset, TimelineInterval } from "@/lib/types";
import { cn } from "@/lib/cn";

/* ── Constants ─────────────────────────────────────────────── */

const UNIT_LABELS: Record<string, string> = {
  Gram: "گرم",
  Milliliter: "میلی‌لیتر",
  Piece: "عدد",
  Portion: "پرس",
  Can: "قوطی",
  Kilogram: "کیلوگرم",
  Liter: "لیتر",
};

const PRESET_OPTIONS: { value: TimePeriodPreset; label: string }[] = [
  { value: "Today", label: "امروز" },
  { value: "Yesterday", label: "دیروز" },
  { value: "ThisMonth", label: "این ماه" },
  { value: "LastMonth", label: "ماه قبل" },
  { value: "CustomRange", label: "بازه دلخواه" },
];

const INTERVAL_OPTIONS: { value: TimelineInterval; label: string }[] = [
  { value: "Hourly", label: "ساعتی" },
  { value: "Daily", label: "روزانه" },
  { value: "Weekly", label: "هفتگی" },
];

/** Stable semantic colors per tender — never shift when a method is missing. */
const PAYMENT_COLORS: Record<string, string> = {
  Cash: "#059669",
  PosTerminal: "#2563EB",
  CardToCard: "#D97706",
  WalletCredit: "#7C3AED",
  Online: "#0891B2",
};
const PAYMENT_FALLBACK = ["#C41E3A", "#1F2937", "#D97706", "#059669", "#2563EB", "#7C3AED"];
const CUSTOMER_RETURN_COLORS = ["#059669", "#94A3B8"];

type SalesMetric = "amount" | "count";
type TabId = "overview" | "sales" | "finance" | "people";
type DrilldownDay = { fromUtc: string; toUtc: string; label: string };

/* ── Small helpers ─────────────────────────────────────────── */

function faNum(value: number): string {
  return Math.round(value).toLocaleString("fa-IR");
}

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = "﻿" + [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("فایل CSV دانلود شد");
}

function toDateTimeLocalInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/* ── Page ──────────────────────────────────────────────────── */

export function ReportsHub() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabId>("overview");
  const [from, setFrom] = useState(daysAgoUtc(14));
  const [to, setTo] = useState(new Date().toISOString());
  const [preset, setPreset] = useState<TimePeriodPreset>("ThisMonth");
  const [interval, setInterval] = useState<TimelineInterval>("Daily");
  const [drilldownDay, setDrilldownDay] = useState<DrilldownDay | null>(null);
  const [visiblePaymentMethods, setVisiblePaymentMethods] = useState<string[] | null>(null);
  const [categoryMetric, setCategoryMetric] = useState<SalesMetric>("amount");
  const [productMetric, setProductMetric] = useState<SalesMetric>("amount");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [salesTableMode, setSalesTableMode] = useState<"top" | "low">("top");
  const [catSearch, setCatSearch] = useState("");
  const [profitSearch, setProfitSearch] = useState("");

  const customFrom = preset === "CustomRange" ? from : undefined;
  const customTo = preset === "CustomRange" ? to : undefined;

  /* Data — each tab enables only the queries it shows, so the first paint
     fires 5 requests instead of 12. Switching tabs reuses the cache. */
  const summary = useQuery({
    queryKey: ["rep-summary", preset, customFrom, customTo],
    queryFn: () => api.dashboardSummary(preset, customFrom, customTo),
  });
  const timelinePreset: TimePeriodPreset = drilldownDay ? "CustomRange" : preset;
  const timelineInterval: TimelineInterval = drilldownDay ? "Hourly" : interval;
  const timelineFrom = drilldownDay?.fromUtc ?? customFrom;
  const timelineTo = drilldownDay?.toUtc ?? customTo;
  const timeline = useQuery({
    queryKey: ["rep-timeline", timelinePreset, timelineInterval, timelineFrom, timelineTo],
    queryFn: () => api.salesTimeline(timelinePreset, timelineInterval, timelineFrom, timelineTo),
    enabled: tab === "overview",
  });
  const heatmap = useQuery({
    queryKey: ["rep-heatmap", preset, customFrom, customTo],
    queryFn: () => api.peakHoursHeatmap(preset, customFrom, customTo),
    enabled: tab === "overview",
  });
  const payments = useQuery({
    queryKey: ["rep-pay", preset, customFrom, customTo],
    queryFn: () => api.paymentBreakdown(preset, customFrom, customTo),
    enabled: tab === "overview" || tab === "finance",
  });
  const menuPerf = useQuery({
    queryKey: ["rep-menu-perf", preset, customFrom, customTo],
    queryFn: () => api.menuItemsPerformance(preset, 10, customFrom, customTo),
    enabled: tab === "overview" || tab === "sales",
  });
  const catDetail = useQuery({
    queryKey: ["rep-cat-detail", preset, customFrom, customTo],
    queryFn: () => api.categorySalesDetail(preset, customFrom, customTo),
    enabled: tab === "sales",
  });
  const terminals = useQuery({
    queryKey: ["rep-term", preset, customFrom, customTo],
    queryFn: () => api.terminalReports(preset, customFrom, customTo),
    enabled: tab === "finance",
  });
  const zReport = useQuery({
    queryKey: ["rep-z", preset, customFrom, customTo],
    queryFn: () => api.shiftZReport(preset, undefined, customFrom, customTo),
    enabled: tab === "finance",
  });
  const profit = useQuery({
    queryKey: ["rep-profit", preset, customFrom, customTo],
    queryFn: () => api.profitMargin(preset, customFrom, customTo),
    enabled: tab === "finance",
  });
  const customerReturns = useQuery({
    queryKey: ["rep-customer-returns", preset, customFrom, customTo],
    queryFn: () => api.customerReturnRate(preset, customFrom, customTo),
    enabled: tab === "people",
  });
  const alerts = useStockAlerts();
  const staff = useQuery({
    queryKey: ["rep-s", summary.data?.fromUtc, summary.data?.toUtc],
    queryFn: () => api.reportStaff(summary.data!.fromUtc, summary.data!.toUtc),
    enabled: tab === "people" && Boolean(summary.data?.fromUtc && summary.data?.toUtc),
  });

  /* ── Derived data (same transforms as before, now memoized per tab) ── */

  const heatmapChart = useMemo(() => {
    const cells = new Map<string, { orderCount: number; netSales: number; density: number; dayFa: string }>();
    for (const row of heatmap.data ?? []) {
      const key = `${row.dayOfWeek}-${row.hour}`;
      cells.set(key, {
        orderCount: row.orderCount,
        netSales: row.netSales.rials,
        density: row.densityScore,
        dayFa: row.dayOfWeekFa,
      });
    }
    const days = Array.from({ length: 7 }, (_, d) => {
      const sample = (heatmap.data ?? []).find((r) => r.dayOfWeek === d);
      return { day: d, label: sample?.dayOfWeekFa ?? `روز ${d}` };
    });
    const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
    const rows = days.flatMap(({ day, label }) =>
      hours.map((hour) => {
        const cell = cells.get(`${day}-${Number(hour)}`);
        const orderCount = cell?.orderCount ?? 0;
        const amount = cell?.netSales ?? 0;
        return {
          day: label,
          hour,
          value: cell?.density ?? 0,
          tooltip: `${formatToman(amount)} · ${orderCount.toLocaleString("fa-IR")} سفارش`,
        };
      }),
    );
    return { days, dayLabels: days.map((day) => day.label), hours, rows };
  }, [heatmap.data]);

  const peakCell = useMemo(() => {
    let best: { dayFa: string; hour: number; orderCount: number; netSales: number } | null = null;
    let bestDensity = -1;
    for (const row of heatmap.data ?? []) {
      if (row.densityScore > bestDensity) {
        bestDensity = row.densityScore;
        best = { dayFa: row.dayOfWeekFa, hour: row.hour, orderCount: row.orderCount, netSales: row.netSales.rials };
      }
    }
    return best;
  }, [heatmap.data]);

  const timelinePoints = useMemo(
    () =>
      (timeline.data?.points ?? []).map((p) => ({
        bucketStartUtc: p.bucketStartUtc,
        label: p.labelFa || p.label,
        netSales: p.netSales.rials,
        orderCount: p.orderCount,
      })),
    [timeline.data],
  );

  const sparkValues = useMemo(() => timelinePoints.map((p) => p.netSales / 10), [timelinePoints]);

  const paymentMix = useMemo(
    () =>
      (payments.data?.methods ?? []).map((m, index) => ({
        method: m.method,
        name: m.methodLabelFa,
        amount: m.amount.rials,
        count: m.paymentCount,
        share: m.percentageShare,
        chartColor: PAYMENT_COLORS[m.method] ?? PAYMENT_FALLBACK[index % PAYMENT_FALLBACK.length],
      })),
    [payments.data],
  );

  const visiblePaymentMix = useMemo(() => {
    if (visiblePaymentMethods === null) return paymentMix;
    return paymentMix.filter((m) => visiblePaymentMethods.includes(m.method));
  }, [paymentMix, visiblePaymentMethods]);

  const topPayment = useMemo(
    () => [...paymentMix].sort((a, b) => b.share - a.share)[0] ?? null,
    [paymentMix],
  );

  const topProduct = menuPerf.data?.topSellingItems[0] ?? null;

  const selectedCategory = (catDetail.data ?? []).find((category) => category.categoryId === selectedCategoryId) ?? null;
  const categoryChartData = useMemo(() => {
    const rows = selectedCategory
      ? selectedCategory.items.map((item) => ({
          id: item.menuItemId,
          categoryId: undefined as string | undefined,
          name: item.title,
          quantity: item.quantity,
          amount: item.revenue.rials,
        }))
      : (catDetail.data ?? []).map((category) => ({
          id: category.categoryId,
          categoryId: category.categoryId as string | undefined,
          name: category.categoryName,
          quantity: category.quantity,
          amount: category.revenue.rials,
        }));
    return rows
      .sort((a, b) => (categoryMetric === "amount" ? b.amount - a.amount : b.quantity - a.quantity))
      .map((row) => ({ ...row, value: categoryMetric === "amount" ? row.amount : row.quantity }));
  }, [catDetail.data, categoryMetric, selectedCategory]);

  const productChartData = useMemo(() => {
    return [...(menuPerf.data?.allItems ?? [])]
      .sort((a, b) => (productMetric === "amount" ? b.revenue.rials - a.revenue.rials : b.quantity - a.quantity))
      .map((item) => ({
        menuItemId: item.menuItemId,
        title: item.title,
        categoryName: item.categoryName,
        quantity: item.quantity,
        amount: item.revenue.rials,
        value: productMetric === "amount" ? item.revenue.rials : item.quantity,
        band: item.band,
        chartColor: item.band === "Star" ? "#059669" : item.band === "Underperforming" ? "#C41E3A" : "#D97706",
      }));
  }, [menuPerf.data, productMetric]);

  const salesTableRows = salesTableMode === "top" ? (menuPerf.data?.topSellingItems ?? []) : (menuPerf.data?.lowestSellingItems ?? []);

  const filteredCategories = useMemo(() => {
    const term = catSearch.trim();
    if (!term) return catDetail.data ?? [];
    return (catDetail.data ?? []).filter((c) => c.categoryName.includes(term));
  }, [catDetail.data, catSearch]);

  const categoryProfit = useMemo(() => {
    const grouped = new Map<string, { categoryName: string; revenue: number; cogs: number; profit: number }>();
    for (const line of profit.data?.lines ?? []) {
      const current = grouped.get(line.categoryId) ?? { categoryName: line.categoryName, revenue: 0, cogs: 0, profit: 0 };
      current.revenue += line.revenue.rials;
      current.cogs += line.cogs.rials;
      current.profit += line.grossProfit.rials;
      grouped.set(line.categoryId, current);
    }
    return Array.from(grouped.entries())
      .map(([categoryId, row]) => ({
        categoryId,
        ...row,
        margin: row.revenue <= 0 ? 0 : (row.profit / row.revenue) * 100,
      }))
      .sort((a, b) => b.profit - a.profit);
  }, [profit.data]);

  const filteredProfitLines = useMemo(() => {
    const term = profitSearch.trim();
    const lines = profit.data?.lines ?? [];
    if (!term) return lines;
    return lines.filter((l) => l.title.includes(term) || l.categoryName.includes(term));
  }, [profit.data, profitSearch]);

  const criticalAlerts = useMemo(() => {
    return [...(alerts.data ?? [])]
      .map((item) => {
        const threshold = item.minimumAlertStock ?? item.reorderPoint ?? 0;
        const deficit = item.deficit ?? Math.max(0, threshold - item.currentStock);
        return { ...item, threshold, deficit };
      })
      .sort((a, b) => b.deficit - a.deficit)
      .slice(0, 8);
  }, [alerts.data]);

  const customerReturnData = useMemo(
    () => [
      { name: "مشتری بازگشتی", value: customerReturns.data?.returningCustomerCount ?? 0 },
      { name: "خرید اول", value: customerReturns.data?.firstTimeCustomerCount ?? 0 },
    ],
    [customerReturns.data],
  );
  const totalCustomers = (customerReturns.data?.returningCustomerCount ?? 0) + (customerReturns.data?.firstTimeCustomerCount ?? 0);

  const categoryShareData = useMemo(
    () => (catDetail.data ?? []).map((category) => ({ name: category.categoryName, value: category.revenue.rials })),
    [catDetail.data],
  );

  const cmp = summary.data?.comparisonWithPreviousPeriod;
  const totalPayments = payments.data?.totalSettled.rials ?? summary.data?.netSales.rials ?? 0;
  const totalVat = summary.data?.totalVat.rials ?? 0;
  const grossSales = totalPayments - totalVat;
  const termTotal = (terminals.data ?? []).reduce((s, t) => s + t.amount.rials, 0);
  const maxStaffSales = Math.max(0, ...(staff.data ?? []).map((s) => s.netSales));

  const anyFetching =
    summary.isFetching ||
    timeline.isFetching ||
    heatmap.isFetching ||
    payments.isFetching ||
    menuPerf.isFetching ||
    catDetail.isFetching ||
    terminals.isFetching ||
    zReport.isFetching ||
    profit.isFetching ||
    customerReturns.isFetching ||
    staff.isFetching;

  function handleTimelinePointClick(point: ReportChartPoint) {
    if (drilldownDay || interval !== "Daily") return;
    const bucketStartUtc = point.bucketStartUtc;
    if (typeof bucketStartUtc !== "string") return;
    const start = new Date(bucketStartUtc);
    if (Number.isNaN(start.getTime())) return;
    setDrilldownDay({
      fromUtc: start.toISOString(),
      toUtc: new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString(),
      label: typeof point.label === "string" ? point.label : "روز انتخاب‌شده",
    });
  }

  function refreshAll() {
    qc.invalidateQueries({
      predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("rep"),
    });
    qc.invalidateQueries({ queryKey: stockAlertKeys.all });
  }

  function exportSummary() {
    const toman = (rials: number) => Math.round(rials / 10);
    const rows: (string | number)[][] = [
      ["فروش خالص (تومان)", toman(summary.data?.netSales.rials ?? 0)],
      ["تعداد سفارش", summary.data?.totalOrders ?? 0],
      ["میانگین فاکتور (تومان)", toman(summary.data?.averageTicketSize.rials ?? 0)],
      ["تخفیف‌ها (تومان)", toman(summary.data?.totalDiscounts.rials ?? 0)],
      ["ارزش افزوده (تومان)", toman(totalVat)],
      ...paymentMix.map((m): (string | number)[] => [`پرداخت ${m.name} (تومان)`, toman(m.amount)]),
      ...(menuPerf.data?.topSellingItems.slice(0, 5) ?? []).map((i): (string | number)[] => [`پرفروش: ${i.title}`, i.quantity]),
    ];
    downloadCsv(`report-${preset}.csv`, ["شاخص", "مقدار"], rows);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="گزارش‌ها"
        description={`تحلیل فروش، مالی و مشتریان · ${summary.data?.periodLabelFa ?? "در حال بارگذاری…"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button size="sm" variant="outline" onClick={refreshAll} loading={anyFetching}>
              <RefreshCw className="size-4" aria-hidden />
              تازه‌سازی
            </Button>
            <Button size="sm" variant="outline" onClick={exportSummary}>
              <Download className="size-4" aria-hidden />
              خروجی خلاصه
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden />
              چاپ
            </Button>
          </div>
        }
        className="print:hidden"
      />

      {/* ── Sticky filter bar ── */}
      <Card className="p-4 print:hidden">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <div className="space-y-1.5">
            <Label>بازه تحلیلی</Label>
            <PillGroup
              ariaLabel="بازه تحلیلی"
              value={preset}
              onChange={(v) => {
                setPreset(v);
                setDrilldownDay(null);
                setSelectedCategoryId(null);
              }}
              options={PRESET_OPTIONS}
            />
          </div>
          <div className="space-y-1.5">
            <Label>دانه‌بندی روند</Label>
            {drilldownDay ? (
              <div className="flex items-center gap-2">
                <Badge>ساعتی · {drilldownDay.label}</Badge>
                <button
                  type="button"
                  onClick={() => setDrilldownDay(null)}
                  className="text-xs font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  بازگشت به روزها
                </button>
              </div>
            ) : (
              <PillGroup ariaLabel="دانه‌بندی روند" value={interval} onChange={(v) => setInterval(v)} options={INTERVAL_OPTIONS} />
            )}
          </div>
          {preset === "CustomRange" ? (
            <>
              <div className="space-y-1.5">
                <Label>از</Label>
                <Input
                  type="datetime-local"
                  value={toDateTimeLocalInput(from)}
                  onChange={(e) => e.target.value && setFrom(new Date(e.target.value).toISOString())}
                />
              </div>
              <div className="space-y-1.5">
                <Label>تا</Label>
                <Input
                  type="datetime-local"
                  value={toDateTimeLocalInput(to)}
                  onChange={(e) => e.target.value && setTo(new Date(e.target.value).toISOString())}
                />
              </div>
            </>
          ) : null}
          {summary.data ? (
            <div className="flex items-center gap-2 xl:ms-auto xl:pb-1">
              <Badge variant="outline">{summary.data.periodLabelFa}</Badge>
              <span className="text-xs text-muted-foreground tabular-nums">
                {(summary.data.totalOrders ?? 0).toLocaleString("fa-IR")} سفارش
              </span>
            </div>
          ) : null}
        </div>
      </Card>

      {/* ── Tabs ── */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} dir="rtl">
        <div className="sticky top-0 z-10 -mx-1 bg-background/95 px-1 py-1 backdrop-blur print:hidden">
          <TabsList className="max-w-full overflow-x-auto">
            <TabsTrigger value="overview" className="flex items-center gap-1.5">
              <LayoutGrid className="size-4" aria-hidden />
              نمای کلی
            </TabsTrigger>
            <TabsTrigger value="sales" className="flex items-center gap-1.5">
              <UtensilsCrossed className="size-4" aria-hidden />
              فروش و منو
            </TabsTrigger>
            <TabsTrigger value="finance" className="flex items-center gap-1.5">
              <Wallet className="size-4" aria-hidden />
              مالی و صندوق
            </TabsTrigger>
            <TabsTrigger value="people" className="flex items-center gap-1.5">
              <Users className="size-4" aria-hidden />
              مشتری و پرسنل
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ══════════ نمای کلی ══════════ */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <HeroKpi
              icon={Banknote}
              title="فروش خالص"
              value={summary.isLoading ? null : formatToman(summary.data?.netSales.rials ?? 0)}
              delta={cmp?.netSalesChangePercent}
              deltaCaption="نسبت به دوره قبل"
              spark={sparkValues}
              loading={summary.isLoading}
            />
            <HeroKpi
              icon={ReceiptText}
              title="تعداد سفارش"
              value={summary.isLoading ? null : faNum(summary.data?.totalOrders ?? 0)}
              delta={cmp?.ordersChangePercent}
              deltaCaption="نسبت به دوره قبل"
              loading={summary.isLoading}
            />
            <HeroKpi
              icon={CreditCard}
              title="میانگین فاکتور"
              value={summary.isLoading ? null : formatToman(summary.data?.averageTicketSize.rials ?? 0)}
              delta={cmp?.averageTicketChangePercent}
              deltaCaption="نسبت به دوره قبل"
              loading={summary.isLoading}
            />
            <HeroKpi
              icon={Tag}
              title="تخفیف‌ها"
              value={summary.isLoading ? null : formatToman(summary.data?.totalDiscounts.rials ?? 0)}
              sub={
                summary.data && grossSales > 0
                  ? `${((summary.data.totalDiscounts.rials / grossSales) * 100).toFixed(1)}٪ از فروش ناخالص`
                  : undefined
              }
              loading={summary.isLoading}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiniKpi title="فروش ناخالص" value={summary.isLoading ? "…" : formatToman(grossSales)} delta={cmp?.grossSalesChangePercent} />
            <MiniKpi title="ارزش افزوده" value={summary.isLoading ? "…" : formatToman(totalVat)} />
            <MiniKpi
              title="در انتظار پرداخت"
              value={summary.isLoading ? "…" : faNum(summary.data?.pendingOrdersCount ?? 0)}
              tone={(summary.data?.pendingOrdersCount ?? 0) > 0 ? "warning" : undefined}
            />
            <MiniKpi title="لغوشده" value={summary.isLoading ? "…" : faNum(summary.data?.cancelledOrdersCount ?? 0)} />
          </div>

          {/* Key findings — auto-generated from this range's data */}
          <Card className="p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Sparkles className="size-[18px]" strokeWidth={1.9} aria-hidden />
              </span>
              <div>
                <h2 className="font-black">یافته‌های کلیدی</h2>
                <p className="text-xs text-muted-foreground">جمع‌بندی خودکار از داده‌های همین بازه</p>
              </div>
            </div>
            {summary.isLoading || menuPerf.isLoading || heatmap.isLoading || payments.isLoading ? (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <Insight icon={Trophy} title="پرفروش‌ترین محصول" value={topProduct ? `${topProduct.title} · ${faNum(topProduct.quantity)} عدد` : "—"} />
                <Insight
                  icon={Clock3}
                  title="اوج ترافیک فروش"
                  value={peakCell ? `${peakCell.dayFa} ساعت ${String(peakCell.hour).padStart(2, "0")}:۰۰` : "—"}
                  hint={peakCell ? `${faNum(peakCell.orderCount)} سفارش` : undefined}
                />
                <Insight
                  icon={CreditCard}
                  title="روش پرداخت غالب"
                  value={topPayment ? `${topPayment.name} · ${topPayment.share.toFixed(1)}٪` : "—"}
                />
                <Insight
                  icon={Hourglass}
                  title="نیازمند پیگیری"
                  value={`${faNum(summary.data?.pendingOrdersCount ?? 0)} سفارش در انتظار پرداخت`}
                  tone={(summary.data?.pendingOrdersCount ?? 0) > 0 ? "warning" : undefined}
                />
              </div>
            )}
          </Card>

          <ReportSection
            icon={TrendingUp}
            title={`روند فروش (${drilldownDay ? `ساعتی · ${drilldownDay.label}` : INTERVAL_OPTIONS.find((o) => o.value === interval)?.label})`}
            description={!drilldownDay && interval === "Daily" ? "برای دیدن روند ساعتی، روی یک نقطه از نمودار کلیک کنید" : undefined}
            loading={timeline.isLoading}
            error={timeline.isError}
            onRetry={() => timeline.refetch()}
            empty={!timeline.isLoading && timelinePoints.length === 0}
            emptyTitle="داده‌ای در این بازه نیست"
            emptyDescription="بازه دیگری را امتحان کنید"
            chartHeight="h-80"
          >
            <ReportAmChart
              mode="line"
              data={timelinePoints}
              categoryField="label"
              valueField="netSales"
              label="روند فروش"
              color="#C41E3A"
              valueScale={0.1}
              formatValue={(value) => formatTomanAmount(value)}
              formatAxisValue={(value) => faNum(value)}
              onPointClick={!drilldownDay && interval === "Daily" ? handleTimelinePointClick : undefined}
            />
          </ReportSection>

          <div className="grid gap-4 lg:grid-cols-2">
            <ReportSection
              icon={PieChart}
              title="ترکیب روش‌های پرداخت"
              loading={payments.isLoading}
              error={payments.isError}
              onRetry={() => payments.refetch()}
              empty={!payments.isLoading && paymentMix.length === 0}
              emptyTitle="پرداختی ثبت نشده"
              emptyDescription="در این بازه پرداختی تسویه نشده است"
              chartHeight="h-64"
            >
              <div className="relative h-full">
                <ReportAmChart
                  mode="pie"
                  data={visiblePaymentMix}
                  categoryField="name"
                  valueField="amount"
                  label="ترکیب روش‌های پرداخت"
                  colorField="chartColor"
                  valueScale={0.1}
                  formatValue={(value) => formatTomanAmount(value)}
                  donut
                />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-10">
                  <span className="text-[11px] text-muted-foreground">جمع</span>
                  <span className="text-lg font-black tabular-nums">{formatTomanAmount(Math.round(totalPayments / 10))}</span>
                </div>
              </div>
            </ReportSection>
            <Card className="p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <Trophy className="size-[18px]" strokeWidth={1.9} aria-hidden />
                  </span>
                  <h2 className="font-black">۵ محصول برتر</h2>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setTab("sales")} className="print:hidden">
                  همه
                  <ChevronLeft className="size-4" aria-hidden />
                </Button>
              </div>
              {menuPerf.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (menuPerf.data?.topSellingItems ?? []).length === 0 ? (
                <EmptyState compact icon={Trophy} title="فروشی ثبت نشده" description="در این بازه محصولی فروخته نشده است" />
              ) : (
                <ol className="divide-y divide-border/60">
                  {(menuPerf.data?.topSellingItems ?? []).slice(0, 5).map((item, i) => (
                    <li key={item.menuItemId} className="flex items-center gap-3 py-2.5">
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-black tabular-nums",
                          i === 0 ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {faNum(item.rank)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold">{item.title}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {item.categoryName} · {faNum(item.quantity)} عدد
                        </div>
                      </div>
                      <div className="shrink-0 text-left">
                        <div className="text-sm font-bold tabular-nums">{formatToman(item.revenue.rials)}</div>
                        <Badge variant={item.band === "Star" ? "success" : "outline"} className="mt-0.5">
                          {item.grossMarginPercent.toFixed(1)}٪ سود
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>

          <ReportSection
            icon={Clock3}
            title="نقشه حرارتی فروش (۷ روز × ۲۴ ساعت)"
            description={
              peakCell
                ? `اوج فروش: ${peakCell.dayFa} ساعت ${String(peakCell.hour).padStart(2, "0")}:۰۰ · رنگ پررنگ‌تر یعنی فروش بیشتر`
                : "هر خانه مبلغ پرداخت‌شده در همان ساعت و روز هفته را نشان می‌دهد"
            }
            loading={heatmap.isLoading}
            error={heatmap.isError}
            onRetry={() => heatmap.refetch()}
            empty={!heatmap.isLoading && (heatmap.data ?? []).length === 0}
            emptyTitle="داده ترافیکی نیست"
            emptyDescription="در این بازه سفارشی ثبت نشده است"
            chartHeight="h-72"
          >
            <ReportAmChart
              mode="heatmap"
              data={heatmapChart.rows}
              categoryField="hour"
              valueField="value"
              label="نقشه حرارتی فروش روز و ساعت"
              tooltipField="tooltip"
              xField="hour"
              yField="day"
              xCategories={heatmapChart.hours}
              yCategories={heatmapChart.dayLabels}
            />
          </ReportSection>
        </TabsContent>

        {/* ══════════ فروش و منو ══════════ */}
        <TabsContent value="sales" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <ReportSection
              icon={Tag}
              title={selectedCategory ? `محصولات دستهٔ ${selectedCategory.categoryName}` : "فروش دسته‌بندی‌ها"}
              description={!selectedCategory ? "برای دیدن محصولات یک دسته، روی ستون آن کلیک کنید" : undefined}
              actions={
                <>
                  {selectedCategory ? (
                    <Button size="sm" variant="ghost" onClick={() => setSelectedCategoryId(null)}>
                      همهٔ دسته‌ها
                    </Button>
                  ) : null}
                  <MetricToggle value={categoryMetric} onChange={setCategoryMetric} />
                </>
              }
              loading={catDetail.isLoading}
              error={catDetail.isError}
              onRetry={() => catDetail.refetch()}
              empty={!catDetail.isLoading && categoryChartData.length === 0}
              emptyTitle="فروش دسته‌ای نیست"
              emptyDescription="در این بازه فروشی ثبت نشده است"
              chartHeight="h-80"
            >
              <ReportAmChart
                mode="bar"
                data={categoryChartData}
                categoryField="name"
                valueField="value"
                label="فروش دسته‌بندی‌ها و محصولات"
                color="#2563EB"
                valueScale={categoryMetric === "amount" ? 0.1 : 1}
                formatValue={(value) =>
                  categoryMetric === "amount" ? formatTomanAmount(value) : `${faNum(value)} عدد`
                }
                formatAxisValue={(value) => faNum(value)}
                onPointClick={(point) => {
                  if (!selectedCategoryId && typeof point.categoryId === "string") {
                    setSelectedCategoryId(point.categoryId);
                  }
                }}
              />
            </ReportSection>
            <ReportSection
              icon={PieChart}
              title="سهم فروش هر دسته"
              loading={catDetail.isLoading}
              error={catDetail.isError}
              onRetry={() => catDetail.refetch()}
              empty={!catDetail.isLoading && categoryShareData.length === 0}
              emptyTitle="سهمی برای نمایش نیست"
              emptyDescription="در این بازه فروشی ثبت نشده است"
              chartHeight="h-80"
            >
              <ReportAmChart
                mode="pie"
                data={categoryShareData}
                categoryField="name"
                valueField="value"
                label="سهم فروش بر اساس دسته‌بندی"
                colors={PAYMENT_FALLBACK}
                valueScale={0.1}
                formatValue={(value) => formatTomanAmount(value)}
              />
            </ReportSection>
          </div>

          <ReportSection
            icon={TrendingUp}
            title="روند پرفروش تا کم‌فروش"
            actions={<MetricToggle value={productMetric} onChange={setProductMetric} />}
            loading={menuPerf.isLoading}
            error={menuPerf.isError}
            onRetry={() => menuPerf.refetch()}
            empty={!menuPerf.isLoading && productChartData.length === 0}
            emptyTitle="محصولی فروخته نشده"
            emptyDescription="در این بازه فروشی ثبت نشده است"
            chartHeight="h-80"
          >
            <ReportAmChart
              mode="bar"
              data={productChartData}
              categoryField="title"
              valueField="value"
              label="فروش محصولات از پرفروش تا کم‌فروش"
              colorField="chartColor"
              valueScale={productMetric === "amount" ? 0.1 : 1}
              formatValue={(value) => (productMetric === "amount" ? formatTomanAmount(value) : `${faNum(value)} عدد`)}
              formatAxisValue={(value) => faNum(value)}
            />
          </ReportSection>

          <ReportSection
            icon={Trophy}
            title={salesTableMode === "top" ? "پرفروش‌ترین محصولات" : "کم‌فروش‌ترین محصولات"}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <PillGroup
                  ariaLabel="پرفروش یا کم‌فروش"
                  value={salesTableMode}
                  onChange={setSalesTableMode}
                  options={[
                    { value: "top", label: "پرفروش‌ها" },
                    { value: "low", label: "کم‌فروش‌ها" },
                  ]}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadCsv(
                      salesTableMode === "top" ? "top-products.csv" : "low-products.csv",
                      ["محصول", "دسته", "تعداد", "فروش (تومان)", "حاشیه سود ٪"],
                      salesTableRows.map((i) => [i.title, i.categoryName, i.quantity, Math.round(i.revenue.rials / 10), i.grossMarginPercent.toFixed(1)]),
                    )
                  }
                >
                  <Download className="size-4" aria-hidden />
                  CSV
                </Button>
              </div>
            }
            loading={menuPerf.isLoading}
            error={menuPerf.isError}
            onRetry={() => menuPerf.refetch()}
            empty={!menuPerf.isLoading && salesTableRows.length === 0}
            emptyTitle="موردی نیست"
            emptyDescription="در این بازه داده‌ای ثبت نشده است"
            skeleton={<SkeletonTable rows={6} cols={5} />}
          >
            <ReportTable maxHeight="max-h-[26rem]">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr>
                  <Th>#</Th>
                  <Th>محصول</Th>
                  <Th>تعداد</Th>
                  <Th>فروش</Th>
                  <Th>حاشیه سود</Th>
                </tr>
              </thead>
              <tbody>
                {salesTableRows.map((item) => (
                  <tr key={item.menuItemId} className="hover:bg-muted/40">
                    <Td>{faNum(item.rank)}</Td>
                    <Td>
                      <span className="font-bold">{item.title}</span>
                      <div className="text-xs text-muted-foreground">{item.categoryName}</div>
                    </Td>
                    <Td>{faNum(item.quantity)}</Td>
                    <Td>{formatToman(item.revenue.rials)}</Td>
                    <Td>
                      <Badge variant={item.band === "Star" ? "success" : "outline"}>{item.grossMarginPercent.toFixed(1)}٪</Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </ReportTable>
          </ReportSection>

          <ReportSection
            icon={Tag}
            title="گزارش تفصیلی دسته‌ها و محصولات"
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <SearchInput value={catSearch} onChange={setCatSearch} placeholder="جستجوی دسته…" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadCsv(
                      "category-sales.csv",
                      ["دسته", "تعداد", "فروش (تومان)", "سهم فروش ٪", "پرفروش‌های دسته"],
                      filteredCategories.map((c) => [
                        c.categoryName,
                        c.quantity,
                        Math.round(c.revenue.rials / 10),
                        c.sharePercent.toFixed(1),
                        c.items
                          .slice(0, 3)
                          .map((i) => `${i.title} (${i.quantity})`)
                          .join("، "),
                      ]),
                    )
                  }
                >
                  <Download className="size-4" aria-hidden />
                  CSV
                </Button>
              </div>
            }
            loading={catDetail.isLoading}
            error={catDetail.isError}
            onRetry={() => catDetail.refetch()}
            empty={!catDetail.isLoading && filteredCategories.length === 0}
            emptyTitle={catSearch ? "دسته‌ای پیدا نشد" : "داده‌ای نیست"}
            emptyDescription={catSearch ? "عبارت جستجو را تغییر دهید" : "در این بازه فروشی ثبت نشده است"}
            skeleton={<SkeletonTable rows={6} cols={5} />}
          >
            <ReportTable maxHeight="max-h-[26rem]">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr>
                  <Th>دسته</Th>
                  <Th>تعداد</Th>
                  <Th>فروش</Th>
                  <Th>سهم فروش</Th>
                  <Th>محصولات پرفروش دسته</Th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((category) => (
                  <tr key={category.categoryId} className="hover:bg-muted/40">
                    <Td>
                      <button
                        type="button"
                        className="font-bold outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50"
                        onClick={() => setSelectedCategoryId(category.categoryId)}
                      >
                        {category.categoryName}
                      </button>
                    </Td>
                    <Td>{faNum(category.quantity)}</Td>
                    <Td>{formatToman(category.revenue.rials)}</Td>
                    <Td>{category.sharePercent.toFixed(1)}٪</Td>
                    <Td className="max-w-64 truncate">
                      {category.items
                        .slice(0, 3)
                        .map((item) => `${item.title} (${item.quantity})`)
                        .join("، ") || "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </ReportTable>
          </ReportSection>
        </TabsContent>

        {/* ══════════ مالی و صندوق ══════════ */}
        <TabsContent value="finance" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <ReportSection
              icon={CreditCard}
              title="ترکیب روش‌های پرداخت"
              loading={payments.isLoading}
              error={payments.isError}
              onRetry={() => payments.refetch()}
              empty={!payments.isLoading && paymentMix.length === 0}
              emptyTitle="پرداختی ثبت نشده"
              emptyDescription="در این بازه پرداختی تسویه نشده است"
            >
              <div className="mb-2 flex flex-wrap gap-1.5">
                {paymentMix.map((method) => {
                  const active = visiblePaymentMethods === null || visiblePaymentMethods.includes(method.method);
                  return (
                    <button
                      key={method.method}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        const current = visiblePaymentMethods ?? paymentMix.map((item) => item.method);
                        setVisiblePaymentMethods(
                          current.includes(method.method)
                            ? current.filter((key) => key !== method.method)
                            : [...current, method.method],
                        );
                      }}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs",
                        active ? "border-primary bg-primary/10" : "opacity-50",
                      )}
                    >
                      <span className="me-1 inline-block size-2 rounded-full" style={{ backgroundColor: method.chartColor }} />
                      {method.name} · {method.share.toFixed(0)}٪
                    </button>
                  );
                })}
              </div>
              {visiblePaymentMix.length ? (
                <div className="h-56 min-w-0">
                  <ReportAmChart
                    mode="bar"
                    data={visiblePaymentMix}
                    categoryField="name"
                    valueField="amount"
                    label="ترکیب روش‌های پرداخت"
                    colorField="chartColor"
                    valueScale={0.1}
                    formatValue={(value) => formatTomanAmount(value)}
                    formatAxisValue={(value) => faNum(value)}
                  />
                </div>
              ) : (
                <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">یک روش پرداخت را نمایش دهید</div>
              )}
            </ReportSection>
            <ReportSection
              icon={ReceiptText}
              title="گزارش کارتخوان‌ها"
              description="مغایرت‌گیری با صورت‌حساب بانک"
              actions={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadCsv(
                      "terminals.csv",
                      ["ترمینال", "PSP", "تعداد", "مبلغ (تومان)", "میانگین (تومان)"],
                      (terminals.data ?? []).map((t) => [
                        t.terminalId ?? "—",
                        t.pspLabel,
                        t.transactionCount,
                        Math.round(t.amount.rials / 10),
                        Math.round(t.averageTicket.rials / 10),
                      ]),
                    )
                  }
                >
                  <Download className="size-4" aria-hidden />
                  CSV
                </Button>
              }
              loading={terminals.isLoading}
              error={terminals.isError}
              onRetry={() => terminals.refetch()}
              empty={!terminals.isLoading && (terminals.data ?? []).length === 0}
              emptyTitle="تراکنش کارتخوانی نیست"
              emptyDescription="در این بازه پرداختی با کارتخوان ثبت نشده است"
              skeleton={<SkeletonTable rows={4} cols={5} />}
            >
              <ReportTable>
                <thead>
                  <tr>
                    <Th>ترمینال</Th>
                    <Th>PSP</Th>
                    <Th>تعداد</Th>
                    <Th>مبلغ</Th>
                    <Th>میانگین</Th>
                    <Th>سهم</Th>
                  </tr>
                </thead>
                <tbody>
                  {(terminals.data ?? []).map((t, i) => (
                    <tr key={`${t.terminalId ?? t.psp}-${i}`} className="hover:bg-muted/40">
                      <Td>
                        <span className="font-bold" dir="ltr">
                          {t.terminalId ?? "—"}
                        </span>
                      </Td>
                      <Td>{t.pspLabel}</Td>
                      <Td>{faNum(t.transactionCount)}</Td>
                      <Td>{formatToman(t.amount.rials)}</Td>
                      <Td>{formatToman(t.averageTicket.rials)}</Td>
                      <Td>{termTotal > 0 ? ((t.amount.rials / termTotal) * 100).toFixed(1) : "۰"}٪</Td>
                    </tr>
                  ))}
                </tbody>
              </ReportTable>
            </ReportSection>
          </div>

          <ReportSection
            icon={ReceiptText}
            title="گزارش Z شیفت‌ها"
            description="مغایرت صندوق هر شیفت؛ قرمز یعنی کسری، سبز یعنی مازاد"
            actions={
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  downloadCsv(
                    "z-report.csv",
                    ["صندوق‌دار", "وضعیت", "افتتاح (تومان)", "اختتام (تومان)", "فروش خالص (تومان)", "سفارش پرداختی", "مغایرت (تومان)"],
                    (zReport.data ?? []).map((s) => [
                      s.cashierName,
                      s.status === "Open" ? "باز" : "بسته",
                      Math.round(s.openingCash.rials / 10),
                      s.closingCash ? Math.round(s.closingCash.rials / 10) : "—",
                      Math.round(s.netSales.rials / 10),
                      s.paidOrderCount,
                      s.cashVariance ? Math.round(s.cashVariance.rials / 10) : "—",
                    ]),
                  )
                }
              >
                <Download className="size-4" aria-hidden />
                CSV
              </Button>
            }
            loading={zReport.isLoading}
            error={zReport.isError}
            onRetry={() => zReport.refetch()}
            empty={!zReport.isLoading && (zReport.data ?? []).length === 0}
            emptyTitle="شیفتی در این بازه نیست"
            emptyDescription="بازه دیگری را امتحان کنید"
            skeleton={<SkeletonTable rows={5} cols={7} />}
          >
            <ReportTable maxHeight="max-h-[26rem]">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr>
                  <Th>صندوق‌دار</Th>
                  <Th>وضعیت</Th>
                  <Th>افتتاح</Th>
                  <Th>اختتام</Th>
                  <Th>فروش خالص</Th>
                  <Th>سفارش پرداختی</Th>
                  <Th>مغایرت صندوق</Th>
                </tr>
              </thead>
              <tbody>
                {(zReport.data ?? []).map((s) => {
                  const variance = s.cashVariance?.rials;
                  return (
                    <tr key={s.shiftId} className="hover:bg-muted/40">
                      <Td>
                        <span className="font-bold">{s.cashierName}</span>
                      </Td>
                      <Td>
                        <Badge variant={s.status === "Open" ? "success" : "outline"}>{s.status === "Open" ? "باز" : "بسته"}</Badge>
                      </Td>
                      <Td>{formatToman(s.openingCash.rials)}</Td>
                      <Td>{s.closingCash ? formatToman(s.closingCash.rials) : "—"}</Td>
                      <Td>{formatToman(s.netSales.rials)}</Td>
                      <Td>{faNum(s.paidOrderCount)}</Td>
                      <Td>
                        {variance === undefined || variance === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : variance === 0 ? (
                          <Badge variant="success">بدون مغایرت</Badge>
                        ) : (
                          <span className={cn("font-bold", variance > 0 ? "text-success" : "text-danger")}>
                            {variance > 0 ? "+" : ""}
                            {formatToman(variance)}
                          </span>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </ReportTable>
          </ReportSection>

          <ReportSection
            icon={Scale}
            title={`حاشیه سود ${profit.data ? `· ${profit.data.periodLabelFa}` : ""}`}
            loading={profit.isLoading}
            error={profit.isError}
            onRetry={() => profit.refetch()}
            empty={!profit.isLoading && (profit.data?.lines ?? []).length === 0}
            emptyTitle="داده سودی نیست"
            emptyDescription="برای محاسبه سود، دستور ساخت (BOM) محصولات را ثبت کنید"
            skeleton={<SkeletonTable rows={6} cols={7} />}
          >
            {profit.data ? (
              <div className="mb-3 flex flex-wrap gap-2 text-sm">
                <Badge>درآمد {formatToman(profit.data.totalRevenue.rials)}</Badge>
                <Badge variant="warning">بهای تمام‌شده {formatToman(profit.data.totalCogs.rials)}</Badge>
                <Badge variant="success">
                  سود ناخالص {formatToman(profit.data.grossProfit.rials)} ({profit.data.grossMarginPercent.toFixed(1)}٪)
                </Badge>
              </div>
            ) : null}
            <h3 className="mb-2 font-bold">حاشیه سود به تفکیک دسته‌بندی</h3>
            <div className="mb-4 grid gap-4 lg:grid-cols-2">
              <div className="h-72 min-w-0">
                <ReportAmChart
                  mode="bar"
                  data={categoryProfit}
                  categoryField="categoryName"
                  valueField="margin"
                  label="حاشیه سود بر اساس دسته‌بندی"
                  color="#059669"
                  formatValue={(value) => `${value.toFixed(1)}٪`}
                  formatAxisValue={(value) => `${faNum(value)}٪`}
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-right text-muted-foreground">
                      <Th>دسته</Th>
                      <Th>فروش</Th>
                      <Th>هزینه</Th>
                      <Th>سود</Th>
                      <Th>حاشیه</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryProfit.map((category) => (
                      <tr key={category.categoryId} className="border-t border-border/60 hover:bg-muted/40">
                        <Td>
                          <span className="font-bold">{category.categoryName}</span>
                        </Td>
                        <Td>{formatToman(category.revenue)}</Td>
                        <Td>{formatToman(category.cogs)}</Td>
                        <Td>{formatToman(category.profit)}</Td>
                        <Td>{category.margin.toFixed(1)}٪</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold">حاشیه سود محصولات</h3>
              <div className="flex flex-wrap items-center gap-2">
                <SearchInput value={profitSearch} onChange={setProfitSearch} placeholder="جستجوی محصول…" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadCsv(
                      "profit-margin.csv",
                      ["آیتم", "دسته", "تعداد", "درآمد (تومان)", "COGS (تومان)", "سود (تومان)", "حاشیه ٪"],
                      filteredProfitLines.map((l) => [
                        l.title,
                        l.categoryName,
                        l.quantitySold,
                        Math.round(l.revenue.rials / 10),
                        Math.round(l.cogs.rials / 10),
                        Math.round(l.grossProfit.rials / 10),
                        l.grossMarginPercent.toFixed(1),
                      ]),
                    )
                  }
                >
                  <Download className="size-4" aria-hidden />
                  CSV
                </Button>
              </div>
            </div>
            <ReportTable maxHeight="max-h-[26rem]">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr>
                  <Th>آیتم</Th>
                  <Th>دسته</Th>
                  <Th>تعداد</Th>
                  <Th>درآمد</Th>
                  <Th>COGS</Th>
                  <Th>سود</Th>
                  <Th>حاشیه</Th>
                </tr>
              </thead>
              <tbody>
                {filteredProfitLines.map((line) => (
                  <tr key={line.menuItemId} className="hover:bg-muted/40">
                    <Td>
                      <span className="font-bold">{line.title}</span>
                    </Td>
                    <Td>{line.categoryName}</Td>
                    <Td>{faNum(line.quantitySold)}</Td>
                    <Td>{formatToman(line.revenue.rials)}</Td>
                    <Td>{formatToman(line.cogs.rials)}</Td>
                    <Td>{formatToman(line.grossProfit.rials)}</Td>
                    <Td>{line.grossMarginPercent.toFixed(1)}٪</Td>
                  </tr>
                ))}
              </tbody>
            </ReportTable>
            <details className="mt-4 rounded-xl border border-border/70">
              <summary className="cursor-pointer p-3 text-sm font-bold outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50">
                جزئیات هزینه مواد اولیه پرفروش‌ها
              </summary>
              <div className="overflow-x-auto border-t border-border/70 p-3">
                <p className="mb-2 text-xs text-muted-foreground">
                  مقدار و هزینه برای تعداد فروش‌رفته در بازهٔ انتخابی و با میانگین بهای فعلی انبار محاسبه شده است.
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-right text-muted-foreground">
                      <Th>محصول</Th>
                      <Th>تعداد فروش</Th>
                      <Th>مواد اولیه و مقدار مصرف</Th>
                      <Th>هزینهٔ مواد اولیه</Th>
                      <Th>بهای تمام‌شده</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(menuPerf.data?.topSellingItems ?? []).map((item) => (
                      <tr key={item.menuItemId} className="border-t border-border/60 align-top hover:bg-muted/40">
                        <Td>
                          <span className="font-bold">{item.title}</span>
                        </Td>
                        <Td>{faNum(item.quantity)}</Td>
                        <Td>
                          {item.ingredients.length ? (
                            <ul className="space-y-1">
                              {item.ingredients.map((ingredient) => (
                                <li key={`${item.menuItemId}-${ingredient.name}`}>
                                  {ingredient.name}: {ingredient.quantity.toLocaleString("fa-IR")}{" "}
                                  {UNIT_LABELS[ingredient.unit] ?? ingredient.unit}
                                  <span className="text-muted-foreground"> · {formatToman(ingredient.cost.rials)}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-muted-foreground">دستور ساخت ثبت نشده</span>
                          )}
                        </Td>
                        <Td>{formatToman(item.ingredients.reduce((sum, ingredient) => sum + ingredient.cost.rials, 0))}</Td>
                        <Td>{formatToman(item.estimatedCogs.rials)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </ReportSection>
        </TabsContent>

        {/* ══════════ مشتری و پرسنل ══════════ */}
        <TabsContent value="people" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <ReportSection
              icon={Users}
              title="نرخ بازگشت مشتری‌ها"
              description="مشتری بازگشتی: خرید قبلی پیش از این بازه یا بیش از یک سفارش در بازه"
              loading={customerReturns.isLoading}
              error={customerReturns.isError}
              onRetry={() => customerReturns.refetch()}
              empty={!customerReturns.isLoading && totalCustomers === 0}
              emptyTitle="مشتری ثبت نشده"
              emptyDescription="در این بازه سفارش مشتری‌داری ثبت نشده است"
            >
              <div className="mb-2 flex justify-center">
                <Badge variant="success">{(customerReturns.data?.returningRatePercent ?? 0).toFixed(1)}٪ بازگشتی</Badge>
              </div>
              <div className="relative h-64 min-w-0">
                <ReportAmChart
                  mode="pie"
                  data={customerReturnData}
                  categoryField="name"
                  valueField="value"
                  label="نرخ بازگشت مشتریان"
                  donut
                  colors={CUSTOMER_RETURN_COLORS}
                  formatValue={(value) => `${faNum(value)} مشتری`}
                />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-10">
                  <span className="text-[11px] text-muted-foreground">مشتری یکتا</span>
                  <span className="text-lg font-black tabular-nums">{faNum(totalCustomers)}</span>
                </div>
              </div>
            </ReportSection>
            <ReportSection
              icon={Users}
              title="عملکرد پرسنل فروش"
              description="بر اساس سفارش‌های همین بازه"
              loading={staff.isLoading}
              error={staff.isError}
              onRetry={() => staff.refetch()}
              empty={!staff.isLoading && (staff.data ?? []).length === 0}
              emptyTitle="عملکردی ثبت نشده"
              emptyDescription="در این بازه فروشی به پرسنل منتسب نشده است"
              skeleton={<SkeletonTable rows={5} cols={4} />}
              actions={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadCsv(
                      "staff-performance.csv",
                      ["پرسنل", "تعداد سفارش", "فروش (تومان)", "میانگین فاکتور (تومان)"],
                      (staff.data ?? []).map((s) => [
                        s.staffName,
                        s.orderCount,
                        Math.round(s.netSales / 10),
                        Math.round(s.averageTicket / 10),
                      ]),
                    )
                  }
                >
                  <Download className="size-4" aria-hidden />
                  CSV
                </Button>
              }
            >
              <ReportTable>
                <thead>
                  <tr>
                    <Th>پرسنل</Th>
                    <Th>فروش و سهم</Th>
                    <Th>سفارش</Th>
                    <Th>میانگین فاکتور</Th>
                  </tr>
                </thead>
                <tbody>
                  {(staff.data ?? []).map((s) => (
                    <tr key={s.staffId} className="hover:bg-muted/40">
                      <Td>
                        <span className="font-bold">{s.staffName}</span>
                      </Td>
                      <Td>
                        <div className="font-bold">{formatToman(s.netSales)}</div>
                        <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-muted" aria-hidden>
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${maxStaffSales > 0 ? Math.round((s.netSales / maxStaffSales) * 100) : 0}%` }}
                          />
                        </div>
                      </Td>
                      <Td>{faNum(s.orderCount)}</Td>
                      <Td>{formatToman(s.averageTicket)}</Td>
                    </tr>
                  ))}
                </tbody>
              </ReportTable>
            </ReportSection>
          </div>

          <Card className="p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning">
                  <AlertTriangle className="size-[18px]" strokeWidth={1.9} aria-hidden />
                </span>
                <div>
                  <h2 className="font-black">هشدارهای موجودی</h2>
                  <p className="text-xs text-muted-foreground">اقلامی که به نقطه سفارش رسیده‌اند · مدیریت کامل در صفحه انبار</p>
                </div>
              </div>
              <Button size="sm" variant="outline" asChild className="print:hidden">
                <Link href="/admin/inventory">
                  مدیریت انبار
                  <ChevronLeft className="size-4" aria-hidden />
                </Link>
              </Button>
            </div>
            {alerts.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : alerts.isError ? (
              <QueryError onRetry={() => alerts.refetch()} />
            ) : criticalAlerts.length === 0 ? (
              <EmptyState compact icon={AlertTriangle} title="موجودی همه کالاها کافی است" description="هشدار کسری فعالی ندارید" />
            ) : (
              <ul className="divide-y divide-border/60">
                {criticalAlerts.map((item) => (
                  <li key={item.inventoryItemId} className="flex items-center gap-3 py-2.5">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
                      <AlertTriangle className="size-4" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{item.name}</div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        {item.sku} · موجودی {item.currentStock.toLocaleString("fa-IR")} · حد{" "}
                        {item.threshold.toLocaleString("fa-IR")}
                      </div>
                    </div>
                    <Badge variant="warning" className="shrink-0 tabular-nums">
                      کسری {item.deficit.toLocaleString("fa-IR")}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ── Building blocks ───────────────────────────────────────── */

/** Segmented pill group — faster than a dropdown for a handful of options. */
function PillGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex max-w-full flex-wrap gap-1 overflow-x-auto rounded-xl bg-muted p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
              active ? "bg-card font-bold text-foreground shadow-xs" : "font-semibold text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Hero KPI with icon, period delta and optional sparkline. */
function HeroKpi({
  icon: Icon,
  title,
  value,
  sub,
  delta,
  deltaCaption,
  spark,
  loading,
}: {
  icon: LucideIcon;
  title: string;
  value: string | null;
  sub?: string;
  delta?: number;
  deltaCaption?: string;
  spark?: number[];
  loading?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
            <Icon className="size-4" strokeWidth={1.9} aria-hidden />
            {title}
          </div>
          {loading || value === null ? (
            <Skeleton className="mt-2 h-8 w-28" />
          ) : (
            <div className="mt-1 truncate text-[1.65rem] font-black leading-9 tracking-tight tabular-nums">{value}</div>
          )}
        </div>
        {spark && spark.length > 1 ? (
          <Sparkline values={spark} className="h-9 w-24 shrink-0 text-primary" />
        ) : null}
      </div>
      <div className="mt-2 flex min-h-5 flex-wrap items-center gap-2">
        <DeltaPill delta={delta} caption={deltaCaption} />
        {sub ? <span className="text-xs text-muted-foreground">{sub}</span> : null}
      </div>
    </Card>
  );
}

function MiniKpi({ title, value, delta, tone }: { title: string; value: string; delta?: number; tone?: "warning" }) {
  return (
    <Card className="flex items-center justify-between gap-2 p-4">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-muted-foreground">{title}</div>
        <div className={cn("mt-0.5 truncate text-xl font-black tabular-nums", tone === "warning" && "text-warning")}>{value}</div>
      </div>
      <DeltaPill delta={delta} />
    </Card>
  );
}

function DeltaPill({ delta, caption }: { delta?: number; caption?: string }) {
  if (typeof delta !== "number" || Number.isNaN(delta)) return null;
  const up = delta >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      title={caption}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ring-1 ring-inset",
        up ? "bg-success/10 text-success ring-success/15" : "bg-danger/10 text-danger ring-danger/15",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {Math.abs(delta).toFixed(1)}٪
    </span>
  );
}

/** Tiny SVG sparkline — no chart lib needed. Values in display units. */
function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;
  const w = 120;
  const h = 36;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 3 - ((v - min) / span) * (h - 8)).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Insight({ icon: Icon, title, value, hint, tone }: { icon: LucideIcon; title: string; value: string; hint?: string; tone?: "warning" }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-muted/30 p-3">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl",
          tone === "warning" ? "bg-warning/10 text-warning" : "bg-primary-soft text-primary",
        )}
      >
        <Icon className="size-[18px]" strokeWidth={1.9} aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground">{title}</div>
        <div className="truncate text-sm font-black">{value}</div>
        {hint ? <div className="text-[11px] text-muted-foreground tabular-nums">{hint}</div> : null}
      </div>
    </div>
  );
}

/**
 * Uniform report section: icon header + loading skeleton + error retry +
 * empty state, so no chart/table ever renders blank silently.
 */
function ReportSection({
  icon: Icon,
  title,
  description,
  actions,
  loading,
  error,
  onRetry,
  empty,
  emptyTitle,
  emptyDescription,
  skeleton,
  chartHeight,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  skeleton?: React.ReactNode;
  chartHeight?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Icon className="size-[18px]" strokeWidth={1.9} aria-hidden />
          </span>
          <div>
            <h2 className="font-black">{title}</h2>
            {description ? <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div> : null}
      </div>
      {loading ? (
        skeleton ?? (
          <div className={cn("min-w-0", chartHeight ?? "h-72")}>
            <Skeleton className="h-full w-full" />
          </div>
        )
      ) : error ? (
        <QueryError onRetry={onRetry} />
      ) : empty ? (
        <EmptyState compact icon={Icon} title={emptyTitle ?? "داده‌ای نیست"} description={emptyDescription ?? "در این بازه داده‌ای ثبت نشده است"} />
      ) : (
        <div className={cn("min-w-0", chartHeight)}>{children}</div>
      )}
    </Card>
  );
}

function QueryError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-danger/25 bg-danger/5 p-6 text-center">
      <p className="text-sm font-bold text-danger">بارگذاری این بخش ناموفق بود</p>
      <p className="text-xs text-muted-foreground">اتصال را بررسی کنید و دوباره تلاش کنید</p>
      {onRetry ? (
        <Button size="sm" variant="outline" onClick={onRetry} className="mt-1">
          <RefreshCw className="size-4" aria-hidden />
          تلاش مجدد
        </Button>
      ) : null}
    </div>
  );
}

/** Scrollable table shell with consistent density. */
function ReportTable({ children, maxHeight }: { children: React.ReactNode; maxHeight?: string }) {
  return (
    <div className={cn("overflow-auto rounded-xl border border-border/70", maxHeight)}>
      <table className="w-full min-w-[38rem] text-sm">{children}</table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="whitespace-nowrap p-2.5 text-right text-xs font-semibold text-muted-foreground">
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("border-t border-border/60 p-2.5 align-middle tabular-nums", className)}>{children}</td>;
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-8 w-44 ps-8 text-xs" />
    </div>
  );
}

function MetricToggle({ value, onChange }: { value: SalesMetric; onChange: (value: SalesMetric) => void }) {
  return (
    <div className="inline-flex rounded-lg border p-0.5 text-xs" role="group" aria-label="نوع نمایش فروش">
      <button
        type="button"
        aria-pressed={value === "amount"}
        onClick={() => onChange("amount")}
        className={cn("rounded-md px-2 py-1", value === "amount" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
      >
        مبلغی
      </button>
      <button
        type="button"
        aria-pressed={value === "count"}
        onClick={() => onChange("count")}
        className={cn("rounded-md px-2 py-1", value === "count" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
      >
        تعدادی
      </button>
    </div>
  );
}
