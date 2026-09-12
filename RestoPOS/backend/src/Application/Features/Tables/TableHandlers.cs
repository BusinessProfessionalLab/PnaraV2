using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Application.Features.Tables;

public sealed record DiningAreaDto(Guid Id, string Name, string? Description, int DisplayPriority, bool IsActive, int TableCount);
public sealed record DiningTableDto(
    Guid Id,
    Guid DiningAreaId,
    string AreaName,
    string Code,
    string? Name,
    int Capacity,
    TableStatus Status,
    Guid? CurrentOrderId,
    int DisplayPriority,
    bool IsActive);

public sealed record CreateDiningAreaCommand(string Name, string? Description, int DisplayPriority, bool IsActive = true) : IRequest<Guid>;
public sealed record UpdateDiningAreaCommand(Guid Id, string Name, string? Description, int DisplayPriority, bool IsActive) : IRequest;
public sealed record DeleteDiningAreaCommand(Guid Id) : IRequest;
public sealed record GetDiningAreaByIdQuery(Guid Id) : IRequest<DiningAreaDto>;
public sealed record ListDiningAreasQuery(bool ActiveOnly = true) : IRequest<IReadOnlyList<DiningAreaDto>>;

public sealed record CreateDiningTableCommand(
    Guid DiningAreaId,
    string Code,
    string? Name,
    int Capacity,
    int DisplayPriority,
    bool IsActive = true) : IRequest<Guid>;

public sealed record UpdateDiningTableCommand(
    Guid Id,
    Guid DiningAreaId,
    string Code,
    string? Name,
    int Capacity,
    int DisplayPriority,
    bool IsActive) : IRequest;

public sealed record DeleteDiningTableCommand(Guid Id) : IRequest;
public sealed record GetDiningTableByIdQuery(Guid Id) : IRequest<DiningTableDto>;
public sealed record ListDiningTablesQuery(bool ActiveOnly = true) : IRequest<IReadOnlyList<DiningTableDto>>;
public sealed record ListTablesByAreaQuery(Guid DiningAreaId, bool ActiveOnly = true) : IRequest<IReadOnlyList<DiningTableDto>>;
public sealed record UpdateTableStatusCommand(Guid Id, TableStatus Status) : IRequest<DiningTableDto>;
public sealed record TransferTableCommand(Guid SourceTableId, Guid TargetTableId) : IRequest;

public sealed class CreateDiningAreaCommandValidator : AbstractValidator<CreateDiningAreaCommand>
{
    public CreateDiningAreaCommandValidator() => RuleFor(x => x.Name).NotEmpty().MaximumLength(128);
}

public sealed class CreateDiningTableCommandValidator : AbstractValidator<CreateDiningTableCommand>
{
    public CreateDiningTableCommandValidator()
    {
        RuleFor(x => x.Code).NotEmpty().MaximumLength(32);
        RuleFor(x => x.Capacity).GreaterThan(0);
        RuleFor(x => x.DiningAreaId).NotEmpty();
    }
}

public sealed class CreateDiningAreaCommandHandler(IApplicationDbContext db) : IRequestHandler<CreateDiningAreaCommand, Guid>
{
    public async Task<Guid> Handle(CreateDiningAreaCommand request, CancellationToken cancellationToken)
    {
        var area = new DiningArea
        {
            Name = request.Name.Trim(),
            Description = request.Description,
            DisplayPriority = request.DisplayPriority,
            IsActive = request.IsActive
        };
        db.DiningAreas.Add(area);
        await db.SaveChangesAsync(cancellationToken);
        return area.Id;
    }
}

public sealed class UpdateDiningAreaCommandHandler(IApplicationDbContext db) : IRequestHandler<UpdateDiningAreaCommand>
{
    public async Task Handle(UpdateDiningAreaCommand request, CancellationToken cancellationToken)
    {
        var area = await db.DiningAreas.FirstOrDefaultAsync(a => a.Id == request.Id, cancellationToken)
                   ?? throw new NotFoundException(nameof(DiningArea), request.Id);
        area.Name = request.Name.Trim();
        area.Description = request.Description;
        area.DisplayPriority = request.DisplayPriority;
        area.IsActive = request.IsActive;
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class DeleteDiningAreaCommandHandler(IApplicationDbContext db) : IRequestHandler<DeleteDiningAreaCommand>
{
    public async Task Handle(DeleteDiningAreaCommand request, CancellationToken cancellationToken)
    {
        var area = await db.DiningAreas.FirstOrDefaultAsync(a => a.Id == request.Id, cancellationToken)
                   ?? throw new NotFoundException(nameof(DiningArea), request.Id);
        var hasActiveTables = await db.DiningTables.AnyAsync(t => t.DiningAreaId == request.Id && t.IsActive, cancellationToken);
        if (hasActiveTables)
            throw new DomainException("حذف سالن با میزهای فعال مجاز نیست.");
        area.IsDeleted = true;
        area.IsActive = false;
        area.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class GetDiningAreaByIdQueryHandler(IApplicationDbContext db) : IRequestHandler<GetDiningAreaByIdQuery, DiningAreaDto>
{
    public async Task<DiningAreaDto> Handle(GetDiningAreaByIdQuery request, CancellationToken cancellationToken)
    {
        var area = await db.DiningAreas.AsNoTracking()
            .Select(a => new { a.Id, a.Name, a.Description, a.DisplayPriority, a.IsActive, TableCount = a.Tables.Count(t => !t.IsDeleted) })
            .FirstOrDefaultAsync(a => a.Id == request.Id, cancellationToken)
            ?? throw new NotFoundException(nameof(DiningArea), request.Id);
        return new DiningAreaDto(area.Id, area.Name, area.Description, area.DisplayPriority, area.IsActive, area.TableCount);
    }
}

public sealed class ListDiningAreasQueryHandler(IApplicationDbContext db) : IRequestHandler<ListDiningAreasQuery, IReadOnlyList<DiningAreaDto>>
{
    public async Task<IReadOnlyList<DiningAreaDto>> Handle(ListDiningAreasQuery request, CancellationToken cancellationToken)
    {
        var query = db.DiningAreas.AsNoTracking().AsQueryable();
        if (request.ActiveOnly)
            query = query.Where(a => a.IsActive);
        return await query.OrderBy(a => a.DisplayPriority).ThenBy(a => a.Name)
            .Select(a => new DiningAreaDto(a.Id, a.Name, a.Description, a.DisplayPriority, a.IsActive, a.Tables.Count(t => !t.IsDeleted)))
            .ToListAsync(cancellationToken);
    }
}

public sealed class CreateDiningTableCommandHandler(IApplicationDbContext db) : IRequestHandler<CreateDiningTableCommand, Guid>
{
    public async Task<Guid> Handle(CreateDiningTableCommand request, CancellationToken cancellationToken)
    {
        if (!await db.DiningAreas.AnyAsync(a => a.Id == request.DiningAreaId, cancellationToken))
            throw new NotFoundException(nameof(DiningArea), request.DiningAreaId);
        if (await db.DiningTables.AnyAsync(t => t.Code == request.Code, cancellationToken))
            throw new ConflictException($"کد میز «{request.Code}» تکراری است.");

        var table = new DiningTable
        {
            DiningAreaId = request.DiningAreaId,
            Code = request.Code.Trim(),
            Name = request.Name,
            Capacity = request.Capacity,
            DisplayPriority = request.DisplayPriority,
            IsActive = request.IsActive,
            Status = TableStatus.Available
        };
        db.DiningTables.Add(table);
        await db.SaveChangesAsync(cancellationToken);
        return table.Id;
    }
}

public sealed class UpdateDiningTableCommandHandler(IApplicationDbContext db) : IRequestHandler<UpdateDiningTableCommand>
{
    public async Task Handle(UpdateDiningTableCommand request, CancellationToken cancellationToken)
    {
        var table = await db.DiningTables.FirstOrDefaultAsync(t => t.Id == request.Id, cancellationToken)
                    ?? throw new NotFoundException(nameof(DiningTable), request.Id);
        if (!await db.DiningAreas.AnyAsync(a => a.Id == request.DiningAreaId, cancellationToken))
            throw new NotFoundException(nameof(DiningArea), request.DiningAreaId);
        if (await db.DiningTables.AnyAsync(t => t.Code == request.Code && t.Id != request.Id, cancellationToken))
            throw new ConflictException($"کد میز «{request.Code}» تکراری است.");

        table.DiningAreaId = request.DiningAreaId;
        table.Code = request.Code.Trim();
        table.Name = request.Name;
        table.Capacity = request.Capacity;
        table.DisplayPriority = request.DisplayPriority;
        table.IsActive = request.IsActive;
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class DeleteDiningTableCommandHandler(IApplicationDbContext db) : IRequestHandler<DeleteDiningTableCommand>
{
    public async Task Handle(DeleteDiningTableCommand request, CancellationToken cancellationToken)
    {
        var table = await db.DiningTables.FirstOrDefaultAsync(t => t.Id == request.Id, cancellationToken)
                    ?? throw new NotFoundException(nameof(DiningTable), request.Id);
        if (table.Status == TableStatus.Occupied)
            throw new DomainException("میز اشغال‌شده قابل حذف نیست.");
        table.IsDeleted = true;
        table.IsActive = false;
        table.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }
}

internal static class TableMapping
{
    public static DiningTableDto ToDto(DiningTable t) => new(
        t.Id, t.DiningAreaId, t.DiningArea.Name, t.Code, t.Name, t.Capacity,
        t.Status, t.CurrentOrderId, t.DisplayPriority, t.IsActive);
}

public sealed class GetDiningTableByIdQueryHandler(IApplicationDbContext db) : IRequestHandler<GetDiningTableByIdQuery, DiningTableDto>
{
    public async Task<DiningTableDto> Handle(GetDiningTableByIdQuery request, CancellationToken cancellationToken)
    {
        var table = await db.DiningTables.AsNoTracking()
            .Include(t => t.DiningArea)
            .FirstOrDefaultAsync(t => t.Id == request.Id, cancellationToken)
            ?? throw new NotFoundException(nameof(DiningTable), request.Id);
        return TableMapping.ToDto(table);
    }
}

public sealed class ListDiningTablesQueryHandler(IApplicationDbContext db) : IRequestHandler<ListDiningTablesQuery, IReadOnlyList<DiningTableDto>>
{
    public async Task<IReadOnlyList<DiningTableDto>> Handle(ListDiningTablesQuery request, CancellationToken cancellationToken)
    {
        var query = db.DiningTables.AsNoTracking().Include(t => t.DiningArea).AsQueryable();
        if (request.ActiveOnly)
            query = query.Where(t => t.IsActive);
        var tables = await query.OrderBy(t => t.DisplayPriority).ThenBy(t => t.Code).ToListAsync(cancellationToken);
        return tables.Select(TableMapping.ToDto).ToList();
    }
}

public sealed class ListTablesByAreaQueryHandler(IApplicationDbContext db) : IRequestHandler<ListTablesByAreaQuery, IReadOnlyList<DiningTableDto>>
{
    public async Task<IReadOnlyList<DiningTableDto>> Handle(ListTablesByAreaQuery request, CancellationToken cancellationToken)
    {
        var query = db.DiningTables.AsNoTracking().Include(t => t.DiningArea)
            .Where(t => t.DiningAreaId == request.DiningAreaId);
        if (request.ActiveOnly)
            query = query.Where(t => t.IsActive);
        var tables = await query.OrderBy(t => t.DisplayPriority).ThenBy(t => t.Code).ToListAsync(cancellationToken);
        return tables.Select(TableMapping.ToDto).ToList();
    }
}

public sealed class UpdateTableStatusCommandHandler(IApplicationDbContext db) : IRequestHandler<UpdateTableStatusCommand, DiningTableDto>
{
    public async Task<DiningTableDto> Handle(UpdateTableStatusCommand request, CancellationToken cancellationToken)
    {
        var table = await db.DiningTables.Include(t => t.DiningArea)
            .FirstOrDefaultAsync(t => t.Id == request.Id, cancellationToken)
            ?? throw new NotFoundException(nameof(DiningTable), request.Id);
        table.SetStatus(request.Status);
        await db.SaveChangesAsync(cancellationToken);
        return TableMapping.ToDto(table);
    }
}

public sealed class TransferTableCommandHandler(IApplicationDbContext db) : IRequestHandler<TransferTableCommand>
{
    public async Task Handle(TransferTableCommand request, CancellationToken cancellationToken)
    {
        await db.ExecuteResilientTransactionAsync(async ct =>
        {
            var source = await db.DiningTables.FirstOrDefaultAsync(t => t.Id == request.SourceTableId, ct)
                         ?? throw new NotFoundException(nameof(DiningTable), request.SourceTableId);
            var target = await db.DiningTables.FirstOrDefaultAsync(t => t.Id == request.TargetTableId, ct)
                         ?? throw new NotFoundException(nameof(DiningTable), request.TargetTableId);

            var orderId = source.CurrentOrderId
                          ?? throw new DomainException("میز مبدأ سفارش فعالی ندارد.");

            source.TransferTo(target);

            var order = await db.Orders.FirstOrDefaultAsync(o => o.Id == orderId, ct)
                        ?? throw new NotFoundException(nameof(Order), orderId);
            order.DiningTableId = target.Id;
            order.TableNumber = target.Code;
        }, cancellationToken);
    }
}
