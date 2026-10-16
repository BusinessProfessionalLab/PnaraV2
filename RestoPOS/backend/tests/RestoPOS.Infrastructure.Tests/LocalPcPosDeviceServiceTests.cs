using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Common.TestKit;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Enums;
using RestoPOS.Infrastructure.Pos;

namespace RestoPOS.Infrastructure.Tests;

[Collection(PostgresCollection.Name)]
public sealed class LocalPcPosDeviceServiceTests(PostgresDatabaseFixture database)
{
    [Fact]
    public async Task Initiate_does_not_approve_a_charge_without_a_terminal_adapter()
    {
        await database.ResetAsync();
        await using var db = database.CreateDbContext();
        var device = new PosDevice
        {
            Name = "Test terminal",
            TerminalId = "test-terminal",
            MerchantId = "test-merchant",
            IsActive = true
        };
        db.PosDevices.Add(device);
        await db.SaveChangesAsync();

        var service = new LocalPcPosDeviceService(db, NullLogger<LocalPcPosDeviceService>.Instance);
        var result = await service.InitiateAsync(new PosChargeRequest(device.Id, 1000, "test-order", Guid.NewGuid()));

        result.Accepted.Should().BeFalse();
        result.Status.Should().Be(PaymentStatus.Failed);
        result.TraceNumber.Should().BeNull();
        result.Rrn.Should().BeNull();
    }
}
