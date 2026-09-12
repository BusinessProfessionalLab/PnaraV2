using RestoPOS.Domain.Common;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Domain.Entities;

public class Payment : BaseEntity
{
    public Guid OrderId { get; set; }
    public PaymentChannel Channel { get; set; }
    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;
    public decimal Amount { get; set; }
    public string? TraceNumber { get; set; }
    public string? ReferenceNumber { get; set; }
    public string? Rrn { get; set; }
    public string? TerminalId { get; set; }
    public IranianPsp Psp { get; set; }
    public Guid? PosDeviceId { get; set; }
    public string? CardMask { get; set; }
    public DateTime? PaidAt { get; set; }
    public string? FailureReason { get; set; }
    public string? ExternalPayload { get; set; }

    public Order Order { get; set; } = default!;
    public PosDevice? PosDevice { get; set; }

    public void MarkSettled(string? trace, string? rrn, string? reference, string? cardMask)
    {
        Status = PaymentStatus.Settled;
        TraceNumber = trace;
        Rrn = rrn;
        ReferenceNumber = reference;
        CardMask = cardMask;
        PaidAt = DateTime.UtcNow;
    }

    public void MarkFailed(string reason)
    {
        Status = PaymentStatus.Failed;
        FailureReason = reason;
    }

    public void MarkVoided(string? reason)
    {
        if (Status != PaymentStatus.Settled)
            throw new DomainException("فقط پرداخت تسویه‌شده قابل ابطال است.");
        Status = PaymentStatus.Cancelled;
        FailureReason = reason ?? "ابطال پرداخت";
    }

    public Payment CreateRefund(decimal amount, string? reason)
    {
        if (Status != PaymentStatus.Settled)
            throw new DomainException("فقط پرداخت تسویه‌شده قابل استرداد است.");
        if (amount <= 0 || amount > Amount)
            throw new DomainException("مبلغ استرداد نامعتبر است.");

        return new Payment
        {
            OrderId = OrderId,
            Channel = Channel,
            Amount = -decimal.Round(amount, 0, MidpointRounding.AwayFromZero),
            Status = PaymentStatus.Settled,
            Psp = Psp,
            PosDeviceId = PosDeviceId,
            TerminalId = TerminalId,
            PaidAt = DateTime.UtcNow,
            ReferenceNumber = $"REFUND-{Id:N}",
            FailureReason = reason,
            Notes = $"استرداد از پرداخت {Id}"
        };
    }

    public string? Notes { get; set; }
}
