using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Domain.ValueObjects;

/// <summary>
/// Iranian Rial (IRR) money. Amounts are stored with zero fractional digits.
/// Convert to Toman with <see cref="ToToman"/> (1 Toman = 10 Rial).
/// </summary>
public readonly record struct Money
{
    public decimal Amount { get; }
    public string Currency { get; }

    public Money(decimal amount, string currency = "IRR")
    {
        if (amount < 0)
            throw new DomainException("مبلغ نمی‌تواند منفی باشد.");

        Amount = decimal.Round(amount, 0, MidpointRounding.AwayFromZero);
        Currency = currency;
    }

    public static Money Zero => new(0);
    public static Money Rial(decimal amount) => new(amount);
    public static Money Toman(decimal toman) => new(toman * 10m);

    public decimal ToToman() => Amount / 10m;

    public static Money operator +(Money left, Money right) => new(left.Amount + right.Amount, left.Currency);
    public static Money operator -(Money left, Money right) => new(left.Amount - right.Amount, left.Currency);
    public static Money operator *(Money left, decimal multiplier) => new(left.Amount * multiplier, left.Currency);

    public override string ToString() => $"{Amount:N0} ریال";
}
