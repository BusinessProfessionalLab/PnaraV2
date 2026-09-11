using FluentValidation;
using RestoPOS.Domain.Enums;

namespace RestoPOS.Application.Features.Inventory;

public sealed class CreateInventoryItemCommandValidator : AbstractValidator<CreateInventoryItemCommand>
{
    public CreateInventoryItemCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Sku).NotEmpty().MaximumLength(64);
        RuleFor(x => x.Barcode).MaximumLength(64).When(x => x.Barcode is not null);
        RuleFor(x => x.Category).MaximumLength(100).When(x => x.Category is not null);
        RuleFor(x => x.BaseUnit).IsInEnum();
        RuleFor(x => x.StorageLocation).IsInEnum();
        RuleFor(x => x.MinimumAlertStock).GreaterThanOrEqualTo(0);
        RuleFor(x => x.OptimalStock).GreaterThanOrEqualTo(0);
        RuleFor(x => x.OpeningStock).GreaterThanOrEqualTo(0);
        RuleFor(x => x.OpeningUnitCostRials).GreaterThanOrEqualTo(0);
        RuleForEach(x => x.Conversions).ChildRules(c =>
        {
            c.RuleFor(i => i.UnitName).NotEmpty().MaximumLength(64);
            c.RuleFor(i => i.FactorToBase).GreaterThan(0);
        }).When(x => x.Conversions is not null);
    }
}

public sealed class UpdateInventoryItemCommandValidator : AbstractValidator<UpdateInventoryItemCommand>
{
    public UpdateInventoryItemCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.MinimumAlertStock).GreaterThanOrEqualTo(0);
        RuleFor(x => x.OptimalStock).GreaterThanOrEqualTo(0);
        RuleFor(x => x.StorageLocation).IsInEnum();
        RuleForEach(x => x.Conversions).ChildRules(c =>
        {
            c.RuleFor(i => i.UnitName).NotEmpty().MaximumLength(64);
            c.RuleFor(i => i.FactorToBase).GreaterThan(0);
        }).When(x => x.Conversions is not null);
    }
}

public sealed class DeactivateInventoryItemCommandValidator : AbstractValidator<DeactivateInventoryItemCommand>
{
    public DeactivateInventoryItemCommandValidator() => RuleFor(x => x.Id).NotEmpty();
}

public sealed class GetInventoryItemsQueryValidator : AbstractValidator<GetInventoryItemsQuery>
{
    public GetInventoryItemsQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 200);
    }
}

public sealed class CreatePurchaseInvoiceCommandValidator : AbstractValidator<CreatePurchaseInvoiceCommand>
{
    public CreatePurchaseInvoiceCommandValidator()
    {
        RuleFor(x => x.InvoiceNumber).NotEmpty().MaximumLength(64);
        RuleFor(x => x.TaxRials).GreaterThanOrEqualTo(0);
        RuleFor(x => x.DiscountRials).GreaterThanOrEqualTo(0);
        RuleFor(x => x.PaymentStatus).IsInEnum();
        RuleFor(x => x.Items).NotEmpty();
        RuleForEach(x => x.Items).ChildRules(i =>
        {
            i.RuleFor(l => l.InventoryItemId).NotEmpty();
            i.RuleFor(l => l.Quantity).GreaterThan(0);
            i.RuleFor(l => l.UnitPriceRials).GreaterThanOrEqualTo(0);
            i.RuleFor(l => l.LineDiscountRials).GreaterThanOrEqualTo(0);
            i.RuleFor(l => l.PurchaseUnit).IsInEnum().When(l => l.PurchaseUnit.HasValue);
        });
        RuleFor(x => x)
            .Must(x => x.SupplierId.HasValue || !string.IsNullOrWhiteSpace(x.SupplierName))
            .WithMessage("تأمین‌کننده باید با شناسه یا نام مشخص شود.");
    }
}

public sealed class RecordWasteBatchCommandValidator : AbstractValidator<RecordWasteBatchCommand>
{
    public RecordWasteBatchCommandValidator()
    {
        RuleFor(x => x.Items).NotEmpty();
        RuleForEach(x => x.Items).ChildRules(i =>
        {
            i.RuleFor(l => l.InventoryItemId).NotEmpty();
            i.RuleFor(l => l.QuantityInBase).GreaterThan(0);
            i.RuleFor(l => l.Reason).IsInEnum();
        });
    }
}

public sealed class StartStockCountCommandValidator : AbstractValidator<StartStockCountCommand>
{
    public StartStockCountCommandValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.LocationFilter).IsInEnum().When(x => x.LocationFilter.HasValue);
    }
}

public sealed class SubmitStockCountCommandValidator : AbstractValidator<SubmitStockCountCommand>
{
    public SubmitStockCountCommandValidator()
    {
        RuleFor(x => x.StockCountId).NotEmpty();
        RuleFor(x => x.Counts).NotEmpty();
        RuleForEach(x => x.Counts).ChildRules(c =>
        {
            c.RuleFor(i => i.InventoryItemId).NotEmpty();
            c.RuleFor(i => i.PhysicalCountQty).GreaterThanOrEqualTo(0);
        });
    }
}

public sealed class ApproveStockCountCommandValidator : AbstractValidator<ApproveStockCountCommand>
{
    public ApproveStockCountCommandValidator() => RuleFor(x => x.StockCountId).NotEmpty();
}

public sealed class CreateStockTransferCommandValidator : AbstractValidator<CreateStockTransferCommand>
{
    public CreateStockTransferCommandValidator()
    {
        RuleFor(x => x.InventoryItemId).NotEmpty();
        RuleFor(x => x.FromLocation).IsInEnum();
        RuleFor(x => x.ToLocation).IsInEnum();
        RuleFor(x => x.QuantityInBase).GreaterThan(0);
        RuleFor(x => x).Must(x => x.FromLocation != x.ToLocation)
            .WithMessage("مبدأ و مقصد انتقال باید متفاوت باشند.");
    }
}

public sealed class GetCardexQueryValidator : AbstractValidator<GetCardexQuery>
{
    public GetCardexQueryValidator() => RuleFor(x => x.ItemId).NotEmpty();
}

public sealed class GetInventoryTransactionsQueryValidator : AbstractValidator<GetInventoryTransactionsQuery>
{
    public GetInventoryTransactionsQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 500);
    }
}

public sealed class GetPurchaseInvoicesQueryValidator : AbstractValidator<GetPurchaseInvoicesQuery>
{
    public GetPurchaseInvoicesQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 200);
    }
}
