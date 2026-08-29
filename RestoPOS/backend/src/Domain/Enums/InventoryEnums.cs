namespace RestoPOS.Domain.Enums;

public enum UnitOfMeasure
{
    Kg = 0,
    Gr = 1,
    Liter = 2,
    Ml = 3,
    Count = 4
}

public enum InventoryTransactionType
{
    InboundPurchase = 0,
    Waste = 1,
    RecipeDeduction = 2,
    ReverseDeduction = 3,
    Adjustment = 4
}

public enum ShiftStatus
{
    Open = 0,
    Closed = 1
}
