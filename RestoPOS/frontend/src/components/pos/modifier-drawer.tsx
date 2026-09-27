"use client";

import { useState } from "react";
import { Minus, Plus, ShoppingBasket } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatToman } from "@/lib/currency";
import { cn } from "@/lib/cn";
import type { CartModifierInput } from "@/lib/cart-store";
import type { MenuItemDto, ModifierDto, ModifierGroupDto } from "@/lib/types";

/** One selectable add-on row: a shared group option or a plain modifier. */
type OptionRow = ModifierDto & { groupId: string | null };

function optionsOf(group: ModifierGroupDto): OptionRow[] {
  return (group.options ?? [])
    .filter((option) => option.isActive)
    .map((option) => ({ ...option, groupId: group.id }));
}

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
  onConfirm: (
    item: MenuItemDto,
    qty: number,
    modifiers: CartModifierInput[],
    notes: string,
  ) => void;
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
  const groups = (item?.modifierGroups ?? [])
    .filter((group) => group.isActive)
    .slice()
    .sort((a, b) => a.displayPriority - b.displayPriority);
  const ungrouped: OptionRow[] = (item?.modifiers ?? [])
    .filter((modifier) => modifier.isActive && !modifier.modifierGroupId)
    .map((modifier) => ({ ...modifier, groupId: null }));
  const mods = [...groups.flatMap(optionsOf), ...ungrouped];
  const pickedMods = mods.filter((m) => (selected[m.id] ?? 0) > 0);
  const extras = pickedMods.reduce((s, m) => s + m.extraPrice * (selected[m.id] ?? 0), 0) * qty;

  /** Required groups that still miss their minimum number of selections. */
  const missingRequired = groups.filter((group) => {
    if (!group.isRequired) return false;
    const count = optionsOf(group).reduce((sum, option) => sum + (selected[option.id] ?? 0), 0);
    return count < Math.max(1, group.minSelections);
  });

  function resetAndClose() {
    setQty(initialQuantity);
    setNotes(initialNotes);
    setSelected({});
    onClose();
  }

  function toggle(modifierId: string, on: number | undefined) {
    setSelected((s) => ({ ...s, [modifierId]: on ? 0 : 1 }));
  }
  function bump(modifierId: string, delta: number) {
    setSelected((s) => ({ ...s, [modifierId]: Math.max(0, (s[modifierId] ?? 0) + delta) }));
  }

  function optionCard(m: OptionRow) {
    const count = selected[m.id] ?? 0;
    const on = count > 0;
    return (
      <div
        key={m.id}
        onClick={() => toggle(m.id, count)}
        className={cn(
          "flex cursor-pointer items-center justify-between gap-2 rounded-xl border p-3 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          on ? "border-primary/35 bg-primary-soft" : "border-border bg-card hover:border-border-strong",
        )}
      >
        <div className="min-w-0">
          <div className="truncate text-[13px] font-bold">{m.name}</div>
          <div className="text-[11px] text-muted-foreground">{formatToman(m.extraPrice)}</div>
        </div>
        {on ? (
          <span className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              aria-label={`کاهش ${m.name}`}
              className="flex size-6 items-center justify-center rounded-full bg-card text-foreground shadow-xs outline-none transition-colors hover:bg-muted"
              onClick={() => bump(m.id, -1)}
            >
              <Minus className="size-3" aria-hidden />
            </button>
            <span className="min-w-5 text-center text-sm font-bold tabular-nums">{count}</span>
            <button
              type="button"
              aria-label={`افزایش ${m.name}`}
              className="flex size-6 items-center justify-center rounded-full bg-primary-fill text-white shadow-xs outline-none transition-colors hover:bg-primary-fill-hover"
              onClick={() => bump(m.id, 1)}
            >
              <Plus className="size-3" aria-hidden />
            </button>
          </span>
        ) : (
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground">
            <Plus className="size-3" aria-hidden />
          </span>
        )}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && resetAndClose()}>
      <DialogContent className="sm:w-[min(94vw,42rem)] p-0">
        {item ? (
          <>
            <DialogHeader>
              <DialogTitle>{item.title}</DialogTitle>
              {item.description ? (
                <DialogDescription>{item.description}</DialogDescription>
              ) : null}
              <div className="mt-2 flex items-center gap-2">
                <span className="text-lg font-black text-primary tabular-nums">
                  {formatToman(item.basePrice)}
                </span>
                {item.basePrice * qty + extras !== item.basePrice ? (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {qty > 1 ? `${qty} عدد · ` : ""}
                    {extras > 0 ? `افزودنی ${formatToman(extras)}` : ""}
                  </span>
                ) : null}
              </div>
            </DialogHeader>

            <DialogBody className="space-y-5 py-5">
              {/* Quantity */}
              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 p-3">
                <span className="text-sm font-semibold">تعداد</span>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="size-9 rounded-full"
                    aria-label="کاهش تعداد"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                  >
                    <Minus className="size-4" aria-hidden />
                  </Button>
                  <span className="min-w-8 text-center text-xl font-black tabular-nums">{qty}</span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="size-9 rounded-full"
                    aria-label="افزایش تعداد"
                    onClick={() => setQty((q) => q + 1)}
                  >
                    <Plus className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>

              {/* Add-ons, grouped the way the backend models them */}
              {mods.length === 0 ? (
                <div>
                  <h3 className="mb-2 text-sm font-bold">افزودنی‌ها</h3>
                  <p className="rounded-xl border border-dashed border-border bg-background/60 p-4 text-center text-[13px] text-muted-foreground">
                    برای این آیتم افزودنی تعریف نشده است
                  </p>
                </div>
              ) : (
                <>
                  {groups.map((group) => {
                    const options = optionsOf(group);
                    if (options.length === 0) return null;
                    return (
                      <div key={group.id}>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold">{group.name}</h3>
                          {group.isRequired ? <Badge variant="warning">الزامی</Badge> : null}
                          {group.maxSelections > 1 ? (
                            <span className="text-[11px] text-muted-foreground">
                              حداقل {group.minSelections} · حداکثر {group.maxSelections} انتخاب
                            </span>
                          ) : null}
                        </div>
                        <div className="grid grid-cols-2 gap-2">{options.map(optionCard)}</div>
                      </div>
                    );
                  })}
                  {ungrouped.length > 0 ? (
                    <div>
                      <h3 className="mb-2 text-sm font-bold">افزودنی‌ها</h3>
                      <div className="grid grid-cols-2 gap-2">{ungrouped.map(optionCard)}</div>
                    </div>
                  ) : null}
                </>
              )}

              <Field label="یادداشت آماده‌سازی" hint="مثلاً بدون شکر، یخ کم…">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="یادداشت برای بار / آشپزخانه"
                  className="min-h-20"
                />
              </Field>

              {missingRequired.length > 0 ? (
                <p className="rounded-xl border border-warning/25 bg-warning/10 p-3 text-[13px] font-medium text-warning">
                  انتخاب گزینه‌های الزامی را کامل کنید:{" "}
                  {missingRequired.map((group) => group.name).join("، ")}
                </p>
              ) : null}
            </DialogBody>

            <DialogFooter className="items-center justify-between sm:justify-between">
              <div>
                <div className="text-[11px] text-muted-foreground">جمع این آیتم</div>
                <div className="text-xl font-black text-primary tabular-nums">
                  {formatToman(item.basePrice * qty + extras)}
                </div>
              </div>
              <Button
                size="lg"
                className="min-w-44"
                disabled={missingRequired.length > 0}
                onClick={() => {
                  onConfirm(
                    item,
                    qty,
                    pickedMods.map((m) => ({
                      id: m.id,
                      name: m.name ?? "",
                      extraPrice: m.extraPrice,
                      quantity: selected[m.id] ?? 1,
                    })),
                    notes,
                  );
                  setQty(initialQuantity);
                  setNotes(initialNotes);
                  setSelected({});
                }}
              >
                <ShoppingBasket className="size-5" aria-hidden />
                افزودن به سبد
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
