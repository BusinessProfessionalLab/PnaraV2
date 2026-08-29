using System.Text.RegularExpressions;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Domain.ValueObjects;

public readonly partial record struct PhoneNumber
{
    public string Value { get; }

    public PhoneNumber(string value)
    {
        var normalized = Normalize(value);
        if (!IranMobileRegex().IsMatch(normalized))
            throw new DomainException("شماره موبایل ایران نامعتبر است.");

        Value = normalized;
    }

    public static string Normalize(string value)
    {
        var digits = new string((value ?? string.Empty).Where(char.IsDigit).ToArray());
        if (digits.StartsWith("0098"))
            digits = "0" + digits[4..];
        else if (digits.StartsWith("98") && digits.Length == 12)
            digits = "0" + digits[2..];
        return digits;
    }

    public static bool TryParse(string? value, out PhoneNumber phone)
    {
        phone = default;
        if (string.IsNullOrWhiteSpace(value))
            return false;
        try
        {
            phone = new PhoneNumber(value);
            return true;
        }
        catch (DomainException)
        {
            return false;
        }
    }

    [GeneratedRegex(@"^09\d{9}$")]
    private static partial Regex IranMobileRegex();

    public override string ToString() => Value;
}
