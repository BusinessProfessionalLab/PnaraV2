using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Enums;

namespace RestoPOS.Application.Common.Interfaces;

public interface IOrderKitchenNotifier
{
    Task OrderChangedAsync(Order order, CancellationToken cancellationToken = default);
    Task TicketReadyAsync(Order order, TicketStation station, CancellationToken cancellationToken = default);
}
