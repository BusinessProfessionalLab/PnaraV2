using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Services;

namespace RestoPOS.Application.Features.Analytics;

internal static class AnalyticsScope
{
    public static IQueryable<Order> PaidOrders(IApplicationDbContext db, DateTime fromUtc, DateTime toUtc) =>
        db.Orders.AsNoTracking()
            .Where(o => o.Status == OrderStatus.Paid && o.PaidAt != null && o.PaidAt >= fromUtc && o.PaidAt <= toUtc);

    public static IQueryable<Order> OrdersCreated(IApplicationDbContext db, DateTime fromUtc, DateTime toUtc) =>
        db.Orders.AsNoTracking()
            .Where(o => o.Status != OrderStatus.Draft && o.CreatedAt >= fromUtc && o.CreatedAt <= toUtc);

    public static IQueryable<Payment> SettledPayments(IApplicationDbContext db, DateTime fromUtc, DateTime toUtc) =>
        db.Payments.AsNoTracking()
            .Where(p => p.Status == PaymentStatus.Settled && p.PaidAt != null && p.PaidAt >= fromUtc && p.PaidAt <= toUtc);

    public static async Task<(Dictionary<Guid, decimal> MenuItemUnitCogs, Dictionary<Guid, decimal> ModifierUnitCogs)>
        BuildAllRecipeUnitCostsAsync(IApplicationDbContext db, CancellationToken cancellationToken)
    {
        var recipes = await db.Recipes.AsNoTracking()
            .Include(r => r.Lines)
            .ThenInclude(l => l.InventoryItem)
            .ThenInclude(i => i!.Conversions)
            .Where(r => !r.IsDeleted)
            .ToListAsync(cancellationToken);

        var menu = new Dictionary<Guid, decimal>();
        var mods = new Dictionary<Guid, decimal>();

        foreach (var recipe in recipes)
        {
            decimal cost = 0;
            foreach (var line in recipe.Lines)
            {
                if (line.InventoryItem is null)
                    continue;
                var qtyInBase = line.InventoryItem.ConvertToBase(line.Quantity, line.Unit);
                cost += qtyInBase * line.InventoryItem.WeightedAverageCost;
            }

            cost = decimal.Round(cost, 0, MidpointRounding.AwayFromZero);
            if (recipe.MenuItemId is Guid mid)
                menu[mid] = cost;
            if (recipe.MenuItemModifierId is Guid modId)
                mods[modId] = cost;
        }

        return (menu, mods);
    }

    public static string DayOfWeekFa(int dayOfWeek) => dayOfWeek switch
    {
        0 => "یکشنبه",
        1 => "دوشنبه",
        2 => "سه‌شنبه",
        3 => "چهارشنبه",
        4 => "پنجشنبه",
        5 => "جمعه",
        6 => "شنبه",
        _ => dayOfWeek.ToString()
    };

    public static string PspLabel(IranianPsp psp) => psp switch
    {
        IranianPsp.AsanPardakht => "آسان‌پرداخت",
        IranianPsp.SamanKish => "سامان‌کیش",
        IranianPsp.BehpardakhtMellat => "به‌پرداخت ملت",
        _ => "نامشخص"
    };

    public static IEnumerable<DateTime> EnumerateBuckets(DateTime fromUtc, DateTime toUtc, TimelineInterval interval)
    {
        var cursor = AlignBucketStart(fromUtc, interval);
        var end = toUtc;
        while (cursor <= end)
        {
            yield return cursor;
            cursor = interval switch
            {
                TimelineInterval.Hourly => cursor.AddHours(1),
                TimelineInterval.Daily => cursor.AddDays(1),
                TimelineInterval.Weekly => cursor.AddDays(7),
                _ => cursor.AddDays(1)
            };
        }
    }

    public static DateTime AlignBucketStart(DateTime utc, TimelineInterval interval)
    {
        var local = PersianDateTime.ToLocal(utc);
        return interval switch
        {
            TimelineInterval.Hourly => DateTime.SpecifyKind(
                new DateTime(local.Year, local.Month, local.Day, local.Hour, 0, 0), DateTimeKind.Local).ToUniversalTime(),
            TimelineInterval.Daily => PersianDateTime.StartOfLocalDayUtc(utc),
            TimelineInterval.Weekly =>
                PersianDateTime.StartOfLocalDayUtc(
                    DateTime.SpecifyKind(local.Date.AddDays(-(int)local.DayOfWeek), DateTimeKind.Local).ToUniversalTime()),
            _ => PersianDateTime.StartOfLocalDayUtc(utc)
        };
    }

    public static DateTime BucketKey(DateTime paidAtUtc, TimelineInterval interval) =>
        AlignBucketStart(paidAtUtc, interval);

    public static string BucketLabel(DateTime bucketStartUtc, TimelineInterval interval)
    {
        var local = PersianDateTime.ToLocal(bucketStartUtc);
        return interval switch
        {
            TimelineInterval.Hourly => $"{PersianDateTime.ToShamsi(bucketStartUtc)} {local:HH}:00",
            TimelineInterval.Daily => PersianDateTime.ToShamsi(bucketStartUtc),
            TimelineInterval.Weekly => $"هفته {PersianDateTime.ToShamsi(bucketStartUtc)}",
            _ => PersianDateTime.ToShamsi(bucketStartUtc)
        };
    }

    public static string BucketLabelIso(DateTime bucketStartUtc, TimelineInterval interval)
    {
        var local = PersianDateTime.ToLocal(bucketStartUtc);
        return interval switch
        {
            TimelineInterval.Hourly => local.ToString("yyyy-MM-dd HH:00"),
            TimelineInterval.Daily => local.ToString("yyyy-MM-dd"),
            TimelineInterval.Weekly => local.ToString("yyyy-MM-dd"),
            _ => local.ToString("O")
        };
    }
}
