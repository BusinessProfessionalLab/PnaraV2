using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Application.Features.Customers;

public sealed record LoyaltyRewardDto(
    Guid Id,
    string Name,
    LoyaltyRewardType Type,
    int PointsCost,
    decimal DiscountRials,
    decimal DiscountPercent,
    decimal MaxDiscountRials,
    string? ProductName,
    bool IsActive);

public sealed record GetLoyaltyRewardsQuery(bool IncludeInactive = false) : IRequest<IReadOnlyList<LoyaltyRewardDto>>;
public sealed record CreateLoyaltyRewardCommand(
    string Name, LoyaltyRewardType Type, int PointsCost, decimal DiscountRials,
    decimal DiscountPercent, decimal MaxDiscountRials, string? ProductName) : IRequest<LoyaltyRewardDto>;
public sealed record UpdateLoyaltyRewardCommand(
    Guid Id, string Name, LoyaltyRewardType Type, int PointsCost, decimal DiscountRials,
    decimal DiscountPercent, decimal MaxDiscountRials, string? ProductName, bool IsActive) : IRequest<LoyaltyRewardDto>;
public sealed record DeactivateLoyaltyRewardCommand(Guid Id) : IRequest;
public sealed record RedeemLoyaltyRewardCommand(Guid CustomerId, Guid RewardId) : IRequest<RedeemedLoyaltyRewardDto>;
public sealed record RedeemedLoyaltyRewardDto(LoyaltyRewardDto Reward, Guid TransactionId, int PointsSpent, int RemainingPoints);

public sealed class CreateLoyaltyRewardValidator : AbstractValidator<CreateLoyaltyRewardCommand>
{
    public CreateLoyaltyRewardValidator() => LoyaltyRewardRules.Apply(this, x => x.Name, x => x.Type, x => x.PointsCost,
        x => x.DiscountRials, x => x.DiscountPercent, x => x.MaxDiscountRials, x => x.ProductName);
}

public sealed class UpdateLoyaltyRewardValidator : AbstractValidator<UpdateLoyaltyRewardCommand>
{
    public UpdateLoyaltyRewardValidator() => LoyaltyRewardRules.Apply(this, x => x.Name, x => x.Type, x => x.PointsCost,
        x => x.DiscountRials, x => x.DiscountPercent, x => x.MaxDiscountRials, x => x.ProductName);
}

internal static class LoyaltyRewardRules
{
    public static void Apply<T>(AbstractValidator<T> validator, Expression<Func<T, string>> name,
        Expression<Func<T, LoyaltyRewardType>> type, Expression<Func<T, int>> points,
        Expression<Func<T, decimal>> discount, Expression<Func<T, decimal>> percent,
        Expression<Func<T, decimal>> maxDiscount, Expression<Func<T, string?>> product)
    {
        validator.RuleFor(name).NotEmpty().MaximumLength(120);
        validator.RuleFor(points).InclusiveBetween(1, 1_000_000);
        validator.RuleFor(discount).GreaterThanOrEqualTo(0);
        validator.RuleFor(percent).InclusiveBetween(0, 100);
        validator.RuleFor(maxDiscount).GreaterThanOrEqualTo(0);
        validator.RuleFor(product).MaximumLength(200);
        var getType = type.Compile();
        var getDiscount = discount.Compile();
        var getPercent = percent.Compile();
        var getMaxDiscount = maxDiscount.Compile();
        var getProduct = product.Compile();
        validator.RuleFor(type).IsInEnum();
        validator.RuleFor(x => x).Must(x => getType(x) switch
        {
            LoyaltyRewardType.FixedDiscount => getDiscount(x) > 0,
            LoyaltyRewardType.PercentDiscount => getPercent(x) > 0 && getMaxDiscount(x) > 0,
            LoyaltyRewardType.FreeProduct => !string.IsNullOrWhiteSpace(getProduct(x)),
            _ => false
        }).WithMessage("مقادیر تخفیف یا نام محصول پاداش معتبر نیست.");
    }
}

internal static class LoyaltyRewardMapping
{
    public static LoyaltyRewardDto Map(LoyaltyReward reward) => new(
        reward.Id, reward.Name, reward.Type, reward.PointsCost, reward.DiscountRials,
        reward.DiscountPercent, reward.MaxDiscountRials, reward.ProductName, reward.IsActive);

    public static void Apply(LoyaltyReward reward, string name, LoyaltyRewardType type, int pointsCost,
        decimal discountRials, decimal discountPercent, decimal maxDiscountRials, string? productName)
    {
        reward.Name = name.Trim();
        reward.Type = type;
        reward.PointsCost = pointsCost;
        reward.DiscountRials = discountRials;
        reward.DiscountPercent = discountPercent;
        reward.MaxDiscountRials = maxDiscountRials;
        reward.ProductName = string.IsNullOrWhiteSpace(productName) ? null : productName.Trim();
    }
}

public sealed class GetLoyaltyRewardsHandler(IApplicationDbContext db)
    : IRequestHandler<GetLoyaltyRewardsQuery, IReadOnlyList<LoyaltyRewardDto>>
{
    public async Task<IReadOnlyList<LoyaltyRewardDto>> Handle(GetLoyaltyRewardsQuery request, CancellationToken ct)
    {
        var query = db.LoyaltyRewards.AsNoTracking();
        if (!request.IncludeInactive) query = query.Where(x => x.IsActive);
        var rewards = await query.OrderBy(x => x.PointsCost).ThenBy(x => x.Name).ToListAsync(ct);
        return rewards.Select(LoyaltyRewardMapping.Map).ToList();
    }
}

public sealed class CreateLoyaltyRewardHandler(IApplicationDbContext db)
    : IRequestHandler<CreateLoyaltyRewardCommand, LoyaltyRewardDto>
{
    public async Task<LoyaltyRewardDto> Handle(CreateLoyaltyRewardCommand request, CancellationToken ct)
    {
        var reward = new LoyaltyReward();
        LoyaltyRewardMapping.Apply(reward, request.Name, request.Type, request.PointsCost, request.DiscountRials,
            request.DiscountPercent, request.MaxDiscountRials, request.ProductName);
        db.LoyaltyRewards.Add(reward);
        await db.SaveChangesAsync(ct);
        return LoyaltyRewardMapping.Map(reward);
    }
}

public sealed class UpdateLoyaltyRewardHandler(IApplicationDbContext db)
    : IRequestHandler<UpdateLoyaltyRewardCommand, LoyaltyRewardDto>
{
    public async Task<LoyaltyRewardDto> Handle(UpdateLoyaltyRewardCommand request, CancellationToken ct)
    {
        var reward = await db.LoyaltyRewards.FirstOrDefaultAsync(x => x.Id == request.Id, ct)
                     ?? throw new NotFoundException(nameof(LoyaltyReward), request.Id);
        LoyaltyRewardMapping.Apply(reward, request.Name, request.Type, request.PointsCost, request.DiscountRials,
            request.DiscountPercent, request.MaxDiscountRials, request.ProductName);
        reward.IsActive = request.IsActive;
        await db.SaveChangesAsync(ct);
        return LoyaltyRewardMapping.Map(reward);
    }
}

public sealed class DeactivateLoyaltyRewardHandler(IApplicationDbContext db)
    : IRequestHandler<DeactivateLoyaltyRewardCommand>
{
    public async Task Handle(DeactivateLoyaltyRewardCommand request, CancellationToken ct)
    {
        var reward = await db.LoyaltyRewards.FirstOrDefaultAsync(x => x.Id == request.Id, ct)
                     ?? throw new NotFoundException(nameof(LoyaltyReward), request.Id);
        reward.IsActive = false;
        await db.SaveChangesAsync(ct);
    }
}

public sealed class RedeemLoyaltyRewardHandler(IApplicationDbContext db, ICurrentUserService current)
    : IRequestHandler<RedeemLoyaltyRewardCommand, RedeemedLoyaltyRewardDto>
{
    public async Task<RedeemedLoyaltyRewardDto> Handle(RedeemLoyaltyRewardCommand request, CancellationToken ct)
    {
        LoyaltyReward? reward = null;
        LoyaltyPointLedger? transaction = null;
        Customer? customer = null;

        await db.ExecuteResilientTransactionAsync(async token =>
        {
            reward = await db.LoyaltyRewards.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == request.RewardId && x.IsActive, token)
                ?? throw new NotFoundException("پاداش فعال پیدا نشد.");
            customer = await db.Customers.FirstOrDefaultAsync(x => x.Id == request.CustomerId, token)
                       ?? throw new NotFoundException(nameof(Customer), request.CustomerId);
            transaction = customer.AdjustPoints(-reward.PointsCost, LoyaltyLedgerType.Redeem, null,
                $"Redeemed reward: {reward.Name}", current.UserId);
            db.LoyaltyPointLedgers.Add(transaction);
        }, ct);

        return new RedeemedLoyaltyRewardDto(LoyaltyRewardMapping.Map(reward!), transaction!.Id,
            reward!.PointsCost, customer!.LoyaltyPoints);
    }
}
