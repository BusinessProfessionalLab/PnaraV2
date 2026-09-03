"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Card, Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api";
import { Users } from "lucide-react";
import { formatToman } from "@/lib/currency";

export function CustomersHub() {
  const [term, setTerm] = useState("");
  const q = useQuery({ queryKey: ["customers", term], queryFn: () => api.customers(term || undefined) });
  return (
    <Card className="animate-fade-up p-4">
      <h2 className="mb-3 text-lg font-bold">باشگاه مشتریان</h2>
      <Input placeholder="جستجوی موبایل یا نام" value={term} onChange={(e) => setTerm(e.target.value)} className="mb-4 max-w-sm" />
      {q.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState
          icon={Users}
          title="مشتری ثبت نشده"
          description="مشتریان پس از اولین سفارش خودکار ثبت می‌شوند"
        />
      ) : (
      <table className="w-full text-sm">
        <thead>
          <tr className="text-right text-muted-foreground">
            <th className="p-2">موبایل</th>
            <th>نام</th>
            <th>مراجعه</th>
            <th>خرید عمری</th>
            <th>امتیاز</th>
            <th>آخرین بازدید</th>
          </tr>
        </thead>
        <tbody>
          {(q.data ?? []).map((c) => (
            <tr key={c.id} className="border-t">
              <td className="p-2 font-mono">{c.phoneNumber}</td>
              <td>{c.fullName || "—"}</td>
              <td>
                <Badge>{c.visitCount}</Badge>
              </td>
              <td>{formatToman(c.totalSpent)}</td>
              <td>{c.loyaltyPoints}</td>
              <td>{c.lastVisitShamsi}</td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
    </Card>
  );
}
