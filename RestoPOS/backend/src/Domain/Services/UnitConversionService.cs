using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Domain.Services;

/// <summary>
/// Converts purchase / recipe quantities into the inventory item's <see cref="BaseUnit"/>.
/// Built-in mass/volume factors plus per-item named conversions (e.g. Box → 24 Piece).
/// </summary>
public static class UnitConversionService
{
    public static decimal ToBaseUnit(
        InventoryItem item,
        decimal quantity,
        BaseUnit? fromUnit = null,
        string? namedPurchaseUnit = null)
    {
        if (quantity < 0)
            throw new DomainException("مقدار نمی‌تواند منفی باشد.");

        if (!string.IsNullOrWhiteSpace(namedPurchaseUnit))
        {
            var named = item.Conversions.FirstOrDefault(c =>
                c.UnitName.Equals(namedPurchaseUnit.Trim(), StringComparison.OrdinalIgnoreCase));
            if (named is null)
                throw new DomainException($"واحد تبدیل «{namedPurchaseUnit}» برای کالای {item.Sku} تعریف نشده است.");
            return decimal.Round(quantity * named.FactorToBase, 4, MidpointRounding.AwayFromZero);
        }

        var source = fromUnit ?? item.BaseUnit;
        if (source == item.BaseUnit)
            return decimal.Round(quantity, 4, MidpointRounding.AwayFromZero);

        var inCanonical = ToCanonical(source, quantity);
        var targetCanonicalUnit = CanonicalFamily(item.BaseUnit);
        if (CanonicalFamily(source) != targetCanonicalUnit)
            throw new DomainException($"تبدیل از {source} به {item.BaseUnit} برای {item.Sku} پشتیبانی نمی‌شود. واحد تبدیل سفارشی تعریف کنید.");

        return decimal.Round(FromCanonical(item.BaseUnit, inCanonical), 4, MidpointRounding.AwayFromZero);
    }

    public static decimal UnitPriceInBase(decimal unitPriceForPurchaseQty, decimal qtyInPurchaseUnit, decimal qtyInBase)
    {
        if (qtyInBase <= 0)
            throw new DomainException("مقدار پایه برای محاسبه قیمت واحد باید بزرگ‌تر از صفر باشد.");
        if (qtyInPurchaseUnit <= 0)
            throw new DomainException("مقدار خرید باید بزرگ‌تر از صفر باشد.");

        var totalCost = unitPriceForPurchaseQty * qtyInPurchaseUnit;
        return decimal.Round(totalCost / qtyInBase, 2, MidpointRounding.AwayFromZero);
    }

    private static decimal ToCanonical(BaseUnit unit, decimal quantity) => unit switch
    {
        BaseUnit.Gram or BaseUnit.Milliliter or BaseUnit.Piece or BaseUnit.Portion or BaseUnit.Can => quantity,
        BaseUnit.Kilogram or BaseUnit.Liter => quantity * 1000m,
        _ => throw new DomainException($"واحد ناشناخته: {unit}")
    };

    private static decimal FromCanonical(BaseUnit unit, decimal canonical) => unit switch
    {
        BaseUnit.Gram or BaseUnit.Milliliter or BaseUnit.Piece or BaseUnit.Portion or BaseUnit.Can => canonical,
        BaseUnit.Kilogram or BaseUnit.Liter => canonical / 1000m,
        _ => throw new DomainException($"واحد ناشناخته: {unit}")
    };

    private static string CanonicalFamily(BaseUnit unit) => unit switch
    {
        BaseUnit.Gram or BaseUnit.Kilogram => "mass",
        BaseUnit.Milliliter or BaseUnit.Liter => "volume",
        BaseUnit.Piece => "piece",
        BaseUnit.Portion => "portion",
        BaseUnit.Can => "can",
        _ => "other"
    };
}
