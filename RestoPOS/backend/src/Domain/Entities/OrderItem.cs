using RestoPOS.Domain.Common;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Domain.Entities;

public class OrderItem : BaseEntity
{
    public Guid OrderId { get; set; }
    public Guid MenuItemId { get; set; }
    public string Title { get; set; } = default!;
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal DiscountPercent { get; set; }
    public bool TaxInclusive { get; set; }
    public decimal LineSubtotal { get; set; }
    public decimal LineModifiersTotal { get; set; }
    public decimal LineTotal { get; set; }
    public TicketStation TicketStation { get; set; }
    public string? Notes { get; set; }

    public Order Order { get; set; } = default!;
    public MenuItem? MenuItem { get; set; }
    public ICollection<OrderItemModifier> Modifiers { get; set; } = [];

    public OrderItemModifier AddModifier(MenuItemModifier modifier, int quantity)
    {
        if (!modifier.IsActive)
            throw new DomainException("افزودنی غیرفعال است.");
        if (quantity <= 0)
            throw new DomainException("تعداد افزودنی باید حداقل ۱ باشد.");

        var line = new OrderItemModifier
        {
            OrderItemId = Id,
            MenuItemModifierId = modifier.Id,
            Name = modifier.Name,
            ExtraPrice = modifier.ExtraPrice,
            Quantity = quantity,
            TicketStation = modifier.TicketStation
        };
        Modifiers.Add(line);
        return line;
    }

    public OrderItemModifier AddAddon(Addon addon, int quantity)
    {
        if (!addon.IsActive || addon.IsDeleted)
            throw new DomainException("افزودنی غیرفعال است.");
        if (quantity <= 0)
            throw new DomainException("تعداد افزودنی باید حداقل ۱ باشد.");
        var line = new OrderItemModifier
        {
            OrderItemId = Id, AddonId = addon.Id, Name = addon.Name,
            ExtraPrice = addon.ExtraPrice, Quantity = quantity, TicketStation = addon.TicketStation
        };
        Modifiers.Add(line);
        return line;
    }
}
