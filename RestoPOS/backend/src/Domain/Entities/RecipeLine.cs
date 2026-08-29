using RestoPOS.Domain.Common;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Domain.Entities;

public class RecipeLine : BaseEntity
{
    public Guid RecipeId { get; set; }
    public Guid InventoryItemId { get; set; }
    public decimal Quantity { get; set; }
    public UnitOfMeasure Unit { get; set; }

    public Recipe Recipe { get; set; } = default!;
    public InventoryItem? InventoryItem { get; set; }

    public void EnsureValid()
    {
        if (Quantity <= 0)
            throw new DomainException("مقدار مصرف رسپی باید بزرگ‌تر از صفر باشد.");
    }
}
