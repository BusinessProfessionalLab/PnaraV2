"use client";

import { formatToman } from "@/lib/currency";
import { toShamsiDateTime } from "@/lib/jalali";
import type { OrderDto, StoreSettingsDto } from "@/lib/types";

export function CustomerReceipt({ order, settings }: { order: OrderDto; settings: StoreSettingsDto }) {
  return (
    <article className="mx-auto w-[80mm] bg-white p-3 text-black" dir="rtl">
      {settings.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={settings.logoUrl} alt="" className="mx-auto mb-2 h-12 object-contain" />
      ) : null}
      <h2 className="text-center text-base font-black">{settings.storeName}</h2>
      {settings.receiptHeader ? <p className="text-center text-xs">{settings.receiptHeader}</p> : null}
      <p className="text-center text-sm">فاکتور {order.orderNumber}</p>
      <p className="text-center text-xs">{order.createdAtShamsi || toShamsiDateTime(new Date(order.createdAt))}</p>
      <p className="text-xs">میز {order.tableNumber || "—"} · {order.customerPhone || "میهمان"}</p>
      <hr className="my-2 border-dashed border-black" />
      {order.items.map((item) => (
        <div key={item.id} className="mb-1 text-xs">
          <div className="flex justify-between font-bold">
            <span>
              {item.quantity} × {item.title}
            </span>
            <span>{formatToman(item.lineTotal)}</span>
          </div>
          {item.modifiers.map((m) => (
            <div key={m.id} className="pr-3">
              • {m.name}
            </div>
          ))}
        </div>
      ))}
      <hr className="my-2 border-dashed border-black" />
      <div className="space-y-1 text-xs">
        <Row k="جمع جزء" v={formatToman(order.subtotal)} />
        <Row k="افزودنی" v={formatToman(order.modifiersTotal)} />
        <Row k={`ارزش افزوده (${Math.round(order.taxRate * 100)}٪)`} v={formatToman(order.taxAmount)} />
        <Row k="قابل پرداخت" v={formatToman(order.grandTotal)} strong />
      </div>
      {settings.receiptFooter ? <p className="mt-2 text-center text-[11px]">{settings.receiptFooter}</p> : null}
    </article>
  );
}

export function KitchenTicket({
  order,
  station,
}: {
  order: OrderDto;
  station: "kitchen" | "bar";
}) {
  const items = station === "bar" ? order.barItems : order.kitchenItems;
  const elapsed = order.submittedAt
    ? Math.max(0, Math.round((Date.now() - new Date(order.submittedAt).getTime()) / 60000))
    : 0;
  return (
    <article className="mx-auto w-[80mm] bg-white p-3 text-black" dir="rtl">
      <h2 className="text-center text-xl font-black">{station === "bar" ? "فیش باریستا" : "فیش آشپزخانه"}</h2>
      <p className="text-center text-lg font-bold">#{order.orderNumber}</p>
      <p className="text-sm">میز {order.tableNumber || "—"} · {elapsed} دقیقه</p>
      <hr className="my-2 border-black" />
      {items.map((item) => (
        <div key={item.id} className="mb-2">
          <div className="text-lg font-black">
            {item.quantity} × {item.title}
          </div>
          {item.modifiers.map((m) => (
            <div key={m.id} className="text-sm">
              • {m.name}
            </div>
          ))}
          {item.notes ? <div className="font-bold">یادداشت: {item.notes}</div> : null}
        </div>
      ))}
    </article>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "text-sm font-black" : ""}`}>
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}
