import { cn } from "@/lib/cn";
import type { ReleaseNote } from "@/lib/releases";
import { formatReleaseDate } from "@/lib/releases/format";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { VersionBadge } from "./version-badge";
import { ReleaseChangeItem } from "./release-change-item";

/**
 * One version node on the timeline. The latest release is visually stronger
 * (solid badge, accent ring); older ones stay quiet.
 */
export function ReleaseCard({
  release,
  isLatest,
  index,
}: {
  release: ReleaseNote;
  isLatest: boolean;
  index: number;
}) {
  return (
    <li className="relative ps-12 sm:ps-16">
      {/* Timeline marker — centered on the version badge row */}
      <span aria-hidden className="absolute start-0 top-[30px] flex size-6 items-center justify-center">
        <span
          className={cn(
            "size-2.5 rounded-full border-2",
            isLatest
              ? "border-primary bg-primary-fill ring-4 ring-primary/15"
              : "border-border bg-background",
          )}
        />
      </span>

      <Card
        className={cn(
          "animate-fade-up overflow-hidden",
          isLatest && "border-primary/30 shadow-card-hover ring-1 ring-primary/15",
        )}
        style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
      >
        {/* Header: version, flags and release date */}
        <div
          className={cn(
            "flex flex-wrap items-center gap-2.5 border-b px-5 py-4",
            isLatest ? "border-primary/15 bg-primary-soft/40" : "border-border/70",
          )}
        >
          <VersionBadge version={release.version} latest={isLatest} />
          {isLatest ? <Badge variant="default">آخرین نسخه</Badge> : null}
          <time
            dateTime={release.date}
            className="ms-auto text-xs font-medium text-muted-foreground tabular-nums"
          >
            {formatReleaseDate(release.date)}
          </time>
        </div>

        {/* Optional release summary */}
        {release.title || release.description ? (
          <div className="space-y-1.5 px-5 pt-4">
            {release.title ? (
              <h3 className="text-[15px] font-bold leading-6 tracking-tight text-foreground">
                {release.title}
              </h3>
            ) : null}
            {release.description ? (
              <p className="text-[13px] leading-5 text-muted-foreground text-pretty">
                {release.description}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Structured changes */}
        <ul className="mt-3 divide-y divide-border/60 pb-2">
          {release.changes.map((change) => (
            <ReleaseChangeItem key={change.title} change={change} />
          ))}
        </ul>
      </Card>
    </li>
  );
}
