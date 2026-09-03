import { cn } from "@/lib/cn";

/**
 * Polished, mono version pill. The solid/accent variant marks the latest
 * release; the quiet variant reads as product metadata for older versions.
 */
export function VersionBadge({
  version,
  latest = false,
  className,
}: {
  version: string;
  latest?: boolean;
  className?: string;
}) {
  return (
    <span
      dir="ltr"
      className={cn(
        "inline-flex h-7 items-center rounded-full border px-2.5 font-mono text-[13px] font-bold leading-none tracking-tight tabular-nums",
        latest
          ? "border-transparent bg-primary-fill text-primary-foreground shadow-xs"
          : "border-border bg-card text-foreground",
        className,
      )}
    >
      v{version}
    </span>
  );
}
