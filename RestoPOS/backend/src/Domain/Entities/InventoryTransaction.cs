using RestoPOS.Domain.Common;
using RestoPOS.Domain.Enums;

namespace RestoPOS.Domain.Entities;

/// <summary>Immutable inventory ledger (کاردکس کالا).</summary>
public class InventoryTransaction : BaseEntity
{
    public Guid InventoryItemId { get; set; }
    public InventoryTransactionType TransactionType { get; set; }
    public Guid? ReferenceId { get; set; }
    public decimal QuantityDelta { get; set; }
    public decimal StockBefore { get; set; }
    public decimal StockAfter { get; set; }
    public decimal UnitCostRials { get; set; }
    public Guid? UserId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public string? Notes { get; set; }
    public StorageLocation? Location { get; set; }

    public InventoryItem? InventoryItem { get; set; }
}
