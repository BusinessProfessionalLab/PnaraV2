using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Application.Common.Models;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Events;
using RestoPOS.Domain.Exceptions;
using RestoPOS.Domain.Services;

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

        var demand = await BuildDemandAsync(db, order, cancellationToken);
        var stockItems = await db.InventoryItems
            .Where(i => demand.Keys.Contains(i.Id))
            .ToDictionaryAsync(i => i.Id, cancellationToken);

        foreach (var (inventoryItemId, lines) in demand)
        {
            if (!stockItems.TryGetValue(inventoryItemId, out var stock) || !stock.IsActive)
                throw new DomainException("یکی از مواد اولیه رسپی در انبار پیدا نشد یا غیرفعال است.");
            var quantity = lines.Sum(line => UnitOfMeasureConversion.Convert(line.Quantity, line.Unit, stock.UnitOfMeasure));
            if (stock.CurrentStock < quantity)
                throw new DomainException($"موجودی ماده اولیه «{stock.Name}» کافی نیست. موجودی فعلی: {stock.CurrentStock}، مقدار موردنیاز: {quantity}.");
        }

        foreach (var (inventoryItemId, lines) in demand)
        {
            var stock = stockItems[inventoryItemId];
            var quantity = lines.Sum(line => UnitOfMeasureConversion.Convert(line.Quantity, line.Unit, stock.UnitOfMeasure));
            stock.ApplyRecipeDeduction(quantity, order.Id, order.CashierId);
        }

        order.InventoryDeducted = true;
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Inventory deducted for order {OrderNumber}", order.OrderNumber);
    }

    private static async Task<Dictionary<Guid, List<RecipeDemandLine>>> BuildDemandAsync(IApplicationDbContext db, Order order, CancellationToken ct)
    {
        var demand = new Dictionary<Guid, List<RecipeDemandLine>>();

        foreach (var item in order.Items)
        {
            var recipes = new List<Recipe>();
            var recipe = await db.Recipes.Include(r => r.Lines)
                .FirstOrDefaultAsync(r => r.MenuItemId == item.MenuItemId, ct);
            if (recipe is not null)
                recipes.Add(recipe);

            foreach (var modifier in item.Modifiers)
            {
                if (modifier.MenuItemModifierId is { } modifierId)
                {
                    var modifierRecipe = await db.Recipes.Include(r => r.Lines)
                        .FirstOrDefaultAsync(r => r.MenuItemModifierId == modifierId, ct);
                    if (modifierRecipe is not null)
                        AddDemand(demand, modifierRecipe, item.Quantity * modifier.Quantity);
                }

                if (modifier.AddonId is { } addonId)
                {
                    var addonRecipe = await db.Recipes.Include(r => r.Lines)
                        .FirstOrDefaultAsync(r => r.AddonId == addonId, ct);
                    if (addonRecipe is not null)
                        AddDemand(demand, addonRecipe, item.Quantity * modifier.Quantity);
                }
            }

            foreach (var itemRecipe in recipes)
                AddDemand(demand, itemRecipe, item.Quantity);
        }

        return demand;
    }

    private static void AddDemand(Dictionary<Guid, List<RecipeDemandLine>> demand, Recipe recipe, decimal multiplier)
    {
        foreach (var line in recipe.Lines)
        {
            if (!demand.TryGetValue(line.InventoryItemId, out var lines))
                demand[line.InventoryItemId] = lines = [];
            lines.Add(new RecipeDemandLine(line.Quantity * multiplier, line.Unit));
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

        var demand = await BuildDemandAsync(db, order, cancellationToken);
        var stockItems = await db.InventoryItems
            .Where(i => demand.Keys.Contains(i.Id))
            .ToDictionaryAsync(i => i.Id, cancellationToken);
        foreach (var (inventoryItemId, lines) in demand)
        {
            if (stockItems.TryGetValue(inventoryItemId, out var stock))
            {
                var quantity = lines.Sum(line => UnitOfMeasureConversion.Convert(line.Quantity, line.Unit, stock.UnitOfMeasure));
                stock.ReverseRecipeDeduction(quantity, order.Id, order.CashierId);
            }
        }

        order.InventoryDeducted = false;
        await db.SaveChangesAsync(cancellationToken);
    }

    private static async Task<Dictionary<Guid, List<RecipeDemandLine>>> BuildDemandAsync(IApplicationDbContext db, Order order, CancellationToken ct)
    {
        var demand = new Dictionary<Guid, List<RecipeDemandLine>>();
        foreach (var item in order.Items)
        {
            var recipe = await db.Recipes.Include(r => r.Lines)
                .FirstOrDefaultAsync(r => r.MenuItemId == item.MenuItemId, ct);
            if (recipe is not null)
                AddDemand(demand, recipe, item.Quantity);
            foreach (var modifier in item.Modifiers)
            {
                if (modifier.MenuItemModifierId is { } modifierId)
                {
                    var modifierRecipe = await db.Recipes.Include(r => r.Lines)
                        .FirstOrDefaultAsync(r => r.MenuItemModifierId == modifierId, ct);
                    if (modifierRecipe is not null)
                        AddDemand(demand, modifierRecipe, item.Quantity * modifier.Quantity);
                }
                if (modifier.AddonId is { } addonId)
                {
                    var addonRecipe = await db.Recipes.Include(r => r.Lines)
                        .FirstOrDefaultAsync(r => r.AddonId == addonId, ct);
                    if (addonRecipe is not null)
                        AddDemand(demand, addonRecipe, item.Quantity * modifier.Quantity);
                }
            }
        }
        return demand;
    }

    private static void AddDemand(Dictionary<Guid, List<RecipeDemandLine>> demand, Recipe recipe, decimal multiplier)
    {
        foreach (var line in recipe.Lines)
        {
            if (!demand.TryGetValue(line.InventoryItemId, out var lines))
                demand[line.InventoryItemId] = lines = [];
            lines.Add(new RecipeDemandLine(line.Quantity * multiplier, line.Unit));
        }
    }
}

internal sealed record RecipeDemandLine(decimal Quantity, UnitOfMeasure Unit);
