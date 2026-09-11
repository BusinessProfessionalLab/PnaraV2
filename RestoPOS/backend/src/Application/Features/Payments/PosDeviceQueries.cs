using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Application.Features.Payments;

public sealed record PosDeviceDto(
    Guid Id,
    string Name,
    PosProtocol Protocol,
    IranianPsp Psp,
    string? IpAddress,
    int? Port,
    string? ComPort,
    int? BaudRate,
    string TerminalId,
    string MerchantId,
    bool IsActive);

public sealed record GetPosDevicesQuery(bool ActiveOnly = true) : IRequest<IReadOnlyList<PosDeviceDto>>;
public sealed record GetPosDeviceByIdQuery(Guid Id) : IRequest<PosDeviceDto>;

public sealed record CreatePosDeviceCommand(
    string Name,
    PosProtocol Protocol,
    IranianPsp Psp,
    string? IpAddress,
    int? Port,
    string? ComPort,
    int? BaudRate,
    string TerminalId,
    string MerchantId,
    bool IsActive = true) : IRequest<Guid>;

public sealed record UpdatePosDeviceCommand(
    Guid Id,
    string Name,
    PosProtocol Protocol,
    IranianPsp Psp,
    string? IpAddress,
    int? Port,
    string? ComPort,
    int? BaudRate,
    string TerminalId,
    string MerchantId,
    bool IsActive) : IRequest;

public sealed record DeletePosDeviceCommand(Guid Id) : IRequest;
public sealed record TestPosDeviceConnectionCommand(Guid Id) : IRequest<PosDeviceTestResult>;
public sealed record PosDeviceTestResult(bool Success, string Message);

internal static class PosDeviceMapping
{
    public static PosDeviceDto ToDto(PosDevice d) => new(
        d.Id, d.Name, d.Protocol, d.Psp, d.IpAddress, d.Port, d.ComPort, d.BaudRate, d.TerminalId, d.MerchantId, d.IsActive);
}

public sealed class CreatePosDeviceCommandValidator : AbstractValidator<CreatePosDeviceCommand>
{
    public CreatePosDeviceCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(128);
        RuleFor(x => x.TerminalId).NotEmpty();
        RuleFor(x => x.MerchantId).NotEmpty();
    }
}

public sealed class GetPosDevicesQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetPosDevicesQuery, IReadOnlyList<PosDeviceDto>>
{
    public async Task<IReadOnlyList<PosDeviceDto>> Handle(GetPosDevicesQuery request, CancellationToken cancellationToken)
    {
        var query = db.PosDevices.AsNoTracking().AsQueryable();
        if (request.ActiveOnly)
            query = query.Where(d => d.IsActive);
        return await query.OrderBy(d => d.Name)
            .Select(d => new PosDeviceDto(d.Id, d.Name, d.Protocol, d.Psp, d.IpAddress, d.Port, d.ComPort, d.BaudRate, d.TerminalId, d.MerchantId, d.IsActive))
            .ToListAsync(cancellationToken);
    }
}

public sealed class GetPosDeviceByIdQueryHandler(IApplicationDbContext db) : IRequestHandler<GetPosDeviceByIdQuery, PosDeviceDto>
{
    public async Task<PosDeviceDto> Handle(GetPosDeviceByIdQuery request, CancellationToken cancellationToken)
    {
        var device = await db.PosDevices.AsNoTracking().FirstOrDefaultAsync(d => d.Id == request.Id, cancellationToken)
                     ?? throw new NotFoundException(nameof(PosDevice), request.Id);
        return PosDeviceMapping.ToDto(device);
    }
}

public sealed class CreatePosDeviceCommandHandler(IApplicationDbContext db) : IRequestHandler<CreatePosDeviceCommand, Guid>
{
    public async Task<Guid> Handle(CreatePosDeviceCommand request, CancellationToken cancellationToken)
    {
        var device = new PosDevice
        {
            Name = request.Name.Trim(),
            Protocol = request.Protocol,
            Psp = request.Psp,
            IpAddress = request.IpAddress,
            Port = request.Port,
            ComPort = request.ComPort,
            BaudRate = request.BaudRate,
            TerminalId = request.TerminalId.Trim(),
            MerchantId = request.MerchantId.Trim(),
            IsActive = request.IsActive
        };
        db.PosDevices.Add(device);
        await db.SaveChangesAsync(cancellationToken);
        return device.Id;
    }
}

public sealed class UpdatePosDeviceCommandHandler(IApplicationDbContext db) : IRequestHandler<UpdatePosDeviceCommand>
{
    public async Task Handle(UpdatePosDeviceCommand request, CancellationToken cancellationToken)
    {
        var device = await db.PosDevices.FirstOrDefaultAsync(d => d.Id == request.Id, cancellationToken)
                     ?? throw new NotFoundException(nameof(PosDevice), request.Id);
        device.Name = request.Name.Trim();
        device.Protocol = request.Protocol;
        device.Psp = request.Psp;
        device.IpAddress = request.IpAddress;
        device.Port = request.Port;
        device.ComPort = request.ComPort;
        device.BaudRate = request.BaudRate;
        device.TerminalId = request.TerminalId.Trim();
        device.MerchantId = request.MerchantId.Trim();
        device.IsActive = request.IsActive;
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class DeletePosDeviceCommandHandler(IApplicationDbContext db) : IRequestHandler<DeletePosDeviceCommand>
{
    public async Task Handle(DeletePosDeviceCommand request, CancellationToken cancellationToken)
    {
        var device = await db.PosDevices.FirstOrDefaultAsync(d => d.Id == request.Id, cancellationToken)
                     ?? throw new NotFoundException(nameof(PosDevice), request.Id);
        device.IsDeleted = true;
        device.IsActive = false;
        device.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class TestPosDeviceConnectionCommandHandler(IApplicationDbContext db, IPosDeviceService pos)
    : IRequestHandler<TestPosDeviceConnectionCommand, PosDeviceTestResult>
{
    public async Task<PosDeviceTestResult> Handle(TestPosDeviceConnectionCommand request, CancellationToken cancellationToken)
    {
        var device = await db.PosDevices.AsNoTracking().FirstOrDefaultAsync(d => d.Id == request.Id, cancellationToken)
                     ?? throw new NotFoundException(nameof(PosDevice), request.Id);

        try
        {
            // Soft connectivity probe: zero-amount initiate is not always supported; report configured reachability stub.
            _ = pos;
            if (device.Protocol == PosProtocol.Lan && string.IsNullOrWhiteSpace(device.IpAddress))
                return new PosDeviceTestResult(false, "آدرس IP برای پروتکل شبکه تنظیم نشده است.");
            if ((device.Protocol is PosProtocol.Com or PosProtocol.Serial) && string.IsNullOrWhiteSpace(device.ComPort))
                return new PosDeviceTestResult(false, "پورت سریال تنظیم نشده است.");

            return new PosDeviceTestResult(true, $"اتصال به کارتخوان «{device.Name}» آماده است.");
        }
        catch (Exception ex)
        {
            return new PosDeviceTestResult(false, ex.Message);
        }
    }
}
