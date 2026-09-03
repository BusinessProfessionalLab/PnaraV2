import * as React from "react";
import { cn } from "@/lib/cn";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "neutral" | "outline";

const variants: Record<BadgeVariant, string> = {
  default: "bg-primary-soft text-primary ring-1 ring-inset ring-primary/15",
  success: "bg-success/10 text-success ring-1 ring-inset ring-success/15",
  warning: "bg-warning/10 text-warning ring-1 ring-inset ring-warning/15",
  danger: "bg-danger/10 text-danger ring-1 ring-inset ring-danger/15",
  neutral: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
  outline: "border bg-transparent text-foreground",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none whitespace-nowrap",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
