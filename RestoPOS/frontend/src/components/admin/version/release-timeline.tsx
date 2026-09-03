import type { ReleaseNote } from "@/lib/releases";
import { ReleaseCard } from "./release-card";

/**
 * Vertical release timeline. The rail is drawn on the inline-start side with
 * logical properties, so it mirrors automatically in RTL; markers sit on the
 * same axis. Content stays the priority — the rail is deliberately quiet.
 */
export function ReleaseTimeline({
  releases,
  currentVersion,
}: {
  releases: ReleaseNote[];
  currentVersion: string;
}) {
  return (
    <ol className="relative space-y-6 before:absolute before:top-4 before:bottom-4 before:start-[11px] before:w-px before:bg-border/80 sm:space-y-8">
      {releases.map((release, index) => (
        <ReleaseCard
          key={release.version}
          release={release}
          isLatest={release.version === currentVersion}
          index={index}
        />
      ))}
    </ol>
  );
}
