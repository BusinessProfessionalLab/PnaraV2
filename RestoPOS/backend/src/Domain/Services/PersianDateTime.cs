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
        var local = dateTime.Kind == DateTimeKind.Utc ? dateTime.ToLocalTime() : dateTime;
        var y = Calendar.GetYear(local);
        var m = Calendar.GetMonth(local);
        var d = Calendar.GetDayOfMonth(local);
        return $"{y:0000}{separator}{m:00}{separator}{d:00}";
    }

    public static string ToShamsiDateTime(DateTime dateTime)
    {
        var local = dateTime.Kind == DateTimeKind.Utc ? dateTime.ToLocalTime() : dateTime;
        return $"{ToShamsi(local)} {local:HH:mm:ss}";
    }

    public static string ToShamsiCompact(DateTime dateTime)
    {
        var local = dateTime.Kind == DateTimeKind.Utc ? dateTime.ToLocalTime() : dateTime;
        return $"{Calendar.GetYear(local):0000}{Calendar.GetMonth(local):00}{Calendar.GetDayOfMonth(local):00}";
    }

    public static int GetHour(DateTime dateTime)
    {
        var local = dateTime.Kind == DateTimeKind.Utc ? dateTime.ToLocalTime() : dateTime;
        return local.Hour;
    }
}
