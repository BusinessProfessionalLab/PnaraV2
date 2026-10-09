using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Enums;
using RestoPOS.Infrastructure.Persistence;
using RestoPOS.Infrastructure.Pos;

namespace RestoPOS.API.Tests;

public sealed class LocalPcPosDeviceServiceTests
{
    [Fact]
    public async Task Initiate_does_not_approve_a_charge_without_a_terminal_adapter()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"PosAdapter-{Guid.NewGuid():N}")
            .Options;
        await using var db = new ApplicationDbContext(options, new TestCurrentUserService(), new NoOpDomainEventDispatcher());
        var device = new PosDevice
        {
            Id = Guid.NewGuid(),
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

    private sealed class TestCurrentUserService : ICurrentUserService
    {
        public Guid? UserId => null;
        public string? UserName => "test";
        public IReadOnlyCollection<string> Permissions => [];
        public bool IsAuthenticated => false;
        public string? IpAddress => null;
    }
}
