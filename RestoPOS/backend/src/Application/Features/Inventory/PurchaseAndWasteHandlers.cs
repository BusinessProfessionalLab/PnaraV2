using MediatR;
using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Application.Common.Models;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Application.Features.Inventory;

public sealed class CreatePurchaseInvoiceCommandHandler(IApplicationDbContext db, ICurrentUserService current)
    : IRequestHandler<CreatePurchaseInvoiceCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(CreatePurchaseInvoiceCommand request, CancellationToken cancellationToken)
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
                    supplier = new Supplier
                    {
                        Name = request.SupplierName!.Trim(),
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
                    InvoiceDateUtc = DateTime.UtcNow
                };
                invoice.SetHeaderCharges(request.TaxRials, request.DiscountRials);

                foreach (var line in request.Items)
                {
                    var item = await db.InventoryItems.Include(i => i.Conversions)
                        .FirstOrDefaultAsync(i => i.Id == line.InventoryItemId, ct)
                               ?? throw new NotFoundException(nameof(InventoryItem), line.InventoryItemId);
                    invoice.AddItem(item, line.Quantity, line.UnitPriceRials, line.PurchaseUnit, line.NamedPurchaseUnit, line.LineDiscountRials);
                }

                invoice.Approve(current.UserId);

                foreach (var line in invoice.Items)
                {
                    var item = await db.InventoryItems.Include(i => i.Conversions)
                        .FirstAsync(i => i.Id == line.InventoryItemId, ct);
                    // WAC: ((OldStock * OldWAC) + (NewQtyInBase * UnitPriceInBase)) / (OldStock + NewQtyInBase)
                    item.ApplyPurchase(line.QuantityInBase, line.UnitPriceInBaseRials, current.UserId, invoice.Id,
                        $"خرید فاکتور {invoice.InvoiceNumber}");
                }

                if (request.PaymentStatus != PurchasePaymentStatus.Paid)
                    supplier.IncreaseBalance(invoice.GrandTotalRials);

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

public sealed class GetPurchaseInvoicesQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetPurchaseInvoicesQuery, Result<PaginatedList<PurchaseInvoiceListDto>>>
{
    public async Task<Result<PaginatedList<PurchaseInvoiceListDto>>> Handle(GetPurchaseInvoicesQuery request, CancellationToken cancellationToken)
    {
        var query = db.PurchaseInvoices.AsNoTracking().Include(p => p.Supplier).AsQueryable();
        if (request.SupplierId is not null)
            query = query.Where(p => p.SupplierId == request.SupplierId);
        if (request.Status is not null)
            query = query.Where(p => p.Status == request.Status);

        var total = await query.CountAsync(cancellationToken);
        var rows = await query.OrderByDescending(p => p.InvoiceDateUtc)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(p => new PurchaseInvoiceListDto(
                p.Id, p.InvoiceNumber, p.SupplierId, p.Supplier.Name, p.InvoiceDateUtc,
                p.GrandTotalRials, p.GrandTotalRials / 10m, p.PaymentStatus, p.Status))
            .ToListAsync(cancellationToken);

        return Result<PaginatedList<PurchaseInvoiceListDto>>.Success(new PaginatedList<PurchaseInvoiceListDto>
        {
            Items = rows,
            Page = request.Page,
            PageSize = request.PageSize,
            TotalCount = total
        });
    }
}

public sealed class GetPurchaseInvoiceByIdQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetPurchaseInvoiceByIdQuery, Result<PurchaseInvoiceDetailDto>>
{
    public async Task<Result<PurchaseInvoiceDetailDto>> Handle(GetPurchaseInvoiceByIdQuery request, CancellationToken cancellationToken)
    {
        var invoice = await db.PurchaseInvoices.AsNoTracking()
            .Include(p => p.Supplier)
            .Include(p => p.Items).ThenInclude(i => i.InventoryItem)
            .FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);
        if (invoice is null)
            return Result<PurchaseInvoiceDetailDto>.Failure("فاکتور خرید یافت نشد.");

        return Result<PurchaseInvoiceDetailDto>.Success(new PurchaseInvoiceDetailDto(
            invoice.Id,
            invoice.InvoiceNumber,
            invoice.SupplierId,
            invoice.Supplier.Name,
            invoice.InvoiceDateUtc,
            invoice.SubtotalRials,
            invoice.TaxRials,
            invoice.DiscountRials,
            invoice.GrandTotalRials,
            MoneyFormatting.ToToman(invoice.GrandTotalRials),
            invoice.PaymentStatus,
            invoice.Status,
            invoice.Notes,
            invoice.ApprovedAtUtc,
            invoice.Items.Select(i => new PurchaseInvoiceItemDto(
                i.Id, i.InventoryItemId, i.InventoryItem.Name, i.InventoryItem.Sku,
                i.Quantity, i.QuantityInBase, i.PurchaseUnit, i.NamedPurchaseUnit,
                i.UnitPriceRials, i.UnitPriceInBaseRials, i.LineDiscountRials,
                i.LineTotalRials, MoneyFormatting.ToToman(i.LineTotalRials))).ToList()));
    }
}

public sealed class RecordWasteBatchCommandHandler(IApplicationDbContext db, ICurrentUserService current)
    : IRequestHandler<RecordWasteBatchCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(RecordWasteBatchCommand request, CancellationToken cancellationToken)
    {
        try
        {
            Guid wasteId = Guid.Empty;
            await db.ExecuteResilientTransactionAsync(async ct =>
            {
                var waste = new InventoryWaste
                {
                    Notes = request.Notes,
                    RecordedByUserId = current.UserId,
                    OccurredAtUtc = DateTime.UtcNow
                };

                foreach (var line in request.Items)
                {
                    var item = await db.InventoryItems.FirstOrDefaultAsync(i => i.Id == line.InventoryItemId, ct)
                               ?? throw new NotFoundException(nameof(InventoryItem), line.InventoryItemId);
                    var wasteItem = waste.AddItem(item, line.QuantityInBase, line.Reason, line.Notes);
                    item.ApplyWaste(line.QuantityInBase, current.UserId, waste.Id,
                        $"ضایعات: {line.Reason}" + (string.IsNullOrWhiteSpace(line.Notes) ? "" : $" — {line.Notes}"));
                    _ = wasteItem;
                }

                db.InventoryWastes.Add(waste);
                wasteId = waste.Id;
            }, cancellationToken);

            return Result<Guid>.Success(wasteId);
        }
        catch (DomainException ex)
        {
            return Result<Guid>.Failure(ex.Message);
        }
    }
}

public sealed class GetWasteReportsQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetWasteReportsQuery, Result<IReadOnlyList<WasteReportRowDto>>>
{
    public async Task<Result<IReadOnlyList<WasteReportRowDto>>> Handle(GetWasteReportsQuery request, CancellationToken cancellationToken)
    {
        var query = db.InventoryWasteItems.AsNoTracking()
            .Include(i => i.InventoryWaste)
            .Include(i => i.InventoryItem)
            .AsQueryable();

        if (request.FromUtc is not null)
            query = query.Where(i => i.InventoryWaste.OccurredAtUtc >= request.FromUtc);
        if (request.ToUtc is not null)
            query = query.Where(i => i.InventoryWaste.OccurredAtUtc <= request.ToUtc);
        if (request.Reason is not null)
            query = query.Where(i => i.Reason == request.Reason);

        var rows = await query.OrderByDescending(i => i.InventoryWaste.OccurredAtUtc)
            .Select(i => new WasteReportRowDto(
                i.InventoryWasteId, i.Id, i.InventoryItemId, i.InventoryItem.Name, i.InventoryItem.Sku,
                i.Reason, i.QuantityInBase, i.UnitCostRials, i.LossRials, i.LossRials / 10m,
                i.InventoryWaste.OccurredAtUtc, i.Notes))
            .ToListAsync(cancellationToken);

        return Result<IReadOnlyList<WasteReportRowDto>>.Success(rows);
    }
}
