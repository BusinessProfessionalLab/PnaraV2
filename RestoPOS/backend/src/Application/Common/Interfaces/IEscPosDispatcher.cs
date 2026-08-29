using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Enums;

namespace RestoPOS.Application.Common.Interfaces;

public interface IEscPosDispatcher
{
    Task PrintCustomerReceiptAsync(Order order, StoreSettings settings, CancellationToken cancellationToken = default);
    Task PrintPrepTicketAsync(Order order, TicketStation station, StoreSettings settings, CancellationToken cancellationToken = default);
}
