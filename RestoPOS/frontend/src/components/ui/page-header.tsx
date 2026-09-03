import { cn } from "@/lib/cn";

/**
 * Standard page header: title + optional description on one side,
 * primary/secondary actions on the other. Keeps hierarchy consistent
 * across the whole product.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0 space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-[1.375rem] sm:leading-8">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-[13px] leading-5 text-muted-foreground text-pretty">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

/** Section caption used above grouped content inside a page. */
export function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={cn("text-[15px] font-bold tracking-tight text-foreground", className)}>
      {children}
    </h2>
  );
}
