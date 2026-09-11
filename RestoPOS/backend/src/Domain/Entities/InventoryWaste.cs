using RestoPOS.Domain.Common;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Domain.Entities;

public class InventoryWaste : BaseEntity
{
    public DateTime OccurredAtUtc { get; set; } = DateTime.UtcNow;
    public Guid? RecordedByUserId { get; set; }
    public string? Notes { get; set; }
    public decimal TotalLossRials { get; set; }

    public ICollection<InventoryWasteItem> Items { get; set; } = [];

    public InventoryWasteItem AddItem(InventoryItem inventoryItem, decimal quantityInBase, WasteReason reason, string? notes)
    {
        if (quantityInBase <= 0)
            throw new DomainException("مقدار ضایعات باید مثبت باشد.");

        var unitCost = inventoryItem.WeightedAverageCost;
        var loss = decimal.Round(quantityInBase * unitCost, 0, MidpointRounding.AwayFromZero);
        var line = new InventoryWasteItem
        {
            InventoryWasteId = Id,
            InventoryItemId = inventoryItem.Id,
            QuantityInBase = quantityInBase,
            Reason = reason,
            UnitCostRials = unitCost,
            LossRials = loss,
            Notes = notes
        };
        Items.Add(line);
        TotalLossRials = Items.Sum(i => i.LossRials);
        return line;
    }
}

public class InventoryWasteItem : BaseEntity
{
    public Guid InventoryWasteId { get; set; }
    public Guid InventoryItemId { get; set; }
    public decimal QuantityInBase { get; set; }
    public WasteReason Reason { get; set; }
    public decimal UnitCostRials { get; set; }
    public decimal LossRials { get; set; }
    public string? Notes { get; set; }

    public InventoryWaste InventoryWaste { get; set; } = default!;
    public InventoryItem InventoryItem { get; set; } = default!;
}
