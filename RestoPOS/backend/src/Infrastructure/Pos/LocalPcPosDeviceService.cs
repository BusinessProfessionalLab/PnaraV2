using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Exceptions;
using RestoPOS.Infrastructure.Persistence;

namespace RestoPOS.Infrastructure.Pos;

/// <summary>
/// Safe placeholder used until a store's certified PSP adapter is installed.
/// It never reports a simulated card charge as approved.
/// </summary>
public sealed class LocalPcPosDeviceService(ApplicationDbContext db, ILogger<LocalPcPosDeviceService> logger) : IPosDeviceService
{
    public async Task<PosChargeResult> InitiateAsync(PosChargeRequest request, CancellationToken cancellationToken = default)
    {
        var device = await db.PosDevices.AsNoTracking().FirstOrDefaultAsync(d => d.Id == request.DeviceId, cancellationToken)
                     ?? throw new NotFoundException("PosDevice", request.DeviceId);

        logger.LogInformation(
            "PC-POS charge {Amount} IRR on {Psp} {Protocol} {Endpoint} for order {Order} payment {Payment}",
            request.AmountRial, device.Psp, device.Protocol, Describe(device), request.OrderNumber, request.PaymentId);

        return new PosChargeResult(
            Accepted: false,
            TraceNumber: null,
            Rrn: null,
            ReferenceNumber: null,
            CardMask: null,
            ErrorMessage: "No certified payment-terminal adapter is configured. Card-terminal payments are unavailable.",
            Status: PaymentStatus.Failed);
    }

    public Task<PosChargeResult> PollAsync(Guid paymentId, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(new PosChargeResult(
            Accepted: false,
            TraceNumber: null,
            Rrn: null,
            ReferenceNumber: null,
            CardMask: null,
            ErrorMessage: "No certified payment-terminal adapter is configured.",
            Status: PaymentStatus.Failed));
    }

    public Task ConfirmSettlementAsync(Guid paymentId, CancellationToken cancellationToken = default)
    {
        logger.LogInformation("PC-POS settlement confirmed for payment {PaymentId}", paymentId);
        return Task.CompletedTask;
    }

    private static string Describe(Domain.Entities.PosDevice device) =>
        device.Protocol == PosProtocol.Lan
            ? $"{device.IpAddress}:{device.Port}"
            : $"{device.ComPort}@{device.BaudRate}";
}
