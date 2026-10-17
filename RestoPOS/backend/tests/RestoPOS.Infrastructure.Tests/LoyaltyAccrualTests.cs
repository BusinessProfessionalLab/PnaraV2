using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Models;
using RestoPOS.Application.Features.Customers;
using RestoPOS.Application.Features.Orders.EventHandlers;
using RestoPOS.Common.TestKit;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Events;

namespace RestoPOS.Infrastructure.Tests;

[Collection(PostgresCollection.Name)]
public sealed class LoyaltyAccrualTests(PostgresDatabaseFixture database)
{
    [Fact]
    public async Task Replaying_paid_order_event_records_earning_once()
    {
        await database.ResetAsync();
        var customer = Customer.Create("09123456789", "Test customer");
        var order = new Order
        {
            OrderNumber = "LOYALTY-TEST-1",
            CustomerId = customer.Id,
            Customer = customer,
            GrandTotal = 2_000_000m
        };

        await using (var setup = database.CreateDbContext())
        {
            setup.Customers.Add(customer);
            setup.Orders.Add(order);
            setup.StoreSettings.Add(new StoreSettings { StoreName = "Test", LoyaltyPointsPerMillionRial = 10 });
            await setup.SaveChangesAsync();
        }

        await using var loyaltyDb = database.CreateDbContext();
        var handler = new OrderPaidLoyaltyHandler(loyaltyDb);
        var notification = new DomainEventNotification<OrderPaidEvent>(
            new OrderPaidEvent(order.Id, order.OrderNumber, order.GrandTotal, customer.Id));
        await handler.Handle(notification, CancellationToken.None);
        await handler.Handle(notification, CancellationToken.None);

        await using var verify = database.CreateDbContext();
        (await verify.LoyaltyPointLedgers.CountAsync(x => x.OrderId == order.Id)).Should().Be(1);
        (await verify.Customers.Where(x => x.Id == customer.Id).Select(x => x.LoyaltyPoints).SingleAsync()).Should().Be(20);
        (await verify.Customers.Where(x => x.Id == customer.Id).Select(x => x.VisitCount).SingleAsync()).Should().Be(1);

        var history = await new GetCustomerPointHistoryQueryHandler(verify)
            .Handle(new GetCustomerPointHistoryQuery(customer.Id), CancellationToken.None);
        history.TotalCount.Should().Be(1);
        history.Items.Single().PointsDelta.Should().Be(20);
    }
}
