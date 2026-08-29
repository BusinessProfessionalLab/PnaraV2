using RestoPOS.Domain.Common;
using RestoPOS.Domain.Enums;

namespace RestoPOS.Domain.Entities;

public class OrderItemModifier : BaseEntity
{
    public Guid OrderItemId { get; set; }
    public Guid MenuItemModifierId { get; set; }
    public string Name { get; set; } = default!;
    public decimal ExtraPrice { get; set; }
    public int Quantity { get; set; }
    public TicketStation TicketStation { get; set; }

    public OrderItem OrderItem { get; set; } = default!;
}
