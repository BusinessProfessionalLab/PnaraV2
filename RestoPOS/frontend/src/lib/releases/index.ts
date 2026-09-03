import { releases } from "./data";

export type {
  ChangeType,
  ReleaseChange,
  ReleaseNote,
} from "./types";

/**
 * Release-notes data source (the UI never imports the static array directly).
 *
 * When a real backend endpoint exists, swap the body of this function for a
 * server/API call — or have a TanStack Query hook consume it on the client —
 * without rewriting the page.
 */
export async function fetchReleaseNotes(): Promise<import("./types").ReleaseNote[]> {
  return releases;
}
