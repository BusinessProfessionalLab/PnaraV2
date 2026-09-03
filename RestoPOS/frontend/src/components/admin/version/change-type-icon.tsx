import {
  Bug,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Wand2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { ChangeType } from "@/lib/releases";

/** Metadata for every change category — icon + Persian label + soft chip tint. */
export const CHANGE_TYPE_META: Record<
  ChangeType,
  { label: string; icon: LucideIcon; chip: string }
> = {
  feature: { label: "امکانات جدید", icon: Sparkles, chip: "bg-primary-soft text-primary" },
  improvement: { label: "بهبودها", icon: Wand2, chip: "bg-muted text-muted-foreground" },
  bugfix: { label: "رفع اشکال", icon: Bug, chip: "bg-danger/10 text-danger" },
  performance: { label: "کارایی", icon: Zap, chip: "bg-warning/10 text-warning" },
  security: { label: "امنیت", icon: ShieldCheck, chip: "bg-success/10 text-success" },
  breaking: { label: "تغییر مهم", icon: TriangleAlert, chip: "bg-danger/10 text-danger" },
};

export function ChangeTypeIcon({ type }: { type: ChangeType }) {
  const { icon: Icon, chip } = CHANGE_TYPE_META[type];
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-xl",
        chip,
      )}
    >
      <Icon className="size-[18px]" strokeWidth={1.8} aria-hidden />
    </span>
  );
}
