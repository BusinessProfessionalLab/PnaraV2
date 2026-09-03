import { toShamsiDate } from "@/lib/jalali";

/**
 * Renders a stored machine-readable `yyyy-mm-dd` release date as a Jalali
 * date, reusing the app's existing localization helpers (no duplicate
 * formatting logic).
 */
export function formatReleaseDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return toShamsiDate(new Date(y, (m ?? 1) - 1, d ?? 1));
}
