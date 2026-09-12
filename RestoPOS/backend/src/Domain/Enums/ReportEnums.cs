namespace RestoPOS.Domain.Enums;

public enum TimePeriodPreset
{
    Today = 0,
    Yesterday = 1,
    ThisMonth = 2,
    LastMonth = 3,
    CustomRange = 4
}

public enum TimelineInterval
{
    Hourly = 0,
    Daily = 1,
    Weekly = 2
}

/// <summary>Normalized payment method labels for analytics charts (maps from <see cref="PaymentChannel"/>).</summary>
public enum ReportPaymentMethod
{
    Cash = 0,
    PosTerminal = 1,
    CardToCard = 2,
    WalletCredit = 3,
    Online = 4
}
