using Microsoft.AspNetCore.SignalR;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Application.Features.Orders;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Enums;
using RestoPOS.API.Hubs;

namespace RestoPOS.API.Services;

public sealed class SignalROrderKitchenNotifier(IHubContext<OrderKitchenHub> hub) : IOrderKitchenNotifier
{
    public async Task OrderChangedAsync(Order order, CancellationToken cancellationToken = default)
    {
        var dto = OrderMapping.ToDto(order);
        await hub.Clients.All.SendAsync("OrderUpdated", dto, cancellationToken);
        if (order.KitchenTicketItems().Any())
            await hub.Clients.Group("kitchen").SendAsync("KitchenTicket", dto, cancellationToken);
        if (order.BarTicketItems().Any())
            await hub.Clients.Group("bar").SendAsync("BarTicket", dto, cancellationToken);
    }

    public Task TicketReadyAsync(Order order, TicketStation station, CancellationToken cancellationToken = default)
    {
        var group = station == TicketStation.Bar ? "bar" : "kitchen";
        return hub.Clients.Group(group).SendAsync("TicketReady", OrderMapping.ToDto(order), cancellationToken);
    }
}
