namespace RestoPOS.Domain.Enums;

/// <summary>Base stock-keeping unit for inventory items and recipe deductions.</summary>
public enum BaseUnit
{
    Gram = 0,
    Milliliter = 1,
    Piece = 2,
    Portion = 3,
    Can = 4,
    Kilogram = 5,
    Liter = 6
}

/// <summary>Legacy alias kept for recipe DTOs during transition; prefer <see cref="BaseUnit"/>.</summary>
public enum UnitOfMeasure
{
    Gram = 0,
    Milliliter = 1,
    Piece = 2,
    Portion = 3,
    Can = 4,
    Kilogram = 5,
    Liter = 6
}

public enum StorageLocation
{
    CentralStorage = 0,
    KitchenLine = 1,
    Bar = 2,
    ColdRoom = 3,
    DryStorage = 4
}

public enum InventoryTransactionType
{
    Purchase = 0,
    RecipeDeduction = 1,
    OrderCancelReturn = 2,
    Waste = 3,
    StockCountAdjustment = 4,
    InternalTransfer = 5,
    OpeningBalance = 6,
    ManualAdjustment = 7
}

public enum PurchasePaymentStatus
{
    Unpaid = 0,
    Partial = 1,
    Paid = 2
}

public enum PurchaseInvoiceStatus
{
    Draft = 0,
    Approved = 1,
    Cancelled = 2
}

public enum WasteReason
{
    Expired = 0,
    PreparationDefect = 1,
    Spoilage = 2,
    StaffMeal = 3,
    SpillBreakage = 4
}

public enum StockCountStatus
{
    Draft = 0,
    InProgress = 1,
    Completed = 2,
    Approved = 3
}

public enum StockTransferStatus
{
    Requested = 0,
    Transferred = 1,
    Cancelled = 2
}

public enum ShiftStatus
{
    Open = 0,
    Closed = 1
}
