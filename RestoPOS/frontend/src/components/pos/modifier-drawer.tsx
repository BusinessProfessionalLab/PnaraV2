"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { formatToman } from "@/lib/currency";
import type { MenuItemDto, ModifierDto } from "@/lib/types";

export function ModifierDrawer({
  item,
  onClose,
  onConfirm,
  initialQuantity = 1,
  initialNotes = "",
  initialModifiers = [],
}: {
  item: MenuItemDto | null;
  onClose: () => void;
  onConfirm: (item: MenuItemDto, qty: number, modifiers: ModifierDto[], notes: string) => void;
  initialQuantity?: number;
  initialNotes?: string;
  initialModifiers?: { id: string; quantity: number }[];
}) {
  const [qty, setQty] = useState(initialQuantity);
  const [notes, setNotes] = useState(initialNotes);
  const [selected, setSelected] = useState<Record<string, number>>(() =>
    Object.fromEntries(initialModifiers.map((modifier) => [modifier.id, modifier.quantity])),
  );

  const open = Boolean(item);
  const mods = item?.modifiers.filter((m) => m.isActive) ?? [];
  const pickedMods = mods.filter((m) => (selected[m.id] ?? 0) > 0);
  const extras = pickedMods.reduce((s, m) => s + m.extraPrice * (selected[m.id] ?? 0), 0) * qty;

  function resetAndClose() {
    setQty(initialQuantity);
    setNotes(initialNotes);
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
                      onClick={() => setSelected((s) => ({ ...s, [m.id]: on ? 0 : 1 }))}
                      className={`rounded-2xl border p-3 text-right ${on ? "border-primary bg-primary/10" : "bg-muted/40"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold">{m.name}</span>
                        {on ? (
                          <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button type="button" className="rounded border px-2" onClick={() => setSelected((s) => ({ ...s, [m.id]: Math.max(0, on - 1) }))}>−</button>
                            <span className="min-w-5 text-center">{on}</span>
                            <button type="button" className="rounded border px-2" onClick={() => setSelected((s) => ({ ...s, [m.id]: on + 1 }))}>+</button>
                          </span>
                        ) : null}
                      </div>
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
                    onConfirm(item, qty, pickedMods.map((m) => ({ ...m, extraPrice: m.extraPrice, quantity: selected[m.id] ?? 1 } as ModifierDto)), notes);
                    setQty(initialQuantity);
                    setNotes(initialNotes);
                    setSelected({});
                  }}
                >
                  افزودن به سبد
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
