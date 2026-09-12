using RestoPOS.Domain.Common;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Domain.Entities;

/// <summary>
/// Named purchase/pack unit mapped to base stock unit (e.g. 1 Box = 24 Piece, 1 Case = 12 Can).
/// </summary>
public class InventoryUnitConversion : BaseEntity
{
    public Guid InventoryItemId { get; set; }
    public string UnitName { get; set; } = default!;
    public BaseUnit TargetBaseUnit { get; set; }
    public decimal FactorToBase { get; set; }

    public InventoryItem InventoryItem { get; set; } = default!;

    public void EnsureValid(BaseUnit itemBaseUnit)
    {
        if (string.IsNullOrWhiteSpace(UnitName))
            throw new DomainException("نام واحد تبدیل الزامی است.");
        if (FactorToBase <= 0)
            throw new DomainException("ضریب تبدیل باید بزرگ‌تر از صفر باشد.");
        if (TargetBaseUnit != itemBaseUnit)
            throw new DomainException("واحد هدف تبدیل باید با واحد پایه کالا یکسان باشد.");
    }
}
