using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Domain.Services;

public static class UnitOfMeasureConversion
{
    public static decimal Convert(decimal quantity, UnitOfMeasure from, UnitOfMeasure to)
    {
        if (quantity < 0)
            throw new DomainException("مقدار برای تبدیل واحد نمی‌تواند منفی باشد.");
        if (Dimension(from) != Dimension(to))
            throw new DomainException($"تبدیل واحد «{from}» به «{to}» امکان‌پذیر نیست.");
        return quantity * FactorToBase(from) / FactorToBase(to);
    }

    private static string Dimension(UnitOfMeasure unit) => unit switch
    {
        UnitOfMeasure.Kg or UnitOfMeasure.Gr => "mass",
        UnitOfMeasure.Liter or UnitOfMeasure.Ml => "volume",
        UnitOfMeasure.Count => "count",
        _ => throw new DomainException("واحد اندازه‌گیری نامعتبر است.")
    };

    private static decimal FactorToBase(UnitOfMeasure unit) => unit switch
    {
        UnitOfMeasure.Kg => 1000m,
        UnitOfMeasure.Gr => 1m,
        UnitOfMeasure.Liter => 1000m,
        UnitOfMeasure.Ml => 1m,
        UnitOfMeasure.Count => 1m,
        _ => throw new DomainException("واحد اندازه‌گیری نامعتبر است.")
    };
}
