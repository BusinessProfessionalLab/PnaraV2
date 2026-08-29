namespace RestoPOS.Domain.Common;

public interface IDomainEvent
{
    DateTime OccurredOnUtc { get; }
}
