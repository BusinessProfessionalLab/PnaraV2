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
 * Money field that shows thousands separators while editing.
 * State lives outside as raw digits — `value`/`onValueChange` never contain
 * separators, so validation and server payloads stay untouched.
 */
export const MoneyInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
    /** Raw digits without separators. */
    value: string;
    /** Called with raw digits (separators stripped). */
    onValueChange: (digits: string) => void;
    /** Optional adornment rendered at the end (e.g. a "تومان" chip) — add matching `pe-*`. */
    endAdornment?: React.ReactNode;
  }
>(({ className, value, onValueChange, endAdornment, ...props }, ref) => (
  <div className="relative">
    <Input
      ref={ref}
      dir="ltr"
      inputMode="numeric"
      type="text"
      className={cn("tabular-nums", className)}
      value={formatDigits(value)}
      onChange={(e) => onValueChange(digitsOnly(e.target.value))}
      {...props}
    />
    {endAdornment ? (
      <span
        aria-hidden
        className="pointer-events-none absolute end-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1 text-xs text-muted-foreground"
      >
        {endAdornment}
      </span>
    ) : null}
  </div>
));
MoneyInput.displayName = "MoneyInput";
