/**
 * Result-envelope helpers.
 *
 * Part of the backend (inventory, menu reorder, purchases, …) answers with an
 * ASP.NET `Result`/`Result<T>` object instead of a bare payload. Services
 * unwrap it right after the HTTP call so components keep receiving plain DTOs
 * and a failed envelope surfaces through the same ApiError pipeline as an
 * HTTP failure.
 */
import { ApiError } from "./errors";
import type { Result } from "@/lib/types";

const FALLBACK_MESSAGE = "عملیات با خطا مواجه شد";

function failureMessage(result: Result<unknown>) {
  const first = (result.errors ?? []).find((message) => message && message.trim());
  return first ?? FALLBACK_MESSAGE;
}

/** Unwraps `Result<T>` into its value; throws ApiError when it has none. */
export function unwrap<T>(result: Result<T>): T {
  if (!result.succeeded) throw new ApiError(400, failureMessage(result), result);
  if (result.value === undefined || result.value === null) {
    throw new ApiError(500, "پاسخ سرور خالی بود", result);
  }
  return result.value;
}

/** Unwraps a value-less `Result` (write operations) into `undefined`. */
export function unwrapVoid(result: Result): void {
  if (!result.succeeded) throw new ApiError(400, failureMessage(result), result);
}
