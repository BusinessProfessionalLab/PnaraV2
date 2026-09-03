import { cn } from "@/lib/cn";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/30 p-8 text-center",
        className,
      )}
    >
      <Icon className="size-10 text-muted-foreground/50" strokeWidth={1.5} />
      <div>
        <p className="text-sm font-semibold text-foreground/80">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground text-pretty">{description}</p>
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
