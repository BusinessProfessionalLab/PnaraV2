using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Exceptions;
using RestoPOS.Domain.Services;

namespace RestoPOS.Application.Features.Analytics;

public readonly record struct TimePeriodRange(
    DateTime FromUtc,
    DateTime ToUtc,
    DateTime ComparisonFromUtc,
    DateTime ComparisonToUtc,
    string LabelFa,
    TimePeriodPreset Preset);

/// <summary>
/// Resolves Jalali-aware report windows and an equal-length prior window for period-over-period deltas.
/// </summary>
public static class TimePeriodHelper
{
    public static TimePeriodRange Resolve(TimePeriodPreset preset, DateTime? fromUtc, DateTime? toUtc, DateTime? utcNow = null)
    {
        var now = utcNow ?? DateTime.UtcNow;
        if (now.Kind == DateTimeKind.Unspecified)
            now = DateTime.SpecifyKind(now, DateTimeKind.Utc);

        DateTime from;
        DateTime to;
        string label;

        switch (preset)
        {
            case TimePeriodPreset.Today:
                from = PersianDateTime.StartOfLocalDayUtc(now);
                to = now;
                label = "امروز";
                break;

            case TimePeriodPreset.Yesterday:
            {
                var yesterdayLocal = PersianDateTime.ToLocal(now).Date.AddDays(-1);
                from = PersianDateTime.StartOfLocalDayUtc(DateTime.SpecifyKind(yesterdayLocal, DateTimeKind.Local).ToUniversalTime());
                to = PersianDateTime.EndOfLocalDayUtc(DateTime.SpecifyKind(yesterdayLocal, DateTimeKind.Local).ToUniversalTime());
                label = "دیروز";
                break;
            }

            case TimePeriodPreset.ThisMonth:
                from = PersianDateTime.StartOfJalaliMonthUtc(now);
                to = now;
                label = $"ماه جاری ({PersianDateTime.JalaliMonthLabel(now)})";
                break;

            case TimePeriodPreset.LastMonth:
                from = PersianDateTime.StartOfPreviousJalaliMonthUtc(now);
                to = PersianDateTime.EndOfPreviousJalaliMonthUtc(now);
                label = $"ماه قبل ({PersianDateTime.JalaliMonthLabel(from)})";
                break;

            case TimePeriodPreset.CustomRange:
                if (fromUtc is null || toUtc is null)
                    throw new DomainException("برای بازه سفارشی باید fromUtc و toUtc مشخص شوند.");
                from = NormalizeUtc(fromUtc.Value);
                to = NormalizeUtc(toUtc.Value);
                if (to < from)
                    throw new DomainException("پایان بازه نمی‌تواند قبل از شروع باشد.");
                label = $"{PersianDateTime.ToShamsi(from)} تا {PersianDateTime.ToShamsi(to)}";
                break;

            default:
                throw new DomainException($"پیش‌فرض بازه زمانی نامعتبر: {preset}");
        }

        var duration = to - from;
        var comparisonTo = from.AddTicks(-1);
        var comparisonFrom = comparisonTo - duration;
        if (comparisonFrom > comparisonTo)
            comparisonFrom = comparisonTo;

        return new TimePeriodRange(from, to, comparisonFrom, comparisonTo, label, preset);
    }

    public static decimal PercentChange(decimal current, decimal previous)
    {
        if (previous == 0)
            return current == 0 ? 0 : 100m;
        return decimal.Round((current - previous) / Math.Abs(previous) * 100m, 2, MidpointRounding.AwayFromZero);
    }

    private static DateTime NormalizeUtc(DateTime value) =>
        value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
}

public static class ReportMoney
{
    public static decimal ToToman(decimal rials) => decimal.Round(rials / 10m, 0, MidpointRounding.AwayFromZero);

    public static long ToTomanLong(decimal rials) => (long)ToToman(rials);

    public static ReportPaymentMethod ToReportMethod(PaymentChannel channel) => channel switch
    {
        PaymentChannel.Cash => ReportPaymentMethod.Cash,
        PaymentChannel.LocalPC_POS => ReportPaymentMethod.PosTerminal,
        PaymentChannel.CardToCard => ReportPaymentMethod.CardToCard,
        PaymentChannel.OnlineGateway => ReportPaymentMethod.Online,
        _ => ReportPaymentMethod.Online
    };

    public static string MethodLabelFa(ReportPaymentMethod method) => method switch
    {
        ReportPaymentMethod.Cash => "نقد",
        ReportPaymentMethod.PosTerminal => "کارتخوان",
        ReportPaymentMethod.CardToCard => "کارت‌به‌کارت",
        ReportPaymentMethod.WalletCredit => "کیف‌پول / اعتبار",
        ReportPaymentMethod.Online => "درگاه آنلاین",
        _ => method.ToString()
    };
}
