namespace RestoPOS.Domain.Enums;

public enum TableStatus
{
    Available = 0,
    Occupied = 1,
    Reserved = 2,
    Cleaning = 3
}

public enum CashDrawerMovementType
{
    CashDrop = 0,
    PaidOut = 1
}

public enum LoyaltyLedgerType
{
    Earn = 0,
    Redeem = 1,
    ManualAdjust = 2
}
