"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowDownToLine, ArrowUpRight, Boxes, PackagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { errorMessage } from "@/api/errors";
import { cn } from "@/lib/cn";
import type { UnitOfMeasure } from "@/lib/types";

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
  const items = useInventory();
  const alerts = useStockAlerts();
  const txs = useInventoryTransactions();

  return (
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
                      {i.currentStock}{" "}
                      <span className="text-xs text-muted-foreground">{UNIT_LABEL[i.unitOfMeasure] ?? i.unitOfMeasure}</span>
                    </TableCell>
                    <TableCell className="hidden tabular-nums text-muted-foreground md:table-cell">{i.reorderPoint}</TableCell>
                    <TableCell className="hidden tabular-nums md:table-cell">{formatToman(i.costPrice)}</TableCell>
                    <TableCell>
                      {i.isLowStock ? (
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

function ModePill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
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
    <div className="space-y-4">
      <div className="flex w-fit gap-1 rounded-xl bg-muted p-1">
        <ModePill active={mode === "buy"} onClick={() => setMode("buy")}>
          فاکتور خرید
        </ModePill>
        <ModePill active={mode === "new"} onClick={() => setMode("new")}>
          کالای جدید
        </ModePill>
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
        <Field label="قیمت خرید واحد (تومان)">
          <MoneyInput value={cost} onValueChange={setCost} className="text-end" />
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
      setQty("");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
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
