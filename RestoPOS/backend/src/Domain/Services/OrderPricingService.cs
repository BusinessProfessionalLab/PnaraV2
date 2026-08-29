using RestoPOS.Domain.Entities;

namespace RestoPOS.Domain.Services;

/// <summary>
/// Toast-style billing engine: line subtotals, modifier extras, configurable Iranian VAT, discounts, grand total.
/// Amounts are rounded to whole Rial.
/// </summary>
public static class OrderPricingService
{
    public static void Apply(Order order)
    {
        decimal itemsNet = 0;
        decimal modifiersNet = 0;
        decimal extractedTax = 0;

        foreach (var item in order.Items)
        {
            var modifiers = item.Modifiers.Sum(m => m.ExtraPrice * m.Quantity) * item.Quantity;
            var baseLine = item.UnitPrice * item.Quantity;
            item.LineModifiersTotal = Round(modifiers);
            item.LineSubtotal = Round(baseLine);
            item.LineTotal = Round(baseLine + modifiers);

            if (item.TaxInclusive && order.TaxRate > 0)
            {
                var taxDivisor = 1 + order.TaxRate;
                extractedTax += item.LineTotal - (item.LineTotal / taxDivisor);
                itemsNet += baseLine / taxDivisor;
                modifiersNet += modifiers / taxDivisor;
            }
            else
            {
                itemsNet += baseLine;
                modifiersNet += modifiers;
            }
        }

        order.Subtotal = Round(itemsNet);
        order.ModifiersTotal = Round(modifiersNet);

        var afterPercent = (order.Subtotal + order.ModifiersTotal) * (1 - order.DiscountPercent / 100m);
        var taxable = Math.Max(0, afterPercent - order.DiscountAmount);

        decimal tax;
        if (extractedTax > 0)
            tax = Round(extractedTax * (taxable / Math.Max(1, order.Subtotal + order.ModifiersTotal)));
        else
            tax = Round(taxable * order.TaxRate);

        order.TaxAmount = tax;
        order.GrandTotal = Round(taxable + (extractedTax > 0 ? 0 : tax));
    }

    private static decimal Round(decimal value) =>
        decimal.Round(value, 0, MidpointRounding.AwayFromZero);
}
