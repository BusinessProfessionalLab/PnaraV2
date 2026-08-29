import { formatRial, formatToman } from "@/lib/currency";
import { toShamsiDateTime } from "@/lib/jalali";
import type { OrderDto, StoreSettingsDto, TicketStation } from "@/lib/types";

function itemsFor(order: OrderDto, station?: TicketStation) {
  if (station === "Kitchen") return order.kitchenItems;
  if (station === "Bar") return order.barItems;
  return order.items;
}

export function receiptHtml(
  order: OrderDto,
  settings: StoreSettingsDto,
  kind: "customer" | "kitchen" | "bar",
  width: "80mm" | "58mm" = "80mm",
) {
  const station: TicketStation | undefined = kind === "kitchen" ? "Kitchen" : kind === "bar" ? "Bar" : undefined;
  const rows = itemsFor(order, station);
  const title =
    kind === "customer" ? "فاکتور فروش" : kind === "bar" ? "فیش باریستا" : "فیش آشپزخانه";
  const large = kind !== "customer";
  const elapsed = order.submittedAt
    ? Math.max(0, Math.round((Date.now() - new Date(order.submittedAt).getTime()) / 60000))
    : 0;

  const lines = rows
    .map((item) => {
      const mods = item.modifiers.map((m) => `<div class="mod">• ${m.name}${m.quantity > 1 ? ` × ${m.quantity}` : ""}</div>`).join("");
      const notes = item.notes ? `<div class="note">یادداشت: ${item.notes}</div>` : "";
      const price = kind === "customer" ? `<span>${formatToman(item.lineTotal)}</span>` : "";
      return `<div class="row"><div class="title">${item.quantity} × ${item.title} ${price}</div>${mods}${notes}</div>`;
    })
    .join("");

  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"/>
<title>${title} ${order.orderNumber}</title>
<style>
  @page { size: ${width} auto; margin: 4mm; }
  body { font-family: Vazirmatn, Tahoma, sans-serif; width: ${width}; margin: 0 auto; color: #111; }
  h1 { font-size: ${large ? "22px" : "16px"}; margin: 0 0 6px; text-align: center; }
  .meta, .row, .tot { font-size: ${large ? "15px" : "12px"}; }
  .logo { max-height: 48px; display: block; margin: 0 auto 8px; }
  .line { border-top: 1px dashed #333; margin: 8px 0; }
  .row { margin-bottom: 8px; }
  .title { display: flex; justify-content: space-between; font-weight: 700; }
  .mod { padding-right: 12px; font-size: 12px; }
  .note { padding-right: 12px; font-weight: 700; }
  .tot div { display: flex; justify-content: space-between; margin: 3px 0; }
  .grand { font-size: 16px; font-weight: 800; }
  .center { text-align: center; }
</style></head><body>
  ${settings.logoUrl && kind === "customer" ? `<img class="logo" src="${settings.logoUrl}" alt="logo"/>` : ""}
  <h1>${kind === "customer" ? settings.storeName : `*** ${title} ***`}</h1>
  ${kind === "customer" && settings.receiptHeader ? `<div class="center">${settings.receiptHeader}</div>` : ""}
  <div class="meta center">شماره ${order.orderNumber}</div>
  <div class="meta center">${order.createdAtShamsi || toShamsiDateTime(new Date(order.createdAt))}</div>
  <div class="meta">نوع: ${orderLabel(order.orderType)} | میز: ${order.tableNumber || "—"}</div>
  ${order.customerPhone ? `<div class="meta">مشتری: ${order.customerPhone}</div>` : ""}
  ${large ? `<div class="meta">زمان سپری‌شده: ${elapsed} دقیقه</div>` : ""}
  <div class="line"></div>
  ${lines || "<div>آیتمی برای این ایستگاه نیست.</div>"}
  ${
    kind === "customer"
      ? `<div class="line"></div>
         <div class="tot">
           <div><span>جمع جزء</span><span>${formatToman(order.subtotal)}</span></div>
           <div><span>افزودنی</span><span>${formatToman(order.modifiersTotal)}</span></div>
           <div><span>تخفیف</span><span>${formatToman(order.discountAmount)}</span></div>
           <div><span>ارزش افزوده (${Math.round(order.taxRate * 100)}٪)</span><span>${formatToman(order.taxAmount)}</span></div>
           <div class="grand"><span>قابل پرداخت</span><span>${formatToman(order.grandTotal)}</span></div>
           <div><span>معادل ریال</span><span>${formatRial(order.grandTotal)}</span></div>
         </div>
         ${settings.taxIdentificationNumber ? `<div class="center">شناسه مالیاتی: ${settings.taxIdentificationNumber}</div>` : ""}
         ${settings.receiptFooter ? `<div class="center">${settings.receiptFooter}</div>` : ""}
         <div class="center">ToastIran POS — Pnara</div>`
      : ""
  }
</body></html>`;
}

function orderLabel(type: string) {
  if (type === "Takeaway") return "بیرون‌بر";
  if (type === "Bar") return "بار";
  return "حضوری";
}

export function printReceipt(
  order: OrderDto,
  settings: StoreSettingsDto,
  kind: "customer" | "kitchen" | "bar",
  width: "80mm" | "58mm" = "80mm",
) {
  const html = receiptHtml(order, settings, kind, width);
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    document.body.removeChild(frame);
  }, 250);
}

export function printOrderTickets(order: OrderDto, settings: StoreSettingsDto, width: "80mm" | "58mm" = "80mm") {
  printReceipt(order, settings, "customer", width);
  if (order.kitchenItems?.length) setTimeout(() => printReceipt(order, settings, "kitchen", width), 400);
  if (order.barItems?.length) setTimeout(() => printReceipt(order, settings, "bar", width), 800);
}
