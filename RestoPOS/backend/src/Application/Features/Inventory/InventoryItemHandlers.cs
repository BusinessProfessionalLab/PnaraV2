using MediatR;
using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Application.Common.Models;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Application.Features.Inventory;

internal static class InventoryMapping
{
    public static InventoryItemListDto ToListDto(InventoryItem i) => new(
        i.Id, i.Name, i.Sku, i.Barcode, i.Category, i.BaseUnit, i.CurrentStock,
        i.MinimumAlertStock, i.OptimalStock,
        i.WeightedAverageCost, MoneyFormatting.ToToman(i.WeightedAverageCost),
        i.LastPurchasePrice, MoneyFormatting.ToToman(i.LastPurchasePrice),
        i.StorageLocation, i.IsActive, i.IsBelowAlertStock,
        decimal.Round(i.CurrentStock * i.WeightedAverageCost, 0, MidpointRounding.AwayFromZero),
        MoneyFormatting.ToToman(decimal.Round(i.CurrentStock * i.WeightedAverageCost, 0, MidpointRounding.AwayFromZero)));

    public static InventoryItemDetailDto ToDetailDto(InventoryItem i) => new(
        i.Id, i.Name, i.Sku, i.Barcode, i.Category, i.BaseUnit, i.CurrentStock,
        i.MinimumAlertStock, i.OptimalStock,
        i.WeightedAverageCost, MoneyFormatting.ToToman(i.WeightedAverageCost),
        i.LastPurchasePrice, MoneyFormatting.ToToman(i.LastPurchasePrice),
        i.StorageLocation, i.IsActive, i.IsBelowAlertStock,
        decimal.Round(i.CurrentStock * i.WeightedAverageCost, 0, MidpointRounding.AwayFromZero),
        MoneyFormatting.ToToman(decimal.Round(i.CurrentStock * i.WeightedAverageCost, 0, MidpointRounding.AwayFromZero)),
        i.Conversions.Select(c => new UnitConversionDto(c.Id, c.UnitName, c.TargetBaseUnit, c.FactorToBase)).ToList());
}

public sealed class CreateInventoryItemCommandHandler(IApplicationDbContext db, ICurrentUserService current)
    : IRequestHandler<CreateInventoryItemCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(CreateInventoryItemCommand request, CancellationToken cancellationToken)
    {
        if (await db.InventoryItems.AnyAsync(i => i.Sku == request.Sku, cancellationToken))
            return Result<Guid>.Failure($"SKU تکراری است: {request.Sku}");

        if (!string.IsNullOrWhiteSpace(request.Barcode) &&
            await db.InventoryItems.AnyAsync(i => i.Barcode == request.Barcode, cancellationToken))
            return Result<Guid>.Failure($"بارکد تکراری است: {request.Barcode}");

        try
        {
            Guid createdId = Guid.Empty;
            await db.ExecuteResilientTransactionAsync(ct =>
            {
                var item = new InventoryItem
                {
                    Name = request.Name.Trim(),
                    Sku = request.Sku.Trim(),
                    Barcode = string.IsNullOrWhiteSpace(request.Barcode) ? null : request.Barcode.Trim(),
                    Category = string.IsNullOrWhiteSpace(request.Category) ? null : request.Category.Trim(),
                    BaseUnit = request.BaseUnit,
                    MinimumAlertStock = request.MinimumAlertStock,
                    OptimalStock = request.OptimalStock,
                    StorageLocation = request.StorageLocation,
                    WeightedAverageCost = request.OpeningUnitCostRials,
                    LastPurchasePrice = request.OpeningUnitCostRials
                };

                if (request.Conversions is { Count: > 0 })
                {
                    foreach (var c in request.Conversions)
                        item.AddConversion(c.UnitName, c.FactorToBase);
                }

                db.InventoryItems.Add(item);
                if (request.OpeningStock > 0)
                    item.ApplyOpeningBalance(request.OpeningStock, request.OpeningUnitCostRials, current.UserId);

                createdId = item.Id;
                return Task.CompletedTask;
            }, cancellationToken);

            return Result<Guid>.Success(createdId);
        }
        catch (DomainException ex)
        {
            return Result<Guid>.Failure(ex.Message);
        }
    }
}

public sealed class UpdateInventoryItemCommandHandler(IApplicationDbContext db)
    : IRequestHandler<UpdateInventoryItemCommand, Result>
{
    public async Task<Result> Handle(UpdateInventoryItemCommand request, CancellationToken cancellationToken)
    {
        var item = await db.InventoryItems.Include(i => i.Conversions)
            .FirstOrDefaultAsync(i => i.Id == request.Id, cancellationToken);
        if (item is null)
            return Result.Failure("کالای انبار یافت نشد.");

        if (!string.IsNullOrWhiteSpace(request.Barcode) &&
            await db.InventoryItems.AnyAsync(i => i.Barcode == request.Barcode && i.Id != request.Id, cancellationToken))
            return Result.Failure($"بارکد تکراری است: {request.Barcode}");

        try
        {
            await db.ExecuteResilientTransactionAsync(async ct =>
            {
                var tracked = await db.InventoryItems.Include(i => i.Conversions)
                    .FirstAsync(i => i.Id == request.Id, ct);
                tracked.Name = request.Name.Trim();
                tracked.Barcode = string.IsNullOrWhiteSpace(request.Barcode) ? null : request.Barcode.Trim();
                tracked.Category = string.IsNullOrWhiteSpace(request.Category) ? null : request.Category.Trim();
                tracked.MinimumAlertStock = request.MinimumAlertStock;
                tracked.OptimalStock = request.OptimalStock;
                tracked.StorageLocation = request.StorageLocation;
                tracked.IsActive = request.IsActive;

                if (request.Conversions is not null)
                {
                    db.InventoryUnitConversions.RemoveRange(tracked.Conversions);
                    tracked.Conversions.Clear();
                    foreach (var c in request.Conversions)
                        tracked.AddConversion(c.UnitName, c.FactorToBase);
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

public sealed class DeactivateInventoryItemCommandHandler(IApplicationDbContext db, ICurrentUserService current)
    : IRequestHandler<DeactivateInventoryItemCommand, Result>
{
    public async Task<Result> Handle(DeactivateInventoryItemCommand request, CancellationToken cancellationToken)
    {
        var item = await db.InventoryItems.FirstOrDefaultAsync(i => i.Id == request.Id, cancellationToken);
        if (item is null)
            return Result.Failure("کالای انبار یافت نشد.");

        item.IsActive = false;
        item.IsDeleted = true;
        item.DeletedAt = DateTime.UtcNow;
        item.DeletedBy = current.UserId;
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}

public sealed class GetInventoryItemsQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetInventoryItemsQuery, Result<PaginatedList<InventoryItemListDto>>>
{
    public async Task<Result<PaginatedList<InventoryItemListDto>>> Handle(GetInventoryItemsQuery request, CancellationToken cancellationToken)
    {
        var query = db.InventoryItems.AsNoTracking().AsQueryable();
        if (request.ActiveOnly)
            query = query.Where(i => i.IsActive);
        if (!string.IsNullOrWhiteSpace(request.Category))
            query = query.Where(i => i.Category == request.Category);
        if (request.StorageLocation is not null)
            query = query.Where(i => i.StorageLocation == request.StorageLocation);
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim();
            query = query.Where(i => i.Name.Contains(term) || i.Sku.Contains(term) || (i.Barcode != null && i.Barcode.Contains(term)));
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await query.OrderBy(i => i.Name)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(cancellationToken);

        return Result<PaginatedList<InventoryItemListDto>>.Success(new PaginatedList<InventoryItemListDto>
        {
            Items = items.Select(InventoryMapping.ToListDto).ToList(),
            Page = request.Page,
            PageSize = request.PageSize,
            TotalCount = total
        });
    }
}

public sealed class GetInventoryItemByIdQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetInventoryItemByIdQuery, Result<InventoryItemDetailDto>>
{
    public async Task<Result<InventoryItemDetailDto>> Handle(GetInventoryItemByIdQuery request, CancellationToken cancellationToken)
    {
        var item = await db.InventoryItems.AsNoTracking()
            .Include(i => i.Conversions)
            .FirstOrDefaultAsync(i => i.Id == request.Id, cancellationToken);
        return item is null
            ? Result<InventoryItemDetailDto>.Failure("کالای انبار یافت نشد.")
            : Result<InventoryItemDetailDto>.Success(InventoryMapping.ToDetailDto(item));
    }
}

public sealed class GetLowStockQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetLowStockQuery, Result<IReadOnlyList<InventoryItemListDto>>>
{
    public async Task<Result<IReadOnlyList<InventoryItemListDto>>> Handle(GetLowStockQuery request, CancellationToken cancellationToken)
    {
        var items = await db.InventoryItems.AsNoTracking()
            .Where(i => i.IsActive && i.CurrentStock <= i.MinimumAlertStock)
            .OrderBy(i => i.CurrentStock)
            .ToListAsync(cancellationToken);
        return Result<IReadOnlyList<InventoryItemListDto>>.Success(items.Select(InventoryMapping.ToListDto).ToList());
    }
}

public sealed class GetInventoryValuationQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetInventoryValuationQuery, Result<InventoryValuationDto>>
{
    public async Task<Result<InventoryValuationDto>> Handle(GetInventoryValuationQuery request, CancellationToken cancellationToken)
    {
        var items = await db.InventoryItems.AsNoTracking()
            .Where(i => i.IsActive)
            .Select(i => new
            {
                i.StorageLocation,
                Category = i.Category ?? "بدون دسته",
                i.CurrentStock,
                Value = i.CurrentStock * i.WeightedAverageCost
            })
            .ToListAsync(cancellationToken);

        var byLocation = items.GroupBy(i => i.StorageLocation)
            .Select(g => new InventoryValuationGroupDto(
                g.Key.ToString(),
                g.Key.ToString(),
                g.Sum(x => x.CurrentStock),
                decimal.Round(g.Sum(x => x.Value), 0, MidpointRounding.AwayFromZero),
                MoneyFormatting.ToToman(decimal.Round(g.Sum(x => x.Value), 0, MidpointRounding.AwayFromZero)),
                g.Count()))
            .OrderBy(x => x.GroupKey)
            .ToList();

        var byCategory = items.GroupBy(i => i.Category)
            .Select(g => new InventoryValuationGroupDto(
                g.Key,
                g.Key,
                g.Sum(x => x.CurrentStock),
                decimal.Round(g.Sum(x => x.Value), 0, MidpointRounding.AwayFromZero),
                MoneyFormatting.ToToman(decimal.Round(g.Sum(x => x.Value), 0, MidpointRounding.AwayFromZero)),
                g.Count()))
            .OrderBy(x => x.GroupKey)
            .ToList();

        var grand = decimal.Round(items.Sum(i => i.Value), 0, MidpointRounding.AwayFromZero);
        return Result<InventoryValuationDto>.Success(new InventoryValuationDto(
            grand, MoneyFormatting.ToToman(grand), byLocation, byCategory));
    }
}
