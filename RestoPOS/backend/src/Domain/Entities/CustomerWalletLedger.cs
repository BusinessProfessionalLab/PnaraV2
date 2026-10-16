using RestoPOS.Domain.Common;

namespace RestoPOS.Domain.Entities;

/// <summary>Append-only wallet movements. Positive amounts credit the customer's wallet.</summary>
public sealed class CustomerWalletLedger : BaseEntity
{
    public Guid CustomerId { get; set; }
    public Guid? OrderId { get; set; }
    public decimal AmountRials { get; set; }
    public decimal BalanceAfterRials { get; set; }
    public string Type { get; set; } = "Cashback";
    public string? Notes { get; set; }
    public DateTime OccurredAtUtc { get; set; } = DateTime.UtcNow;

    public Customer Customer { get; set; } = default!;
}
