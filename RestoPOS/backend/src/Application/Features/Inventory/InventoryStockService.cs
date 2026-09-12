using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Enums;

namespace RestoPOS.Application.Features.Inventory;

/// <summary>
/// Shared inventory stock operations consumed by POS order lifecycle (submit / cancel).
/// </summary>
public interface IInventoryStockService
{
    Task DeductRecipeStockForOrderAsync(Order order, CancellationToken cancellationToken = default);
    Task RestoreOrderStockAsync(Order order, CancellationToken cancellationToken = default);
}

public sealed class InventoryStockService(
    IApplicationDbContext db,
    ILogger<InventoryStockService> logger) : IInventoryStockService
{
    public async Task DeductRecipeStockForOrderAsync(Order order, CancellationToken cancellationToken = default)
    {
        if (order.InventoryDeducted)
            return;

        await db.ExecuteResilientTransactionAsync(async ct =>
        {
            // Reload under transaction with concurrency tokens
            var tracked = await db.Orders
                .Include(o => o.Items).ThenInclude(i => i.Modifiers)
                .FirstAsync(o => o.Id == order.Id, ct);

            if (tracked.InventoryDeducted)
                return;

            foreach (var item in tracked.Items)
            {
                var recipe = await db.Recipes.Include(r => r.Lines)
                    .FirstOrDefaultAsync(r => r.MenuItemId == item.MenuItemId, ct);
                if (recipe is not null)
                    await DeductRecipeAsync(recipe, item.Quantity, tracked, ct);

                foreach (var modifier in item.Modifiers)
                {
                    var modifierRecipe = await db.Recipes.Include(r => r.Lines)
                        .FirstOrDefaultAsync(r => r.MenuItemModifierId == modifier.MenuItemModifierId, ct);
                    if (modifierRecipe is not null)
                        await DeductRecipeAsync(modifierRecipe, item.Quantity * modifier.Quantity, tracked, ct);
                }
            }

            tracked.InventoryDeducted = true;
        }, cancellationToken);

        logger.LogInformation("Inventory deducted for order {OrderNumber}", order.OrderNumber);
    }

    public async Task RestoreOrderStockAsync(Order order, CancellationToken cancellationToken = default)
    {
        if (!order.InventoryDeducted)
            return;

        await db.ExecuteResilientTransactionAsync(async ct =>
        {
            var tracked = await db.Orders
                .Include(o => o.Items).ThenInclude(i => i.Modifiers)
                .FirstAsync(o => o.Id == order.Id, ct);

            if (!tracked.InventoryDeducted)
                return;

            foreach (var item in tracked.Items)
            {
                var recipe = await db.Recipes.Include(r => r.Lines)
                    .FirstOrDefaultAsync(r => r.MenuItemId == item.MenuItemId, ct);
                if (recipe is not null)
                    await RestoreRecipeAsync(recipe, item.Quantity, tracked, ct);

                foreach (var modifier in item.Modifiers)
                {
                    var modifierRecipe = await db.Recipes.Include(r => r.Lines)
                        .FirstOrDefaultAsync(r => r.MenuItemModifierId == modifier.MenuItemModifierId, ct);
                    if (modifierRecipe is not null)
                        await RestoreRecipeAsync(modifierRecipe, item.Quantity * modifier.Quantity, tracked, ct);
                }
            }

            tracked.InventoryDeducted = false;
        }, cancellationToken);

        logger.LogInformation("Inventory restored for cancelled order {OrderNumber}", order.OrderNumber);
    }

    private async Task DeductRecipeAsync(Recipe recipe, int multiplier, Order order, CancellationToken ct)
    {
        foreach (var line in recipe.Lines)
        {
            var stock = await db.InventoryItems
                .Include(i => i.Conversions)
                .FirstOrDefaultAsync(i => i.Id == line.InventoryItemId, ct);
            if (stock is null)
                continue;

            var qtyInBase = stock.ConvertToBase(line.Quantity * multiplier, line.Unit);
            stock.ApplyRecipeDeduction(qtyInBase, order.Id, order.CashierId);
        }
    }

    private async Task RestoreRecipeAsync(Recipe recipe, int multiplier, Order order, CancellationToken ct)
    {
        foreach (var line in recipe.Lines)
        {
            var stock = await db.InventoryItems
                .Include(i => i.Conversions)
                .FirstOrDefaultAsync(i => i.Id == line.InventoryItemId, ct);
            if (stock is null)
                continue;

            var qtyInBase = stock.ConvertToBase(line.Quantity * multiplier, line.Unit);
            stock.RestoreOrderStock(qtyInBase, order.Id, order.CashierId);
        }
    }
}
