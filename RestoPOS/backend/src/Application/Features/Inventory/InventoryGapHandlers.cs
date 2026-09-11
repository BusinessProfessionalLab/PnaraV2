using MediatR;
using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Application.Common.Models;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Application.Features.Inventory;

public sealed class CreateSupplierCommandHandler(IApplicationDbContext db) : IRequestHandler<CreateSupplierCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(CreateSupplierCommand request, CancellationToken cancellationToken)
    {
        var supplier = new Supplier
        {
            Name = request.Name.Trim(),
            Phone = request.Phone,
            ContactPerson = request.ContactPerson,
            Address = request.Address,
            IsActive = request.IsActive
        };
        db.Suppliers.Add(supplier);
        await db.SaveChangesAsync(cancellationToken);
        return Result<Guid>.Success(supplier.Id);
    }
}

public sealed class UpdateSupplierCommandHandler(IApplicationDbContext db) : IRequestHandler<UpdateSupplierCommand, Result>
{
    public async Task<Result> Handle(UpdateSupplierCommand request, CancellationToken cancellationToken)
    {
        var supplier = await db.Suppliers.FirstOrDefaultAsync(s => s.Id == request.Id, cancellationToken);
        if (supplier is null)
            return Result.Failure("تأمین‌کننده یافت نشد.");
        supplier.Name = request.Name.Trim();
        supplier.Phone = request.Phone;
        supplier.ContactPerson = request.ContactPerson;
        supplier.Address = request.Address;
        supplier.IsActive = request.IsActive;
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}

public sealed class DeleteSupplierCommandHandler(IApplicationDbContext db) : IRequestHandler<DeleteSupplierCommand, Result>
{
    public async Task<Result> Handle(DeleteSupplierCommand request, CancellationToken cancellationToken)
    {
        var supplier = await db.Suppliers.FirstOrDefaultAsync(s => s.Id == request.Id, cancellationToken);
        if (supplier is null)
            return Result.Failure("تأمین‌کننده یافت نشد.");
        supplier.IsDeleted = true;
        supplier.IsActive = false;
        supplier.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}

public sealed class GetSupplierByIdQueryHandler(IApplicationDbContext db) : IRequestHandler<GetSupplierByIdQuery, Result<SupplierDto>>
{
    public async Task<Result<SupplierDto>> Handle(GetSupplierByIdQuery request, CancellationToken cancellationToken)
    {
        var s = await db.Suppliers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.Id, cancellationToken);
        if (s is null)
            return Result<SupplierDto>.Failure("تأمین‌کننده یافت نشد.");
        return Result<SupplierDto>.Success(new SupplierDto(
            s.Id, s.Name, s.Phone, s.ContactPerson, s.Address, s.CurrentBalanceRials, MoneyFormatting.ToToman(s.CurrentBalanceRials), s.IsActive));
    }
}

public sealed class ListSuppliersQueryHandler(IApplicationDbContext db) : IRequestHandler<ListSuppliersQuery, Result<PaginatedList<SupplierDto>>>
{
    public async Task<Result<PaginatedList<SupplierDto>>> Handle(ListSuppliersQuery request, CancellationToken cancellationToken)
    {
        var query = db.Suppliers.AsNoTracking().AsQueryable();
        if (request.ActiveOnly)
            query = query.Where(s => s.IsActive);
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim();
            query = query.Where(s => s.Name.Contains(term) || (s.Phone != null && s.Phone.Contains(term)));
        }

        var total = await query.CountAsync(cancellationToken);
        var rows = await query.OrderBy(s => s.Name)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(s => new SupplierDto(s.Id, s.Name, s.Phone, s.ContactPerson, s.Address, s.CurrentBalanceRials, s.CurrentBalanceRials / 10m, s.IsActive))
            .ToListAsync(cancellationToken);

        return Result<PaginatedList<SupplierDto>>.Success(new PaginatedList<SupplierDto>
        {
            Items = rows,
            Page = request.Page,
            PageSize = request.PageSize,
            TotalCount = total
        });
    }
}

public sealed class CreateManualAdjustmentCommandHandler(IApplicationDbContext db, ICurrentUserService current)
    : IRequestHandler<CreateManualAdjustmentCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(CreateManualAdjustmentCommand request, CancellationToken cancellationToken)
    {
        try
        {
            Guid txId = Guid.Empty;
            await db.ExecuteResilientTransactionAsync(async ct =>
            {
                var item = await db.InventoryItems.FirstOrDefaultAsync(i => i.Id == request.InventoryItemId, ct)
                           ?? throw new NotFoundException(nameof(InventoryItem), request.InventoryItemId);
                var tx = item.ApplyManualAdjustment(request.QuantityDelta, current.UserId, request.Notes);
                txId = tx.Id;
            }, cancellationToken);
            return Result<Guid>.Success(txId);
        }
        catch (DomainException ex)
        {
            return Result<Guid>.Failure(ex.Message);
        }
    }
}

public sealed class ListStockCountsQueryHandler(IApplicationDbContext db)
    : IRequestHandler<ListStockCountsQuery, Result<PaginatedList<StockCountListDto>>>
{
    public async Task<Result<PaginatedList<StockCountListDto>>> Handle(ListStockCountsQuery request, CancellationToken cancellationToken)
    {
        var query = db.StockCounts.AsNoTracking().AsQueryable();
        if (request.Status is not null)
            query = query.Where(c => c.Status == request.Status);

        var total = await query.CountAsync(cancellationToken);
        var rows = await query.OrderByDescending(c => c.StartedAtUtc)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(c => new StockCountListDto(c.Id, c.Title, c.Status, c.LocationFilter, c.StartedAtUtc, c.CompletedAtUtc, c.ApprovedAtUtc))
            .ToListAsync(cancellationToken);

        return Result<PaginatedList<StockCountListDto>>.Success(new PaginatedList<StockCountListDto>
        {
            Items = rows,
            Page = request.Page,
            PageSize = request.PageSize,
            TotalCount = total
        });
    }
}

public sealed class ListTransfersQueryHandler(IApplicationDbContext db)
    : IRequestHandler<ListTransfersQuery, Result<PaginatedList<StockTransferDto>>>
{
    public async Task<Result<PaginatedList<StockTransferDto>>> Handle(ListTransfersQuery request, CancellationToken cancellationToken)
    {
        var query = db.StockTransfers.AsNoTracking().Include(t => t.InventoryItem).AsQueryable();
        if (request.Status is not null)
            query = query.Where(t => t.Status == request.Status);
        if (request.InventoryItemId is not null)
            query = query.Where(t => t.InventoryItemId == request.InventoryItemId);

        var total = await query.CountAsync(cancellationToken);
        var rows = await query.OrderByDescending(t => t.RequestedAtUtc)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(t => new StockTransferDto(
                t.Id, t.InventoryItemId, t.InventoryItem.Name, t.InventoryItem.Sku,
                t.FromLocation, t.ToLocation, t.QuantityInBase, t.Status,
                t.RequestedAtUtc, t.TransferredAtUtc, t.Notes))
            .ToListAsync(cancellationToken);

        return Result<PaginatedList<StockTransferDto>>.Success(new PaginatedList<StockTransferDto>
        {
            Items = rows,
            Page = request.Page,
            PageSize = request.PageSize,
            TotalCount = total
        });
    }
}

public sealed class CancelStockTransferCommandHandler(IApplicationDbContext db) : IRequestHandler<CancelStockTransferCommand, Result>
{
    public async Task<Result> Handle(CancelStockTransferCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var transfer = await db.StockTransfers.FirstOrDefaultAsync(t => t.Id == request.Id, cancellationToken)
                           ?? throw new NotFoundException(nameof(StockTransfer), request.Id);
            transfer.Cancel();
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }
        catch (DomainException ex)
        {
            return Result.Failure(ex.Message);
        }
    }
}

public sealed class CompleteStockTransferCommandHandler(IApplicationDbContext db, ICurrentUserService current)
    : IRequestHandler<CompleteStockTransferCommand, Result>
{
    public async Task<Result> Handle(CompleteStockTransferCommand request, CancellationToken cancellationToken)
    {
        try
        {
            await db.ExecuteResilientTransactionAsync(async ct =>
            {
                var transfer = await db.StockTransfers.FirstOrDefaultAsync(t => t.Id == request.Id, ct)
                               ?? throw new NotFoundException(nameof(StockTransfer), request.Id);
                if (transfer.Status != StockTransferStatus.Requested)
                    throw new DomainException("فقط انتقال درخواستی قابل تکمیل است.");

                var item = await db.InventoryItems.FirstAsync(i => i.Id == transfer.InventoryItemId, ct);
                transfer.Complete(current.UserId);
                item.ApplyInternalTransfer(transfer.QuantityInBase, transfer.FromLocation, transfer.ToLocation, current.UserId, transfer.Id);
            }, cancellationToken);
            return Result.Success();
        }
        catch (DomainException ex)
        {
            return Result.Failure(ex.Message);
        }
    }
}

public sealed class CreateDraftPurchaseCommandHandler(IApplicationDbContext db) : IRequestHandler<CreateDraftPurchaseCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(CreateDraftPurchaseCommand request, CancellationToken cancellationToken)
    {
        if (await db.PurchaseInvoices.AnyAsync(p => p.InvoiceNumber == request.InvoiceNumber, cancellationToken))
            return Result<Guid>.Failure($"شماره فاکتور تکراری است: {request.InvoiceNumber}");

        try
        {
            Guid invoiceId = Guid.Empty;
            await db.ExecuteResilientTransactionAsync(async ct =>
            {
                Supplier supplier;
                if (request.SupplierId is Guid supplierId)
                {
                    supplier = await db.Suppliers.FirstOrDefaultAsync(s => s.Id == supplierId, ct)
                               ?? throw new NotFoundException(nameof(Supplier), supplierId);
                }
                else
                {
                    if (string.IsNullOrWhiteSpace(request.SupplierName))
                        throw new DomainException("نام تأمین‌کننده الزامی است.");
                    supplier = new Supplier
                    {
                        Name = request.SupplierName.Trim(),
                        Phone = request.SupplierPhone,
                        ContactPerson = request.SupplierContactPerson,
                        Address = request.SupplierAddress
                    };
                    db.Suppliers.Add(supplier);
                }

                var invoice = new PurchaseInvoice
                {
                    InvoiceNumber = request.InvoiceNumber.Trim(),
                    Supplier = supplier,
                    SupplierId = supplier.Id,
                    PaymentStatus = request.PaymentStatus,
                    Notes = request.Notes,
                    InvoiceDateUtc = DateTime.UtcNow,
                    Status = PurchaseInvoiceStatus.Draft
                };
                invoice.SetHeaderCharges(request.TaxRials, request.DiscountRials);

                foreach (var line in request.Items)
                {
                    var item = await db.InventoryItems.Include(i => i.Conversions)
                        .FirstOrDefaultAsync(i => i.Id == line.InventoryItemId, ct)
                               ?? throw new NotFoundException(nameof(InventoryItem), line.InventoryItemId);
                    invoice.AddItem(item, line.Quantity, line.UnitPriceRials, line.PurchaseUnit, line.NamedPurchaseUnit, line.LineDiscountRials);
                }

                db.PurchaseInvoices.Add(invoice);
                invoiceId = invoice.Id;
            }, cancellationToken);

            return Result<Guid>.Success(invoiceId);
        }
        catch (DomainException ex)
        {
            return Result<Guid>.Failure(ex.Message);
        }
    }
}

public sealed class UpdateDraftPurchaseCommandHandler(IApplicationDbContext db) : IRequestHandler<UpdateDraftPurchaseCommand, Result>
{
    public async Task<Result> Handle(UpdateDraftPurchaseCommand request, CancellationToken cancellationToken)
    {
        try
        {
            await db.ExecuteResilientTransactionAsync(async ct =>
            {
                var invoice = await db.PurchaseInvoices.Include(p => p.Items)
                    .FirstOrDefaultAsync(p => p.Id == request.Id, ct)
                              ?? throw new NotFoundException(nameof(PurchaseInvoice), request.Id);

                if (invoice.Status != PurchaseInvoiceStatus.Draft)
                    throw new DomainException("فقط فاکتور پیش‌نویس قابل ویرایش است.");

                var existing = invoice.Items.ToList();
                foreach (var line in existing)
                    db.PurchaseInvoiceItems.Remove(line);
                invoice.Items.Clear();

                invoice.PaymentStatus = request.PaymentStatus;
                invoice.Notes = request.Notes;
                invoice.SetHeaderCharges(request.TaxRials, request.DiscountRials);

                foreach (var line in request.Items)
                {
                    var item = await db.InventoryItems.Include(i => i.Conversions)
                        .FirstOrDefaultAsync(i => i.Id == line.InventoryItemId, ct)
                               ?? throw new NotFoundException(nameof(InventoryItem), line.InventoryItemId);
                    invoice.AddItem(item, line.Quantity, line.UnitPriceRials, line.PurchaseUnit, line.NamedPurchaseUnit, line.LineDiscountRials);
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

public sealed class ApprovePurchaseCommandHandler(IApplicationDbContext db, ICurrentUserService current)
    : IRequestHandler<ApprovePurchaseCommand, Result>
{
    public async Task<Result> Handle(ApprovePurchaseCommand request, CancellationToken cancellationToken)
    {
        try
        {
            await db.ExecuteResilientTransactionAsync(async ct =>
            {
                var invoice = await db.PurchaseInvoices
                    .Include(p => p.Items)
                    .Include(p => p.Supplier)
                    .FirstOrDefaultAsync(p => p.Id == request.Id, ct)
                              ?? throw new NotFoundException(nameof(PurchaseInvoice), request.Id);

                if (invoice.Status != PurchaseInvoiceStatus.Draft)
                    throw new DomainException("فقط فاکتور پیش‌نویس قابل تأیید است.");

                invoice.Approve(current.UserId);

                foreach (var line in invoice.Items)
                {
                    var item = await db.InventoryItems.Include(i => i.Conversions)
                        .FirstAsync(i => i.Id == line.InventoryItemId, ct);
                    item.ApplyPurchase(line.QuantityInBase, line.UnitPriceInBaseRials, current.UserId, invoice.Id,
                        $"خرید فاکتور {invoice.InvoiceNumber}");
                }

                if (invoice.PaymentStatus != PurchasePaymentStatus.Paid)
                    invoice.Supplier.IncreaseBalance(invoice.GrandTotalRials);
            }, cancellationToken);
            return Result.Success();
        }
        catch (DomainException ex)
        {
            return Result.Failure(ex.Message);
        }
    }
}

public sealed class CancelPurchaseCommandHandler(IApplicationDbContext db) : IRequestHandler<CancelPurchaseCommand, Result>
{
    public async Task<Result> Handle(CancelPurchaseCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var invoice = await db.PurchaseInvoices.FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken)
                          ?? throw new NotFoundException(nameof(PurchaseInvoice), request.Id);
            invoice.Cancel();
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }
        catch (DomainException ex)
        {
            return Result.Failure(ex.Message);
        }
    }
}

public sealed class ListWasteQueryHandler(IApplicationDbContext db) : IRequestHandler<ListWasteQuery, Result<PaginatedList<WasteDetailDto>>>
{
    public async Task<Result<PaginatedList<WasteDetailDto>>> Handle(ListWasteQuery request, CancellationToken cancellationToken)
    {
        var query = db.InventoryWastes.AsNoTracking().Include(w => w.Items).ThenInclude(i => i.InventoryItem).AsQueryable();
        if (request.FromUtc is not null)
            query = query.Where(w => w.OccurredAtUtc >= request.FromUtc);
        if (request.ToUtc is not null)
            query = query.Where(w => w.OccurredAtUtc <= request.ToUtc);

        var total = await query.CountAsync(cancellationToken);
        var wastes = await query.OrderByDescending(w => w.OccurredAtUtc)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(cancellationToken);

        var rows = wastes.Select(w => new WasteDetailDto(
            w.Id, w.OccurredAtUtc, w.RecordedByUserId, w.Notes, w.TotalLossRials, MoneyFormatting.ToToman(w.TotalLossRials),
            w.Items.Select(i => new WasteReportRowDto(
                w.Id, i.Id, i.InventoryItemId, i.InventoryItem.Name, i.InventoryItem.Sku,
                i.Reason, i.QuantityInBase, i.UnitCostRials, i.LossRials, MoneyFormatting.ToToman(i.LossRials),
                w.OccurredAtUtc, i.Notes)).ToList())).ToList();

        return Result<PaginatedList<WasteDetailDto>>.Success(new PaginatedList<WasteDetailDto>
        {
            Items = rows,
            Page = request.Page,
            PageSize = request.PageSize,
            TotalCount = total
        });
    }
}

public sealed class GetWasteByIdQueryHandler(IApplicationDbContext db) : IRequestHandler<GetWasteByIdQuery, Result<WasteDetailDto>>
{
    public async Task<Result<WasteDetailDto>> Handle(GetWasteByIdQuery request, CancellationToken cancellationToken)
    {
        var w = await db.InventoryWastes.AsNoTracking()
            .Include(x => x.Items).ThenInclude(i => i.InventoryItem)
            .FirstOrDefaultAsync(x => x.Id == request.Id, cancellationToken);
        if (w is null)
            return Result<WasteDetailDto>.Failure("ثبت ضایعات یافت نشد.");

        return Result<WasteDetailDto>.Success(new WasteDetailDto(
            w.Id, w.OccurredAtUtc, w.RecordedByUserId, w.Notes, w.TotalLossRials, MoneyFormatting.ToToman(w.TotalLossRials),
            w.Items.Select(i => new WasteReportRowDto(
                w.Id, i.Id, i.InventoryItemId, i.InventoryItem.Name, i.InventoryItem.Sku,
                i.Reason, i.QuantityInBase, i.UnitCostRials, i.LossRials, MoneyFormatting.ToToman(i.LossRials),
                w.OccurredAtUtc, i.Notes)).ToList()));
    }
}
