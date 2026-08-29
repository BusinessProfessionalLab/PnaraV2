using RestoPOS.Domain.Common;
using RestoPOS.Domain.Enums;

namespace RestoPOS.Domain.Entities;

public class InventoryTransaction : BaseEntity
{
    public Guid InventoryItemId { get; set; }
    public InventoryTransactionType Type { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitCost { get; set; }
    public string? Reference { get; set; }
    public string? Notes { get; set; }
    public DateTime OccurredAt { get; set; }
    public Guid? StaffId { get; set; }

    public InventoryItem? InventoryItem { get; set; }
}
