/**
 * Product-tour domain types.
 *
 * A tour is a list of steps; steps may live on different routes (the manager
 * navigates between route segments automatically). Content is kept as plain
 * Persian data so an i18n layer can take over later without touching the
 * manager or the UI.
 */

/** How a tour run started — controls what closing mid-tour persists. */
export type TourMode = "auto" | "manual";

export type TourStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "skipped";

/** One step of a tour. */
export interface TourStep {
  /** Stable semantic id — mirrors a `data-tour` contract where applicable. */
  id: string;
  /**
   * Route this step's target lives on. Steps without a route stay on the
   * current route segment (used for centered welcome/completion steps).
   */
  route?: string;
  /**
   * `data-tour` selectors to highlight. Several selectors may be given (e.g.
   * desktop vs mobile variants of the same control) — the first visible one
   * wins. Omit for a centered popover step that highlights nothing.
   */
  element?: string | string[];
  title: string;
  description: string;
  /** Preferred popover side (driver auto-flips when it does not fit). */
  side?: "top" | "right" | "bottom" | "left";
}

/** A named, versioned tour. */
export interface TourDefinition {
  id: string;
  /** Bump when the flow/UX changes so users see it again. */
  version: string;
  steps: TourStep[];
}

/** Per-user, per-tour persisted record. */
export interface TourStateRecord {
  version: string;
  status: TourStatus;
  /** Zero-based global step index while `in_progress`. */
  step?: number;
  /** Route of the last active step (for refresh/resume). */
  route?: string;
  updatedAt?: string;
}
