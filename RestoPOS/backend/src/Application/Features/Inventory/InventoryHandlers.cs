using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Application.Features.Inventory;

public sealed record InventoryItemDto(
    Guid Id, string Name, string Sku, UnitOfMeasure UnitOfMeasure, decimal ReorderPoint, decimal SafetyStock,
    decimal CurrentStock, decimal CostPrice, decimal AverageCost, bool IsActive, bool IsLowStock);

public sealed record InventoryTransactionDto(
    Guid Id, Guid InventoryItemId, string ItemName, InventoryTransactionType Type, decimal Quantity, decimal UnitCost,
    string? Reference, string? Notes, DateTime OccurredAt);

public sealed record CreateInventoryItemCommand(
    string Name, string Sku, UnitOfMeasure UnitOfMeasure, decimal ReorderPoint, decimal SafetyStock,
    decimal OpeningStock, decimal CostPrice) : IRequest<Guid>;

public sealed record ReceiveStockCommand(Guid InventoryItemId, decimal Quantity, decimal UnitCost, string? Notes, string? BatchReference) : IRequest<Guid>;
public sealed record RecordWasteCommand(Guid InventoryItemId, decimal Quantity, string? Notes) : IRequest<Guid>;
public sealed record GetInventoryQuery : IRequest<IReadOnlyList<InventoryItemDto>>;
public sealed record GetLowStockQuery : IRequest<IReadOnlyList<InventoryItemDto>>;
public sealed record GetInventoryTransactionsQuery(Guid? InventoryItemId, DateTime? FromUtc, DateTime? ToUtc) : IRequest<IReadOnlyList<InventoryTransactionDto>>;

public sealed class CreateInventoryItemCommandValidator : AbstractValidator<CreateInventoryItemCommand>
{
    public CreateInventoryItemCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty();
        RuleFor(x => x.Sku).NotEmpty();
        RuleFor(x => x.CostPrice).GreaterThanOrEqualTo(0);
        RuleFor(x => x.OpeningStock).GreaterThanOrEqualTo(0);
    }
}

public sealed class CreateInventoryItemCommandHandler(IApplicationDbContext db) : IRequestHandler<CreateInventoryItemCommand, Guid>
{
    public async Task<Guid> Handle(CreateInventoryItemCommand request, CancellationToken cancellationToken)
    {
        if (await db.InventoryItems.AnyAsync(i => i.Sku == request.Sku, cancellationToken))
            throw new ConflictException($"SKU تکراری است: {request.Sku}");

        var item = new InventoryItem
        {
            Name = request.Name,
            Sku = request.Sku,
            UnitOfMeasure = request.UnitOfMeasure,
            ReorderPoint = request.ReorderPoint,
            SafetyStock = request.SafetyStock,
            CostPrice = request.CostPrice,
            AverageCost = request.CostPrice
        };
        db.InventoryItems.Add(item);
        if (request.OpeningStock > 0)
            item.ApplyInbound(request.OpeningStock, request.CostPrice, null, "موجودی اول دوره", "OPENING");

        await db.SaveChangesAsync(cancellationToken);
        return item.Id;
    }
}

public sealed class ReceiveStockCommandHandler(IApplicationDbContext db, ICurrentUserService current)
    : IRequestHandler<ReceiveStockCommand, Guid>
{
    public async Task<Guid> Handle(ReceiveStockCommand request, CancellationToken cancellationToken)
    {
        var item = await db.InventoryItems.FirstOrDefaultAsync(i => i.Id == request.InventoryItemId, cancellationToken)
                   ?? throw new NotFoundException(nameof(InventoryItem), request.InventoryItemId);
        var tx = item.ApplyInbound(request.Quantity, request.UnitCost, current.UserId, request.Notes, request.BatchReference);
        await db.SaveChangesAsync(cancellationToken);
        return tx.Id;
    }
}

public sealed class RecordWasteCommandHandler(IApplicationDbContext db, ICurrentUserService current)
    : IRequestHandler<RecordWasteCommand, Guid>
{
    public async Task<Guid> Handle(RecordWasteCommand request, CancellationToken cancellationToken)
    {
        var item = await db.InventoryItems.FirstOrDefaultAsync(i => i.Id == request.InventoryItemId, cancellationToken)
                   ?? throw new NotFoundException(nameof(InventoryItem), request.InventoryItemId);
        var tx = item.ApplyWaste(request.Quantity, current.UserId, request.Notes);
        await db.SaveChangesAsync(cancellationToken);
        return tx.Id;
    }
}

public sealed class GetInventoryQueryHandler(IApplicationDbContext db) : IRequestHandler<GetInventoryQuery, IReadOnlyList<InventoryItemDto>>
{
    public async Task<IReadOnlyList<InventoryItemDto>> Handle(GetInventoryQuery request, CancellationToken cancellationToken) =>
        await db.InventoryItems.AsNoTracking().OrderBy(i => i.Name)
            .Select(i => new InventoryItemDto(i.Id, i.Name, i.Sku, i.UnitOfMeasure, i.ReorderPoint, i.SafetyStock, i.CurrentStock, i.CostPrice, i.AverageCost, i.IsActive, i.CurrentStock <= i.ReorderPoint))
            .ToListAsync(cancellationToken);
}

public sealed class GetLowStockQueryHandler(IApplicationDbContext db) : IRequestHandler<GetLowStockQuery, IReadOnlyList<InventoryItemDto>>
{
    public async Task<IReadOnlyList<InventoryItemDto>> Handle(GetLowStockQuery request, CancellationToken cancellationToken) =>
        await db.InventoryItems.AsNoTracking()
            .Where(i => i.IsActive && i.CurrentStock <= i.ReorderPoint)
            .OrderBy(i => i.CurrentStock)
            .Select(i => new InventoryItemDto(i.Id, i.Name, i.Sku, i.UnitOfMeasure, i.ReorderPoint, i.SafetyStock, i.CurrentStock, i.CostPrice, i.AverageCost, i.IsActive, true))
            .ToListAsync(cancellationToken);
}

public sealed class GetInventoryTransactionsQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetInventoryTransactionsQuery, IReadOnlyList<InventoryTransactionDto>>
{
    public async Task<IReadOnlyList<InventoryTransactionDto>> Handle(GetInventoryTransactionsQuery request, CancellationToken cancellationToken)
    {
        var query = db.InventoryTransactions.AsNoTracking().Include(t => t.InventoryItem).AsQueryable();
        if (request.InventoryItemId is not null)
            query = query.Where(t => t.InventoryItemId == request.InventoryItemId);
        if (request.FromUtc is not null)
            query = query.Where(t => t.OccurredAt >= request.FromUtc);
        if (request.ToUtc is not null)
            query = query.Where(t => t.OccurredAt <= request.ToUtc);

        return await query.OrderByDescending(t => t.OccurredAt)
            .Select(t => new InventoryTransactionDto(t.Id, t.InventoryItemId, t.InventoryItem.Name, t.Type, t.Quantity, t.UnitCost, t.Reference, t.Notes, t.OccurredAt))
            .ToListAsync(cancellationToken);
    }
}
