using MediatR;
using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Application.Features.Customers;

public sealed record GetCustomerWalletBalanceQuery(Guid CustomerId) : IRequest<CustomerWalletBalanceDto>;
public sealed record CustomerWalletBalanceDto(decimal BalanceRials);

public sealed class GetCustomerWalletBalanceQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetCustomerWalletBalanceQuery, CustomerWalletBalanceDto>
{
    public async Task<CustomerWalletBalanceDto> Handle(
        GetCustomerWalletBalanceQuery request, CancellationToken cancellationToken)
    {
        if (!await db.Customers.AsNoTracking().AnyAsync(c => c.Id == request.CustomerId, cancellationToken))
            throw new NotFoundException(nameof(Customer), request.CustomerId);

        var balance = await db.CustomerWalletLedgers.AsNoTracking()
            .Where(x => x.CustomerId == request.CustomerId)
            .OrderByDescending(x => x.OccurredAtUtc)
            .ThenByDescending(x => x.Id)
            .Select(x => (decimal?)x.BalanceAfterRials)
            .FirstOrDefaultAsync(cancellationToken) ?? 0;

        return new CustomerWalletBalanceDto(balance);
    }
}
