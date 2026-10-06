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
  if (error instanceof ApiError) return friendlyApiMessage(error);
  if (error instanceof Error) return friendlyGenericMessage(error.message);
  if (typeof error === "string") return friendlyGenericMessage(error);
  return "خطا در ارتباط با سرور";
}

function hasPersian(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

/** Maps technical/English API failures to Persian user-facing messages. */
function friendlyApiMessage(error: ApiError): string {
  const raw = (error.message || "").trim();
  const payload = error.payload as Record<string, unknown> | undefined;
  const title = typeof payload?.title === "string" ? payload.title : undefined;

  // No HTTP response at all (CORS / DNS / backend down / wrong baseURL).
  if (error.status === 0) {
    return "خطا در ارتباط با سرور. اتصال اینترنت و روشن بودن سرور را بررسی کنید.";
  }
  if (error.code === "ECONNABORTED" || /timeout/i.test(raw)) {
    return "پاسخ سرور طول کشید. لطفاً دوباره تلاش کنید.";
  }
  switch (error.status) {
    case 401:
      return "نشست شما منقضی شده است. لطفاً دوباره وارد شوید.";
    case 403:
      return "شما مجوز این عملیات را ندارید.";
    case 404:
      return hasPersian(raw) ? raw : "اطلاعات موردنظر یافت نشد. لطفاً صفحه را تازه‌سازی کنید.";
    case 409:
      // Concurrency detail from backend is already Persian — keep it.
      return hasPersian(raw) ? raw : "اطلاعات تغییر کرده است. لطفاً دوباره تلاش کنید.";
    case 400:
    case 422:
      // FluentValidation default messages are English ("'Amount' must be...").
      // Keep Persian domain messages, replace English noise with a generic one.
      if (hasPersian(raw)) return raw;
      if (title === "ValidationFailed") return "اطلاعات وارد شده معتبر نیست. لطفاً ورودی‌ها را بررسی کنید.";
      return "درخواست نامعتبر است. لطفاً ورودی‌ها را بررسی کنید.";
    default:
      if (error.status >= 500) {
        return hasPersian(raw) ? raw : "خطای داخلی سرور. لطفاً چند لحظه دیگر دوباره تلاش کنید.";
      }
      return friendlyGenericMessage(raw);
  }
}

function friendlyGenericMessage(message: string): string {
  const raw = (message || "").trim();
  if (!raw) return "خطا در ارتباط با سرور";
  if (hasPersian(raw)) return raw;
  if (/failed to fetch|network ?error|load failed/i.test(raw)) {
    return "خطا در ارتباط با سرور. اتصال اینترنت و روشن بودن سرور را بررسی کنید.";
  }
  if (/must be greater than/i.test(raw)) {
    return "مبلغ وارد شده معتبر نیست. مبلغ باید بیشتر از صفر باشد.";
  }
  if (/validation/i.test(raw)) {
    return "اطلاعات وارد شده معتبر نیست. لطفاً ورودی‌ها را بررسی کنید.";
  }
  if (/not found/i.test(raw)) {
    return "اطلاعات موردنظر یافت نشد. لطفاً صفحه را تازه‌سازی کنید.";
  }
  // Unknown English technical text — never show it raw to the cashier.
  if (/^[A-Za-z0-9 _.'"\-:,;()[\]]+$/.test(raw) && !hasPersian(raw)) {
    return "عملیات انجام نشد. لطفاً دوباره تلاش کنید.";
  }
  return raw;
}
