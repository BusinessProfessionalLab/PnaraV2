using MediatR;
using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Enums;

namespace RestoPOS.Application.Features.Payments;

public sealed record PosDeviceDto(
    Guid Id,
    string Name,
    PosProtocol Protocol,
    IranianPsp Psp,
    string? IpAddress,
    int? Port,
    string TerminalId,
    bool IsActive);

public sealed record GetPosDevicesQuery : IRequest<IReadOnlyList<PosDeviceDto>>;

public sealed class GetPosDevicesQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetPosDevicesQuery, IReadOnlyList<PosDeviceDto>>
{
    public async Task<IReadOnlyList<PosDeviceDto>> Handle(GetPosDevicesQuery request, CancellationToken cancellationToken)
    {
        return await db.PosDevices.AsNoTracking()
            .Where(d => d.IsActive)
            .OrderBy(d => d.Name)
            .Select(d => new PosDeviceDto(d.Id, d.Name, d.Protocol, d.Psp, d.IpAddress, d.Port, d.TerminalId, d.IsActive))
            .ToListAsync(cancellationToken);
    }
}
