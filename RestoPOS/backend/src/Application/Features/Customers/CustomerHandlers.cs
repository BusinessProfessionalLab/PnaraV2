using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Application.Common.Models;
using RestoPOS.Application.Features.Orders;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Enums;
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
    string LastVisitShamsi,
    DateOnly? BirthDate = null,
    string? Gender = null,
    string? PersonalityType = null,
    IReadOnlyList<string>? FavoriteProducts = null,
    IReadOnlyList<string>? Tags = null,
    string? Notes = null,
    bool MarketingConsent = false,
    DateTime? MarketingConsentUpdatedAtUtc = null,
    string RegistrationSource = "Manual");

public sealed record CreateCustomerCommand(
    string PhoneNumber, string? FullName, DateOnly? BirthDate = null, string? Gender = null,
    string? PersonalityType = null, string[]? FavoriteProducts = null, string[]? Tags = null,
    string? Notes = null, bool MarketingConsent = false, string RegistrationSource = "Manual") : IRequest<CustomerDto>;
public sealed record UpdateCustomerCommand(
    Guid Id, string? FullName, string PhoneNumber, DateOnly? BirthDate = null, string? Gender = null,
    string? PersonalityType = null, string[]? FavoriteProducts = null, string[]? Tags = null,
    string? Notes = null, bool? MarketingConsent = null) : IRequest<CustomerDto>;
public sealed record SoftDeleteCustomerCommand(Guid Id) : IRequest;
public sealed record GetCustomerByIdQuery(Guid Id) : IRequest<CustomerDto>;
public sealed record GetCustomerByPhoneQuery(string PhoneNumber) : IRequest<CustomerDto>;
public sealed record SearchCustomersQuery(string? Term) : IRequest<IReadOnlyList<CustomerDto>>;
public sealed record GetCustomersPagedQuery(int Page = 1, int PageSize = 50, string? Term = null) : IRequest<PaginatedList<CustomerDto>>;
public sealed record AdjustLoyaltyPointsCommand(Guid CustomerId, int Delta, string? Notes) : IRequest<CustomerDto>;
public sealed record LoyaltyPointTransactionDto(Guid Id, LoyaltyLedgerType Type, int PointsDelta, int BalanceAfter, Guid? OrderId, string? Notes, DateTime OccurredAtUtc);
public sealed record GetCustomerPointHistoryQuery(Guid CustomerId, int Page = 1, int PageSize = 50)
    : IRequest<PaginatedList<LoyaltyPointTransactionDto>>;
public sealed record GetCustomerOrderHistoryQuery(Guid CustomerId, int Page = 1, int PageSize = 50) : IRequest<PaginatedList<OrderDto>>;
public sealed record RegisterOnlineCustomerCommand(string PhoneNumber, string FullName, bool MarketingConsent)
    : IRequest<CustomerDto>;

internal static class CustomerMapping
{
    public static CustomerDto Map(Customer c) => new(
        c.Id, c.PhoneNumber, c.FullName, c.VisitCount, c.TotalSpent, c.LoyaltyPoints,
        c.FirstVisitAt, PersianDateTime.ToShamsiDateTime(c.FirstVisitAt),
        c.LastVisitAt, PersianDateTime.ToShamsiDateTime(c.LastVisitAt), c.BirthDate, c.Gender,
        c.PersonalityType, c.FavoriteProducts, c.Tags, c.Notes, c.MarketingConsent,
        c.MarketingConsentUpdatedAtUtc, c.RegistrationSource);
}

public sealed class CreateCustomerCommandValidator : AbstractValidator<CreateCustomerCommand>
{
    public CreateCustomerCommandValidator() => RuleFor(x => x.PhoneNumber).NotEmpty();
}

public sealed class CreateCustomerCommandHandler(IApplicationDbContext db) : IRequestHandler<CreateCustomerCommand, CustomerDto>
{
    public async Task<CustomerDto> Handle(CreateCustomerCommand request, CancellationToken cancellationToken)
    {
        var phone = new PhoneNumber(request.PhoneNumber).Value;
        if (await db.Customers.AnyAsync(c => c.PhoneNumber == phone, cancellationToken))
            throw new ConflictException("مشتری با این شماره تلفن از قبل وجود دارد.");

        var customer = Customer.Create(phone, request.FullName);
        customer.BirthDate = request.BirthDate;
        customer.Gender = request.Gender;
        customer.PersonalityType = request.PersonalityType;
        customer.FavoriteProducts = request.FavoriteProducts ?? [];
        customer.Tags = request.Tags ?? [];
        customer.Notes = request.Notes;
        customer.MarketingConsent = request.MarketingConsent;
        customer.MarketingConsentUpdatedAtUtc = request.MarketingConsent ? DateTime.UtcNow : null;
        customer.RegistrationSource = request.RegistrationSource;
        db.Customers.Add(customer);
        await db.SaveChangesAsync(cancellationToken);
        return CustomerMapping.Map(customer);
    }
}

public sealed class UpdateCustomerCommandHandler(IApplicationDbContext db) : IRequestHandler<UpdateCustomerCommand, CustomerDto>
{
    public async Task<CustomerDto> Handle(UpdateCustomerCommand request, CancellationToken cancellationToken)
    {
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == request.Id, cancellationToken)
                       ?? throw new NotFoundException(nameof(Customer), request.Id);
        var phone = new PhoneNumber(request.PhoneNumber).Value;
        if (await db.Customers.AnyAsync(c => c.PhoneNumber == phone && c.Id != request.Id, cancellationToken))
            throw new ConflictException("شماره تلفن متعلق به مشتری دیگری است.");

        customer.PhoneNumber = phone;
        customer.FullName = request.FullName;
        if (request.BirthDate is not null) customer.BirthDate = request.BirthDate;
        if (request.Gender is not null) customer.Gender = request.Gender;
        if (request.PersonalityType is not null) customer.PersonalityType = request.PersonalityType;
        if (request.FavoriteProducts is not null) customer.FavoriteProducts = request.FavoriteProducts;
        if (request.Tags is not null) customer.Tags = request.Tags;
        if (request.Notes is not null) customer.Notes = request.Notes;
        if (request.MarketingConsent is not null && customer.MarketingConsent != request.MarketingConsent.Value)
            customer.MarketingConsentUpdatedAtUtc = DateTime.UtcNow;
        if (request.MarketingConsent is not null) customer.MarketingConsent = request.MarketingConsent.Value;
        await db.SaveChangesAsync(cancellationToken);
        return CustomerMapping.Map(customer);
    }
}

public sealed class SoftDeleteCustomerCommandHandler(IApplicationDbContext db) : IRequestHandler<SoftDeleteCustomerCommand>
{
    public async Task Handle(SoftDeleteCustomerCommand request, CancellationToken cancellationToken)
    {
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == request.Id, cancellationToken)
                       ?? throw new NotFoundException(nameof(Customer), request.Id);
        customer.IsDeleted = true;
        customer.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class GetCustomerByIdQueryHandler(IApplicationDbContext db) : IRequestHandler<GetCustomerByIdQuery, CustomerDto>
{
    public async Task<CustomerDto> Handle(GetCustomerByIdQuery request, CancellationToken cancellationToken)
    {
        var customer = await db.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == request.Id, cancellationToken)
                       ?? throw new NotFoundException(nameof(Customer), request.Id);
        return CustomerMapping.Map(customer);
    }
}

public sealed class GetCustomerByPhoneQueryHandler(IApplicationDbContext db) : IRequestHandler<GetCustomerByPhoneQuery, CustomerDto>
{
    public async Task<CustomerDto> Handle(GetCustomerByPhoneQuery request, CancellationToken cancellationToken)
    {
        var phone = new PhoneNumber(request.PhoneNumber).Value;
        var customer = await db.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.PhoneNumber == phone, cancellationToken)
                       ?? throw new NotFoundException(nameof(Customer), phone);
        return CustomerMapping.Map(customer);
    }
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
        return items.Select(CustomerMapping.Map).ToList();
    }
}

public sealed class GetCustomersPagedQueryHandler(IApplicationDbContext db) : IRequestHandler<GetCustomersPagedQuery, PaginatedList<CustomerDto>>
{
    public async Task<PaginatedList<CustomerDto>> Handle(GetCustomersPagedQuery request, CancellationToken cancellationToken)
    {
        var query = db.Customers.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(request.Term))
        {
            var term = request.Term.Trim();
            query = query.Where(c => c.PhoneNumber.Contains(term) || (c.FullName != null && c.FullName.Contains(term)));
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await query.OrderByDescending(c => c.LastVisitAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(cancellationToken);

        return new PaginatedList<CustomerDto>
        {
            Items = items.Select(CustomerMapping.Map).ToList(),
            Page = request.Page,
            PageSize = request.PageSize,
            TotalCount = total
        };
    }
}

public sealed class AdjustLoyaltyPointsCommandValidator : AbstractValidator<AdjustLoyaltyPointsCommand>
{
    public AdjustLoyaltyPointsCommandValidator()
    {
        RuleFor(x => x.CustomerId).NotEmpty();
        RuleFor(x => x.Delta).NotEqual(0).WithMessage("مقدار تغییر امتیاز نمی‌تواند صفر باشد.");
    }
}

public sealed class AdjustLoyaltyPointsCommandHandler(IApplicationDbContext db, ICurrentUserService current)
    : IRequestHandler<AdjustLoyaltyPointsCommand, CustomerDto>
{
    public async Task<CustomerDto> Handle(AdjustLoyaltyPointsCommand request, CancellationToken cancellationToken)
    {
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == request.CustomerId, cancellationToken)
                       ?? throw new NotFoundException(nameof(Customer), request.CustomerId);

        var ledger = customer.AdjustPoints(request.Delta, LoyaltyLedgerType.ManualAdjust, null, request.Notes, current.UserId);
        db.LoyaltyPointLedgers.Add(ledger);
        await db.SaveChangesAsync(cancellationToken);
        return CustomerMapping.Map(customer);
    }
}

public sealed class GetCustomerOrderHistoryQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetCustomerOrderHistoryQuery, PaginatedList<OrderDto>>
{
    public async Task<PaginatedList<OrderDto>> Handle(GetCustomerOrderHistoryQuery request, CancellationToken cancellationToken)
    {
        if (!await db.Customers.AnyAsync(c => c.Id == request.CustomerId, cancellationToken))
            throw new NotFoundException(nameof(Customer), request.CustomerId);

        var query = db.Orders
            .Include(o => o.Items).ThenInclude(i => i.Modifiers)
            .Include(o => o.Payments)
            .Where(o => o.CustomerId == request.CustomerId);

        var total = await query.CountAsync(cancellationToken);
        var orders = await query.OrderByDescending(o => o.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(cancellationToken);

        return new PaginatedList<OrderDto>
        {
            Items = orders.Select(OrderMapping.ToDto).ToList(),
            Page = request.Page,
            PageSize = request.PageSize,
            TotalCount = total
        };
    }
}

public sealed class RegisterOnlineCustomerCommandHandler(IApplicationDbContext db)
    : IRequestHandler<RegisterOnlineCustomerCommand, CustomerDto>
{
    public async Task<CustomerDto> Handle(RegisterOnlineCustomerCommand request, CancellationToken cancellationToken)
    {
        var phone = new PhoneNumber(request.PhoneNumber).Value;
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.PhoneNumber == phone, cancellationToken);
        if (customer is null)
        {
            customer = Customer.Create(phone, request.FullName.Trim());
            customer.RegistrationSource = "Online";
            db.Customers.Add(customer);
        }
        else if (!string.IsNullOrWhiteSpace(request.FullName))
        {
            customer.FullName = request.FullName.Trim();
        }

        if (request.MarketingConsent && !customer.MarketingConsent)
        {
            customer.MarketingConsent = true;
            customer.MarketingConsentUpdatedAtUtc = DateTime.UtcNow;
        }
        await db.SaveChangesAsync(cancellationToken);
        return CustomerMapping.Map(customer);
    }
}

public sealed class GetCustomerPointHistoryQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetCustomerPointHistoryQuery, PaginatedList<LoyaltyPointTransactionDto>>
{
    public async Task<PaginatedList<LoyaltyPointTransactionDto>> Handle(
        GetCustomerPointHistoryQuery request,
        CancellationToken cancellationToken)
    {
        if (!await db.Customers.AnyAsync(c => c.Id == request.CustomerId, cancellationToken))
            throw new NotFoundException(nameof(Customer), request.CustomerId);

        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        var query = db.LoyaltyPointLedgers.AsNoTracking().Where(x => x.CustomerId == request.CustomerId);
        var total = await query.CountAsync(cancellationToken);
        var entries = await query.OrderByDescending(x => x.OccurredAtUtc)
            .ThenByDescending(x => x.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new LoyaltyPointTransactionDto(
                x.Id, x.Type, x.PointsDelta, x.BalanceAfter, x.OrderId, x.Notes, x.OccurredAtUtc))
            .ToListAsync(cancellationToken);

        return new PaginatedList<LoyaltyPointTransactionDto>
        {
            Items = entries,
            Page = page,
            PageSize = pageSize,
            TotalCount = total
        };
    }
}
