using RestoPOS.Domain.Common;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Events;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Domain.Entities;

public class InventoryItem : BaseEntity, ISoftDeletable
{
    public string Name { get; set; } = default!;
    public string Sku { get; set; } = default!;
    public UnitOfMeasure UnitOfMeasure { get; set; }
    public decimal ReorderPoint { get; set; }
    public decimal SafetyStock { get; set; }
    public decimal CurrentStock { get; set; }
    public decimal CostPrice { get; set; }
    public decimal AverageCost { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public ICollection<InventoryTransaction> Transactions { get; set; } = [];
    public ICollection<RecipeLine> RecipeLines { get; set; } = [];

    public bool IsBelowReorderPoint => CurrentStock <= ReorderPoint;

    public InventoryTransaction ApplyInbound(decimal quantity, decimal unitCost, Guid? staffId, string? notes, string? reference)
    {
        if (quantity <= 0)
            throw new DomainException("مقدار ورودی انبار باید مثبت باشد.");

        var previousQty = CurrentStock;
        CurrentStock += quantity;
        AverageCost = previousQty <= 0
            ? unitCost
            : ((AverageCost * previousQty) + (unitCost * quantity)) / CurrentStock;
        CostPrice = unitCost;

        return NewTx(InventoryTransactionType.InboundPurchase, quantity, unitCost, staffId, notes, reference);
    }

    public InventoryTransaction ApplyWaste(decimal quantity, Guid? staffId, string? notes)
    {
        if (quantity <= 0)
            throw new DomainException("مقدار ضایعات باید مثبت باشد.");
        if (quantity > CurrentStock)
            throw new DomainException("ضایعات بیشتر از موجودی فعلی است.");

        CurrentStock -= quantity;
        var tx = NewTx(InventoryTransactionType.Waste, -quantity, AverageCost, staffId, notes, null);
        RaiseLowStockIfNeeded();
        return tx;
    }

    public InventoryTransaction ApplyRecipeDeduction(decimal quantity, Guid orderId, Guid? staffId)
    {
        CurrentStock -= quantity;
        var tx = NewTx(InventoryTransactionType.RecipeDeduction, -quantity, AverageCost, staffId, "کسر خودکار رسپی", orderId.ToString());
        RaiseLowStockIfNeeded();
        return tx;
    }

    public InventoryTransaction ReverseRecipeDeduction(decimal quantity, Guid orderId, Guid? staffId)
    {
        CurrentStock += quantity;
        return NewTx(InventoryTransactionType.ReverseDeduction, quantity, AverageCost, staffId, "برگشت کسر رسپی پس از لغو", orderId.ToString());
    }

    private InventoryTransaction NewTx(InventoryTransactionType type, decimal qty, decimal unitCost, Guid? staffId, string? notes, string? reference)
    {
        var tx = new InventoryTransaction
        {
            InventoryItemId = Id,
            Type = type,
            Quantity = qty,
            UnitCost = unitCost,
            Reference = reference,
            Notes = notes,
            OccurredAt = DateTime.UtcNow,
            StaffId = staffId
        };
        Transactions.Add(tx);
        return tx;
    }

    private void RaiseLowStockIfNeeded()
    {
        if (IsBelowReorderPoint)
            AddDomainEvent(new InventoryLowStockEvent(Id, Sku, Name, CurrentStock, ReorderPoint));
    }
}
