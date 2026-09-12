using RestoPOS.Domain.Common;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Domain.Entities;

public class LoyaltyPointLedger : BaseEntity
{
    public Guid CustomerId { get; set; }
    public LoyaltyLedgerType Type { get; set; }
    public int PointsDelta { get; set; }
    public int BalanceAfter { get; set; }
    public Guid? OrderId { get; set; }
    public string? Notes { get; set; }
    public Guid? RecordedByUserId { get; set; }
    public DateTime OccurredAtUtc { get; set; } = DateTime.UtcNow;

    public Customer Customer { get; set; } = default!;
}
