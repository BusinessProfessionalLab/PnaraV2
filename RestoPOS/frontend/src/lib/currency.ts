const tomanFormatter = new Intl.NumberFormat("fa-IR");
const rialFormatter = new Intl.NumberFormat("fa-IR");

export function rialToToman(rial: number) {
  return Math.round(rial / 10);
}

export function formatToman(rial: number, withUnit = true) {
  const value = tomanFormatter.format(rialToToman(rial));
  return withUnit ? `${value} تومان` : value;
}

export function formatRial(rial: number, withUnit = true) {
  const value = rialFormatter.format(Math.round(rial));
  return withUnit ? `${value} ریال` : value;
}

export type CartModifier = { id: string; name: string; extraPrice: number; quantity: number };
export type PricedCartItem = {
  quantity: number;
  unitPrice: number;
  taxInclusive?: boolean;
  discountPercent?: number;
  modifiers: CartModifier[];
};

export function priceCart(
  items: PricedCartItem[],
  vatRate: number,
  discountPercent = 0,
  discountAmount = 0,
) {
  let itemsNet = 0;
  let modifiersNet = 0;
  let extractedTax = 0;

  for (const item of items) {
    const modifiers = item.modifiers.reduce((sum, m) => sum + m.extraPrice * m.quantity, 0) * item.quantity;
    const discountFactor = 1 - Math.min(100, Math.max(0, item.discountPercent ?? 0)) / 100;
    const baseLine = item.unitPrice * item.quantity * discountFactor;
    const discountedModifiers = modifiers * discountFactor;
    if (item.taxInclusive && vatRate > 0) {
      const divisor = 1 + vatRate;
      extractedTax += baseLine + discountedModifiers - (baseLine + discountedModifiers) / divisor;
      itemsNet += baseLine / divisor;
      modifiersNet += discountedModifiers / divisor;
    } else {
      itemsNet += baseLine;
      modifiersNet += discountedModifiers;
    }
  }

  const subtotal = Math.round(itemsNet);
  const modifiersTotal = Math.round(modifiersNet);
  const afterPercent = (subtotal + modifiersTotal) * (1 - discountPercent / 100);
  const taxable = Math.max(0, afterPercent - discountAmount);
  const taxAmount =
    extractedTax > 0
      ? Math.round(extractedTax * (taxable / Math.max(1, subtotal + modifiersTotal)))
      : Math.round(taxable * vatRate);
  const grandTotal = Math.round(taxable + (extractedTax > 0 ? 0 : taxAmount));

  return { subtotal: subtotal + modifiersTotal, modifiersTotal, taxAmount, grandTotal, taxable: Math.round(taxable) };
}
