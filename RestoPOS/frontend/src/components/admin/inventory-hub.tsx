"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { formatToman } from "@/lib/currency";
import type { UnitOfMeasure } from "@/lib/types";

export function InventoryHub() {
  const qc = useQueryClient();
  const items = useQuery({ queryKey: ["inventory"], queryFn: api.inventory });
  const alerts = useQuery({ queryKey: ["stock-alerts"], queryFn: api.stockAlerts });
  const txs = useQuery({ queryKey: ["inventory-tx"], queryFn: () => api.inventoryTx() });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {(alerts.data ?? []).map((a) => (
          <Card key={a.inventoryItemId} className="border-amber-300 bg-amber-50 p-4">
            <div className="font-black">{a.name}</div>
            <div className="text-sm">نقطه سفارش مجدد: {a.reorderPoint}</div>
            <div className="text-sm">موجودی فعلی: {a.currentStock}</div>
            <Badge variant="warning">کسری {a.deficit}</Badge>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 font-black">ثبت کالای جدید / فاکتور خرید</h2>
          <InboundForm
            items={items.data ?? []}
            onDone={() => {
              qc.invalidateQueries({ queryKey: ["inventory"] });
              qc.invalidateQueries({ queryKey: ["inventory-tx"] });
              qc.invalidateQueries({ queryKey: ["stock-alerts"] });
            }}
          />
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 font-black">ثبت ضایعات</h2>
          <WasteForm
            items={items.data ?? []}
            onDone={() => {
              qc.invalidateQueries({ queryKey: ["inventory"] });
              qc.invalidateQueries({ queryKey: ["inventory-tx"] });
            }}
          />
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
              <th>نقطه سفارش</th>
              <th>قیمت خرید</th>
              <th>وضعیت</th>
            </tr>
          </thead>
          <tbody>
            {(items.data ?? []).map((i) => (
              <tr key={i.id} className="border-t">
                <td className="p-2 font-bold">{i.name}</td>
                <td>{i.sku}</td>
                <td>{i.currentStock} {i.unitOfMeasure}</td>
                <td>{i.reorderPoint}</td>
                <td>{formatToman(i.costPrice)}</td>
                <td>{i.isLowStock ? <Badge variant="danger">هشدار</Badge> : <Badge variant="success">سالم</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card className="p-4">
        <h2 className="mb-3 font-black">گردش انبار</h2>
        <ul className="space-y-1 text-sm">
          {(txs.data ?? []).slice(0, 20).map((t) => (
            <li key={t.id} className="flex justify-between border-b py-2">
              <span>
                {t.itemName} · {t.type} · {t.quantity}
              </span>
              <span className="text-muted-foreground">{t.notes}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function InboundForm({
  items,
  onDone,
}: {
  items: { id: string; name: string }[];
  onDone: () => void;
}) {
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
      if (mode === "new") {
        return api.createInventoryItem({
          name,
          sku,
          unitOfMeasure: unit,
          reorderPoint: Number(reorder),
          safetyStock: Number(reorder) / 2,
          openingStock: Number(qty),
          costPrice: Number(cost) * 10,
        });
      }
      return api.receiveStock({
        inventoryItemId: id,
        quantity: Number(qty),
        unitCost: Number(cost) * 10,
        notes: "فاکتور خرید",
        batchReference: `PO-${Date.now()}`,
      });
    },
    onSuccess: () => {
      toast.success("انبار به‌روز شد");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button size="sm" variant={mode === "buy" ? "default" : "outline"} onClick={() => setMode("buy")}>
          فاکتور خرید
        </Button>
        <Button size="sm" variant={mode === "new" ? "default" : "outline"} onClick={() => setMode("new")}>
          کالای جدید
        </Button>
      </div>
      {mode === "new" ? (
        <>
          <Input placeholder="نام" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} />
          <Select value={unit} onValueChange={(v) => setUnit(v as UnitOfMeasure)}>
            <SelectTrigger>
              <SelectValue placeholder="واحد" />
            </SelectTrigger>
            <SelectContent>
              {["Gr", "Ml", "Kg", "Liter", "Count"].map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="نقطه سفارش مجدد" value={reorder} onChange={(e) => setReorder(e.target.value)} />
        </>
      ) : (
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
      )}
      <Input placeholder="مقدار" value={qty} onChange={(e) => setQty(e.target.value)} />
      <Input placeholder="قیمت خرید واحد (تومان)" value={cost} onChange={(e) => setCost(e.target.value)} />
      <Button className="w-full" onClick={() => mut.mutate()}>
        ثبت
      </Button>
    </div>
  );
}

function WasteForm({ items, onDone }: { items: { id: string; name: string }[]; onDone: () => void }) {
  const [id, setId] = useState("");
  const [qty, setQty] = useState("");
  const [notes, setNotes] = useState("ضایعات / ریخت‌وپاش");
  const mut = useMutation({
    mutationFn: () => api.recordWaste({ inventoryItemId: id, quantity: Number(qty), notes }),
    onSuccess: () => {
      toast.success("ضایعات ثبت شد");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-2">
      <Select value={id} onValueChange={setId}>
        <SelectTrigger>
          <SelectValue placeholder="کالا" />
        </SelectTrigger>
        <SelectContent>
          {items.map((i) => (
            <SelectItem key={i.id} value={i.id}>
              {i.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input placeholder="مقدار" value={qty} onChange={(e) => setQty(e.target.value)} />
      <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      <Button variant="destructive" className="w-full" onClick={() => mut.mutate()}>
        ثبت خروج ضایعات
      </Button>
    </div>
  );
}
