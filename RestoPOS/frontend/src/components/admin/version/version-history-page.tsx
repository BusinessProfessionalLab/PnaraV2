import { History, PackageOpen } from "lucide-react";
import Link from "next/link";
import { appConfig } from "@/config/app";
import type { ReleaseNote } from "@/lib/releases";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { VersionBadge } from "./version-badge";
import { ReleaseTimeline } from "./release-timeline";

/**
 * Version history page: current version badge up top, then a structured
 * timeline of releases (or a calm empty state when none exist yet).
 * Data arrives already-fetched through `fetchReleaseNotes` — the page never
 * reaches into the data source itself.
 */
export function VersionHistoryPage({ releases }: { releases: ReleaseNote[] }) {
  const currentVersion = appConfig.version;
  const hasReleases = releases.length > 0;

  return (
    <div data-tour="version-page" className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader
        title="تاریخچه نسخه‌ها"
        description="تغییرات هر نسخه برنامه را ببینید — از امکانات جدید تا بهبودها و رفع اشکال‌ها."
        actions={
          <div className="flex items-center gap-2">
            <VersionBadge
              version={currentVersion}
              latest
              className="h-8 px-3 text-sm"
            />
            {hasReleases ? (
              <Badge variant="outline" className="h-8 px-3 text-xs">
                آخرین نسخه
              </Badge>
            ) : null}
          </div>
        }
      />

      {hasReleases ? (
        <ReleaseTimeline releases={releases} currentVersion={currentVersion} />
      ) : (
        <EmptyState
          icon={History}
          title="یادداشت نسخه‌ای ثبت نشده است"
          description="به محض انتشار نسخه جدید، تغییرات هر نسخه این‌جا نمایش داده می‌شود."
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin">
                <PackageOpen className="size-4" aria-hidden />
                بازگشت به داشبورد
              </Link>
            </Button>
          }
        />
      )}

      <p className="pb-2 text-center text-[11px] text-muted-foreground/80">
        {appConfig.appName} · نسخه {currentVersion}
      </p>
    </div>
  );
}
