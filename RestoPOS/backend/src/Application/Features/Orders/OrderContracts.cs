using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Services;

namespace RestoPOS.Application.Features.Orders;

public sealed record OrderItemModifierDto(Guid Id, Guid MenuItemModifierId, string Name, decimal ExtraPrice, int Quantity, TicketStation TicketStation);
public sealed record OrderItemDto(Guid Id, Guid MenuItemId, string Title, int Quantity, decimal UnitPrice, decimal LineTotal, TicketStation TicketStation, string? Notes, IReadOnlyList<OrderItemModifierDto> Modifiers);
public sealed record PaymentDto(Guid Id, PaymentChannel Channel, PaymentStatus Status, decimal Amount, string? TraceNumber, string? Rrn, DateTime? PaidAt);
public sealed record OrderDto(
    Guid Id,
    string OrderNumber,
    OrderStatus Status,
    OrderType OrderType,
    string? TableNumber,
    string? CustomerPhone,
    Guid CashierId,
    Guid? ShiftId,
    decimal Subtotal,
    decimal ModifiersTotal,
    decimal DiscountAmount,
    decimal DiscountPercent,
    decimal TaxRate,
    decimal TaxAmount,
    decimal GrandTotal,
    string? Notes,
    DateTime CreatedAt,
    string CreatedAtShamsi,
    DateTime? SubmittedAt,
    IReadOnlyList<OrderItemDto> Items,
    IReadOnlyList<PaymentDto> Payments,
    IReadOnlyList<OrderItemDto> KitchenItems,
    IReadOnlyList<OrderItemDto> BarItems);

public sealed record CreateDraftOrderCommand(
    OrderType OrderType,
    string? TableNumber,
    string? CustomerPhone,
    string? Notes,
    IReadOnlyList<CreateDraftOrderItemRequest>? Items = null) : MediatR.IRequest<OrderDto>;
public sealed record CreateDraftOrderItemRequest(Guid MenuItemId, int Quantity, string? Notes, IReadOnlyList<AddModifierRequest>? Modifiers);
public sealed record AddOrderItemCommand(Guid OrderId, Guid MenuItemId, int Quantity, string? Notes, IReadOnlyList<AddModifierRequest>? Modifiers) : MediatR.IRequest<OrderDto>;
public sealed record AddModifierRequest(Guid MenuItemModifierId, int Quantity);
public sealed record RemoveOrderItemCommand(Guid OrderId, Guid OrderItemId) : MediatR.IRequest<OrderDto>;
public sealed record ApplyDiscountCommand(Guid OrderId, decimal Percent, decimal Amount) : MediatR.IRequest<OrderDto>;
public sealed record SubmitOrderCommand(Guid OrderId) : MediatR.IRequest<OrderDto>;
public sealed record UpdateOrderStatusCommand(Guid OrderId, OrderStatus Status) : MediatR.IRequest<OrderDto>;
public sealed record CancelDraftOrderCommand(Guid OrderId) : MediatR.IRequest;
public sealed record CancelOrderCommand(Guid OrderId, string? Reason) : MediatR.IRequest<OrderDto>;
public sealed record GetOrderByIdQuery(Guid Id) : MediatR.IRequest<OrderDto>;
public sealed record GetActiveOrdersQuery : MediatR.IRequest<IReadOnlyList<OrderDto>>;

public static class OrderMapping
{
    public static OrderDto ToDto(Domain.Entities.Order o) => new(
        o.Id, o.OrderNumber, o.Status, o.OrderType, o.TableNumber, o.CustomerPhone, o.CashierId, o.ShiftId,
        o.Subtotal, o.ModifiersTotal, o.DiscountAmount, o.DiscountPercent, o.TaxRate, o.TaxAmount, o.GrandTotal,
        o.Notes, o.CreatedAt, PersianDateTime.ToShamsiDateTime(o.CreatedAt), o.SubmittedAt,
        o.Items.Select(ToItem).ToList(),
        o.Payments.Select(p => new PaymentDto(p.Id, p.Channel, p.Status, p.Amount, p.TraceNumber, p.Rrn, p.PaidAt)).ToList(),
        o.KitchenTicketItems().Select(ToItem).ToList(),
        o.BarTicketItems().Select(ToItem).ToList());

    private static OrderItemDto ToItem(Domain.Entities.OrderItem i) =>
        new(i.Id, i.MenuItemId, i.Title, i.Quantity, i.UnitPrice, i.LineTotal, i.TicketStation, i.Notes,
            i.Modifiers.Select(m => new OrderItemModifierDto(m.Id, m.MenuItemModifierId, m.Name, m.ExtraPrice, m.Quantity, m.TicketStation)).ToList());
}
