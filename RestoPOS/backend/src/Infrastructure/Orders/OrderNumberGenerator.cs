using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Services;
using RestoPOS.Infrastructure.Persistence;

namespace RestoPOS.Infrastructure.Orders;

public sealed class OrderNumberGenerator(ApplicationDbContext db) : IOrderNumberGenerator
{
    public async Task<string> NextAsync(CancellationToken cancellationToken = default)
    {
        var stamp = PersianDateTime.ToShamsiCompact(DateTime.UtcNow);
        var prefix = $"TI-{stamp}-";
        var last = await db.Orders.IgnoreQueryFilters()
            .Where(o => o.OrderNumber.StartsWith(prefix))
            .OrderByDescending(o => o.OrderNumber)
            .Select(o => o.OrderNumber)
            .FirstOrDefaultAsync(cancellationToken);

        var seq = 1;
        if (last is not null)
        {
            var tail = last[prefix.Length..];
            if (int.TryParse(tail, out var parsed))
                seq = parsed + 1;
        }

        return $"{prefix}{seq:0000}";
    }
}

public sealed class SystemDateTimeProvider : IDateTimeProvider
{
    public DateTime UtcNow => DateTime.UtcNow;
}
