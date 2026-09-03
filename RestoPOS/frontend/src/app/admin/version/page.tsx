import { VersionHistoryPage } from "@/components/admin/version/version-history-page";
import { fetchReleaseNotes } from "@/lib/releases";

export default async function VersionPage() {
  // Version data flows through the release-notes data source; the page only
  // ever sees the fetched result (later an API/TanStack query can take over).
  const releases = await fetchReleaseNotes();
  return <VersionHistoryPage releases={releases} />;
}
