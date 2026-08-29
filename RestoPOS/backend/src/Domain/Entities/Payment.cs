using RestoPOS.Domain.Common;
using RestoPOS.Domain.Enums;

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
}
