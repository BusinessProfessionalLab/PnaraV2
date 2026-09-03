import * as React from "react";
import { cn } from "@/lib/cn";
import { Input } from "./input";

/** Strips everything but digits from a raw money string. */
export function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** "1234567" -> "1,234,567" — display-only grouping for ltr numeric money fields. */
export function formatDigits(raw: string): string {
  const digits = digitsOnly(raw);
  if (!digits) return "";
  return Number(digits).toLocaleString("en-US");
}

/**
 * Money field that shows thousands separators while editing, with the unit
 * (تومان by default) as a fixed chip on the **absolute right** of the field.
 *
 * - State lives outside as raw digits — `value`/`onValueChange` never contain
 *   separators, so validation and server payloads stay untouched.
 * - The whole control is pinned `dir="ltr"` and the chip is positioned on the
 *   physical right, so it stays put regardless of the surrounding RTL layout,
 *   the field value or its length.
 * - The chip is `pointer-events-none` and overlays padding reserved on the
 *   right, so it never interferes with typing, caret, selection or the
 *   input's own formatting.
 */
export const MoneyInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
    /** Raw digits without separators. */
    value: string;
    /** Called with raw digits (separators stripped). */
    onValueChange: (digits: string) => void;
    /**
     * Unit shown as a chip at the absolute right of the field.
     * Defaults to `"تومان"`; pass `null` to hide it (non-monetary uses).
     */
    unit?: React.ReactNode;
  }
>(({ className, value, onValueChange, unit = "تومان", ...props }, ref) => {
  const withUnit = unit !== null && unit !== undefined;
  return (
    <div dir="ltr" className="relative">
      <Input
        ref={ref}
        dir="ltr"
        inputMode="numeric"
        type="text"
        value={formatDigits(value)}
        onChange={(e) => onValueChange(digitsOnly(e.target.value))}
        // Unit-aware padding/text-alignment win over any consumer class, so
        // digits can never slide underneath the fixed right-side chip.
        className={cn("tabular-nums", className, withUnit && "pe-16 text-start")}
        {...props}
      />
      {withUnit ? (
        <span
          aria-hidden
          className="pointer-events-none absolute end-2.5 top-1/2 flex -translate-y-1/2 select-none items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
        >
          {unit}
        </span>
      ) : null}
    </div>
  );
});
MoneyInput.displayName = "MoneyInput";
