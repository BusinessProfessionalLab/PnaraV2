using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Application.Features.Shifts;

public sealed record OpenShiftCommand(decimal OpeningCash, string? Notes) : IRequest<Guid>;
public sealed record CloseShiftCommand(Guid ShiftId, decimal ClosingCash, string? Notes) : IRequest;
public sealed record GetCurrentShiftQuery : IRequest<ShiftDto?>;
public sealed record ShiftDto(Guid Id, Guid StaffId, DateTime OpenedAt, DateTime? ClosedAt, decimal OpeningCash, decimal? ClosingCash, ShiftStatus Status);

public sealed class OpenShiftCommandHandler(IApplicationDbContext db, ICurrentUserService current) : IRequestHandler<OpenShiftCommand, Guid>
{
    public async Task<Guid> Handle(OpenShiftCommand request, CancellationToken cancellationToken)
    {
        var staffId = current.UserId ?? throw new ForbiddenException();
        var open = await db.CashierShifts.AnyAsync(s => s.StaffId == staffId && s.Status == ShiftStatus.Open, cancellationToken);
        if (open)
            throw new ConflictException("شیفت باز قبلی باید ابتدا بسته شود.");

        var shift = new CashierShift
        {
            StaffId = staffId,
            OpenedAt = DateTime.UtcNow,
            OpeningCash = request.OpeningCash,
            Notes = request.Notes,
            Status = ShiftStatus.Open
        };
        db.CashierShifts.Add(shift);
        await db.SaveChangesAsync(cancellationToken);
        return shift.Id;
    }
}

public sealed class CloseShiftCommandHandler(IApplicationDbContext db, ICurrentUserService current) : IRequestHandler<CloseShiftCommand>
{
    public async Task Handle(CloseShiftCommand request, CancellationToken cancellationToken)
    {
        var shift = await db.CashierShifts.FirstOrDefaultAsync(s => s.Id == request.ShiftId, cancellationToken)
                    ?? throw new NotFoundException(nameof(CashierShift), request.ShiftId);

        var cashSales = await db.Payments
            .Where(p => p.Channel == PaymentChannel.Cash && p.Status == PaymentStatus.Settled && p.Order.ShiftId == shift.Id)
            .SumAsync(p => (decimal?)p.Amount, cancellationToken) ?? 0;

        shift.Close(request.ClosingCash, shift.OpeningCash + cashSales, request.Notes);
        await db.SaveChangesAsync(cancellationToken);
        _ = current;
    }
}

public sealed class GetCurrentShiftQueryHandler(IApplicationDbContext db, ICurrentUserService current) : IRequestHandler<GetCurrentShiftQuery, ShiftDto?>
{
    public async Task<ShiftDto?> Handle(GetCurrentShiftQuery request, CancellationToken cancellationToken)
    {
        var staffId = current.UserId ?? throw new ForbiddenException();
        var shift = await db.CashierShifts
            .Where(s => s.StaffId == staffId && s.Status == ShiftStatus.Open)
            .OrderByDescending(s => s.OpenedAt)
            .FirstOrDefaultAsync(cancellationToken);

        return shift is null ? null : new ShiftDto(shift.Id, shift.StaffId, shift.OpenedAt, shift.ClosedAt, shift.OpeningCash, shift.ClosingCash, shift.Status);
    }
}

public sealed class OpenShiftCommandValidator : AbstractValidator<OpenShiftCommand>
{
    public OpenShiftCommandValidator() => RuleFor(x => x.OpeningCash).GreaterThanOrEqualTo(0);
}
