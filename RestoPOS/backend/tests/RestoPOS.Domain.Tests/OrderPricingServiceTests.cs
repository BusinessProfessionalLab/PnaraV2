using FluentAssertions;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Services;
using RestoPOS.Domain.ValueObjects;

namespace RestoPOS.Domain.Tests;

public class OrderPricingServiceTests
{
    [Fact]
    public void Calculates_vat_on_top_of_exclusive_prices()
    {
        var order = Order.CreateDraft("TI-1", OrderType.DineIn, Guid.NewGuid(), null, 0.10m, "12", null);
        var coffee = new MenuItem { Title = "لاته", BasePrice = 100_000, TaxInclusive = false, IsActive = true, TicketStation = TicketStation.Bar };
        var extra = new MenuItemModifier { Name = "شیر جو", ExtraPrice = 20_000, IsActive = true, MenuItem = coffee };

        var line = order.AddItem(coffee, 2, null);
        line.AddModifier(extra, 1);
        order.Recalculate();

        order.Subtotal.Should().Be(200_000);
        order.ModifiersTotal.Should().Be(40_000);
        order.TaxAmount.Should().Be(24_000);
        order.GrandTotal.Should().Be(264_000);
    }

    [Fact]
    public void Applies_percent_and_amount_discount_before_vat()
    {
        var order = Order.CreateDraft("TI-2", OrderType.Takeaway, Guid.NewGuid(), null, 0.10m, null, null);
        var item = new MenuItem { Title = "اسپرسو", BasePrice = 100_000, IsActive = true };
        order.AddItem(item, 1, null);
        order.ApplyDiscount(10, 5_000);
        order.Recalculate();

        order.GrandTotal.Should().Be(93_500);
    }
}

public class OrderLifecycleTests
{
    [Fact]
    public void Discarding_draft_marks_deleted_and_submit_requires_items()
    {
        var order = Order.CreateDraft("TI-3", OrderType.Bar, Guid.NewGuid(), null, 0.10m, null, null);
        var act = () => order.Submit();
        act.Should().Throw<RestoPOS.Domain.Exceptions.DomainException>();

        order.AddItem(new MenuItem { Title = "چای", BasePrice = 50_000, IsActive = true }, 1, null);
        order.Submit();
        order.Status.Should().Be(OrderStatus.Submitted);
        order.KitchenTicketItems().Should().NotBeEmpty();
    }

    [Fact]
    public void Inventory_inbound_updates_average_cost_and_low_stock_event()
    {
        var milk = new InventoryItem
        {
            Name = "شیر",
            Sku = "MILK",
            ReorderPoint = 100,
            UnitOfMeasure = UnitOfMeasure.Ml
        };
        milk.ApplyInbound(50, 80, null, "open", "A");
        milk.ApplyInbound(50, 100, null, "buy", "B");
        milk.AverageCost.Should().Be(90);
        milk.ApplyRecipeDeduction(20, Guid.NewGuid(), null);
        milk.IsBelowReorderPoint.Should().BeTrue();
        milk.DomainEvents.Should().ContainSingle(e => e is RestoPOS.Domain.Events.InventoryLowStockEvent);
    }
}

public class PhoneNumberTests
{
    [Theory]
    [InlineData("09121234567", "09121234567")]
    [InlineData("+989121234567", "09121234567")]
    [InlineData("00989121234567", "09121234567")]
    public void Normalizes_iranian_mobiles(string input, string expected)
    {
        new PhoneNumber(input).Value.Should().Be(expected);
    }
}

public class PersianDateTimeTests
{
    [Fact]
    public void Formats_shamsi_compact_stamp()
    {
        var stamp = PersianDateTime.ToShamsiCompact(new DateTime(2026, 3, 21, 0, 0, 0, DateTimeKind.Local));
        stamp.Should().HaveLength(8);
        stamp.Should().StartWith("14");
    }
}
