"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge, Textarea } from "@/components/ui/input";
import { formatToman } from "@/lib/currency";
import type { MenuItemDto, ModifierDto } from "@/lib/types";

export function ModifierDrawer({
  item,
  catalog,
  onClose,
  onConfirm,
}: {
  item: MenuItemDto | null;
  catalog: MenuItemDto[];
  onClose: () => void;
  onConfirm: (item: MenuItemDto, qty: number, modifiers: ModifierDto[], notes: string) => void;
}) {
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const open = Boolean(item);
  const mods = item?.modifiers.filter((m) => m.isActive) ?? [];
  const pickedMods = mods.filter((m) => selected[m.id]);
  const extras = pickedMods.reduce((s, m) => s + m.extraPrice, 0) * qty;
  const suggested = useMemo(
    () => (item ? catalog.filter((x) => x.categoryId === item.categoryId && x.id !== item.id).slice(0, 4) : []),
    [catalog, item],
  );

  function resetAndClose() {
    setQty(1);
    setNotes("");
    setSelected({});
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && resetAndClose()}>
      <DialogContent wide>
        {item ? (
          <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
            <div>
              <DialogTitle>{item.title}</DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              <p className="mt-2 font-black text-primary">{formatToman(item.basePrice)}</p>
              <div className="mt-4 flex items-center gap-3">
                <Button variant="outline" size="lg" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                  −
                </Button>
                <span className="min-w-10 text-center text-2xl font-black">{qty}</span>
                <Button variant="outline" size="lg" onClick={() => setQty((q) => q + 1)}>
                  +
                </Button>
              </div>
              <h3 className="mt-6 mb-2 font-bold">افزودنی‌ها</h3>
              <div className="grid grid-cols-2 gap-2">
                {mods.map((m) => {
                  const on = selected[m.id];
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelected((s) => ({ ...s, [m.id]: !s[m.id] }))}
                      className={`rounded-2xl border p-3 text-right ${on ? "border-primary bg-primary/10" : "bg-muted/40"}`}
                    >
                      <div className="font-bold">{m.name}</div>
                      <div className="text-xs">{formatToman(m.extraPrice)}</div>
                    </button>
                  );
                })}
                {mods.length === 0 ? <p className="text-sm text-muted-foreground">افزودنی تعریف نشده</p> : null}
              </div>
              <Textarea className="mt-4" placeholder="یادداشت آماده‌سازی (بدون شکر، یخ کم...)" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <div className="mt-4 flex items-center justify-between">
                <span className="text-lg font-black">{formatToman(item.basePrice * qty + extras)}</span>
                <Button
                  size="lg"
                  onClick={() => {
                    onConfirm(item, qty, pickedMods, notes);
                    setQty(1);
                    setNotes("");
                    setSelected({});
                  }}
                >
                  افزودن به سبد
                </Button>
              </div>
            </div>
            <div>
              <h3 className="mb-2 font-bold">پیشنهاد همین دسته</h3>
              <div className="space-y-2">
                {suggested.map((s) => (
                  <button
                    key={s.id}
                    className="flex w-full items-center justify-between rounded-2xl border bg-card p-3 text-right"
                    onClick={() => {
                      setQty(1);
                      setNotes("");
                      setSelected({});
                      onConfirm(s, 1, [], "");
                    }}
                  >
                    <span className="font-semibold">{s.title}</span>
                    <Badge>{formatToman(s.basePrice)}</Badge>
                  </button>
                ))}
                {suggested.length === 0 ? <p className="text-sm text-muted-foreground">مورد دیگری در این دسته نیست.</p> : null}
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
