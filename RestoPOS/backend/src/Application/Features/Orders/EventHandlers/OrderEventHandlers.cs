using MediatR;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Application.Common.Models;
using RestoPOS.Application.Features.Inventory;
using RestoPOS.Application.Features.Customers;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Enums;
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
        var order = await db.Orders.Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == notification.DomainEvent.OrderId, cancellationToken);
        if (order?.CustomerId is null)
            return;

        // The paid event may be dispatched again after a transient failure. Keep the
        // order's earn entry idempotent so retries cannot issue the same points twice.
        if (await db.LoyaltyPointLedgers.AnyAsync(
                entry => entry.OrderId == order.Id && entry.Type == LoyaltyLedgerType.Earn,
                cancellationToken))
            return;

        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == order.CustomerId, cancellationToken);
        var settings = await db.StoreSettings.AsNoTracking().FirstAsync(cancellationToken);
        if (customer is null)
            return;

        var basePoints = settings.LoyaltyEarnMode switch
        {
            "Visit" => (customer.VisitCount + 1) % Math.Max(1, settings.LoyaltyEarnEveryVisits) == 0
                ? Math.Max(0, settings.LoyaltyEarnPoints)
                : 0,
            "Percent" => (int)Math.Max(0, decimal.Floor(order.GrandTotal * settings.LoyaltyEarnPercent / 100m / 1000m)),
            _ => settings.LoyaltyEarnAmountRials > 0
                ? (int)(order.GrandTotal / settings.LoyaltyEarnAmountRials * settings.LoyaltyEarnPoints)
                : settings.LoyaltyPointsPerMillionRial <= 0
                    ? 0
                    : (int)(order.GrandTotal / 1_000_000m * settings.LoyaltyPointsPerMillionRial)
        };
        var tier = (JsonSerializer.Deserialize<LoyaltyTierRuleDto[]>(settings.LoyaltyTierRulesJson) ?? [])
            .Where(x => customer.VisitCount + 1 >= x.MinimumVisits || customer.TotalSpent + order.GrandTotal >= x.MinimumSpendRials)
            .OrderByDescending(x => x.MinimumVisits)
            .ThenByDescending(x => x.MinimumSpendRials)
            .FirstOrDefault();
        var points = (int)Math.Floor(basePoints * (tier?.PointsMultiplier ?? 1m));
        customer.RegisterVisit(order.GrandTotal, points);
        db.LoyaltyPointLedgers.Add(new LoyaltyPointLedger
        {
            CustomerId = customer.Id,
            Type = LoyaltyLedgerType.Earn,
            PointsDelta = points,
            BalanceAfter = customer.LoyaltyPoints,
            OrderId = order.Id,
            Notes = $"Earned from paid order {order.OrderNumber}",
            OccurredAtUtc = DateTime.UtcNow
        });

        var cashbackPercent = tier?.CashbackPercent > 0 ? tier.CashbackPercent : settings.CashbackPercent;
        if (cashbackPercent > 0 && order.GrandTotal >= settings.CashbackMinSpendRials &&
            !await db.CustomerWalletLedgers.AnyAsync(x => x.OrderId == order.Id, cancellationToken))
        {
            var eligibleSpend = settings.CashbackProductIds.Length == 0
                ? order.GrandTotal
                : order.Items.Where(x => settings.CashbackProductIds.Contains(x.MenuItemId.ToString()))
                    .Sum(x => x.LineTotal);
            var cashback = decimal.Floor(eligibleSpend * cashbackPercent / 100m);
            if (settings.CashbackMaxRials > 0) cashback = Math.Min(cashback, settings.CashbackMaxRials);
            if (cashback > 0)
            {
                var balance = await db.CustomerWalletLedgers.Where(x => x.CustomerId == customer.Id)
                    .SumAsync(x => (decimal?)x.AmountRials, cancellationToken) ?? 0;
                db.CustomerWalletLedgers.Add(new CustomerWalletLedger
                {
                    CustomerId = customer.Id,
                    OrderId = order.Id,
                    AmountRials = cashback,
                    BalanceAfterRials = balance + cashback,
                    Type = "Cashback",
                    Notes = $"Cashback from paid order {order.OrderNumber}"
                });
            }
        }

        if (settings.LoyaltySmsEnabled && settings.ThankYouSmsEnabled && !string.IsNullOrWhiteSpace(customer.PhoneNumber))
        {
            var thankYouCampaign = new LoyaltySmsCampaign
            {
                Name = $"تشکر سفارش {order.OrderNumber}",
                Body = settings.ThankYouSmsTemplate
            };
            thankYouCampaign.Messages.Add(new LoyaltySmsMessage
            {
                CustomerId = customer.Id,
                PhoneNumber = customer.PhoneNumber,
                Body = settings.ThankYouSmsTemplate
                    .Replace("{name}", customer.FullName ?? "مشتری", StringComparison.Ordinal)
                    .Replace("{points}", points.ToString(), StringComparison.Ordinal)
                    .Replace("{balance}", customer.LoyaltyPoints.ToString(), StringComparison.Ordinal)
                    .Replace("{amount}", order.GrandTotal.ToString("0"), StringComparison.Ordinal)
                    .Replace("{date}", DateTime.UtcNow.ToString("yyyy/MM/dd"), StringComparison.Ordinal),
                IsTransactional = true,
                Status = "Queued"
            });
            db.LoyaltySmsCampaigns.Add(thankYouCampaign);
        }
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
