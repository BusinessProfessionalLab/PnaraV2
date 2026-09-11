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
public sealed record GetShiftHistoryQuery(DateTime? FromUtc, DateTime? ToUtc, Guid? StaffId, int Page = 1, int PageSize = 50)
    : IRequest<RestoPOS.Application.Common.Models.PaginatedList<ShiftHistoryDto>>;
public sealed record AddCashDropCommand(Guid ShiftId, decimal AmountRials, string Reason) : IRequest<Guid>;
public sealed record AddPaidOutCommand(Guid ShiftId, decimal AmountRials, string Reason) : IRequest<Guid>;

public sealed record ShiftDto(Guid Id, Guid StaffId, DateTime OpenedAt, DateTime? ClosedAt, decimal OpeningCash, decimal? ClosingCash, ShiftStatus Status);

public sealed record CashDrawerMovementDto(
    Guid Id,
    CashDrawerMovementType Type,
    decimal AmountRials,
    string Reason,
    DateTime OccurredAtUtc,
    Guid? RecordedByUserId);

public sealed record ShiftHistoryDto(
    Guid Id,
    Guid StaffId,
    DateTime OpenedAt,
    DateTime? ClosedAt,
    decimal OpeningCash,
    decimal? ClosingCash,
    decimal? ExpectedCash,
    ShiftStatus Status,
    string? Notes,
    IReadOnlyList<CashDrawerMovementDto> Movements);

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
        var shift = await db.CashierShifts.Include(s => s.Movements)
            .FirstOrDefaultAsync(s => s.Id == request.ShiftId, cancellationToken)
                    ?? throw new NotFoundException(nameof(CashierShift), request.ShiftId);

        var cashSales = await db.Payments
            .Where(p => p.Channel == PaymentChannel.Cash && p.Status == PaymentStatus.Settled && p.Order.ShiftId == shift.Id)
            .SumAsync(p => (decimal?)p.Amount, cancellationToken) ?? 0;

        var drops = shift.Movements.Where(m => m.Type == CashDrawerMovementType.CashDrop).Sum(m => m.AmountRials);
        var paidOuts = shift.Movements.Where(m => m.Type == CashDrawerMovementType.PaidOut).Sum(m => m.AmountRials);
        var expected = shift.OpeningCash + cashSales + drops - paidOuts;

        shift.Close(request.ClosingCash, expected, request.Notes);
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

public sealed class GetShiftHistoryQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetShiftHistoryQuery, RestoPOS.Application.Common.Models.PaginatedList<ShiftHistoryDto>>
{
    public async Task<RestoPOS.Application.Common.Models.PaginatedList<ShiftHistoryDto>> Handle(
        GetShiftHistoryQuery request, CancellationToken cancellationToken)
    {
        var query = db.CashierShifts.AsNoTracking().Include(s => s.Movements).AsQueryable();
        if (request.FromUtc is not null)
            query = query.Where(s => s.OpenedAt >= request.FromUtc);
        if (request.ToUtc is not null)
            query = query.Where(s => s.OpenedAt <= request.ToUtc);
        if (request.StaffId is not null)
            query = query.Where(s => s.StaffId == request.StaffId);

        var total = await query.CountAsync(cancellationToken);
        var shifts = await query.OrderByDescending(s => s.OpenedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(cancellationToken);

        return new RestoPOS.Application.Common.Models.PaginatedList<ShiftHistoryDto>
        {
            Items = shifts.Select(s => new ShiftHistoryDto(
                s.Id, s.StaffId, s.OpenedAt, s.ClosedAt, s.OpeningCash, s.ClosingCash, s.ExpectedCash, s.Status, s.Notes,
                s.Movements.OrderBy(m => m.OccurredAtUtc)
                    .Select(m => new CashDrawerMovementDto(m.Id, m.Type, m.AmountRials, m.Reason, m.OccurredAtUtc, m.RecordedByUserId))
                    .ToList())).ToList(),
            Page = request.Page,
            PageSize = request.PageSize,
            TotalCount = total
        };
    }
}

public sealed class AddCashDropCommandValidator : AbstractValidator<AddCashDropCommand>
{
    public AddCashDropCommandValidator()
    {
        RuleFor(x => x.AmountRials).GreaterThan(0);
        RuleFor(x => x.Reason).NotEmpty();
    }
}

public sealed class AddPaidOutCommandValidator : AbstractValidator<AddPaidOutCommand>
{
    public AddPaidOutCommandValidator()
    {
        RuleFor(x => x.AmountRials).GreaterThan(0);
        RuleFor(x => x.Reason).NotEmpty();
    }
}

public sealed class AddCashDropCommandHandler(IApplicationDbContext db, ICurrentUserService current)
    : IRequestHandler<AddCashDropCommand, Guid>
{
    public async Task<Guid> Handle(AddCashDropCommand request, CancellationToken cancellationToken)
    {
        var shift = await db.CashierShifts.FirstOrDefaultAsync(s => s.Id == request.ShiftId, cancellationToken)
                    ?? throw new NotFoundException(nameof(CashierShift), request.ShiftId);
        if (shift.Status != ShiftStatus.Open)
            throw new DomainException("فقط شیفت باز امکان واریز به صندوق دارد.");

        var movement = CashDrawerMovement.Create(shift.Id, CashDrawerMovementType.CashDrop, request.AmountRials, request.Reason, current.UserId);
        db.CashDrawerMovements.Add(movement);
        await db.SaveChangesAsync(cancellationToken);
        return movement.Id;
    }
}

public sealed class AddPaidOutCommandHandler(IApplicationDbContext db, ICurrentUserService current)
    : IRequestHandler<AddPaidOutCommand, Guid>
{
    public async Task<Guid> Handle(AddPaidOutCommand request, CancellationToken cancellationToken)
    {
        var shift = await db.CashierShifts.FirstOrDefaultAsync(s => s.Id == request.ShiftId, cancellationToken)
                    ?? throw new NotFoundException(nameof(CashierShift), request.ShiftId);
        if (shift.Status != ShiftStatus.Open)
            throw new DomainException("فقط شیفت باز امکان برداشت از صندوق دارد.");

        var movement = CashDrawerMovement.Create(shift.Id, CashDrawerMovementType.PaidOut, request.AmountRials, request.Reason, current.UserId);
        db.CashDrawerMovements.Add(movement);
        await db.SaveChangesAsync(cancellationToken);
        return movement.Id;
    }
}

public sealed class OpenShiftCommandValidator : AbstractValidator<OpenShiftCommand>
{
    public OpenShiftCommandValidator() => RuleFor(x => x.OpeningCash).GreaterThanOrEqualTo(0);
}
