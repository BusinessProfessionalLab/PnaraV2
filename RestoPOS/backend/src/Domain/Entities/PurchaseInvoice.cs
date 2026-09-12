using RestoPOS.Domain.Common;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Exceptions;
using RestoPOS.Domain.Services;

namespace RestoPOS.Domain.Entities;

public class PurchaseInvoice : BaseEntity
{
    public string InvoiceNumber { get; set; } = default!;
    public Guid SupplierId { get; set; }
    public DateTime InvoiceDateUtc { get; set; } = DateTime.UtcNow;
    public decimal SubtotalRials { get; set; }
    public decimal TaxRials { get; set; }
    public decimal DiscountRials { get; set; }
    public decimal GrandTotalRials { get; set; }
    public PurchasePaymentStatus PaymentStatus { get; set; } = PurchasePaymentStatus.Unpaid;
    public PurchaseInvoiceStatus Status { get; set; } = PurchaseInvoiceStatus.Draft;
    public string? Notes { get; set; }
    public Guid? ApprovedByUserId { get; set; }
    public DateTime? ApprovedAtUtc { get; set; }

    public Supplier Supplier { get; set; } = default!;
    public ICollection<PurchaseInvoiceItem> Items { get; set; } = [];

    public PurchaseInvoiceItem AddItem(
        InventoryItem inventoryItem,
        decimal quantity,
        decimal unitPriceRials,
        BaseUnit? purchaseUnit,
        string? namedPurchaseUnit,
        decimal lineDiscountRials = 0)
    {
        if (Status != PurchaseInvoiceStatus.Draft)
            throw new DomainException("فقط فاکتور پیش‌نویس قابل ویرایش است.");
        if (quantity <= 0)
            throw new DomainException("مقدار اقلام فاکتور باید مثبت باشد.");
        if (unitPriceRials < 0)
            throw new DomainException("قیمت واحد نمی‌تواند منفی باشد.");

        var qtyInBase = inventoryItem.ConvertToBase(quantity, purchaseUnit, namedPurchaseUnit);
        var unitPriceInBase = UnitConversionService.UnitPriceInBase(unitPriceRials, quantity, qtyInBase);
        var lineSubtotal = decimal.Round((unitPriceRials * quantity) - lineDiscountRials, 0, MidpointRounding.AwayFromZero);
        if (lineSubtotal < 0)
            throw new DomainException("مبلغ ردیف فاکتور پس از تخفیف نمی‌تواند منفی باشد.");

        var item = new PurchaseInvoiceItem
        {
            PurchaseInvoiceId = Id,
            InventoryItemId = inventoryItem.Id,
            Quantity = quantity,
            QuantityInBase = qtyInBase,
            PurchaseUnit = purchaseUnit ?? inventoryItem.BaseUnit,
            NamedPurchaseUnit = namedPurchaseUnit,
            UnitPriceRials = decimal.Round(unitPriceRials, 0, MidpointRounding.AwayFromZero),
            UnitPriceInBaseRials = unitPriceInBase,
            LineDiscountRials = decimal.Round(lineDiscountRials, 0, MidpointRounding.AwayFromZero),
            LineTotalRials = lineSubtotal
        };
        Items.Add(item);
        RecalculateTotals();
        return item;
    }

    public void RecalculateTotals()
    {
        SubtotalRials = Items.Sum(i => i.LineTotalRials);
        GrandTotalRials = decimal.Round(SubtotalRials + TaxRials - DiscountRials, 0, MidpointRounding.AwayFromZero);
        if (GrandTotalRials < 0)
            throw new DomainException("جمع کل فاکتور نمی‌تواند منفی باشد.");
    }

    public void SetHeaderCharges(decimal taxRials, decimal discountRials)
    {
        if (taxRials < 0 || discountRials < 0)
            throw new DomainException("مالیات و تخفیف نمی‌توانند منفی باشند.");
        TaxRials = decimal.Round(taxRials, 0, MidpointRounding.AwayFromZero);
        DiscountRials = decimal.Round(discountRials, 0, MidpointRounding.AwayFromZero);
        RecalculateTotals();
    }

    public void Approve(Guid? userId)
    {
        if (Status == PurchaseInvoiceStatus.Approved)
            throw new ConflictException("این فاکتور قبلاً تأیید شده است.");
        if (Status == PurchaseInvoiceStatus.Cancelled)
            throw new DomainException("فاکتور لغوشده قابل تأیید نیست.");
        if (Items.Count == 0)
            throw new DomainException("فاکتور بدون قلم قابل تأیید نیست.");

        Status = PurchaseInvoiceStatus.Approved;
        ApprovedByUserId = userId;
        ApprovedAtUtc = DateTime.UtcNow;
    }

    public void Cancel()
    {
        if (Status == PurchaseInvoiceStatus.Approved)
            throw new DomainException("فاکتور تأییدشده قابل لغو نیست.");
        if (Status == PurchaseInvoiceStatus.Cancelled)
            throw new DomainException("فاکتور قبلاً لغو شده است.");
        Status = PurchaseInvoiceStatus.Cancelled;
    }

    public void ClearItems()
    {
        if (Status != PurchaseInvoiceStatus.Draft)
            throw new DomainException("فقط فاکتور پیش‌نویس قابل ویرایش است.");
        Items.Clear();
        RecalculateTotals();
    }
}

public class PurchaseInvoiceItem : BaseEntity
{
    public Guid PurchaseInvoiceId { get; set; }
    public Guid InventoryItemId { get; set; }
    public decimal Quantity { get; set; }
    public decimal QuantityInBase { get; set; }
    public BaseUnit PurchaseUnit { get; set; }
    public string? NamedPurchaseUnit { get; set; }
    public decimal UnitPriceRials { get; set; }
    public decimal UnitPriceInBaseRials { get; set; }
    public decimal LineDiscountRials { get; set; }
    public decimal LineTotalRials { get; set; }

    public PurchaseInvoice PurchaseInvoice { get; set; } = default!;
    public InventoryItem InventoryItem { get; set; } = default!;
}
