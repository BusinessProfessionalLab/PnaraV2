using System.ComponentModel.DataAnnotations;
using RestoPOS.Domain.Common;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Events;
using RestoPOS.Domain.Exceptions;
using RestoPOS.Domain.Services;

namespace RestoPOS.Domain.Entities;

public class InventoryItem : BaseEntity, ISoftDeletable
{
    public string Name { get; set; } = default!;
    public string Sku { get; set; } = default!;
    public string? Barcode { get; set; }
    public string? Category { get; set; }
    public BaseUnit BaseUnit { get; set; }
    public decimal CurrentStock { get; set; }
    public decimal MinimumAlertStock { get; set; }
    public decimal OptimalStock { get; set; }
    public decimal WeightedAverageCost { get; set; }
    public decimal LastPurchasePrice { get; set; }
    public StorageLocation StorageLocation { get; set; } = StorageLocation.CentralStorage;
    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    [Timestamp]
    public byte[] RowVersion { get; set; } = default!;

    public ICollection<InventoryTransaction> Transactions { get; set; } = [];
    public ICollection<RecipeLine> RecipeLines { get; set; } = [];
    public ICollection<InventoryUnitConversion> Conversions { get; set; } = [];

    public bool IsBelowAlertStock => CurrentStock <= MinimumAlertStock;

    public InventoryUnitConversion AddConversion(string unitName, decimal factorToBase)
    {
        var conversion = new InventoryUnitConversion
        {
            InventoryItemId = Id,
            UnitName = unitName.Trim(),
            TargetBaseUnit = BaseUnit,
            FactorToBase = factorToBase
        };
        conversion.EnsureValid(BaseUnit);
        if (Conversions.Any(c => c.UnitName.Equals(conversion.UnitName, StringComparison.OrdinalIgnoreCase)))
            throw new DomainException($"واحد «{conversion.UnitName}» از قبل تعریف شده است.");
        Conversions.Add(conversion);
        return conversion;
    }

    public void ReplaceConversions(IEnumerable<(string UnitName, decimal FactorToBase)> conversions)
    {
        Conversions.Clear();
        foreach (var (unitName, factor) in conversions)
            AddConversion(unitName, factor);
    }

    public InventoryTransaction ApplyPurchase(
        decimal quantityInBase,
        decimal unitPriceInBaseRials,
        Guid? userId,
        Guid? referenceId,
        string? notes)
    {
        if (quantityInBase <= 0)
            throw new DomainException("مقدار ورودی انبار باید مثبت باشد.");
        if (unitPriceInBaseRials < 0)
            throw new DomainException("قیمت واحد نمی‌تواند منفی باشد.");

        var stockBefore = CurrentStock;
        var oldWac = WeightedAverageCost;
        var newStock = stockBefore + quantityInBase;

        WeightedAverageCost = stockBefore <= 0
            ? decimal.Round(unitPriceInBaseRials, 2, MidpointRounding.AwayFromZero)
            : decimal.Round(
                ((stockBefore * oldWac) + (quantityInBase * unitPriceInBaseRials)) / newStock,
                2,
                MidpointRounding.AwayFromZero);

        LastPurchasePrice = decimal.Round(unitPriceInBaseRials, 2, MidpointRounding.AwayFromZero);
        CurrentStock = decimal.Round(newStock, 4, MidpointRounding.AwayFromZero);

        return AppendLedger(
            InventoryTransactionType.Purchase,
            quantityInBase,
            stockBefore,
            CurrentStock,
            unitPriceInBaseRials,
            userId,
            referenceId,
            notes);
    }

    public InventoryTransaction ApplyOpeningBalance(decimal quantityInBase, decimal unitCostRials, Guid? userId)
    {
        if (quantityInBase < 0)
            throw new DomainException("موجودی اول دوره نمی‌تواند منفی باشد.");

        var stockBefore = CurrentStock;
        CurrentStock = decimal.Round(stockBefore + quantityInBase, 4, MidpointRounding.AwayFromZero);
        if (quantityInBase > 0)
        {
            WeightedAverageCost = stockBefore <= 0
                ? decimal.Round(unitCostRials, 2, MidpointRounding.AwayFromZero)
                : decimal.Round(
                    ((stockBefore * WeightedAverageCost) + (quantityInBase * unitCostRials)) / CurrentStock,
                    2,
                    MidpointRounding.AwayFromZero);
            LastPurchasePrice = decimal.Round(unitCostRials, 2, MidpointRounding.AwayFromZero);
        }

        return AppendLedger(
            InventoryTransactionType.OpeningBalance,
            quantityInBase,
            stockBefore,
            CurrentStock,
            WeightedAverageCost,
            userId,
            null,
            "موجودی اول دوره");
    }

    public InventoryTransaction ApplyWaste(decimal quantityInBase, Guid? userId, Guid? referenceId, string? notes)
    {
        if (quantityInBase <= 0)
            throw new DomainException("مقدار ضایعات باید مثبت باشد.");
        if (quantityInBase > CurrentStock)
            throw new DomainException($"ضایعات بیشتر از موجودی فعلی است (موجودی: {CurrentStock}).");

        var stockBefore = CurrentStock;
        CurrentStock = decimal.Round(stockBefore - quantityInBase, 4, MidpointRounding.AwayFromZero);
        var tx = AppendLedger(
            InventoryTransactionType.Waste,
            -quantityInBase,
            stockBefore,
            CurrentStock,
            WeightedAverageCost,
            userId,
            referenceId,
            notes);
        RaiseLowStockIfNeeded();
        return tx;
    }

    public InventoryTransaction ApplyRecipeDeduction(decimal quantityInBase, Guid orderId, Guid? userId)
    {
        if (quantityInBase <= 0)
            throw new DomainException("مقدار کسر رسپی باید مثبت باشد.");

        var stockBefore = CurrentStock;
        CurrentStock = decimal.Round(stockBefore - quantityInBase, 4, MidpointRounding.AwayFromZero);
        var tx = AppendLedger(
            InventoryTransactionType.RecipeDeduction,
            -quantityInBase,
            stockBefore,
            CurrentStock,
            WeightedAverageCost,
            userId,
            orderId,
            "کسر خودکار رسپی");
        RaiseLowStockIfNeeded();
        return tx;
    }

    public InventoryTransaction RestoreOrderStock(decimal quantityInBase, Guid orderId, Guid? userId)
    {
        if (quantityInBase <= 0)
            throw new DomainException("مقدار برگشت موجودی باید مثبت باشد.");

        var stockBefore = CurrentStock;
        CurrentStock = decimal.Round(stockBefore + quantityInBase, 4, MidpointRounding.AwayFromZero);
        return AppendLedger(
            InventoryTransactionType.OrderCancelReturn,
            quantityInBase,
            stockBefore,
            CurrentStock,
            WeightedAverageCost,
            userId,
            orderId,
            "برگشت کسر رسپی پس از لغو");
    }

    public InventoryTransaction ApplyStockCountAdjustment(decimal physicalCountQty, Guid? userId, Guid stockCountId)
    {
        var stockBefore = CurrentStock;
        var discrepancy = decimal.Round(physicalCountQty - stockBefore, 4, MidpointRounding.AwayFromZero);
        CurrentStock = decimal.Round(physicalCountQty, 4, MidpointRounding.AwayFromZero);
        var tx = AppendLedger(
            InventoryTransactionType.StockCountAdjustment,
            discrepancy,
            stockBefore,
            CurrentStock,
            WeightedAverageCost,
            userId,
            stockCountId,
            "تعدیل انبارگردانی");
        RaiseLowStockIfNeeded();
        return tx;
    }

    public InventoryTransaction ApplyManualAdjustment(decimal quantityDelta, Guid? userId, string? notes)
    {
        if (quantityDelta == 0)
            throw new DomainException("مقدار تعدیل نمی‌تواند صفر باشد.");
        var stockBefore = CurrentStock;
        var next = stockBefore + quantityDelta;
        if (next < 0)
            throw new DomainException("موجودی پس از تعدیل نمی‌تواند منفی باشد.");
        CurrentStock = decimal.Round(next, 4, MidpointRounding.AwayFromZero);
        var tx = AppendLedger(
            InventoryTransactionType.ManualAdjustment,
            quantityDelta,
            stockBefore,
            CurrentStock,
            WeightedAverageCost,
            userId,
            null,
            notes ?? "تعدیل دستی موجودی");
        RaiseLowStockIfNeeded();
        return tx;
    }

    public InventoryTransaction ApplyInternalTransfer(decimal quantityInBase, StorageLocation from, StorageLocation to, Guid? userId, Guid transferId)
    {
        if (quantityInBase <= 0)
            throw new DomainException("مقدار انتقال باید مثبت باشد.");
        if (from == to)
            throw new DomainException("مبدأ و مقصد انتقال یکسان است.");
        if (StorageLocation != from)
            throw new DomainException($"کالای {Sku} در محل {StorageLocation} است، نه {from}.");
        if (quantityInBase > CurrentStock)
            throw new DomainException("مقدار انتقال بیشتر از موجودی فعلی است.");

        var stockBefore = CurrentStock;
        StorageLocation = to;
        return AppendLedger(
            InventoryTransactionType.InternalTransfer,
            0,
            stockBefore,
            CurrentStock,
            WeightedAverageCost,
            userId,
            transferId,
            $"انتقال از {from} به {to} به مقدار {quantityInBase}");
    }

    public decimal ConvertToBase(decimal quantity, BaseUnit? fromUnit = null, string? namedUnit = null) =>
        UnitConversionService.ToBaseUnit(this, quantity, fromUnit, namedUnit);

    private InventoryTransaction AppendLedger(
        InventoryTransactionType type,
        decimal quantityDelta,
        decimal stockBefore,
        decimal stockAfter,
        decimal unitCostRials,
        Guid? userId,
        Guid? referenceId,
        string? notes)
    {
        var tx = new InventoryTransaction
        {
            InventoryItemId = Id,
            TransactionType = type,
            QuantityDelta = quantityDelta,
            StockBefore = stockBefore,
            StockAfter = stockAfter,
            UnitCostRials = decimal.Round(unitCostRials, 2, MidpointRounding.AwayFromZero),
            UserId = userId,
            ReferenceId = referenceId,
            Notes = notes,
            CreatedAtUtc = DateTime.UtcNow,
            Location = StorageLocation
        };
        Transactions.Add(tx);
        return tx;
    }

    private void RaiseLowStockIfNeeded()
    {
        if (IsBelowAlertStock)
            AddDomainEvent(new InventoryLowStockEvent(Id, Sku, Name, CurrentStock, MinimumAlertStock));
    }

    // Backward-compatible aliases used by older analytics/tests during transition
    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public decimal ReorderPoint
    {
        get => MinimumAlertStock;
        set => MinimumAlertStock = value;
    }

    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public decimal SafetyStock
    {
        get => OptimalStock;
        set => OptimalStock = value;
    }

    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public decimal AverageCost
    {
        get => WeightedAverageCost;
        set => WeightedAverageCost = value;
    }

    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public decimal CostPrice
    {
        get => LastPurchasePrice;
        set => LastPurchasePrice = value;
    }

    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public UnitOfMeasure UnitOfMeasure
    {
        get => (UnitOfMeasure)(int)BaseUnit;
        set => BaseUnit = (BaseUnit)(int)value;
    }

    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public bool IsBelowReorderPoint => IsBelowAlertStock;

    public InventoryTransaction ApplyInbound(decimal quantity, decimal unitCost, Guid? staffId, string? notes, string? reference)
    {
        Guid? refId = Guid.TryParse(reference, out var g) ? g : null;
        return ApplyPurchase(quantity, unitCost, staffId, refId, notes);
    }

    public InventoryTransaction ReverseRecipeDeduction(decimal quantity, Guid orderId, Guid? staffId) =>
        RestoreOrderStock(quantity, orderId, staffId);
}
