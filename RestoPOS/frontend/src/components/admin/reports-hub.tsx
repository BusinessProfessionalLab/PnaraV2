"use client";

import { useQuery } from "@tanstack/react-query";
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
import { Card, Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { formatToman, rialToToman } from "@/lib/currency";
import { daysAgoUtc } from "@/lib/jalali";

const COLORS = ["#C41E3A", "#1F2937", "#D97706", "#059669", "#2563EB", "#7C3AED"];

export function ReportsHub() {
  const [from, setFrom] = useState(daysAgoUtc(14));
  const [to, setTo] = useState(new Date().toISOString());
  const products = useQuery({ queryKey: ["rep-p", from, to], queryFn: () => api.reportProducts(from, to) });
  const cats = useQuery({ queryKey: ["rep-c", from, to], queryFn: () => api.reportCategories(from, to) });
  const hourly = useQuery({ queryKey: ["rep-h", from, to], queryFn: () => api.reportHourly(from, to) });
  const perf = useQuery({ queryKey: ["rep-perf", from, to], queryFn: () => api.reportPerformance(from, to) });
  const staff = useQuery({ queryKey: ["rep-s", from, to], queryFn: () => api.reportStaff(from, to) });

  const heat = useMemo(() => {
    const map = new Map((hourly.data ?? []).map((h) => [h.hour, h]));
    return Array.from({ length: 24 }, (_, hour) => {
      const row = map.get(hour);
      return { hour, orderCount: row?.orderCount ?? 0, toman: rialToToman(row?.netSales ?? 0) };
    });
  }, [hourly.data]);
  const max = Math.max(1, ...heat.map((h) => h.toman));

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input type="datetime-local" onChange={(e) => e.target.value && setFrom(new Date(e.target.value).toISOString())} />
        <Input type="datetime-local" onChange={(e) => e.target.value && setTo(new Date(e.target.value).toISOString())} />
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
