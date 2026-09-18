"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, Input, Label } from "@/components/ui/input";
import { api } from "@/lib/api";
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
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");

  const list = useQuery({
    queryKey: ["customers", "paged", term],
    queryFn: () => api.customersPaged(1, 50, term || undefined),
  });

  const detail = useQuery({
    queryKey: ["customer", selectedId],
    queryFn: () => api.customerById(selectedId!),
    enabled: !!selectedId,
  });

  const orders = useQuery({
    queryKey: ["customer-orders", selectedId],
    queryFn: () => api.customerOrders(selectedId!),
    enabled: !!selectedId,
  });

  const createMut = useMutation({
    mutationFn: () => api.createCustomer({ phoneNumber: phone.trim(), fullName: fullName.trim() || null }),
    onSuccess: (c) => {
      toast.success("مشتری ثبت شد");
      setPhone("");
      setFullName("");
      setSelectedId(c.id);
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const customers = list.data?.items ?? [];

  const [debouncedTerm, setDebouncedTerm] = useState("");

  // UI state (raw keystrokes) is separate from server state (debounced term).
  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(term.trim()), 250);
    return () => clearTimeout(t);
  }, [term]);

  const q = useCustomers(debouncedTerm || undefined);

  const customers = q.data ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card className="p-4">
        <h2 className="mb-3 font-black">باشگاه مشتریان</h2>
        <div className="mb-4 grid max-w-xl gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input placeholder="موبایل" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input placeholder="نام کامل" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Button disabled={!phone.trim() || createMut.isPending} onClick={() => createMut.mutate()}>
            ثبت مشتری
          </Button>
        </div>
        <Input
          placeholder="جستجوی موبایل یا نام"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          className="mb-4 max-w-sm"
        />
        <div className="overflow-x-auto">
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
              {customers.map((c) => (
                <tr
                  key={c.id}
                  className={`cursor-pointer border-t hover:bg-muted/40 ${selectedId === c.id ? "bg-primary/5" : ""}`}
                  onClick={() => setSelectedId(c.id)}
                >
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
              {!customers.length && !list.isLoading ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">
                    مشتری‌ای یافت نشد
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        {!selectedId ? (
          <p className="text-sm text-muted-foreground">یک مشتری را برای جزئیات انتخاب کنید.</p>
        ) : detail.isLoading ? (
          <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
        ) : detail.data ? (
          <CustomerDetail
            customerId={selectedId}
            onDeleted={() => {
              setSelectedId(null);
              qc.invalidateQueries({ queryKey: ["customers"] });
            }}
            onUpdated={() => {
              qc.invalidateQueries({ queryKey: ["customers"] });
              qc.invalidateQueries({ queryKey: ["customer", selectedId] });
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">مشتری یافت نشد</p>
        )}

        {selectedId ? (
          <div>
            <h3 className="mb-2 font-black">سفارش‌ها</h3>
            <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
              {(orders.data?.items ?? []).map((o) => (
                <li key={o.id} className="rounded-xl border p-2">
                  <div className="flex justify-between gap-2">
                    <span className="font-mono font-bold">{o.orderNumber}</span>
                    <Badge>{o.status}</Badge>
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                    <span>{formatToman(o.grandTotal)}</span>
                    <span>{o.createdAtShamsi}</span>
                  </div>
                </li>
              ))}
              {!orders.data?.items?.length && !orders.isLoading ? (
                <li className="text-muted-foreground">سفارشی ثبت نشده</li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function CustomerDetail({
  customerId,
  onDeleted,
  onUpdated,
}: {
  customerId: string;
  onDeleted: () => void;
  onUpdated: () => void;
}) {
  const detail = useQuery({
    queryKey: ["customer", customerId],
    queryFn: () => api.customerById(customerId),
  });
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [pointsDelta, setPointsDelta] = useState("");
  const [loyaltyNotes, setLoyaltyNotes] = useState("");

  useEffect(() => {
    if (!detail.data) return;
    setPhone(detail.data.phoneNumber);
    setFullName(detail.data.fullName ?? "");
  }, [detail.data]);

  const updateMut = useMutation({
    mutationFn: () =>
      api.updateCustomer(customerId, {
        phoneNumber: phone.trim(),
        fullName: fullName.trim() || null,
      }),
    onSuccess: () => {
      toast.success("مشتری به‌روز شد");
      onUpdated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.deleteCustomer(customerId),
    onSuccess: () => {
      toast.success("مشتری حذف شد");
      onDeleted();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const loyaltyMut = useMutation({
    mutationFn: () => api.adjustLoyalty(customerId, Number(pointsDelta), loyaltyNotes.trim() || undefined),
    onSuccess: () => {
      toast.success("امتیاز به‌روز شد");
      setPointsDelta("");
      setLoyaltyNotes("");
      onUpdated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!detail.data) return null;
  const c = detail.data;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-black">جزئیات مشتری</h3>
        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge>امتیاز {c.loyaltyPoints}</Badge>
          <span>مراجعه {c.visitCount}</span>
          <span>{formatToman(c.totalSpent)}</span>
        </div>
      </div>
      <div className="space-y-2">
        <Label>موبایل</Label>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Label>نام کامل</Label>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Button className="w-full" onClick={() => updateMut.mutate()} disabled={!phone.trim() || updateMut.isPending}>
          ذخیره تغییرات
        </Button>
        <Button className="w-full" variant="destructive" onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending}>
          حذف مشتری
        </Button>
      </div>
      <div className="space-y-2 border-t pt-3">
        <Label>تعدیل امتیاز وفاداری</Label>
        <Input
          placeholder="تغییر امتیاز (+/-)"
          value={pointsDelta}
          onChange={(e) => setPointsDelta(e.target.value)}
        />
        <Input placeholder="یادداشت" value={loyaltyNotes} onChange={(e) => setLoyaltyNotes(e.target.value)} />
        <Button
          className="w-full"
          variant="outline"
          disabled={!pointsDelta || Number.isNaN(Number(pointsDelta)) || loyaltyMut.isPending}
          onClick={() => loyaltyMut.mutate()}
        >
          اعمال امتیاز
        </Button>
      </div>
    </div>
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
