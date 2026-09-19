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

export function ReportsHub() {
  const [from, setFrom] = useState(daysAgoUtc(14));
  const [to, setTo] = useState(new Date().toISOString());
  const [preset, setPreset] = useState<TimePeriodPreset>("Today");
  const [interval, setInterval] = useState<TimelineInterval>("Daily");

  const customFrom = preset === "CustomRange" ? from : undefined;
  const customTo = preset === "CustomRange" ? to : undefined;

  const products = useQuery({ queryKey: ["rep-p", from, to], queryFn: () => api.reportProducts(from, to) });
  const cats = useQuery({ queryKey: ["rep-c", from, to], queryFn: () => api.reportCategories(from, to) });
  const hourly = useQuery({ queryKey: ["rep-h", from, to], queryFn: () => api.reportHourly(from, to) });
  const perf = useQuery({ queryKey: ["rep-perf", from, to], queryFn: () => api.reportPerformance(from, to) });
  const staff = useQuery({ queryKey: ["rep-s", from, to], queryFn: () => api.reportStaff(from, to) });

  const summary = useQuery({
    queryKey: ["rep-summary", preset, customFrom, customTo],
    queryFn: () => api.dashboardSummary(preset, customFrom, customTo),
  });
  const timeline = useQuery({
    queryKey: ["rep-timeline", preset, interval, customFrom, customTo],
    queryFn: () => api.salesTimeline(preset, interval, customFrom, customTo),
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

  const heat = useMemo(() => {
    const map = new Map((hourly.data ?? []).map((h) => [h.hour, h]));
    return Array.from({ length: 24 }, (_, hour) => {
      const row = map.get(hour);
      return { hour, orderCount: row?.orderCount ?? 0, toman: rialToToman(row?.netSales ?? 0) };
    });
  }, [hourly.data]);
  const max = Math.max(1, ...heat.map((h) => h.toman));

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
      maxDensity = Math.max(maxDensity, row.densityScore || row.orderCount);
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
        label: p.labelFa || p.label,
        netSales: p.netSales.rials,
        orderCount: p.orderCount,
      })),
    [timeline.data],
  );

  const paymentPie = useMemo(
    () =>
      (payments.data?.methods ?? []).map((m) => ({
        name: m.methodLabelFa,
        value: m.amount.rials,
        count: m.paymentCount,
        share: m.percentageShare,
      })),
    [payments.data],
  );

  const cmp = summary.data?.comparisonWithPreviousPeriod;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[160px]">
            <Label>بازه تحلیلی</Label>
            <Select value={preset} onValueChange={(v) => setPreset(v as TimePeriodPreset)}>
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
            <Select value={interval} onValueChange={(v) => setInterval(v as TimelineInterval)}>
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
                  onChange={(e) => e.target.value && setFrom(new Date(e.target.value).toISOString())}
                />
              </div>
              <div>
                <Label>تا</Label>
                <Input
                  type="datetime-local"
                  onChange={(e) => e.target.value && setTo(new Date(e.target.value).toISOString())}
                />
              </div>
            </>
          ) : null}
          {summary.data ? <Badge variant="outline">{summary.data.periodLabelFa}</Badge> : null}
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="فروش ناخالص" value={formatToman(summary.data?.grossSales.rials ?? 0)} delta={cmp?.grossSalesChangePercent} />
        <Kpi title="فروش خالص" value={formatToman(summary.data?.netSales.rials ?? 0)} delta={cmp?.netSalesChangePercent} />
        <Kpi title="تعداد سفارش" value={String(summary.data?.totalOrders ?? 0)} delta={cmp?.ordersChangePercent} />
        <Kpi
          title="میانگین فاکتور"
          value={formatToman(summary.data?.averageTicketSize.rials ?? 0)}
          delta={cmp?.averageTicketChangePercent}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi title="تخفیف‌ها" value={formatToman(summary.data?.totalDiscounts.rials ?? 0)} />
        <Kpi title="ارزش افزوده" value={formatToman(summary.data?.totalVat.rials ?? 0)} />
        <Kpi
          title="پرداخت‌شده / در انتظار / لغو"
          value={`${summary.data?.paidOrdersCount ?? 0} / ${summary.data?.pendingOrdersCount ?? 0} / ${summary.data?.cancelledOrdersCount ?? 0}`}
        />
      </div>

      <Card className="h-96 p-4">
        <h2 className="mb-2 font-black">روند فروش ({INTERVAL_LABELS[interval]})</h2>
        <ResponsiveContainer>
          <LineChart data={timelinePoints}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => String(rialToToman(Number(v)))} width={56} />
            <Tooltip
              formatter={(v, name) =>
                name === "orderCount" ? [Number(v), "تعداد سفارش"] : [formatToman(Number(v)), "فروش خالص"]
              }
            />
            <Legend />
            <Line type="monotone" dataKey="netSales" name="فروش خالص" stroke="#C41E3A" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="orderCount" name="تعداد سفارش" stroke="#2563EB" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-black">نقشه حرارتی پیک فروش (۷×۲۴)</h2>
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
        <Card className="h-80 p-4">
          <h2 className="mb-2 font-black">ترکیب روش‌های پرداخت</h2>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={paymentPie} dataKey="value" nameKey="name" outerRadius={90} label>
                {paymentPie.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatToman(Number(v))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
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
          <h2 className="mb-3 font-black">پرفروش‌ترین آیتم‌ها</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-muted-foreground">
                <th className="p-2">#</th>
                <th>آیتم</th>
                <th>تعداد</th>
                <th>درآمد</th>
                <th>حاشیه</th>
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
                  <td>
                    <Badge variant={item.band === "Star" ? "success" : "outline"}>{item.grossMarginPercent.toFixed(1)}٪</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 font-black">کم‌فروش‌ترین آیتم‌ها</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-muted-foreground">
                <th className="p-2">#</th>
                <th>آیتم</th>
                <th>تعداد</th>
                <th>درآمد</th>
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
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="mb-3 font-black">فروش تفصیلی دسته‌ها</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-right text-muted-foreground">
              <th className="p-2">دسته</th>
              <th>تعداد</th>
              <th>درآمد</th>
              <th>سهم</th>
            </tr>
          </thead>
          <tbody>
            {(catDetail.data ?? []).map((c) => (
              <tr key={c.categoryId} className="border-t">
                <td className="p-2 font-bold">{c.categoryName}</td>
                <td>{c.quantity}</td>
                <td>{formatToman(c.revenue.rials)}</td>
                <td>{c.sharePercent.toFixed(1)}٪</td>
              </tr>
            ))}
          </tbody>
        </table>
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
      </Card>

      <div className="flex gap-2">
        <Input type="datetime-local" onChange={(e) => e.target.value && setFrom(new Date(e.target.value).toISOString())} />
        <Input type="datetime-local" onChange={(e) => e.target.value && setTo(new Date(e.target.value).toISOString())} />
        <Badge variant="outline">بازه نمودارهای قدیمی</Badge>
      </div>
      <Card className="p-4">
        <h2 className="mb-3 font-black">ساعات پیک فروش</h2>
        <div className="grid grid-cols-12 gap-1">
          {heat.map((h) => (
            <div key={h.hour} className="text-center">
              <div
                className="h-16 rounded-md"
                style={{ background: `rgba(196,30,58,${0.12 + (h.toman / max) * 0.88})` }}
                title={`${h.hour}:00 — ${h.toman}`}
              />
              <div className="text-[10px]">{h.hour}</div>
            </div>
          ))}
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="h-80 p-4">
          <h2 className="mb-2 font-black">توزیع درآمد دسته‌ها</h2>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={cats.data ?? []} dataKey="netSales" nameKey="categoryName" outerRadius={90} label>
                {(cats.data ?? []).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatToman(Number(v))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card className="h-80 p-4">
          <h2 className="mb-2 font-black">پرفروش در برابر کم‌فروش</h2>
          <ResponsiveContainer>
            <BarChart data={perf.data ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="title" hide />
              <YAxis />
              <Tooltip formatter={(v) => formatToman(Number(v))} />
              <Bar dataKey="netSales">
                {(perf.data ?? []).map((p, i) => (
                  <Cell key={i} fill={p.band === "Star" ? "#059669" : p.band === "Underperforming" ? "#C41E3A" : "#D97706"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
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
      <Card className="p-4">
        <h2 className="mb-3 font-black">فروش کالا</h2>
        <ul className="space-y-1 text-sm">
          {(products.data ?? []).map((p) => (
            <li key={p.menuItemId} className="flex justify-between border-b py-2">
              <span>
                {p.title} · {p.categoryName} · {p.quantity} عدد
              </span>
              <span className="font-bold">{formatToman(p.netSales)}</span>
            </li>
          ))}
        </ul>
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
