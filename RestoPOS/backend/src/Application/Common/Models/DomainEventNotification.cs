using MediatR;
using RestoPOS.Domain.Common;

namespace RestoPOS.Application.Common.Models;

public sealed class DomainEventNotification<TEvent>(TEvent domainEvent) : INotification
    where TEvent : IDomainEvent
{
    public TEvent DomainEvent { get; } = domainEvent;
}
