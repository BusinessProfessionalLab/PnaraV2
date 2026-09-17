using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Application.Common.Models;
using RestoPOS.Application.Features.Inventory;
using RestoPOS.Domain.Events;

namespace RestoPOS.Application.Features.Orders.EventHandlers;

public sealed class OrderSubmittedInventoryHandler(IInventoryStockService inventoryStock, IApplicationDbContext db, ILogger<OrderSubmittedInventoryHandler> logger)
    : INotificationHandler<DomainEventNotification<OrderSubmittedEvent>>
{
    public async Task Handle(DomainEventNotification<OrderSubmittedEvent> notification, CancellationToken cancellationToken)
    {
        var order = await db.Orders
            .AsNoTracking()
            .FirstOrDefaultAsync(o => o.Id == notification.DomainEvent.OrderId, cancellationToken);
        if (order is null || order.InventoryDeducted)
            return;

        await inventoryStock.DeductRecipeStockForOrderAsync(order, cancellationToken);
        logger.LogInformation("Inventory deduction requested for order {OrderNumber}", order.OrderNumber);
    }
}

public sealed class OrderPaidLoyaltyHandler(IApplicationDbContext db)
    : INotificationHandler<DomainEventNotification<OrderPaidEvent>>
{
    public async Task Handle(DomainEventNotification<OrderPaidEvent> notification, CancellationToken cancellationToken)
    {
        var order = await db.Orders.FirstOrDefaultAsync(o => o.Id == notification.DomainEvent.OrderId, cancellationToken);
        if (order?.CustomerId is null)
            return;

        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == order.CustomerId, cancellationToken);
        var settings = await db.StoreSettings.AsNoTracking().FirstAsync(cancellationToken);
        if (customer is null)
            return;

        var points = settings.LoyaltyPointsPerMillionRial <= 0
            ? 0
            : (int)(order.GrandTotal / 1_000_000m * settings.LoyaltyPointsPerMillionRial);
        customer.RegisterVisit(order.GrandTotal, points);
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class OrderCancelledInventoryHandler(IInventoryStockService inventoryStock, IApplicationDbContext db)
    : INotificationHandler<DomainEventNotification<OrderCancelledEvent>>
{
    public async Task Handle(DomainEventNotification<OrderCancelledEvent> notification, CancellationToken cancellationToken)
    {
        if (!notification.DomainEvent.ReverseInventory)
            return;

        var order = await db.Orders
            .AsNoTracking()
            .FirstOrDefaultAsync(o => o.Id == notification.DomainEvent.OrderId, cancellationToken);
        if (order is null || !order.InventoryDeducted)
            return;

        await inventoryStock.RestoreOrderStockAsync(order, cancellationToken);
    }
}
