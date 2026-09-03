"use client";

import { useEffect, useState } from "react";
import { Search, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonTable } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroller,
} from "@/components/ui/table";
import { useCustomers } from "@/queries/customers";
import { formatToman } from "@/lib/currency";

export function CustomersHub() {
  const [term, setTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");

  // UI state (raw keystrokes) is separate from server state (debounced term).
  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(term.trim()), 250);
    return () => clearTimeout(t);
  }, [term]);

  const q = useCustomers(debouncedTerm || undefined);

  const customers = q.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="باشگاه مشتریان"
        description="مشتریان پس از اولین سفارش و تسویه به‌صورت خودکار ثبت می‌شوند و امتیاز وفاداری می‌گیرند"
      />
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border/70 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <span className="shrink-0 text-[13px] font-medium text-muted-foreground">
            {q.isLoading ? null : `${customers.length} مشتری`}
          </span>
          <div className="relative w-full sm:max-w-xs">
          <Search
            className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            placeholder="جستجوی موبایل یا نام…"
            className="ps-9"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
      </div>

      {q.isLoading ? (
        <div className="p-5">
          <SkeletonTable rows={6} cols={6} />
        </div>
      ) : customers.length === 0 ? (
        <div className="p-5">
          <EmptyState
            icon={Users}
            title={term ? "مشتری‌ای یافت نشد" : "هنوز مشتری ثبت نشده"}
            description={
              term
                ? "عبارت دیگری را امتحان کنید"
                : "بعد از اولین سفارش و تسویه، مشتری به‌صورت خودکار به این فهرست اضافه می‌شود"
            }
          />
        </div>
      ) : (
        <TableScroller>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>موبایل</TableHead>
                <TableHead>نام</TableHead>
                <TableHead className="hidden md:table-cell">مراجعه</TableHead>
                <TableHead>خرید عمری</TableHead>
                <TableHead className="hidden md:table-cell">امتیاز باشگاه</TableHead>
                <TableHead className="hidden md:table-cell">آخرین بازدید</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-[13px] font-medium tabular-nums" dir="ltr">
                    {c.phoneNumber}
                  </TableCell>
                  <TableCell className="font-medium">{c.fullName || "—"}</TableCell>
                  <TableCell className="hidden tabular-nums md:table-cell">{c.visitCount}</TableCell>
                  <TableCell className="font-medium tabular-nums">{formatToman(c.totalSpent)}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      {c.loyaltyPoints}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground tabular-nums md:table-cell">
                    {c.lastVisitShamsi}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableScroller>
      )}
      </Card>
    </div>
  );
}
