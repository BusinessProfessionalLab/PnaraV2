using MediatR;
using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Enums;

namespace RestoPOS.Application.Features.Analytics;

public sealed class GetCustomerReturnRateQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetCustomerReturnRateQuery, CustomerReturnRateReportDto>
{
    public async Task<CustomerReturnRateReportDto> Handle(
        GetCustomerReturnRateQuery request,
        CancellationToken cancellationToken)
    {
        var period = TimePeriodHelper.Resolve(request.Preset, request.FromUtc, request.ToUtc);
        var visits = await AnalyticsScope.PaidOrders(db, period.FromUtc, period.ToUtc)
            .Where(o => o.CustomerId != null)
            .GroupBy(o => o.CustomerId!.Value)
            .Select(g => new { CustomerId = g.Key, VisitCount = g.Count() })
            .ToListAsync(cancellationToken);

        var customerIds = visits.Select(v => v.CustomerId).ToList();
        var priorVisits = customerIds.Count == 0
            ? new HashSet<Guid>()
            : (await db.Orders.AsNoTracking()
                .Where(o => o.Status == OrderStatus.Paid
                            && o.CustomerId != null
                            && customerIds.Contains(o.CustomerId.Value)
                            && o.PaidAt != null
                            && o.PaidAt < period.FromUtc)
                .Select(o => o.CustomerId!.Value)
                .Distinct()
                .ToListAsync(cancellationToken))
                .ToHashSet();

        var returning = visits.Count(v => v.VisitCount > 1 || priorVisits.Contains(v.CustomerId));
        var customerCount = visits.Count;
        var rate = customerCount == 0
            ? 0
            : decimal.Round(returning / (decimal)customerCount * 100m, 2, MidpointRounding.AwayFromZero);

        return new CustomerReturnRateReportDto(
            period.LabelFa,
            customerCount,
            returning,
            customerCount - returning,
            rate);
    }
}
