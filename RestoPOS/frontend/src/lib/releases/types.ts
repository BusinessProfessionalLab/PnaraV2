/** Release change category — maps 1:1 to an icon + label in the UI. */
export type ChangeType =
  | "feature"
  | "improvement"
  | "bugfix"
  | "performance"
  | "security"
  | "breaking";

export interface ReleaseChange {
  type: ChangeType;
  title: string;
  description?: string;
}

export interface ReleaseNote {
  version: string;
  /** Machine-readable ISO date (`yyyy-mm-dd`). Display conversion happens in the UI. */
  date: string;
  title?: string;
  description?: string;
  changes: ReleaseChange[];
}
