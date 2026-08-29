using RestoPOS.Domain.Enums;

namespace RestoPOS.Application.Common.Interfaces;

public sealed record PosChargeRequest(
    Guid DeviceId,
    decimal AmountRial,
    string OrderNumber,
    Guid PaymentId);

public sealed record PosChargeResult(
    bool Accepted,
    string? TraceNumber,
    string? Rrn,
    string? ReferenceNumber,
    string? CardMask,
    string? ErrorMessage,
    PaymentStatus Status);

public interface IPosDeviceService
{
    Task<PosChargeResult> InitiateAsync(PosChargeRequest request, CancellationToken cancellationToken = default);
    Task<PosChargeResult> PollAsync(Guid paymentId, CancellationToken cancellationToken = default);
    Task ConfirmSettlementAsync(Guid paymentId, CancellationToken cancellationToken = default);
}
