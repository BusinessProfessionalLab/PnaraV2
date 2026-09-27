"use client";

import { useQuery } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { formatToman, rialToToman } from "@/lib/currency";
import { daysAgoUtc } from "@/lib/jalali";
import type { TimePeriodPreset, TimelineInterval } from "@/lib/types";

const COLORS = ["#C41E3A", "#1F2937", "#D97706", "#059669", "#2563EB", "#7C3AED"];
const UNIT_LABELS: Record<string, string> = {
  Gram: "گرم",
  Milliliter: "میلی‌لیتر",
  Piece: "عدد",
  Portion: "پرس",
  Can: "قوطی",
  Kilogram: "کیلوگرم",
  Liter: "لیتر",
};

const PRESET_LABELS: Record<TimePeriodPreset, string> = {
  Today: "امروز",
  Yesterday: "دیروز",
  ThisMonth: "این ماه",
  LastMonth: "ماه قبل",
  CustomRange: "بازه دلخواه",
};

const INTERVAL_LABELS: Record<TimelineInterval, string> = {
  Hourly: "ساعتی",
  Daily: "روزانه",
  Weekly: "هفتگی",
};

type SalesMetric = "amount" | "count";

type DrilldownDay = { fromUtc: string; toUtc: string; label: string };

export function ReportsHub() {
  const [from, setFrom] = useState(daysAgoUtc(14));
  const [to, setTo] = useState(new Date().toISOString());
  const [preset, setPreset] = useState<TimePeriodPreset>("ThisMonth");
  const [interval, setInterval] = useState<TimelineInterval>("Daily");
  const [drilldownDay, setDrilldownDay] = useState<DrilldownDay | null>(null);
  const [visiblePaymentMethods, setVisiblePaymentMethods] = useState<string[] | null>(null);
  const [categoryMetric, setCategoryMetric] = useState<SalesMetric>("amount");
  const [productMetric, setProductMetric] = useState<SalesMetric>("amount");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const customFrom = preset === "CustomRange" ? from : undefined;
  const customTo = preset === "CustomRange" ? to : undefined;

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
  });
  const heatmap = useQuery({
    queryKey: ["rep-heatmap", preset, customFrom, customTo],
    queryFn: () => api.peakHoursHeatmap(preset, customFrom, customTo),
  });
  const payments = useQuery({
    queryKey: ["rep-pay", preset, customFrom, customTo],
    queryFn: () => api.paymentBreakdown(preset, customFrom, customTo),
  });
  const terminals = useQuery({
    queryKey: ["rep-term", preset, customFrom, customTo],
    queryFn: () => api.terminalReports(preset, customFrom, customTo),
  });
  const menuPerf = useQuery({
    queryKey: ["rep-menu-perf", preset, customFrom, customTo],
    queryFn: () => api.menuItemsPerformance(preset, 10, customFrom, customTo),
  });
  const catDetail = useQuery({
    queryKey: ["rep-cat-detail", preset, customFrom, customTo],
    queryFn: () => api.categorySalesDetail(preset, customFrom, customTo),
  });
  const zReport = useQuery({
    queryKey: ["rep-z", preset, customFrom, customTo],
    queryFn: () => api.shiftZReport(preset, undefined, customFrom, customTo),
  });
  const profit = useQuery({
    queryKey: ["rep-profit", preset, customFrom, customTo],
    queryFn: () => api.profitMargin(preset, customFrom, customTo),
  });
  const customerReturns = useQuery({
    queryKey: ["rep-customer-returns", preset, customFrom, customTo],
    queryFn: () => api.customerReturnRate(preset, customFrom, customTo),
  });
  const inventory = useQuery({ queryKey: ["rep-inventory"], queryFn: api.inventory });
  const staff = useQuery({
    queryKey: ["rep-s", summary.data?.fromUtc, summary.data?.toUtc],
    queryFn: () => api.reportStaff(summary.data!.fromUtc, summary.data!.toUtc),
    enabled: Boolean(summary.data?.fromUtc && summary.data?.toUtc),
  });

  const heatmapGrid = useMemo(() => {
    const cells = new Map<string, { orderCount: number; netSales: number; density: number; dayFa: string }>();
    let maxDensity = 1;
    for (const row of heatmap.data ?? []) {
      const key = `${row.dayOfWeek}-${row.hour}`;
      cells.set(key, {
        orderCount: row.orderCount,
        netSales: row.netSales.rials,
        density: row.densityScore,
        dayFa: row.dayOfWeekFa,
      });
      maxDensity = Math.max(maxDensity, row.densityScore);
    }
    const days = Array.from({ length: 7 }, (_, d) => {
      const sample = (heatmap.data ?? []).find((r) => r.dayOfWeek === d);
      return { day: d, label: sample?.dayOfWeekFa ?? `روز ${d}` };
    });
    return { cells, maxDensity, days };
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

  const paymentMix = useMemo(
    () =>
      (payments.data?.methods ?? []).map((m) => ({
        method: m.method,
        name: m.methodLabelFa,
        amount: m.amount.rials,
        count: m.paymentCount,
        share: m.percentageShare,
      })),
    [payments.data],
  );

  const visiblePaymentMix = useMemo(() => {
    if (visiblePaymentMethods === null) return paymentMix;
    return paymentMix.filter((m) => visiblePaymentMethods.includes(m.method));
  }, [paymentMix, visiblePaymentMethods]);

  const selectedCategory = (catDetail.data ?? []).find((category) => category.categoryId === selectedCategoryId) ?? null;
  const categoryChartData = useMemo(() => {
    const rows = selectedCategory
      ? selectedCategory.items.map((item) => ({
          id: item.menuItemId,
          categoryId: undefined,
          name: item.title,
          quantity: item.quantity,
          amount: item.revenue.rials,
        }))
      : (catDetail.data ?? []).map((category) => ({
          id: category.categoryId,
          categoryId: category.categoryId,
          name: category.categoryName,
          quantity: category.quantity,
          amount: category.revenue.rials,
        }));
    return rows
      .sort((a, b) => categoryMetric === "amount" ? b.amount - a.amount : b.quantity - a.quantity)
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
      }));
  }, [menuPerf.data, productMetric]);

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

  const stockChartData = useMemo(
    () =>
      [...(inventory.data ?? [])]
        .sort((a, b) => b.currentStock - a.currentStock)
        .slice(0, 18)
        .map((item) => ({ name: item.name, stock: item.currentStock, unit: item.baseUnit })),
    [inventory.data],
  );

  const customerReturnData = [
    { name: "مشتری بازگشتی", value: customerReturns.data?.returningCustomerCount ?? 0 },
    { name: "خرید اول", value: customerReturns.data?.firstTimeCustomerCount ?? 0 },
  ];

  const cmp = summary.data?.comparisonWithPreviousPeriod;
  const totalPayments = payments.data?.totalSettled.rials ?? summary.data?.netSales.rials ?? 0;
  const totalVat = summary.data?.totalVat.rials ?? 0;
  const grossSales = totalPayments - totalVat;

  function handleTimelineChartClick(state: unknown) {
    if (drilldownDay || interval !== "Daily") return;
    const point = (state as {
      activePayload?: { payload?: { bucketStartUtc?: string; label?: string } }[];
    } | null)?.activePayload?.[0]?.payload;
    if (!point?.bucketStartUtc) return;
    const start = new Date(point.bucketStartUtc);
    if (Number.isNaN(start.getTime())) return;
    setDrilldownDay({
      fromUtc: start.toISOString(),
      toUtc: new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString(),
      label: point.label || "روز انتخاب‌شده",
    });
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[160px]">
            <Label>بازه تحلیلی</Label>
            <Select
              value={preset}
              onValueChange={(v) => {
                setPreset(v as TimePeriodPreset);
                setDrilldownDay(null);
                setSelectedCategoryId(null);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRESET_LABELS) as TimePeriodPreset[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRESET_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[140px]">
            <Label>بازه زمانی نمودار</Label>
            <Select
              value={drilldownDay ? "Hourly" : interval}
              onValueChange={(v) => {
                setInterval(v as TimelineInterval);
                setDrilldownDay(null);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(INTERVAL_LABELS) as TimelineInterval[]).map((i) => (
                  <SelectItem key={i} value={i}>
                    {INTERVAL_LABELS[i]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {preset === "CustomRange" ? (
            <>
              <div>
                <Label>از</Label>
                <Input
                  type="datetime-local"
                  value={toDateTimeLocalInput(from)}
                  onChange={(e) => e.target.value && setFrom(new Date(e.target.value).toISOString())}
                />
              </div>
              <div>
                <Label>تا</Label>
                <Input
                  type="datetime-local"
                  value={toDateTimeLocalInput(to)}
                  onChange={(e) => e.target.value && setTo(new Date(e.target.value).toISOString())}
                />
              </div>
            </>
          ) : null}
          {summary.data ? <Badge variant="outline">{summary.data.periodLabelFa}</Badge> : null}
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi title="فروش خالص · مجموع پرداختی‌ها" value={formatToman(totalPayments)} delta={cmp?.netSalesChangePercent} />
        <Kpi title="فروش ناخالص · پرداختی منهای ارزش افزوده" value={formatToman(grossSales)} delta={cmp?.grossSalesChangePercent} />
        <Kpi title="تعداد سفارش" value={String(summary.data?.totalOrders ?? 0)} delta={cmp?.ordersChangePercent} />
        <Kpi title="پرداخت‌شده‌ها" value={String(summary.data?.paidOrdersCount ?? 0)} />
        <Kpi title="در انتظار پرداخت" value={String(summary.data?.pendingOrdersCount ?? 0)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi title="تخفیف‌ها" value={formatToman(summary.data?.totalDiscounts.rials ?? 0)} />
        <Kpi title="ارزش افزوده" value={formatToman(summary.data?.totalVat.rials ?? 0)} />
        <Kpi title="لغوشده‌ها" value={String(summary.data?.cancelledOrdersCount ?? 0)} />
        <Kpi title="میانگین فاکتور" value={formatToman(summary.data?.averageTicketSize.rials ?? 0)} />
      </div>

      <Card className="p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-black">
            روند فروش ({drilldownDay ? `ساعتی · ${drilldownDay.label}` : INTERVAL_LABELS[interval]})
          </h2>
          {drilldownDay ? (
            <button type="button" className="text-sm font-semibold text-primary" onClick={() => setDrilldownDay(null)}>
              بازگشت به روزها
            </button>
          ) : interval === "Daily" ? (
            <span className="text-xs text-muted-foreground">برای دیدن روند ساعتی روی یک روز کلیک کنید</span>
          ) : null}
        </div>
        <div className="h-80 min-w-0">
          <ResponsiveContainer>
            <LineChart data={timelinePoints} onClick={handleTimelineChartClick}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => String(rialToToman(Number(v)))} width={56} />
              <Tooltip formatter={(v) => [formatToman(Number(v)), "مجموع پرداختی‌ها"]} />
              <Legend />
              <Line
                type="monotone"
                dataKey="netSales"
                name="مجموع پرداختی‌ها"
                stroke="#C41E3A"
                strokeWidth={2}
                dot={interval === "Daily" && !drilldownDay ? { r: 3, cursor: "pointer" } : false}
                activeDot={{ r: 6, cursor: "pointer" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="mb-1 font-black">نقشهٔ حرارتی مبلغ فروش بر اساس روز و ساعت (۷×۲۴)</h2>
        <p className="mb-3 text-xs text-muted-foreground">هر خانه مبلغ پرداخت‌شده در همان ساعت و روز هفته را نشان می‌دهد؛ رنگ پررنگ‌تر یعنی فروش بیشتر.</p>
        <div className="overflow-x-auto">
          <div className="inline-grid min-w-full gap-0.5" style={{ gridTemplateColumns: `72px repeat(24, minmax(18px, 1fr))` }}>
            <div />
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="text-center text-[9px] text-muted-foreground">
                {h}
              </div>
            ))}
            {heatmapGrid.days.map(({ day, label }) => (
              <Fragment key={day}>
                <div className="flex items-center pe-1 text-xs font-bold">{label}</div>
                {Array.from({ length: 24 }, (_, hour) => {
                  const cell = heatmapGrid.cells.get(`${day}-${hour}`);
                  const density = cell?.density ?? 0;
                  const alpha = 0.08 + (density / heatmapGrid.maxDensity) * 0.92;
                  return (
                    <div
                      key={`${day}-${hour}`}
                      className="aspect-square rounded-sm"
                      style={{ background: `rgba(196,30,58,${alpha})` }}
                      title={`${label} ${hour}:00 — ${cell?.orderCount ?? 0} سفارش · ${formatToman(cell?.netSales ?? 0)}`}
                    />
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-2 font-black">ترکیب روش‌های پرداخت</h2>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {paymentMix.map((method, i) => {
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
                  className={`rounded-full border px-2.5 py-1 text-xs ${active ? "border-primary bg-primary/10" : "opacity-50"}`}
                >
                  <span className="me-1 inline-block size-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  {method.name}
                </button>
              );
            })}
          </div>
          {visiblePaymentMix.length ? (
            <div className="h-56 min-w-0">
              <ResponsiveContainer>
                <BarChart data={visiblePaymentMix} layout="vertical" margin={{ left: 4, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => String(rialToToman(Number(v)))} />
                  <YAxis type="category" dataKey="name" width={105} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [formatToman(Number(v)), "مبلغ پرداخت"]} />
                  <Bar dataKey="amount" name="مبلغ پرداخت" radius={[0, 5, 5, 0]}>
                    {visiblePaymentMix.map((method) => {
                      const colorIndex = paymentMix.findIndex((item) => item.method === method.method);
                      return <Cell key={method.method} fill={COLORS[colorIndex % COLORS.length]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">یک روش پرداخت را نمایش دهید</div>
          )}
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 font-black">گزارش کارتخوان‌ها</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-muted-foreground">
                <th className="p-2">ترمینال</th>
                <th>PSP</th>
                <th>تعداد</th>
                <th>مبلغ</th>
                <th>میانگین</th>
              </tr>
            </thead>
            <tbody>
              {(terminals.data ?? []).map((t, i) => (
                <tr key={`${t.terminalId ?? t.psp}-${i}`} className="border-t">
                  <td className="p-2 font-bold">{t.terminalId ?? "—"}</td>
                  <td>{t.pspLabel}</td>
                  <td>{t.transactionCount}</td>
                  <td>{formatToman(t.amount.rials)}</td>
                  <td>{formatToman(t.averageTicket.rials)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-black">نرخ بازگشت مشتری‌ها</h2>
            <Badge variant="success">{(customerReturns.data?.returningRatePercent ?? 0).toFixed(1)}٪ بازگشتی</Badge>
          </div>
          <p className="text-xs text-muted-foreground">مشتری بازگشتی: خرید قبلی پیش از این بازه یا بیش از یک سفارش در بازه</p>
          <div className="h-64 min-w-0">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={customerReturnData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={90} label>
                  {customerReturnData.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? "#059669" : "#94A3B8"} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [Number(v), "تعداد مشتری"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-black">روند پرفروش تا کم‌فروش</h2>
            <MetricToggle value={productMetric} onChange={setProductMetric} />
          </div>
          <div className="h-80 min-w-0">
            <ResponsiveContainer>
              <BarChart data={productChartData} layout="vertical" margin={{ left: 4, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(v) => productMetric === "amount" ? String(rialToToman(Number(v))) : String(v)}
                />
                <YAxis type="category" dataKey="title" width={125} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v) => productMetric === "amount"
                    ? [formatToman(Number(v)), "فروش"]
                    : [Number(v), "تعداد فروش"]}
                />
                <Bar dataKey="value" name={productMetric === "amount" ? "فروش" : "تعداد فروش"}>
                  {productChartData.map((item) => (
                    <Cell
                      key={item.menuItemId}
                      fill={item.band === "Star" ? "#059669" : item.band === "Underperforming" ? "#C41E3A" : "#D97706"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 font-black">پرفروش‌ترین محصولات کافه</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-muted-foreground">
                  <th className="p-2">#</th>
                  <th>محصول</th>
                  <th>تعداد</th>
                  <th>فروش</th>
                  <th>حاشیه سود</th>
                </tr>
              </thead>
              <tbody>
                {(menuPerf.data?.topSellingItems ?? []).map((item) => (
                  <tr key={item.menuItemId} className="border-t">
                    <td className="p-2">{item.rank}</td>
                    <td>
                      {item.title}
                      <div className="text-xs text-muted-foreground">{item.categoryName}</div>
                    </td>
                    <td>{item.quantity}</td>
                    <td>{formatToman(item.revenue.rials)}</td>
                    <td><Badge variant={item.band === "Star" ? "success" : "outline"}>{item.grossMarginPercent.toFixed(1)}٪</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 font-black">کم‌فروش‌ترین محصولات</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-muted-foreground">
                  <th className="p-2">#</th>
                  <th>محصول</th>
                  <th>تعداد</th>
                  <th>فروش</th>
                </tr>
              </thead>
              <tbody>
                {(menuPerf.data?.lowestSellingItems ?? []).map((item) => (
                  <tr key={item.menuItemId} className="border-t">
                    <td className="p-2">{item.rank}</td>
                    <td>{item.title}</td>
                    <td>{item.quantity}</td>
                    <td>{formatToman(item.revenue.rials)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-black">
              {selectedCategory ? `محصولات دستهٔ ${selectedCategory.categoryName}` : "فروش دسته‌بندی‌ها"}
            </h2>
            <div className="flex items-center gap-2">
              {selectedCategory ? (
                <button type="button" className="text-xs font-semibold text-primary" onClick={() => setSelectedCategoryId(null)}>
                  همهٔ دسته‌ها
                </button>
              ) : null}
              <MetricToggle value={categoryMetric} onChange={setCategoryMetric} />
            </div>
          </div>
          {!selectedCategory ? <p className="mb-1 text-xs text-muted-foreground">برای دیدن محصولات روی یک دسته کلیک کنید</p> : null}
          <div className="h-80 min-w-0">
            <ResponsiveContainer>
              <BarChart
                data={categoryChartData}
                layout="vertical"
                margin={{ left: 4, right: 12 }}
                onClick={(state) => {
                  if (selectedCategoryId) return;
                  const payload = (state as { activePayload?: { payload?: { categoryId?: string } }[] } | null)
                    ?.activePayload?.[0]?.payload;
                  if (payload?.categoryId) setSelectedCategoryId(payload.categoryId);
                }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(v) => categoryMetric === "amount" ? String(rialToToman(Number(v))) : String(v)}
                />
                <YAxis type="category" dataKey="name" width={125} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v) => categoryMetric === "amount"
                    ? [formatToman(Number(v)), "فروش"]
                    : [Number(v), "تعداد فروش"]}
                />
                <Bar dataKey="value" name={categoryMetric === "amount" ? "فروش" : "تعداد فروش"} fill="#2563EB" cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <h2 className="mb-2 font-black">سهم فروش هر دسته</h2>
          <div className="h-80 min-w-0">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={(catDetail.data ?? []).map((category) => ({ name: category.categoryName, value: category.revenue.rials }))}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={105}
                  label
                >
                  {(catDetail.data ?? []).map((category, i) => (
                    <Cell key={category.categoryId} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatToman(Number(v))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="mb-3 font-black">گزارش تفصیلی دسته‌ها و محصولات</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-muted-foreground">
                <th className="p-2">دسته</th>
                <th>تعداد</th>
                <th>فروش</th>
                <th>سهم فروش</th>
                <th>محصولات پرفروش دسته</th>
              </tr>
            </thead>
            <tbody>
              {(catDetail.data ?? []).map((category) => (
                <tr key={category.categoryId} className="border-t">
                  <td className="p-2 font-bold">
                    <button type="button" className="text-right" onClick={() => setSelectedCategoryId(category.categoryId)}>
                      {category.categoryName}
                    </button>
                  </td>
                  <td>{category.quantity}</td>
                  <td>{formatToman(category.revenue.rials)}</td>
                  <td>{category.sharePercent.toFixed(1)}٪</td>
                  <td>{category.items.slice(0, 3).map((item) => `${item.title} (${item.quantity})`).join("، ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-black">مواد اولیه و هزینهٔ محصولات پرفروش</h2>
        <p className="mb-3 text-xs text-muted-foreground">مقدار و هزینه برای تعداد فروش‌رفته در بازهٔ انتخابی و با میانگین بهای فعلی انبار محاسبه شده است؛ مواد افزودنی انتخابی مشتری نیز لحاظ می‌شوند.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-muted-foreground">
                <th className="p-2">محصول</th>
                <th>تعداد فروش</th>
                <th>مواد اولیه و مقدار مصرف</th>
                <th>هزینهٔ مواد اولیه</th>
                <th>بهای تمام‌شده</th>
              </tr>
            </thead>
            <tbody>
              {(menuPerf.data?.topSellingItems ?? []).map((item) => (
                <tr key={item.menuItemId} className="border-t align-top">
                  <td className="p-2 font-bold">{item.title}</td>
                  <td>{item.quantity}</td>
                  <td>
                    {item.ingredients.length ? (
                      <ul className="space-y-1">
                        {item.ingredients.map((ingredient) => (
                          <li key={`${item.menuItemId}-${ingredient.name}`}>
                            {ingredient.name}: {ingredient.quantity.toLocaleString("fa-IR")} {UNIT_LABELS[ingredient.unit] ?? ingredient.unit}
                            <span className="text-muted-foreground"> · {formatToman(ingredient.cost.rials)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : <span className="text-muted-foreground">دستور ساخت ثبت نشده</span>}
                  </td>
                  <td>{formatToman(item.ingredients.reduce((sum, ingredient) => sum + ingredient.cost.rials, 0))}</td>
                  <td>{formatToman(item.estimatedCogs.rials)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-black">گزارش Z شیفت‌ها</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-right text-muted-foreground">
              <th className="p-2">صندوق‌دار</th>
              <th>وضعیت</th>
              <th>افتتاح</th>
              <th>فروش خالص</th>
              <th>سفارش پرداختی</th>
              <th>اختلاف صندوق</th>
            </tr>
          </thead>
          <tbody>
            {(zReport.data ?? []).map((s) => (
              <tr key={s.shiftId} className="border-t">
                <td className="p-2 font-bold">{s.cashierName}</td>
                <td>
                  <Badge variant={s.status === "Open" ? "success" : "outline"}>{s.status === "Open" ? "باز" : "بسته"}</Badge>
                </td>
                <td>{formatToman(s.openingCash.rials)}</td>
                <td>{formatToman(s.netSales.rials)}</td>
                <td>{s.paidOrderCount}</td>
                <td>{s.cashVariance ? formatToman(s.cashVariance.rials) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-4">
        <h2 className="mb-2 font-black">حاشیه سود {profit.data ? `· ${profit.data.periodLabelFa}` : ""}</h2>
        {profit.data ? (
          <div className="mb-3 flex flex-wrap gap-3 text-sm">
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
            <ResponsiveContainer>
              <BarChart data={categoryProfit} layout="vertical" margin={{ left: 4, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `${Number(v).toFixed(0)}٪`} />
                <YAxis type="category" dataKey="categoryName" width={120} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => [`${Number(v).toFixed(1)}٪`, "حاشیه سود"]} />
                <Bar dataKey="margin" name="حاشیه سود" fill="#059669" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-muted-foreground">
                  <th className="p-2">دسته</th>
                  <th>فروش</th>
                  <th>هزینه</th>
                  <th>سود</th>
                  <th>حاشیه سود</th>
                </tr>
              </thead>
              <tbody>
                {categoryProfit.map((category) => (
                  <tr key={category.categoryId} className="border-t">
                    <td className="p-2 font-bold">{category.categoryName}</td>
                    <td>{formatToman(category.revenue)}</td>
                    <td>{formatToman(category.cogs)}</td>
                    <td>{formatToman(category.profit)}</td>
                    <td>{category.margin.toFixed(1)}٪</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <h3 className="mb-2 font-bold">حاشیه سود محصولات</h3>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-right text-muted-foreground">
              <th className="p-2">آیتم</th>
              <th>دسته</th>
              <th>تعداد</th>
              <th>درآمد</th>
              <th>COGS</th>
              <th>سود</th>
              <th>حاشیه</th>
            </tr>
          </thead>
          <tbody>
            {(profit.data?.lines ?? []).map((line) => (
              <tr key={line.menuItemId} className="border-t">
                <td className="p-2 font-bold">{line.title}</td>
                <td>{line.categoryName}</td>
                <td>{line.quantitySold}</td>
                <td>{formatToman(line.revenue.rials)}</td>
                <td>{formatToman(line.cogs.rials)}</td>
                <td>{formatToman(line.grossProfit.rials)}</td>
                <td>{line.grossMarginPercent.toFixed(1)}٪</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="mb-1 font-black">حجم موجودی مواد اولیهٔ انبار</h2>
        <p className="mb-3 text-xs text-muted-foreground">نمودار ۱۸ قلم با بیشترین موجودی را نشان می‌دهد؛ هر قلم با واحد پایهٔ خودش نمایش داده می‌شود.</p>
        <div className="h-[30rem] min-w-0">
          <ResponsiveContainer>
            <BarChart data={stockChartData} layout="vertical" margin={{ left: 4, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={145} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v, _name, item) => [`${Number(v).toLocaleString("fa-IR")} ${UNIT_LABELS[item.payload?.unit] ?? item.payload?.unit ?? ""}`, "موجودی"]} />
              <Bar dataKey="stock" name="موجودی" fill="#2563EB" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <h3 className="mb-2 mt-5 font-bold">فهرست موجودی مواد اولیه</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-muted-foreground">
                <th className="p-2">مادهٔ اولیه</th>
                <th>موجودی فعلی</th>
                <th>حد هشدار</th>
                <th>ارزش موجودی</th>
                <th>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {(inventory.data ?? []).map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-2 font-bold">{item.name}<div className="text-xs text-muted-foreground">{item.sku}</div></td>
                  <td>{item.currentStock.toLocaleString("fa-IR")} {UNIT_LABELS[item.baseUnit] ?? item.baseUnit}</td>
                  <td>{item.minimumAlertStock.toLocaleString("fa-IR")} {UNIT_LABELS[item.baseUnit] ?? item.baseUnit}</td>
                  <td>{formatToman(item.valuationRials)}</td>
                  <td>
                    <Badge variant={item.currentStock <= 0 ? "danger" : item.isLowStock ? "warning" : "success"}>
                      {item.currentStock <= 0 ? "ناموجود" : item.isLowStock ? "کم‌موجود" : "موجود"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="p-4">
        <h2 className="mb-3 font-black">ممیزی عملکرد صندوق‌دار</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-right text-muted-foreground">
              <th className="p-2">پرسنل</th>
              <th>تعداد سفارش</th>
              <th>فروش</th>
              <th>میانگین فاکتور</th>
            </tr>
          </thead>
          <tbody>
            {(staff.data ?? []).map((s) => (
              <tr key={s.staffId} className="border-t">
                <td className="p-2 font-bold">{s.staffName}</td>
                <td>{s.orderCount}</td>
                <td>{formatToman(s.netSales)}</td>
                <td>{formatToman(s.averageTicket)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Kpi({ title, value, delta }: { title: string; value: string; delta?: number }) {
  return (
    <Card className="p-4">
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="text-2xl font-black">{value}</div>
      {typeof delta === "number" ? (
        <div className={`mt-1 text-xs font-bold ${delta >= 0 ? "text-emerald-700" : "text-red-700"}`}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}٪ نسبت به دوره قبل
        </div>
      ) : null}
    </Card>
  );
}

function MetricToggle({ value, onChange }: { value: SalesMetric; onChange: (value: SalesMetric) => void }) {
  return (
    <div className="inline-flex rounded-lg border p-0.5 text-xs" role="group" aria-label="نوع نمایش فروش">
      <button
        type="button"
        aria-pressed={value === "amount"}
        onClick={() => onChange("amount")}
        className={`rounded-md px-2 py-1 ${value === "amount" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
      >
        مبلغی
      </button>
      <button
        type="button"
        aria-pressed={value === "count"}
        onClick={() => onChange("count")}
        className={`rounded-md px-2 py-1 ${value === "count" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
      >
        تعدادی
      </button>
    </div>
  );
}

function toDateTimeLocalInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
