import type { TourStateRecord, TourStatus } from "./types";

/**
 * Centralized tour persistence.
 *
 * Storage is per-user (session.userId) so one person's completion never
 * leaks into another account on the same browser, and every record carries
 * the tour version so stale tours are ignored after a UX update.
 */

/** Single key prefix — do not scatter raw localStorage keys elsewhere. */
const KEY_PREFIX = "toastiran-product-tour";

/** Current tour flow version. Bump when onboarding changes meaningfully. */
export const TOUR_VERSION = "1";

type TourStore = Record<string, TourStateRecord>;

function keyFor(userId: string) {
  return `${KEY_PREFIX}:${userId}`;
}

function readStore(userId: string | null): TourStore {
  if (!userId) return {};
  try {
    const raw = localStorage.getItem(keyFor(userId));
    return raw ? (JSON.parse(raw) as TourStore) : {};
  } catch {
    return {};
  }
}

function writeStore(userId: string | null, store: TourStore) {
  if (!userId) return;
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(store));
  } catch {
    /* storage unavailable — tours simply fall back to never persisted */
  }
}

/** Record for a tour, or null when it was never started on this tour version. */
export function getTourState(
  userId: string | null,
  tourId: string,
): TourStateRecord | null {
  const record = readStore(userId)[tourId];
  if (!record) return null;
  if (record.version !== TOUR_VERSION) return null; // obsolete version → treat as new
  return record;
}

export function getTourStatus(
  userId: string | null,
  tourId: string,
): TourStatus {
  return getTourState(userId, tourId)?.status ?? "not_started";
}

export function setTourStatus(
  userId: string | null,
  tourId: string,
  status: TourStatus,
  extra?: { step?: number; route?: string },
) {
  if (!userId) return;
  const store = readStore(userId);
  store[tourId] = {
    version: TOUR_VERSION,
    status,
    ...(status === "in_progress"
      ? { step: extra?.step, route: extra?.route }
      : {}),
    updatedAt: new Date().toISOString(),
  };
  writeStore(userId, store);
}

/** Drop a stale in-progress record (e.g. user never resumed it). */
export function clearTourProgress(userId: string | null, tourId: string) {
  if (!userId) return;
  const store = readStore(userId);
  const record = store[tourId];
  if (!record) return;
  if (record.status === "in_progress") delete store[tourId];
  writeStore(userId, store);
}
