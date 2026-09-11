using System.Globalization;

namespace RestoPOS.Domain.Services;

/// <summary>
/// Shamsi (Jalali) helpers. Persistence always uses UTC; this type is for receipts, reports, and order numbers.
/// </summary>
public static class PersianDateTime
{
    private static readonly PersianCalendar Calendar = new();

    public static DateTime UtcNow => DateTime.UtcNow;

    public static string ToShamsi(DateTime dateTime, string separator = "/")
    {
        var local = ToLocal(dateTime);
        var y = Calendar.GetYear(local);
        var m = Calendar.GetMonth(local);
        var d = Calendar.GetDayOfMonth(local);
        return $"{y:0000}{separator}{m:00}{separator}{d:00}";
    }

    public static string ToShamsiDateTime(DateTime dateTime)
    {
        var local = ToLocal(dateTime);
        return $"{ToShamsi(local)} {local:HH:mm:ss}";
    }

    public static string ToShamsiCompact(DateTime dateTime)
    {
        var local = ToLocal(dateTime);
        return $"{Calendar.GetYear(local):0000}{Calendar.GetMonth(local):00}{Calendar.GetDayOfMonth(local):00}";
    }

    public static int GetHour(DateTime dateTime) => ToLocal(dateTime).Hour;

    public static int GetDayOfWeek(DateTime dateTime) => (int)ToLocal(dateTime).DayOfWeek;

    public static DateTime StartOfLocalDayUtc(DateTime utcOrLocal)
    {
        var local = ToLocal(utcOrLocal);
        var startLocal = new DateTime(local.Year, local.Month, local.Day, 0, 0, 0, DateTimeKind.Local);
        return startLocal.ToUniversalTime();
    }

    public static DateTime EndOfLocalDayUtc(DateTime utcOrLocal)
    {
        var local = ToLocal(utcOrLocal);
        var endLocal = new DateTime(local.Year, local.Month, local.Day, 23, 59, 59, 999, DateTimeKind.Local);
        return endLocal.ToUniversalTime();
    }

    /// <summary>First instant (local midnight) of the Jalali month containing <paramref name="utcOrLocal"/>, as UTC.</summary>
    public static DateTime StartOfJalaliMonthUtc(DateTime utcOrLocal)
    {
        var local = ToLocal(utcOrLocal);
        var y = Calendar.GetYear(local);
        var m = Calendar.GetMonth(local);
        var startLocal = Calendar.ToDateTime(y, m, 1, 0, 0, 0, 0);
        return DateTime.SpecifyKind(startLocal, DateTimeKind.Local).ToUniversalTime();
    }

    /// <summary>Last instant of the Jalali month containing <paramref name="utcOrLocal"/>, as UTC.</summary>
    public static DateTime EndOfJalaliMonthUtc(DateTime utcOrLocal)
    {
        var local = ToLocal(utcOrLocal);
        var y = Calendar.GetYear(local);
        var m = Calendar.GetMonth(local);
        var days = Calendar.GetDaysInMonth(y, m);
        var endLocal = Calendar.ToDateTime(y, m, days, 23, 59, 59, 999);
        return DateTime.SpecifyKind(endLocal, DateTimeKind.Local).ToUniversalTime();
    }

    public static DateTime StartOfPreviousJalaliMonthUtc(DateTime utcOrLocal)
    {
        var local = ToLocal(utcOrLocal);
        var y = Calendar.GetYear(local);
        var m = Calendar.GetMonth(local);
        if (m == 1) { y--; m = 12; } else m--;
        var startLocal = Calendar.ToDateTime(y, m, 1, 0, 0, 0, 0);
        return DateTime.SpecifyKind(startLocal, DateTimeKind.Local).ToUniversalTime();
    }

    public static DateTime EndOfPreviousJalaliMonthUtc(DateTime utcOrLocal)
    {
        var local = ToLocal(utcOrLocal);
        var y = Calendar.GetYear(local);
        var m = Calendar.GetMonth(local);
        if (m == 1) { y--; m = 12; } else m--;
        var days = Calendar.GetDaysInMonth(y, m);
        var endLocal = Calendar.ToDateTime(y, m, days, 23, 59, 59, 999);
        return DateTime.SpecifyKind(endLocal, DateTimeKind.Local).ToUniversalTime();
    }

    public static string JalaliMonthLabel(DateTime utcOrLocal)
    {
        var local = ToLocal(utcOrLocal);
        return $"{Calendar.GetYear(local):0000}/{Calendar.GetMonth(local):00}";
    }

    public static DateTime ToLocal(DateTime dateTime) =>
        dateTime.Kind == DateTimeKind.Utc ? dateTime.ToLocalTime() : DateTime.SpecifyKind(dateTime, DateTimeKind.Local);
}
