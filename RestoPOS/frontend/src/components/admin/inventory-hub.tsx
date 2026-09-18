"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowDownToLine, ArrowUpRight, Boxes, PackagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, Input, Label, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonTable } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroller,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateInventoryItem,
  useInventory,
  useInventoryTransactions,
  useReceiveStock,
  useRecordWaste,
  useStockAlerts,
} from "@/queries/inventory";
import { formatToman } from "@/lib/currency";
import type {
  BaseUnit,
  InventoryItemDto,
  PurchasePaymentStatus,
  StorageLocation,
  WasteReason,
} from "@/lib/types";
import { errorMessage } from "@/api/errors";
import { cn } from "@/lib/cn";
import type { UnitOfMeasure } from "@/lib/types";

const BASE_UNITS: { value: BaseUnit; label: string }[] = [
  { value: "Gram", label: "گرم" },
  { value: "Milliliter", label: "میلی‌لیتر" },
  { value: "Piece", label: "عدد" },
  { value: "Portion", label: "پرس" },
  { value: "Can", label: "قوطی" },
  { value: "Kilogram", label: "کیلوگرم" },
  { value: "Liter", label: "لیتر" },
];

const STORAGE_LOCATIONS: { value: StorageLocation; label: string }[] = [
  { value: "CentralStorage", label: "انبار مرکزی" },
  { value: "KitchenLine", label: "خط آشپزخانه" },
  { value: "Bar", label: "بار" },
  { value: "ColdRoom", label: "سردخانه" },
  { value: "DryStorage", label: "انبار خشک" },
];

const WASTE_REASONS: { value: WasteReason; label: string }[] = [
  { value: "Expired", label: "انقضا" },
  { value: "PreparationDefect", label: "اشکال آماده‌سازی" },
  { value: "Spoilage", label: "فساد" },
  { value: "StaffMeal", label: "وعده پرسنل" },
  { value: "SpillBreakage", label: "ریخت‌وپاش / شکستگی" },
];

const PAYMENT_STATUSES: { value: PurchasePaymentStatus; label: string }[] = [
  { value: "Paid", label: "پرداخت‌شده" },
  { value: "Unpaid", label: "پرداخت‌نشده" },
  { value: "Partial", label: "پرداخت جزئی" },
];

function asItems<T>(data: { items?: T[] } | T[] | undefined | null): T[] {
  if (!data) return [];
  return Array.isArray(data) ? data : data.items ?? [];
}

function unitLabel(u: string | undefined) {
  return BASE_UNITS.find((x) => x.value === u)?.label ?? u ?? "—";
}

function locationLabel(l: string | undefined | null) {
  return STORAGE_LOCATIONS.find((x) => x.value === l)?.label ?? l ?? "—";
}

function tomanToRials(toman: string | number) {
  return Math.round(Number(toman || 0) * 10);
}

function invalidateInventory(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["inventory"] });
  qc.invalidateQueries({ queryKey: ["low-stock"] });
  qc.invalidateQueries({ queryKey: ["inventory-valuation"] });
  qc.invalidateQueries({ queryKey: ["inventory-tx"] });
  qc.invalidateQueries({ queryKey: ["cardex"] });
  qc.invalidateQueries({ queryKey: ["purchases"] });
  qc.invalidateQueries({ queryKey: ["waste"] });
  qc.invalidateQueries({ queryKey: ["waste-reports"] });
  qc.invalidateQueries({ queryKey: ["stock-counts"] });
  qc.invalidateQueries({ queryKey: ["transfers"] });
  qc.invalidateQueries({ queryKey: ["suppliers"] });
}

const UNITS: UnitOfMeasure[] = ["Gr", "Ml", "Kg", "Liter", "Count"];
const UNIT_LABEL: Record<string, string> = {
  Gr: "گرم",
  Ml: "میلی‌لیتر",
  Kg: "کیلوگرم",
  Liter: "لیتر",
  Count: "عدد",
};

const TX_META: Record<string, { label: string; variant: "success" | "danger" | "neutral" | "default" }> = {
  InboundPurchase: { label: "خرید", variant: "success" },
  Waste: { label: "ضایعات", variant: "danger" },
  RecipeDeduction: { label: "مصرف رسپی", variant: "neutral" },
  ReverseDeduction: { label: "برگشت", variant: "default" },
  Adjustment: { label: "تعدیل", variant: "neutral" },
};

export function InventoryHub() {
  return (
    <Tabs defaultValue="items" className="space-y-4" dir="rtl">
      <TabsList>
        <TabsTrigger value="items">کالاها</TabsTrigger>
        <TabsTrigger value="purchases">خرید</TabsTrigger>
        <TabsTrigger value="waste">ضایعات</TabsTrigger>
        <TabsTrigger value="counts">انبارگردانی</TabsTrigger>
        <TabsTrigger value="transfers">انتقال</TabsTrigger>
        <TabsTrigger value="suppliers">تأمین‌کنندگان</TabsTrigger>
      </TabsList>
      <TabsContent value="items">
        <ItemsTab />
      </TabsContent>
      <TabsContent value="purchases">
        <PurchasesTab />
      </TabsContent>
      <TabsContent value="waste">
        <WasteTab />
      </TabsContent>
      <TabsContent value="counts">
        <StockCountsTab />
      </TabsContent>
      <TabsContent value="transfers">
        <TransfersTab />
      </TabsContent>
      <TabsContent value="suppliers">
        <SuppliersTab />
      </TabsContent>
    </Tabs>
  );
}

/* ───────────────────── کالاها ───────────────────── */

function ItemsTab() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>("");
  const [editId, setEditId] = useState<string | null>(null);

  const items = useQuery({ queryKey: ["inventory"], queryFn: api.inventory });
  const lowStock = useQuery({ queryKey: ["low-stock"], queryFn: api.lowStock });
  const valuation = useQuery({ queryKey: ["inventory-valuation"], queryFn: api.inventoryValuation });
  const txs = useQuery({
    queryKey: ["inventory-tx", selectedId || "all"],
    queryFn: () => api.inventoryTx(selectedId || undefined),
  });
  const cardex = useQuery({
    queryKey: ["cardex", selectedId],
    queryFn: () => api.cardex(selectedId),
    enabled: !!selectedId,
  });
  const items = useInventory();
  const alerts = useStockAlerts();
  const txs = useInventoryTransactions();

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteInventoryItem(id),
    onSuccess: () => {
      toast.success("کالا حذف شد");
      if (selectedId === editId) setSelectedId("");
      setEditId(null);
      invalidateInventory(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editing = useMemo(
    () => (items.data ?? []).find((i) => i.id === editId) ?? null,
    [items.data, editId],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">ارزش کل انبار</div>
          <div className="text-xl font-black">
            {formatToman(valuation.data?.grandTotalRials ?? 0)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">تعداد کالا</div>
          <div className="text-xl font-black">{(items.data ?? []).length}</div>
        </Card>
        <Card className="border-amber-300 bg-amber-50 p-4">
          <div className="text-sm text-muted-foreground">هشدار کمبود</div>
          <div className="text-xl font-black">{(lowStock.data ?? []).length}</div>
        </Card>
      </div>

      {(lowStock.data ?? []).length > 0 && (
        <div className="grid gap-3 md:grid-cols-3">
          {(lowStock.data ?? []).map((a) => (
            <Card key={a.id} className="border-amber-300 bg-amber-50 p-4">
              <div className="font-black">{a.name}</div>
              <div className="text-sm">حداقل: {a.reorderPoint ?? a.minimumAlertStock}</div>
              <div className="text-sm">موجودی: {a.currentStock}</div>
              <Badge variant="warning">کمبود</Badge>
            </Card>
          ))}
        </div>
      )}

      {(valuation.data?.byLocation?.length ?? 0) > 0 && (
        <Card className="p-4">
          <h3 className="mb-2 font-black">ارزش بر اساس محل</h3>
          <div className="flex flex-wrap gap-2 text-sm">
            {valuation.data!.byLocation.map((g) => (
              <Badge key={g.groupKey} variant="outline">
                {g.groupLabel}: {formatToman(g.totalValueRials)} ({g.itemCount} کالا)
              </Badge>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 font-black">{editId ? "ویرایش کالا" : "ثبت کالای جدید"}</h2>
          <ItemForm
            key={editId ?? "new"}
            initial={editing}
            onCancel={() => setEditId(null)}
            onDone={() => {
              setEditId(null);
              invalidateInventory(qc);
            }}
          />
    <div className="space-y-5">
      <PageHeader
        title="انبار"
        description="موجودی مواد اولیه، فاکتور خرید، ضایعات و گردش انبار"
      />

      {/* Low-stock alert cards */}
      {alerts.isLoading ? null : (alerts.data ?? []).length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(alerts.data ?? []).map((a) => (
            <Card key={a.inventoryItemId} className="border-warning/30 bg-warning/[0.04] p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning">
                  <AlertTriangle className="size-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{a.name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    {a.sku} · نقطه سفارش {a.reorderPoint}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      موجودی فعلی:{" "}
                      <span className="font-bold text-foreground tabular-nums">{a.currentStock}</span>
                    </span>
                    <Badge variant="warning" className="tabular-nums">
                      کسری {a.deficit}
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Registration forms */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border/70 px-5 py-4">
            <div className="flex size-8 items-center justify-center rounded-lg bg-success/10 text-success">
              <ArrowDownToLine className="size-4" aria-hidden />
            </div>
            <div>
              <h2 className="text-[15px] font-bold">ثبت کالا / فاکتور خرید</h2>
              <p className="text-xs text-muted-foreground">ورود کالا به انبار</p>
            </div>
          </div>
          <div className="p-5">
            <InboundForm items={items.data ?? []} />
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 font-black">تعدیل دستی موجودی</h2>
          <ManualAdjustmentForm
            items={items.data ?? []}
            onDone={() => invalidateInventory(qc)}
          />
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border/70 px-5 py-4">
            <div className="flex size-8 items-center justify-center rounded-lg bg-danger/10 text-danger">
              <Trash2 className="size-4" aria-hidden />
            </div>
            <div>
              <h2 className="text-[15px] font-bold">ثبت ضایعات</h2>
              <p className="text-xs text-muted-foreground">خروج کالای معیوب یا ریخته‌شده</p>
            </div>
          </div>
          <div className="p-5">
            <WasteForm items={items.data ?? []} />
          </div>
        </Card>
      </div>

      <Card className="overflow-x-auto p-4">
        <h2 className="mb-3 font-black">موجودی زنده</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-right text-muted-foreground">
              <th className="p-2">کالا</th>
              <th>SKU</th>
              <th>موجودی</th>
              <th>حداقل</th>
              <th>محل</th>
              <th>قیمت</th>
              <th>وضعیت</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {(items.data ?? []).map((i) => (
              <tr
                key={i.id}
                className={`border-t ${selectedId === i.id ? "bg-muted/40" : ""}`}
              >
                <td className="p-2 font-bold">
                  <button type="button" className="text-right hover:underline" onClick={() => setSelectedId(i.id)}>
                    {i.name}
                  </button>
                </td>
                <td>{i.sku}</td>
                <td>
                  {i.currentStock} {unitLabel(i.unitOfMeasure ?? i.baseUnit)}
                </td>
                <td>{i.reorderPoint ?? i.minimumAlertStock}</td>
                <td>{locationLabel(i.storageLocation)}</td>
                <td>{formatToman(i.costPrice ?? i.lastPurchasePriceRials ?? 0)}</td>
                <td>
                  {i.isLowStock ? <Badge variant="danger">هشدار</Badge> : <Badge variant="success">سالم</Badge>}
                </td>
                <td className="space-x-1 space-x-reverse whitespace-nowrap p-2">
                  <Button size="sm" variant="outline" onClick={() => { setSelectedId(i.id); setEditId(i.id); }}>
                    ویرایش
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteMut.mutate(i.id)}>
                    حذف
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

      {/* Live stock */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
          <div className="flex items-center gap-2">
            <Boxes className="size-4 text-muted-foreground" aria-hidden />
            <h2 className="text-[15px] font-bold">موجودی زنده</h2>
          </div>
          {items.data ? (
            <Badge variant="neutral" className="tabular-nums">
              {items.data.length} کالا
            </Badge>
          ) : null}
        </div>
        {items.isLoading ? (
          <div className="p-5">
            <SkeletonTable rows={6} cols={6} />
          </div>
        ) : (items.data ?? []).length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={Boxes}
              title="کالایی در انبار ثبت نشده"
              description="با فرم «ثبت کالا» اولین ماده اولیه را اضافه کنید"
            />
          </div>
        ) : (
          <TableScroller>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>کالا</TableHead>
                  <TableHead className="hidden md:table-cell">SKU</TableHead>
                  <TableHead>موجودی</TableHead>
                  <TableHead className="hidden md:table-cell">نقطه سفارش</TableHead>
                  <TableHead className="hidden md:table-cell">قیمت خرید</TableHead>
                  <TableHead>وضعیت</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(items.data ?? []).map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-semibold">{i.name}</TableCell>
                    <TableCell className="hidden font-mono text-[13px] text-muted-foreground tabular-nums md:table-cell" dir="ltr">
                      {i.sku}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      <span className="font-bold">{Math.max(0, i.currentStock)}</span>{" "}
                      <span className="text-xs text-muted-foreground">{UNIT_LABEL[i.unitOfMeasure] ?? i.unitOfMeasure}</span>
                    </TableCell>
                    <TableCell className="hidden tabular-nums text-muted-foreground md:table-cell">{i.reorderPoint} {UNIT_LABEL[i.unitOfMeasure] ?? i.unitOfMeasure}</TableCell>
                    <TableCell className="hidden tabular-nums md:table-cell">{formatToman(i.costPrice)}</TableCell>
                    <TableCell>
                      {i.currentStock <= 0 ? (
                        <Badge variant="danger">Ù†Ø§Ù…ÙˆØ¬ÙˆØ¯</Badge>
                      ) : i.isLowStock ? (
                        <Badge variant="danger">رو به اتمام</Badge>
                      ) : i.currentStock <= 0 ? (
                        <Badge variant="danger">ناموجود</Badge>
                      ) : (
                        <Badge variant="success">سالم</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroller>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 font-black">کاردکس {selectedId ? "" : "(کالا را انتخاب کنید)"}</h2>
          <ul className="max-h-80 space-y-1 overflow-y-auto text-sm">
            {(cardex.data ?? []).map((r) => (
              <li key={r.id} className="flex justify-between gap-2 border-b py-2">
                <span>
                  {r.transactionType} · Δ{r.quantityDelta} · موجودی {r.stockAfter}
                </span>
                <span className="text-muted-foreground">
                  {formatToman(r.unitCostRials)} · {new Date(r.createdAtUtc).toLocaleString("fa-IR")}
                </span>
              </li>
            ))}
            {selectedId && (cardex.data ?? []).length === 0 && (
              <li className="text-muted-foreground">رکوردی نیست</li>
            )}
          </ul>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 font-black">گردش انبار</h2>
          <ul className="max-h-80 space-y-1 overflow-y-auto text-sm">
            {(txs.data ?? []).slice(0, 40).map((t) => (
              <li key={t.id} className="flex justify-between gap-2 border-b py-2">
                <span>
                  {t.itemName} · {t.type ?? t.transactionType} · {t.quantity ?? t.quantityDelta}
                </span>
                <span className="text-muted-foreground">{t.notes}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>

      {/* Transactions */}
      <Card className="overflow-hidden">
        <div className="border-b border-border/70 px-5 py-4">
          <h2 className="text-[15px] font-bold">گردش انبار</h2>
        </div>
        {txs.isLoading ? (
          <div className="p-5">
            <SkeletonTable rows={5} cols={3} />
          </div>
        ) : (txs.data ?? []).length === 0 ? (
          <div className="p-5">
            <EmptyState compact icon={PackagePlus} title="تراکنشی ثبت نشده" description="گردش خرید و مصرف مواد اینجا نمایش داده می‌شود" />
          </div>
        ) : (
          <ul className="divide-y divide-border/70">
            {(txs.data ?? []).slice(0, 20).map((t) => {
              const meta = TX_META[t.type] ?? { label: t.type, variant: "neutral" as const };
              return (
                <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    {t.type === "Waste" ? (
                      <ArrowUpRight className="size-3.5" aria-hidden />
                    ) : (
                      <ArrowDownToLine className="size-3.5" aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{t.itemName}</span>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                      <span className="text-[13px] font-medium tabular-nums text-foreground">
                        {t.quantity > 0 ? `+${t.quantity}` : t.quantity}
                      </span>
                    </div>
                    {t.notes ? (
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">{t.notes}</div>
                    ) : null}
                  </div>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {t.occurredAt}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ItemForm({
  initial,
  onDone,
  onCancel,
function ModePill({
  active,
  onClick,
  children,
}: {
  initial: InventoryItemDto | null;
  onDone: () => void;
  onCancel: () => void;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [barcode, setBarcode] = useState(initial?.barcode ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [baseUnit, setBaseUnit] = useState<BaseUnit>(initial?.baseUnit ?? "Piece");
  const [minimumAlertStock, setMinimumAlertStock] = useState(String(initial?.minimumAlertStock ?? initial?.reorderPoint ?? 0));
  const [optimalStock, setOptimalStock] = useState(String(initial?.optimalStock ?? initial?.safetyStock ?? 0));
  const [openingStock, setOpeningStock] = useState("0");
  const [openingUnitCostToman, setOpeningUnitCostToman] = useState("0");
  const [storageLocation, setStorageLocation] = useState<StorageLocation>(initial?.storageLocation ?? "CentralStorage");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-lg px-3.5 py-1.5 text-[13px] font-semibold outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/50",
        active ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function InboundForm({ items }: { items: { id: string; name: string }[] }) {
  const createItem = useCreateInventoryItem();
  const receive = useReceiveStock();
  const [mode, setMode] = useState<"new" | "buy">("buy");
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState<UnitOfMeasure>("Gr");
  const [id, setId] = useState("");
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [reorder, setReorder] = useState("1000");

  const mut = useMutation({
    mutationFn: async () => {
      if (isEdit && initial) {
        return api.updateInventoryItem(initial.id, {
          name,
          barcode: barcode || null,
          category: category || null,
          minimumAlertStock: Number(minimumAlertStock),
          optimalStock: Number(optimalStock),
          storageLocation,
          isActive,
          conversions: null,
        });
      }
      return api.createInventoryItem({
        name,
        sku,
        barcode: barcode || null,
        category: category || null,
        baseUnit,
        minimumAlertStock: Number(minimumAlertStock),
        optimalStock: Number(optimalStock),
        openingStock: Number(openingStock),
        openingUnitCostRials: tomanToRials(openingUnitCostToman),
        storageLocation,
        conversions: null,
      });
    },
    onSuccess: () => {
      toast.success(isEdit ? "کالا به‌روز شد" : "کالا ثبت شد");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  async function submit() {
    try {
      if (mode === "new") {
        await createItem.mutateAsync({
          name,
          sku,
          unitOfMeasure: unit,
          reorderPoint: Number(reorder),
          safetyStock: Number(reorder) / 2,
          openingStock: Number(qty),
          costPrice: Number(cost) * 10,
        });
      } else {
        if (!id) {
          toast.error("کالا را انتخاب کنید.");
          return;
        }
        await receive.mutateAsync({
          inventoryItemId: id,
          quantity: Number(qty),
          unitCost: Number(cost) * 10,
          notes: "فاکتور خرید",
          batchReference: `PO-${Date.now()}`,
        });
      }
      toast.success("انبار به‌روز شد");
      setQty("");
      setCost("");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  const valid =
    mode === "buy" ? Boolean(id && qty && cost) : Boolean(name && sku && qty && cost);
  const pending = mode === "new" ? createItem.isPending : receive.isPending;

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="space-y-1">
        <Label>نام</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
    <div className="space-y-4">
      <div className="flex w-fit gap-1 rounded-xl bg-muted p-1">
        <ModePill active={mode === "buy"} onClick={() => setMode("buy")}>
          فاکتور خرید
        </ModePill>
        <ModePill active={mode === "new"} onClick={() => setMode("new")}>
          کالای جدید
        </ModePill>
      </div>
      {!isEdit && (
        <div className="space-y-1">
          <Label>SKU</Label>
          <Input value={sku} onChange={(e) => setSku(e.target.value)} />
        </div>
      )}
      <div className="space-y-1">
        <Label>بارکد</Label>
        <Input value={barcode ?? ""} onChange={(e) => setBarcode(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>دسته‌بندی</Label>
        <Input value={category ?? ""} onChange={(e) => setCategory(e.target.value)} />
      </div>
      {!isEdit && (
        <div className="space-y-1">
          <Label>واحد پایه</Label>
          <Select value={baseUnit} onValueChange={(v) => setBaseUnit(v as BaseUnit)}>
            <SelectTrigger>
              <SelectValue placeholder="واحد" />
            </SelectTrigger>
            <SelectContent>
              {BASE_UNITS.map((u) => (
                <SelectItem key={u.value} value={u.value}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-1">
        <Label>محل نگهداری</Label>
        <Select value={storageLocation} onValueChange={(v) => setStorageLocation(v as StorageLocation)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STORAGE_LOCATIONS.map((l) => (
              <SelectItem key={l.value} value={l.value}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>حداقل هشدار</Label>
        <Input type="number" value={minimumAlertStock} onChange={(e) => setMinimumAlertStock(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>موجودی مطلوب</Label>
        <Input type="number" value={optimalStock} onChange={(e) => setOptimalStock(e.target.value)} />
      </div>
      {!isEdit && (
        <>
          <div className="space-y-1">
            <Label>موجودی افتتاحیه</Label>
            <Input type="number" value={openingStock} onChange={(e) => setOpeningStock(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>بهای واحد افتتاحیه (تومان)</Label>
            <Input type="number" value={openingUnitCostToman} onChange={(e) => setOpeningUnitCostToman(e.target.value)} />
          </div>

      {mode === "new" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="نام کالا">
              <Input placeholder="مثلاً قهوه عربیکا" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="SKU">
              <Input placeholder="کد کالا" dir="ltr" value={sku} onChange={(e) => setSku(e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="واحد اندازه‌گیری">
              <Select value={unit} onValueChange={(v) => setUnit(v as UnitOfMeasure)}>
                <SelectTrigger>
                  <SelectValue placeholder="واحد" />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {UNIT_LABEL[u]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="نقطه سفارش مجدد">
              <Input type="number" inputMode="numeric" value={reorder} onChange={(e) => setReorder(e.target.value)} />
            </Field>
          </div>
        </>
      )}
      {isEdit && (
        <div className="flex items-center gap-2 space-y-1">
          <input
            id="item-active"
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <Label htmlFor="item-active">فعال</Label>
        </div>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <Button className="flex-1" onClick={() => mut.mutate()} disabled={mut.isPending}>
          {isEdit ? "ذخیره تغییرات" : "ثبت کالا"}
        </Button>
        {isEdit && (
          <Button variant="outline" onClick={onCancel}>
            انصراف
          </Button>
        )}
      </div>
    </div>
  );
}

function ManualAdjustmentForm({
  items,
  onDone,
}: {
  items: InventoryItemDto[];
  onDone: () => void;
}) {
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [quantityDelta, setQuantityDelta] = useState("");
  const [notes, setNotes] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      api.manualAdjustment({
        inventoryItemId,
        quantityDelta: Number(quantityDelta),
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success("تعدیل ثبت شد");
      setQuantityDelta("");
      setNotes("");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-2">
      <Select value={inventoryItemId} onValueChange={setInventoryItemId}>
        <SelectTrigger>
          <SelectValue placeholder="انتخاب کالا" />
        </SelectTrigger>
        <SelectContent>
          {items.map((i) => (
            <SelectItem key={i.id} value={i.id}>
              {i.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="number"
        placeholder="تغییر مقدار (+/-)"
        value={quantityDelta}
        onChange={(e) => setQuantityDelta(e.target.value)}
      />
      <Input placeholder="یادداشت" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <Button className="w-full" onClick={() => mut.mutate()} disabled={!inventoryItemId || mut.isPending}>
        ثبت تعدیل
      </Button>
    </div>
  );
}

/* ───────────────────── خرید ───────────────────── */

type PurchaseLine = {
  inventoryItemId: string;
  quantity: string;
  unitPriceToman: string;
  lineDiscountToman: string;
};

function PurchasesTab() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>("");
  const [asDraft, setAsDraft] = useState(false);

  const items = useQuery({ queryKey: ["inventory"], queryFn: api.inventory });
  const purchases = useQuery({
    queryKey: ["purchases"],
    queryFn: () => api.listPurchases({ page: 1, pageSize: 50 }),
  });
  const detail = useQuery({
    queryKey: ["purchases", selectedId],
    queryFn: () => api.getPurchase(selectedId),
    enabled: !!selectedId,
  });

  const [invoiceNumber, setInvoiceNumber] = useState(`PO-${Date.now()}`);
  const [supplierName, setSupplierName] = useState("");
  const [taxToman, setTaxToman] = useState("0");
  const [discountToman, setDiscountToman] = useState("0");
  const [paymentStatus, setPaymentStatus] = useState<PurchasePaymentStatus>("Unpaid");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<PurchaseLine[]>([
    { inventoryItemId: "", quantity: "1", unitPriceToman: "0", lineDiscountToman: "0" },
  ]);

  const createMut = useMutation({
    mutationFn: async () => {
      const payload = {
        invoiceNumber,
        supplierName: supplierName || undefined,
        taxRials: tomanToRials(taxToman),
        discountRials: tomanToRials(discountToman),
        paymentStatus,
        notes: notes || undefined,
        items: lines
          .filter((l) => l.inventoryItemId)
          .map((l) => ({
            inventoryItemId: l.inventoryItemId,
            quantity: Number(l.quantity),
            unitPriceRials: tomanToRials(l.unitPriceToman),
            lineDiscountRials: tomanToRials(l.lineDiscountToman),
          })),
      };
      if (asDraft) return api.createDraftPurchase(payload);
      return api.createPurchase(payload);
    },
    onSuccess: () => {
      toast.success(asDraft ? "پیش‌نویس خرید ثبت شد" : "فاکتور خرید ثبت و تأیید شد");
      setInvoiceNumber(`PO-${Date.now()}`);
      setLines([{ inventoryItemId: "", quantity: "1", unitPriceToman: "0", lineDiscountToman: "0" }]);
      invalidateInventory(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => api.approvePurchase(id),
    onSuccess: () => {
      toast.success("فاکتور تأیید شد");
      invalidateInventory(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => api.cancelPurchase(id),
    onSuccess: () => {
      toast.success("فاکتور لغو شد");
      setSelectedId("");
      invalidateInventory(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = asItems(purchases.data);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="mb-3 font-black">ثبت فاکتور خرید</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <Label>شماره فاکتور</Label>
            <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>نام تأمین‌کننده</Label>
            <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>وضعیت پرداخت</Label>
            <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as PurchasePaymentStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_STATUSES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>مالیات (تومان)</Label>
            <Input type="number" value={taxToman} onChange={(e) => setTaxToman(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>تخفیف کل (تومان)</Label>
            <Input type="number" value={discountToman} onChange={(e) => setDiscountToman(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2 lg:col-span-1">
            <Label>یادداشت</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">اقلام فاکتور</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setLines((prev) => [
                  ...prev,
                  { inventoryItemId: "", quantity: "1", unitPriceToman: "0", lineDiscountToman: "0" },
                ])
              }
            >
              افزودن ردیف
            </Button>
          </div>
          {lines.map((line, idx) => (
            <div key={idx} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-4">
              <Select
                value={line.inventoryItemId}
                onValueChange={(v) =>
                  setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, inventoryItemId: v } : l)))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="کالا" />
                </SelectTrigger>
                <SelectContent>
                  {(items.data ?? []).map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="تعداد"
                value={line.quantity}
                onChange={(e) =>
                  setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, quantity: e.target.value } : l)))
                }
              />
              <Input
                type="number"
                placeholder="قیمت واحد (تومان)"
                value={line.unitPriceToman}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((l, i) => (i === idx ? { ...l, unitPriceToman: e.target.value } : l)),
                  )
                }
              />
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="تخفیف ردیف (تومان)"
                  value={line.lineDiscountToman}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, i) => (i === idx ? { ...l, lineDiscountToman: e.target.value } : l)),
                    )
                  }
                />
                {lines.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    حذف
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={asDraft} onChange={(e) => setAsDraft(e.target.checked)} />
            ثبت به‌صورت پیش‌نویس
          </label>
          <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
            {asDraft ? "ذخیره پیش‌نویس" : "ثبت و ورود به انبار"}
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-x-auto p-4">
          <h2 className="mb-3 font-black">لیست خریدها</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-muted-foreground">
                <th className="p-2">شماره</th>
                <th>تأمین‌کننده</th>
                <th>مبلغ</th>
                <th>وضعیت</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className={`border-t ${selectedId === p.id ? "bg-muted/40" : ""}`}>
                  <td className="p-2">
                    <button type="button" className="font-bold hover:underline" onClick={() => setSelectedId(p.id)}>
                      {p.invoiceNumber}
                    </button>
                  </td>
                  <td>{p.supplierName}</td>
                  <td>{formatToman(p.grandTotalRials)}</td>
                  <td>
                    <Badge variant={p.status === "Approved" ? "success" : p.status === "Cancelled" ? "danger" : "warning"}>
                      {p.status}
                    </Badge>{" "}
                    <Badge variant="outline">{p.paymentStatus}</Badge>
                  </td>
                  <td className="space-x-1 space-x-reverse whitespace-nowrap p-2">
                    {p.status === "Draft" && (
                      <Button size="sm" onClick={() => approveMut.mutate(p.id)}>
                        تأیید
                      </Button>
                    )}
                    {p.status !== "Cancelled" && (
                      <Button size="sm" variant="destructive" onClick={() => cancelMut.mutate(p.id)}>
                        لغو
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 font-black">جزئیات فاکتور</h2>
          {!selectedId && <p className="text-sm text-muted-foreground">یک فاکتور را انتخاب کنید</p>}
          {detail.data && (
            <div className="space-y-2 text-sm">
              <div className="font-bold">{detail.data.invoiceNumber} — {detail.data.supplierName}</div>
              <div>مالیات: {formatToman(detail.data.taxRials)}</div>
              <div>تخفیف: {formatToman(detail.data.discountRials)}</div>
              <div>جمع: {formatToman(detail.data.grandTotalRials)}</div>
              <ul className="mt-2 space-y-1">
                {detail.data.items.map((it) => (
                  <li key={it.id} className="flex justify-between border-b py-1">
                    <span>
                      {it.itemName} × {it.quantity}
                    </span>
                    <span>{formatToman(it.lineTotalRials)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>
      ) : (
        <Field label="کالا">
          <Select value={id} onValueChange={setId}>
            <SelectTrigger>
              <SelectValue placeholder="انتخاب کالا" />
            </SelectTrigger>
            <SelectContent>
              {items.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="مقدار">
          <Input
            type="number"
            inputMode="numeric"
            placeholder={mode === "new" ? "موجودی اولیه" : "مقدار دریافت"}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </Field>
        <Field label="قیمت خرید واحد">
          <MoneyInput value={cost} onValueChange={setCost} />
        </Field>
      </div>

      <Button
        className="w-full sm:w-auto"
        loading={pending}
        disabled={!valid}
        onClick={submit}
      >
        ثبت در انبار
      </Button>
    </div>
  );
}

/* ───────────────────── ضایعات ───────────────────── */

type WasteLine = {
  inventoryItemId: string;
  quantityInBase: string;
  reason: WasteReason;
  notes: string;
};

function WasteTab() {
  const qc = useQueryClient();
  const items = useQuery({ queryKey: ["inventory"], queryFn: api.inventory });
  const wasteList = useQuery({
    queryKey: ["waste"],
    queryFn: () => api.listWaste({ page: 1, pageSize: 50 }),
  });
  const reports = useQuery({
    queryKey: ["waste-reports"],
    queryFn: () => api.wasteReports(),
  });

  const [batchNotes, setBatchNotes] = useState("");
  const [lines, setLines] = useState<WasteLine[]>([
    { inventoryItemId: "", quantityInBase: "", reason: "Spoilage", notes: "" },
  ]);

  const mut = useMutation({
    mutationFn: () =>
      api.recordWaste({
        notes: batchNotes || undefined,
        items: lines
          .filter((l) => l.inventoryItemId)
          .map((l) => ({
            inventoryItemId: l.inventoryItemId,
            quantityInBase: Number(l.quantityInBase),
            reason: l.reason,
            notes: l.notes || undefined,
          })),
      }),
    onSuccess: () => {
function WasteForm({ items }: { items: { id: string; name: string }[] }) {
  const waste = useRecordWaste();
  const [id, setId] = useState("");
  const [qty, setQty] = useState("");
  const [notes, setNotes] = useState("ضایعات / ریخت‌وپاش");

  async function submit() {
    if (!id || !qty) return;
    try {
      await waste.mutateAsync({ inventoryItemId: id, quantity: Number(qty), notes });
      toast.success("ضایعات ثبت شد");
      setLines([{ inventoryItemId: "", quantityInBase: "", reason: "Spoilage", notes: "" }]);
      setBatchNotes("");
      invalidateInventory(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });

      setQty("");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="mb-3 font-black">ثبت ضایعات</h2>
        <Textarea
          className="mb-3"
          placeholder="یادداشت کلی (اختیاری)"
          value={batchNotes}
          onChange={(e) => setBatchNotes(e.target.value)}
        />
        <div className="mb-2 flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setLines((prev) => [
                ...prev,
                { inventoryItemId: "", quantityInBase: "", reason: "Spoilage", notes: "" },
              ])
            }
          >
            افزودن ردیف
          </Button>
        </div>
        {lines.map((line, idx) => (
          <div key={idx} className="mb-3 grid gap-2 rounded-xl border p-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              value={line.inventoryItemId}
              onValueChange={(v) =>
                setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, inventoryItemId: v } : l)))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="کالا" />
              </SelectTrigger>
              <SelectContent>
                {(items.data ?? []).map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="مقدار (واحد پایه)"
              value={line.quantityInBase}
              onChange={(e) =>
                setLines((prev) =>
                  prev.map((l, i) => (i === idx ? { ...l, quantityInBase: e.target.value } : l)),
                )
              }
            />
            <Select
              value={line.reason}
              onValueChange={(v) =>
                setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, reason: v as WasteReason } : l)))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WASTE_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input
                placeholder="یادداشت ردیف"
                value={line.notes}
                onChange={(e) =>
                  setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, notes: e.target.value } : l)))
                }
              />
              {lines.length > 1 && (
                <Button size="sm" variant="ghost" onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}>
                  حذف
                </Button>
              )}
            </div>
          </div>
        ))}
        <Button variant="destructive" className="w-full" onClick={() => mut.mutate()} disabled={mut.isPending}>
          ثبت ضایعات
        </Button>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 font-black">لیست ضایعات</h2>
          <ul className="max-h-96 space-y-2 overflow-y-auto text-sm">
            {asItems(wasteList.data).map((w) => (
              <li key={w.id} className="border-b py-2">
                <div className="flex justify-between font-bold">
                  <span>{new Date(w.occurredAtUtc).toLocaleString("fa-IR")}</span>
                  <span>{formatToman(w.totalLossRials)}</span>
                </div>
                <div className="text-muted-foreground">{w.notes || "—"}</div>
                <div className="mt-1 text-xs">
                  {w.items?.map((it) => (
                    <span key={it.wasteItemId} className="ml-2">
                      {it.itemName} ({it.quantityInBase}) ·{" "}
                      {WASTE_REASONS.find((r) => r.value === it.reason)?.label ?? it.reason}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 font-black">گزارش ضایعات</h2>
          <ul className="max-h-96 space-y-1 overflow-y-auto text-sm">
            {(reports.data ?? []).map((r) => (
              <li key={`${r.wasteId}-${r.wasteItemId}`} className="flex justify-between border-b py-2">
                <span>
                  {r.itemName} · {WASTE_REASONS.find((x) => x.value === r.reason)?.label ?? r.reason} ·{" "}
                  {r.quantityInBase}
                </span>
                <span>{formatToman(r.lossRials)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* ───────────────────── انبارگردانی ───────────────────── */

function StockCountsTab() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState("");
  const [title, setTitle] = useState("");
  const [locationFilter, setLocationFilter] = useState<StorageLocation | "">("");
  const [notes, setNotes] = useState("");
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, string>>({});

  const list = useQuery({
    queryKey: ["stock-counts"],
    queryFn: () => api.listStockCounts({ page: 1, pageSize: 50 }),
  });
  const detail = useQuery({
    queryKey: ["stock-counts", selectedId],
    queryFn: () => api.getStockCount(selectedId),
    enabled: !!selectedId,
  });

  const startMut = useMutation({
    mutationFn: () =>
      api.startStockCount({
        title,
        locationFilter: locationFilter || null,
        notes: notes || undefined,
      }),
    onSuccess: (id) => {
      toast.success("انبارگردانی شروع شد");
      setTitle("");
      setNotes("");
      setLocationFilter("");
      if (typeof id === "string") setSelectedId(id);
      invalidateInventory(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitMut = useMutation({
    mutationFn: () => {
      if (!detail.data) throw new Error("جزئیات بارگذاری نشده");
      const counts = detail.data.items.map((it) => ({
        inventoryItemId: it.inventoryItemId,
        physicalCountQty: Number(
          physicalCounts[it.inventoryItemId] ?? it.physicalCountQty ?? it.systemSnapshotQty,
        ),
      }));
      return api.submitStockCounts(selectedId, counts);
    },
    onSuccess: () => {
      toast.success("شمارش ثبت شد");
      qc.invalidateQueries({ queryKey: ["stock-counts", selectedId] });
      invalidateInventory(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveMut = useMutation({
    mutationFn: () => api.approveStockCount(selectedId),
    onSuccess: () => {
      toast.success("انبارگردانی تأیید شد");
      invalidateInventory(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="mb-3 font-black">شروع انبارگردانی</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>عنوان</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً شمارش ماهانه" />
          </div>
          <div className="space-y-1">
            <Label>فیلتر محل (اختیاری)</Label>
            <Select
              value={locationFilter || "__all__"}
              onValueChange={(v) => setLocationFilter(v === "__all__" ? "" : (v as StorageLocation))}
            >
              <SelectTrigger>
                <SelectValue placeholder="همه محل‌ها" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">همه محل‌ها</SelectItem>
                {STORAGE_LOCATIONS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>یادداشت</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <Button className="mt-3" onClick={() => startMut.mutate()} disabled={!title || startMut.isPending}>
          شروع
        </Button>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-x-auto p-4">
          <h2 className="mb-3 font-black">لیست انبارگردانی‌ها</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-muted-foreground">
                <th className="p-2">عنوان</th>
                <th>وضعیت</th>
                <th>شروع</th>
              </tr>
            </thead>
            <tbody>
              {asItems(list.data).map((s) => (
                <tr
                  key={s.id}
                  className={`cursor-pointer border-t ${selectedId === s.id ? "bg-muted/40" : ""}`}
                  onClick={() => {
                    setSelectedId(s.id);
                    setPhysicalCounts({});
                  }}
                >
                  <td className="p-2 font-bold">{s.title}</td>
                  <td>
                    <Badge>{s.status}</Badge>
                  </td>
                  <td>{new Date(s.startedAtUtc).toLocaleString("fa-IR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 font-black">جزئیات و شمارش فیزیکی</h2>
          {!selectedId && <p className="text-sm text-muted-foreground">یک انبارگردانی را انتخاب کنید</p>}
          {detail.data && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{detail.data.title}</span>
                <Badge>{detail.data.status}</Badge>
                {detail.data.locationFilter && (
                  <Badge variant="outline">{locationLabel(detail.data.locationFilter)}</Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  واریانس: {formatToman(detail.data.totalCostVarianceRials)}
                </span>
              </div>
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {detail.data.items.map((it) => (
                  <div key={it.id} className="grid grid-cols-3 gap-2 rounded-lg border p-2 text-sm">
                    <div>
                      <div className="font-bold">{it.itemName}</div>
                      <div className="text-muted-foreground">سیستم: {it.systemSnapshotQty}</div>
                    </div>
                    <Input
                      type="number"
                      placeholder="شمارش فیزیکی"
                      value={
                        physicalCounts[it.inventoryItemId] ??
                        (it.physicalCountQty != null ? String(it.physicalCountQty) : "")
                      }
                      onChange={(e) =>
                        setPhysicalCounts((prev) => ({ ...prev, [it.inventoryItemId]: e.target.value }))
                      }
                      disabled={detail.data.status === "Approved"}
                    />
                    <div className="text-muted-foreground">
                      اختلاف: {it.discrepancyQty} · {formatToman(it.costVarianceRials)}
                    </div>
                  </div>
                ))}
              </div>
              {detail.data.status !== "Approved" && (
                <div className="flex gap-2">
                  <Button onClick={() => submitMut.mutate()} disabled={submitMut.isPending}>
                    ثبت شمارش
                  </Button>
                  <Button variant="outline" onClick={() => approveMut.mutate()} disabled={approveMut.isPending}>
                    تأیید نهایی
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ───────────────────── انتقال ───────────────────── */

function TransfersTab() {
  const qc = useQueryClient();
  const items = useQuery({ queryKey: ["inventory"], queryFn: api.inventory });
  const transfers = useQuery({
    queryKey: ["transfers"],
    queryFn: () => api.listTransfers({ page: 1, pageSize: 50 }),
  });

  const [inventoryItemId, setInventoryItemId] = useState("");
  const [fromLocation, setFromLocation] = useState<StorageLocation>("CentralStorage");
  const [toLocation, setToLocation] = useState<StorageLocation>("KitchenLine");
  const [quantityInBase, setQuantityInBase] = useState("");
  const [notes, setNotes] = useState("");

  const createMut = useMutation({
    mutationFn: () =>
      api.createTransfer({
        inventoryItemId,
        fromLocation,
        toLocation,
        quantityInBase: Number(quantityInBase),
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success("درخواست انتقال ثبت شد");
      setQuantityInBase("");
      setNotes("");
      invalidateInventory(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const completeMut = useMutation({
    mutationFn: (id: string) => api.completeTransfer(id),
    onSuccess: () => {
      toast.success("انتقال تکمیل شد");
      invalidateInventory(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => api.cancelTransfer(id),
    onSuccess: () => {
      toast.success("انتقال لغو شد");
      invalidateInventory(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="mb-3 font-black">ایجاد انتقال بین محل‌ها</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1 sm:col-span-2 lg:col-span-1">
            <Label>کالا</Label>
            <Select value={inventoryItemId} onValueChange={setInventoryItemId}>
              <SelectTrigger>
                <SelectValue placeholder="انتخاب کالا" />
              </SelectTrigger>
              <SelectContent>
                {(items.data ?? []).map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>از محل</Label>
            <Select value={fromLocation} onValueChange={(v) => setFromLocation(v as StorageLocation)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STORAGE_LOCATIONS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>به محل</Label>
            <Select value={toLocation} onValueChange={(v) => setToLocation(v as StorageLocation)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STORAGE_LOCATIONS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>مقدار (واحد پایه)</Label>
            <Input type="number" value={quantityInBase} onChange={(e) => setQuantityInBase(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>یادداشت</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <Button
          className="mt-3"
          onClick={() => createMut.mutate()}
          disabled={!inventoryItemId || !quantityInBase || createMut.isPending}
        >
          ثبت انتقال
        </Button>
      </Card>

      <Card className="overflow-x-auto p-4">
        <h2 className="mb-3 font-black">لیست انتقال‌ها</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-right text-muted-foreground">
              <th className="p-2">کالا</th>
              <th>از</th>
              <th>به</th>
              <th>مقدار</th>
              <th>وضعیت</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {asItems(transfers.data).map((t) => (
              <tr key={t.id} className="border-t">
                <td className="p-2 font-bold">{t.itemName ?? t.inventoryItemId}</td>
                <td>{locationLabel(t.fromLocation)}</td>
                <td>{locationLabel(t.toLocation)}</td>
                <td>{t.quantityInBase}</td>
                <td>
                  <Badge
                    variant={
                      t.status === "Transferred" ? "success" : t.status === "Cancelled" ? "danger" : "warning"
                    }
                  >
                    {t.status}
                  </Badge>
                </td>
                <td className="space-x-1 space-x-reverse whitespace-nowrap p-2">
                  {t.status === "Requested" && (
                    <>
                      <Button size="sm" onClick={() => completeMut.mutate(t.id)}>
                        تکمیل
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => cancelMut.mutate(t.id)}>
                        لغو
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ───────────────────── تأمین‌کنندگان ───────────────────── */

function SuppliersTab() {
  const qc = useQueryClient();
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");

  const list = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api.listSuppliers({ page: 1, pageSize: 100 }),
  });
  const detail = useQuery({
    queryKey: ["suppliers", selectedId],
    queryFn: () => api.getSupplier(selectedId),
    enabled: !!selectedId,
  });

  const suppliers = asItems(list.data);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [address, setAddress] = useState("");
  const [isActive, setIsActive] = useState(true);

  const resetForm = () => {
    setName("");
    setPhone("");
    setContactPerson("");
    setAddress("");
    setIsActive(true);
    setEditId(null);
  };

  const loadEdit = (id: string) => {
    const s = suppliers.find((x) => x.id === id);
    if (!s) return;
    setEditId(id);
    setSelectedId(id);
    setName(s.name);
    setPhone(s.phone ?? "");
    setContactPerson(s.contactPerson ?? "");
    setAddress(s.address ?? "");
    setIsActive(s.isActive);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        phone: phone || null,
        contactPerson: contactPerson || null,
        address: address || null,
        isActive,
      };
      if (editId) return api.updateSupplier(editId, payload);
      return api.createSupplier(payload);
    },
    onSuccess: () => {
      toast.success(editId ? "تأمین‌کننده به‌روز شد" : "تأمین‌کننده ثبت شد");
      resetForm();
      invalidateInventory(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteSupplier(id),
    onSuccess: () => {
      toast.success("تأمین‌کننده حذف شد");
      if (selectedId === editId) setSelectedId("");
      resetForm();
      invalidateInventory(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="mb-3 font-black">{editId ? "ویرایش تأمین‌کننده" : "تأمین‌کننده جدید"}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>نام</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>تلفن</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>شخص تماس</Label>
            <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>آدرس</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            فعال
          </label>
        </div>
        <div className="mt-3 flex gap-2">
          <Button onClick={() => saveMut.mutate()} disabled={!name || saveMut.isPending}>
            {editId ? "ذخیره" : "ثبت"}
          </Button>
          {editId && (
            <Button variant="outline" onClick={resetForm}>
              انصراف
            </Button>
          )}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-x-auto p-4">
          <h2 className="mb-3 font-black">لیست تأمین‌کنندگان</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-muted-foreground">
                <th className="p-2">نام</th>
                <th>تلفن</th>
                <th>مانده</th>
                <th>وضعیت</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className={`border-t ${selectedId === s.id ? "bg-muted/40" : ""}`}>
                  <td className="p-2">
                    <button
                      type="button"
                      className="font-bold hover:underline"
                      onClick={() => setSelectedId(s.id)}
                    >
                      {s.name}
                    </button>
                  </td>
                  <td>{s.phone || "—"}</td>
                  <td>{formatToman(s.currentBalanceRials)}</td>
                  <td>{s.isActive ? <Badge variant="success">فعال</Badge> : <Badge variant="outline">غیرفعال</Badge>}</td>
                  <td className="space-x-1 space-x-reverse whitespace-nowrap p-2">
                    <Button size="sm" variant="outline" onClick={() => loadEdit(s.id)}>
                      ویرایش
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteMut.mutate(s.id)}>
                      حذف
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 font-black">جزئیات تأمین‌کننده</h2>
          {!selectedId && <p className="text-sm text-muted-foreground">یک تأمین‌کننده را انتخاب کنید</p>}
          {detail.data && (
            <div className="space-y-1 text-sm">
              <div className="text-lg font-black">{detail.data.name}</div>
              <div>تلفن: {detail.data.phone || "—"}</div>
              <div>شخص تماس: {detail.data.contactPerson || "—"}</div>
              <div>آدرس: {detail.data.address || "—"}</div>
              <div>مانده حساب: {formatToman(detail.data.currentBalanceRials)}</div>
              <div>{detail.data.isActive ? "فعال" : "غیرفعال"}</div>
            </div>
          )}
        </Card>
      </div>
    <div className="space-y-4">
      <Field label="کالا">
        <Select value={id} onValueChange={setId}>
          <SelectTrigger>
            <SelectValue placeholder="انتخاب کالا" />
          </SelectTrigger>
          <SelectContent>
            {items.map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="مقدار خروج">
          <Input type="number" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field label="توضیح">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      <Button
        variant="destructive"
        className="w-full sm:w-auto"
        loading={waste.isPending}
        disabled={!id || !qty}
        onClick={submit}
      >
        ثبت خروج ضایعات
      </Button>
    </div>
  );
}
