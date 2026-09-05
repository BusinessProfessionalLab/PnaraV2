"use client";

import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/api/errors";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { InventoryItemDto, MenuItemDto, RecipeLineDto, UnitOfMeasure } from "@/lib/types";
import { useUpsertRecipe } from "@/queries/menu";

const unitLabels: Record<UnitOfMeasure, string> = {
  Gr: "گرم",
  Kg: "کیلوگرم",
  Ml: "میلی‌لیتر",
  Liter: "لیتر",
  Count: "عدد",
};

type IngredientRow = {
  key: string;
  inventoryItemId: string;
  quantity: string;
  unit: UnitOfMeasure;
};

export function RecipeEditor({
  item,
  inventory,
  onLinesChange,
}: {
  item: MenuItemDto | null;
  inventory: InventoryItemDto[];
  onLinesChange?: (lines: RecipeLineDto[]) => void;
}) {
  const saveRecipe = useUpsertRecipe();
  const [rows, setRows] = useState<IngredientRow[]>(() =>
    (item?.recipe?.lines ?? []).map((line, index) => ({
      ...line,
      key: String(index),
      quantity: String(line.quantity),
    })),
  );
  const [dirty, setDirty] = useState(false);
  const valid = rows.every((row) => row.inventoryItemId && Number.isFinite(Number(row.quantity)) && Number(row.quantity) > 0)
    && new Set(rows.map((row) => row.inventoryItemId)).size === rows.length;
  const available = inventory.filter((ingredient) => !rows.some((row) => row.inventoryItemId === ingredient.id));

  useEffect(() => {
    onLinesChange?.(rows
      .filter((row) => row.inventoryItemId)
      .map(({ inventoryItemId, quantity, unit }) => ({
        inventoryItemId,
        quantity: Number(quantity),
        unit,
      })));
  }, [rows, onLinesChange]);

  function changeRow(key: string, patch: Partial<IngredientRow>) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row));
    setDirty(true);
  }

  async function save() {
    if (!item || !valid || !dirty || saveRecipe.isPending) return;
    try {
      await saveRecipe.mutateAsync({
        menuItemId: item.id,
        menuItemModifierId: null,
        addonId: null,
        name: item.recipe?.name ?? `BOM ${item.title}`,
        lines: rows.map(({ inventoryItemId, quantity, unit }) => ({ inventoryItemId, quantity: Number(quantity), unit })),
      });
      setDirty(false);
      toast.success("مواد اولیه محصول ذخیره شد");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-3.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">مواد اولیه و رسپی محصول</h3>
        <span className="text-xs text-muted-foreground">{rows.filter((row) => row.inventoryItemId).length} ماده اولیه</span>
      </div>
      <p className="text-xs text-muted-foreground">چند ماده اولیه اضافه کنید و مقدار مصرف هرکدام را برای یک عدد از این محصول مشخص کنید.</p>
      {inventory.length === 0 && <p className="text-xs text-muted-foreground">ابتدا مواد اولیه را در بخش انبار ثبت کنید.</p>}
      {rows.length === 0 && <p className="text-xs text-muted-foreground">هنوز ماده اولیه‌ای به این محصول متصل نشده است.</p>}
      <fieldset disabled={saveRecipe.isPending} className="min-w-0 space-y-3">
        {rows.map((row, index) => {
          const ingredient = inventory.find((entry) => entry.id === row.inventoryItemId);
          const invalidQuantity = !Number.isFinite(Number(row.quantity)) || Number(row.quantity) <= 0;
          return (
            <div key={row.key} className="grid items-start gap-2 rounded-lg border border-border p-3 sm:grid-cols-[minmax(0,1fr)_8rem_7rem_auto]">
              <Field label="ماده اولیه">
                <Select value={row.inventoryItemId} onValueChange={(id) => changeRow(row.key, {
                  inventoryItemId: id,
                  unit: inventory.find((entry) => entry.id === id)?.unitOfMeasure ?? row.unit,
                })}>
                  <SelectTrigger aria-label={`ماده اولیه ${index + 1}`}><SelectValue placeholder="انتخاب از انبار…" /></SelectTrigger>
                  <SelectContent>
                    {row.inventoryItemId && !ingredient && <SelectItem value={row.inventoryItemId}>ماده اولیه ثبت‌شده ({row.inventoryItemId})</SelectItem>}
                    {inventory.filter((entry) => entry.id === row.inventoryItemId || !rows.some((other) => other.inventoryItemId === entry.id)).map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>{entry.name} ({entry.sku})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="مقدار مصرف" error={invalidQuantity ? "مقدار باید بیشتر از صفر باشد" : undefined}>
                <Input type="number" inputMode="decimal" step="any" min="0" required value={row.quantity}
                  className="tabular-nums" aria-label={`مقدار مصرف ماده اولیه ${index + 1}`} aria-invalid={invalidQuantity}
                  onChange={(event) => changeRow(row.key, { quantity: event.target.value })} />
              </Field>
              <Field label="واحد">
                <Select value={row.unit} onValueChange={(unit) => changeRow(row.key, { unit: unit as UnitOfMeasure })}>
                  <SelectTrigger aria-label={`واحد ماده اولیه ${index + 1}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(unitLabels) as [UnitOfMeasure, string][]).map(([unit, label]) => <SelectItem key={unit} value={unit}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Button type="button" variant="ghost" size="icon" className="text-danger sm:mt-6"
                aria-label={`حذف ${ingredient?.name ?? `ماده اولیه ${index + 1}`}`}
                onClick={() => { setRows((current) => current.filter((entry) => entry.key !== row.key)); setDirty(true); }}>
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          );
        })}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={available.length === 0 || rows.some((row) => !row.inventoryItemId)}
            onClick={() => {
              setRows((current) => [...current, { key: crypto.randomUUID(), inventoryItemId: "", quantity: "1", unit: "Gr" }]);
              setDirty(true);
            }}>
            <Plus className="size-4" aria-hidden />افزودن ماده اولیه
          </Button>
          {item ? (
            <Button type="button" loading={saveRecipe.isPending} disabled={!valid || !dirty} onClick={() => void save()}>
              <Save className="size-4" aria-hidden />ذخیره مواد اولیه
            </Button>
          ) : null}
        </div>
      </fieldset>
      {dirty && <p className="text-xs text-muted-foreground">برای ثبت افزودن، ویرایش یا حذف مواد اولیه، «ذخیره مواد اولیه» را بزنید.</p>}
    </div>
  );
}
