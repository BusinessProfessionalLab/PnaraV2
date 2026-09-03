/**
 * Central API error model.
 *
 * Every failed HTTP call is normalized into an ApiError inside the axios
 * response interceptor, so UI code never has to unwrap axios errors or parse
 * backend problem-details payloads itself.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly payload?: unknown;

  constructor(status: number, message: string, payload?: unknown, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Backend error payloads (ASP.NET problem-details style or plain strings). */
export function extractText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const detail = obj.detail;
    const title = obj.title;
    const message = obj.message;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (typeof title === "string" && title.trim()) return title;
    if (typeof message === "string" && message.trim()) return message;
    // Validation summary objects like { errors: { field: ["..."] } }
    const errors = obj.errors;
    if (errors && typeof errors === "object") {
      const first = Object.values(errors as Record<string, unknown>)[0];
      const firstValue = Array.isArray(first) ? first[0] : first;
      if (typeof firstValue === "string" && firstValue.trim()) return firstValue;
    }
  }
  return undefined;
}

/** Human-readable message from any unknown thrown value (network errors included). */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "خطا در ارتباط با سرور";
}
