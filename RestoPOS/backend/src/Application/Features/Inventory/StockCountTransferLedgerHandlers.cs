using MediatR;
using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Application.Common.Models;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Application.Features.Inventory;

public sealed class StartStockCountCommandHandler(IApplicationDbContext db, ICurrentUserService current)
    : IRequestHandler<StartStockCountCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(StartStockCountCommand request, CancellationToken cancellationToken)
    {
        try
        {
            Guid id = Guid.Empty;
            await db.ExecuteResilientTransactionAsync(async ct =>
            {
                var count = new StockCount
                {
                    Title = request.Title.Trim(),
                    LocationFilter = request.LocationFilter,
                    Notes = request.Notes,
                    StartedByUserId = current.UserId,
                    Status = StockCountStatus.InProgress,
                    StartedAtUtc = DateTime.UtcNow
                };

                var itemsQuery = db.InventoryItems.Where(i => i.IsActive);
                if (request.LocationFilter is not null)
                    itemsQuery = itemsQuery.Where(i => i.StorageLocation == request.LocationFilter);

                var items = await itemsQuery.ToListAsync(ct);
                if (items.Count == 0)
                    throw new DomainException("هیچ کالای فعالی برای انبارگردانی یافت نشد.");

                foreach (var item in items)
                {
                    count.Items.Add(new StockCountItem
                    {
                        InventoryItemId = item.Id,
                        SystemSnapshotQty = item.CurrentStock,
                        SnapshotUnitCostRials = item.WeightedAverageCost,
                        PhysicalCountQty = null
                    });
                }

                db.StockCounts.Add(count);
                id = count.Id;
            }, cancellationToken);

            return Result<Guid>.Success(id);
        }
        catch (DomainException ex)
        {
            return Result<Guid>.Failure(ex.Message);
        }
    }
}

public sealed class SubmitStockCountCommandHandler(IApplicationDbContext db)
    : IRequestHandler<SubmitStockCountCommand, Result>
{
    public async Task<Result> Handle(SubmitStockCountCommand request, CancellationToken cancellationToken)
    {
        try
        {
            await db.ExecuteResilientTransactionAsync(async ct =>
            {
                var count = await db.StockCounts.Include(c => c.Items)
                    .FirstOrDefaultAsync(c => c.Id == request.StockCountId, ct)
                            ?? throw new NotFoundException(nameof(StockCount), request.StockCountId);

                if (count.Status is StockCountStatus.Approved)
                    throw new DomainException("انبارگردانی تأییدشده قابل ویرایش نیست.");

                var map = request.Counts.ToDictionary(c => c.InventoryItemId, c => c.PhysicalCountQty);
                foreach (var line in count.Items)
                {
                    if (!map.TryGetValue(line.InventoryItemId, out var physical))
                        continue;
                    line.SetPhysicalCount(physical, line.SnapshotUnitCostRials);
                }

                var missing = count.Items.Where(i => i.PhysicalCountQty is null).Select(i => i.InventoryItemId).ToList();
                if (missing.Count > 0)
                    throw new DomainException($"شمارش فیزیکی برای {missing.Count} قلم ثبت نشده است.");

                count.SubmitCounts();
            }, cancellationToken);

            return Result.Success();
        }
        catch (DomainException ex)
        {
            return Result.Failure(ex.Message);
        }
    }
}

public sealed class ApproveStockCountCommandHandler(IApplicationDbContext db, ICurrentUserService current)
    : IRequestHandler<ApproveStockCountCommand, Result>
{
    public async Task<Result> Handle(ApproveStockCountCommand request, CancellationToken cancellationToken)
    {
        try
        {
            await db.ExecuteResilientTransactionAsync(async ct =>
            {
                var count = await db.StockCounts.Include(c => c.Items)
                    .FirstOrDefaultAsync(c => c.Id == request.StockCountId, ct)
                            ?? throw new NotFoundException(nameof(StockCount), request.StockCountId);

                count.Approve(current.UserId);

                foreach (var line in count.Items)
                {
                    if (line.PhysicalCountQty is null)
                        throw new DomainException("شمارش فیزیکی ناقص است.");
                    if (line.DiscrepancyQty == 0)
                        continue;

                    var item = await db.InventoryItems.FirstAsync(i => i.Id == line.InventoryItemId, ct);
                    item.ApplyStockCountAdjustment(line.PhysicalCountQty.Value, current.UserId, count.Id);
                    line.CostVarianceRials = decimal.Round(
                        line.DiscrepancyQty * line.SnapshotUnitCostRials, 0, MidpointRounding.AwayFromZero);
                }
            }, cancellationToken);

            return Result.Success();
        }
        catch (DomainException ex)
        {
            return Result.Failure(ex.Message);
        }
    }
}

public sealed class GetStockCountByIdQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetStockCountByIdQuery, Result<StockCountDetailDto>>
{
    public async Task<Result<StockCountDetailDto>> Handle(GetStockCountByIdQuery request, CancellationToken cancellationToken)
    {
        var count = await db.StockCounts.AsNoTracking()
            .Include(c => c.Items).ThenInclude(i => i.InventoryItem)
            .FirstOrDefaultAsync(c => c.Id == request.Id, cancellationToken);
        if (count is null)
            return Result<StockCountDetailDto>.Failure("انبارگردانی یافت نشد.");

        var items = count.Items.Select(i =>
        {
            var discrepancy = (i.PhysicalCountQty ?? i.SystemSnapshotQty) - i.SystemSnapshotQty;
            return new StockCountItemDto(
                i.Id, i.InventoryItemId, i.InventoryItem.Name, i.InventoryItem.Sku,
                i.SystemSnapshotQty, i.PhysicalCountQty, discrepancy,
                i.CostVarianceRials, MoneyFormatting.ToToman(i.CostVarianceRials), i.SnapshotUnitCostRials);
        }).ToList();

        var totalVar = items.Sum(i => i.CostVarianceRials);
        return Result<StockCountDetailDto>.Success(new StockCountDetailDto(
            count.Id, count.Title, count.Status, count.LocationFilter,
            count.StartedAtUtc, count.CompletedAtUtc, count.ApprovedAtUtc, count.Notes,
            totalVar, MoneyFormatting.ToToman(totalVar), items));
    }
}

public sealed class CreateStockTransferCommandHandler(IApplicationDbContext db, ICurrentUserService current)
    : IRequestHandler<CreateStockTransferCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(CreateStockTransferCommand request, CancellationToken cancellationToken)
    {
        try
        {
            Guid transferId = Guid.Empty;
            await db.ExecuteResilientTransactionAsync(async ct =>
            {
                var item = await db.InventoryItems.FirstOrDefaultAsync(i => i.Id == request.InventoryItemId, ct)
                           ?? throw new NotFoundException(nameof(InventoryItem), request.InventoryItemId);

                var transfer = new StockTransfer
                {
                    InventoryItemId = item.Id,
                    FromLocation = request.FromLocation,
                    ToLocation = request.ToLocation,
                    QuantityInBase = request.QuantityInBase,
                    Notes = request.Notes,
                    RequestedByUserId = current.UserId,
                    Status = StockTransferStatus.Requested,
                    RequestedAtUtc = DateTime.UtcNow
                };

                if (request.FromLocation == request.ToLocation)
                    throw new DomainException("مبدأ و مقصد یکسان است.");
                if (request.QuantityInBase <= 0)
                    throw new DomainException("مقدار انتقال باید مثبت باشد.");

                db.StockTransfers.Add(transfer);
                transferId = transfer.Id;
            }, cancellationToken);

            return Result<Guid>.Success(transferId);
        }
        catch (DomainException ex)
        {
            return Result<Guid>.Failure(ex.Message);
        }
    }
}

public sealed class GetCardexQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetCardexQuery, Result<IReadOnlyList<CardexRowDto>>>
{
    public async Task<Result<IReadOnlyList<CardexRowDto>>> Handle(GetCardexQuery request, CancellationToken cancellationToken)
    {
        if (!await db.InventoryItems.AnyAsync(i => i.Id == request.ItemId, cancellationToken))
            return Result<IReadOnlyList<CardexRowDto>>.Failure("کالای انبار یافت نشد.");

        var query = db.InventoryTransactions.AsNoTracking()
            .Where(t => t.InventoryItemId == request.ItemId);
        if (request.FromUtc is not null)
            query = query.Where(t => t.CreatedAtUtc >= request.FromUtc);
        if (request.ToUtc is not null)
            query = query.Where(t => t.CreatedAtUtc <= request.ToUtc);

        var rows = await query.OrderBy(t => t.CreatedAtUtc)
            .Select(t => new CardexRowDto(
                t.Id, t.TransactionType, t.ReferenceId, t.QuantityDelta, t.StockBefore, t.StockAfter,
                t.UnitCostRials, t.UnitCostRials / 10m, t.UserId, t.CreatedAtUtc, t.Notes, t.Location))
            .ToListAsync(cancellationToken);

        return Result<IReadOnlyList<CardexRowDto>>.Success(rows);
    }
}

public sealed class GetInventoryTransactionsQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetInventoryTransactionsQuery, Result<PaginatedList<InventoryTransactionListDto>>>
{
    public async Task<Result<PaginatedList<InventoryTransactionListDto>>> Handle(
        GetInventoryTransactionsQuery request, CancellationToken cancellationToken)
    {
        var query = db.InventoryTransactions.AsNoTracking().Include(t => t.InventoryItem).AsQueryable();
        if (request.InventoryItemId is not null)
            query = query.Where(t => t.InventoryItemId == request.InventoryItemId);
        if (request.TransactionType is not null)
            query = query.Where(t => t.TransactionType == request.TransactionType);
        if (request.FromUtc is not null)
            query = query.Where(t => t.CreatedAtUtc >= request.FromUtc);
        if (request.ToUtc is not null)
            query = query.Where(t => t.CreatedAtUtc <= request.ToUtc);

        var total = await query.CountAsync(cancellationToken);
        var rows = await query.OrderByDescending(t => t.CreatedAtUtc)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(t => new InventoryTransactionListDto(
                t.Id, t.InventoryItemId, t.InventoryItem!.Name, t.InventoryItem.Sku,
                t.TransactionType, t.ReferenceId, t.QuantityDelta, t.StockBefore, t.StockAfter,
                t.UnitCostRials, t.UnitCostRials / 10m, t.UserId, t.CreatedAtUtc, t.Notes))
            .ToListAsync(cancellationToken);

        return Result<PaginatedList<InventoryTransactionListDto>>.Success(new PaginatedList<InventoryTransactionListDto>
        {
            Items = rows,
            Page = request.Page,
            PageSize = request.PageSize,
            TotalCount = total
        });
    }
}
