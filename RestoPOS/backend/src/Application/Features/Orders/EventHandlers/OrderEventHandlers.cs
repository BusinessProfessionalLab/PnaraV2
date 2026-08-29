using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Application.Common.Models;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Events;

namespace RestoPOS.Application.Features.Orders.EventHandlers;

public sealed class OrderSubmittedInventoryHandler(IApplicationDbContext db, ILogger<OrderSubmittedInventoryHandler> logger)
    : INotificationHandler<DomainEventNotification<OrderSubmittedEvent>>
{
    public async Task Handle(DomainEventNotification<OrderSubmittedEvent> notification, CancellationToken cancellationToken)
    {
        var order = await db.Orders
            .Include(o => o.Items).ThenInclude(i => i.Modifiers)
            .FirstOrDefaultAsync(o => o.Id == notification.DomainEvent.OrderId, cancellationToken);
        if (order is null || order.InventoryDeducted)
            return;

        foreach (var item in order.Items)
        {
            var recipe = await db.Recipes.Include(r => r.Lines)
                .FirstOrDefaultAsync(r => r.MenuItemId == item.MenuItemId, cancellationToken);
            if (recipe is not null)
                await DeductAsync(db, recipe, item.Quantity, order, cancellationToken);

            foreach (var modifier in item.Modifiers)
            {
                var modifierRecipe = await db.Recipes.Include(r => r.Lines)
                    .FirstOrDefaultAsync(r => r.MenuItemModifierId == modifier.MenuItemModifierId, cancellationToken);
                if (modifierRecipe is not null)
                    await DeductAsync(db, modifierRecipe, item.Quantity * modifier.Quantity, order, cancellationToken);
            }
        }

        order.InventoryDeducted = true;
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Inventory deducted for order {OrderNumber}", order.OrderNumber);
    }

    private static async Task DeductAsync(IApplicationDbContext db, Recipe recipe, int multiplier, Order order, CancellationToken ct)
    {
        foreach (var line in recipe.Lines)
        {
            var stock = await db.InventoryItems.FirstOrDefaultAsync(i => i.Id == line.InventoryItemId, ct);
            stock?.ApplyRecipeDeduction(line.Quantity * multiplier, order.Id, order.CashierId);
        }
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

public sealed class OrderCancelledInventoryHandler(IApplicationDbContext db)
    : INotificationHandler<DomainEventNotification<OrderCancelledEvent>>
{
    public async Task Handle(DomainEventNotification<OrderCancelledEvent> notification, CancellationToken cancellationToken)
    {
        if (!notification.DomainEvent.ReverseInventory)
            return;

        var order = await db.Orders
            .Include(o => o.Items).ThenInclude(i => i.Modifiers)
            .FirstOrDefaultAsync(o => o.Id == notification.DomainEvent.OrderId, cancellationToken);
        if (order is null || !order.InventoryDeducted)
            return;

        foreach (var item in order.Items)
        {
            var recipe = await db.Recipes.Include(r => r.Lines)
                .FirstOrDefaultAsync(r => r.MenuItemId == item.MenuItemId, cancellationToken);
            if (recipe is not null)
                await ReverseAsync(db, recipe, item.Quantity, order, cancellationToken);

            foreach (var modifier in item.Modifiers)
            {
                var modifierRecipe = await db.Recipes.Include(r => r.Lines)
                    .FirstOrDefaultAsync(r => r.MenuItemModifierId == modifier.MenuItemModifierId, cancellationToken);
                if (modifierRecipe is not null)
                    await ReverseAsync(db, modifierRecipe, item.Quantity * modifier.Quantity, order, cancellationToken);
            }
        }

        order.InventoryDeducted = false;
        await db.SaveChangesAsync(cancellationToken);
    }

    private static async Task ReverseAsync(IApplicationDbContext db, Recipe recipe, int multiplier, Order order, CancellationToken ct)
    {
        foreach (var line in recipe.Lines)
        {
            var stock = await db.InventoryItems.FirstOrDefaultAsync(i => i.Id == line.InventoryItemId, ct);
            stock?.ReverseRecipeDeduction(line.Quantity * multiplier, order.Id, order.CashierId);
        }
    }
}
