using MediatR;
using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Exceptions;
using RestoPOS.Domain.Services;
using RestoPOS.Domain.ValueObjects;

namespace RestoPOS.Application.Features.Customers;

public sealed record CustomerDto(
    Guid Id,
    string PhoneNumber,
    string? FullName,
    int VisitCount,
    decimal TotalSpent,
    int LoyaltyPoints,
    DateTime FirstVisitAt,
    string FirstVisitShamsi,
    DateTime LastVisitAt,
    string LastVisitShamsi);

public sealed record GetCustomerByPhoneQuery(string PhoneNumber) : IRequest<CustomerDto>;
public sealed record SearchCustomersQuery(string? Term) : IRequest<IReadOnlyList<CustomerDto>>;

public sealed class GetCustomerByPhoneQueryHandler(IApplicationDbContext db) : IRequestHandler<GetCustomerByPhoneQuery, CustomerDto>
{
    public async Task<CustomerDto> Handle(GetCustomerByPhoneQuery request, CancellationToken cancellationToken)
    {
        var phone = new PhoneNumber(request.PhoneNumber).Value;
        var customer = await db.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.PhoneNumber == phone, cancellationToken)
                       ?? throw new NotFoundException(nameof(Customer), phone);
        return Map(customer);
    }

    internal static CustomerDto Map(Customer c) => new(
        c.Id, c.PhoneNumber, c.FullName, c.VisitCount, c.TotalSpent, c.LoyaltyPoints,
        c.FirstVisitAt, PersianDateTime.ToShamsiDateTime(c.FirstVisitAt),
        c.LastVisitAt, PersianDateTime.ToShamsiDateTime(c.LastVisitAt));
}

public sealed class SearchCustomersQueryHandler(IApplicationDbContext db) : IRequestHandler<SearchCustomersQuery, IReadOnlyList<CustomerDto>>
{
    public async Task<IReadOnlyList<CustomerDto>> Handle(SearchCustomersQuery request, CancellationToken cancellationToken)
    {
        var query = db.Customers.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(request.Term))
        {
            var term = request.Term.Trim();
            query = query.Where(c => c.PhoneNumber.Contains(term) || (c.FullName != null && c.FullName.Contains(term)));
        }

        var items = await query.OrderByDescending(c => c.LastVisitAt).Take(50).ToListAsync(cancellationToken);
        return items.Select(GetCustomerByPhoneQueryHandler.Map).ToList();
    }
}
