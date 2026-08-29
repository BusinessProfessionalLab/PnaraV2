using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Exceptions;
using RestoPOS.Infrastructure.Persistence;

namespace RestoPOS.Infrastructure.Pos;

/// <summary>
/// Local PC-POS bridge. Talks to Iranian PSP terminals (Asan Pardakht, SEP, BehPardakht) over LAN/COM.
/// Default implementation simulates a successful settlement so stores can go live against a sandbox device,
/// then swap protocol adapters per PSP without changing application code.
/// </summary>
public sealed class LocalPcPosDeviceService(ApplicationDbContext db, ILogger<LocalPcPosDeviceService> logger) : IPosDeviceService
{
    private static readonly ConcurrentDictionary<Guid, PosChargeResult> Ledger = new();

    public async Task<PosChargeResult> InitiateAsync(PosChargeRequest request, CancellationToken cancellationToken = default)
    {
        var device = await db.PosDevices.AsNoTracking().FirstOrDefaultAsync(d => d.Id == request.DeviceId, cancellationToken)
                     ?? throw new NotFoundException("PosDevice", request.DeviceId);

        logger.LogInformation(
            "PC-POS charge {Amount} IRR on {Psp} {Protocol} {Endpoint} for order {Order} payment {Payment}",
            request.AmountRial, device.Psp, device.Protocol, Describe(device), request.OrderNumber, request.PaymentId);

        // Protocol adapters would open TCP (typical ports 1362/12000) or COM and send ISO-like frames.
        // Simulated approved response with a synthetic trace — replace with vendor SDK in production.
        var result = new PosChargeResult(
            Accepted: true,
            TraceNumber: DateTime.UtcNow.ToString("HHmmssff"),
            Rrn: Guid.NewGuid().ToString("N")[..12].ToUpperInvariant(),
            ReferenceNumber: request.PaymentId.ToString("N")[..10].ToUpperInvariant(),
            CardMask: "6037********1234",
            ErrorMessage: null,
            Status: PaymentStatus.Settled);

        Ledger[request.PaymentId] = result;
        return result;
    }

    public Task<PosChargeResult> PollAsync(Guid paymentId, CancellationToken cancellationToken = default)
    {
        if (Ledger.TryGetValue(paymentId, out var result))
            return Task.FromResult(result);

        return Task.FromResult(new PosChargeResult(false, null, null, null, null, "تراکنش یافت نشد.", PaymentStatus.Failed));
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
