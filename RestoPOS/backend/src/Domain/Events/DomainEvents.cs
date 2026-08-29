using RestoPOS.Domain.Common;

namespace RestoPOS.Domain.Events;

public sealed record OrderSubmittedEvent(Guid OrderId, string OrderNumber, Guid CashierId) : IDomainEvent
{
    public DateTime OccurredOnUtc { get; } = DateTime.UtcNow;
}

public sealed record OrderPaidEvent(Guid OrderId, string OrderNumber, decimal GrandTotal, Guid? CustomerId) : IDomainEvent
{
    public DateTime OccurredOnUtc { get; } = DateTime.UtcNow;
}

public sealed record OrderCancelledEvent(Guid OrderId, string OrderNumber, bool ReverseInventory) : IDomainEvent
{
    public DateTime OccurredOnUtc { get; } = DateTime.UtcNow;
}

public sealed record InventoryLowStockEvent(Guid InventoryItemId, string Sku, string Name, decimal CurrentStock, decimal ReorderPoint) : IDomainEvent
{
    public DateTime OccurredOnUtc { get; } = DateTime.UtcNow;
}
