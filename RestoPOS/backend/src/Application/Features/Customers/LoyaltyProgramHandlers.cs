using System.Text.Json;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Entities;

namespace RestoPOS.Application.Features.Customers;

public sealed record LoyaltyTierRuleDto(string Name, int MinimumVisits, decimal MinimumSpendRials, decimal PointsMultiplier, decimal CashbackPercent);

public sealed record LoyaltyProgramSettingsDto(
    string EarnMode,
    decimal EarnAmountRials,
    int EarnPoints,
    int EarnEveryVisits,
    decimal EarnPercent,
    bool ThankYouSmsEnabled,
    bool SmsEnabled,
    string SmsQuietHoursStart,
    string SmsQuietHoursEnd,
    string ThankYouSmsTemplate,
    decimal CashbackPercent,
    decimal CashbackMaxRials,
    decimal CashbackMinSpendRials,
    IReadOnlyList<string> CashbackProductIds,
    int RewardPointsThreshold,
    decimal RewardDiscountRials,
    string RewardProductName,
    IReadOnlyList<LoyaltyTierRuleDto> Tiers,
    int LapsedCustomerDays);

public sealed record GetLoyaltyProgramSettingsQuery : IRequest<LoyaltyProgramSettingsDto>;

public sealed record UpdateLoyaltyProgramSettingsCommand(
    string EarnMode,
    decimal EarnAmountRials,
    int EarnPoints,
    int EarnEveryVisits,
    decimal EarnPercent,
    bool ThankYouSmsEnabled,
    bool SmsEnabled,
    string SmsQuietHoursStart,
    string SmsQuietHoursEnd,
    string ThankYouSmsTemplate,
    decimal CashbackPercent,
    decimal CashbackMaxRials,
    decimal CashbackMinSpendRials,
    string[] CashbackProductIds,
    int RewardPointsThreshold,
    decimal RewardDiscountRials,
    string RewardProductName,
    LoyaltyTierRuleDto[] Tiers,
    int LapsedCustomerDays) : IRequest<LoyaltyProgramSettingsDto>;

public sealed class UpdateLoyaltyProgramSettingsValidator : AbstractValidator<UpdateLoyaltyProgramSettingsCommand>
{
    public UpdateLoyaltyProgramSettingsValidator()
    {
        RuleFor(x => x.EarnMode).Must(x => x is "Amount" or "Visit" or "Percent");
        RuleFor(x => x.EarnAmountRials).GreaterThan(0);
        RuleFor(x => x.EarnPoints).GreaterThanOrEqualTo(0);
        RuleFor(x => x.EarnEveryVisits).GreaterThan(0);
        RuleFor(x => x.EarnPercent).InclusiveBetween(0, 100);
        RuleFor(x => x.ThankYouSmsTemplate).MaximumLength(1000);
        RuleFor(x => x.CashbackPercent).InclusiveBetween(0, 100);
        RuleFor(x => x.CashbackMaxRials).GreaterThanOrEqualTo(0);
        RuleFor(x => x.CashbackMinSpendRials).GreaterThanOrEqualTo(0);
        RuleFor(x => x.RewardPointsThreshold).GreaterThan(0);
        RuleFor(x => x.LapsedCustomerDays).InclusiveBetween(1, 3650);
        RuleForEach(x => x.Tiers).ChildRules(tier =>
        {
            tier.RuleFor(x => x.Name).NotEmpty().MaximumLength(64);
            tier.RuleFor(x => x.MinimumVisits).GreaterThanOrEqualTo(0);
            tier.RuleFor(x => x.MinimumSpendRials).GreaterThanOrEqualTo(0);
            tier.RuleFor(x => x.PointsMultiplier).GreaterThan(0);
            tier.RuleFor(x => x.CashbackPercent).InclusiveBetween(0, 100);
        });
    }
}

public sealed class GetLoyaltyProgramSettingsHandler(IApplicationDbContext db)
    : IRequestHandler<GetLoyaltyProgramSettingsQuery, LoyaltyProgramSettingsDto>
{
    public async Task<LoyaltyProgramSettingsDto> Handle(GetLoyaltyProgramSettingsQuery request, CancellationToken cancellationToken)
    {
        var settings = await db.StoreSettings.AsNoTracking().FirstAsync(cancellationToken);
        return Map(settings);
    }

    internal static LoyaltyProgramSettingsDto Map(StoreSettings settings) => new(
        settings.LoyaltyEarnMode, settings.LoyaltyEarnAmountRials, settings.LoyaltyEarnPoints, settings.LoyaltyEarnEveryVisits,
        settings.LoyaltyEarnPercent, settings.ThankYouSmsEnabled, settings.LoyaltySmsEnabled,
        settings.SmsQuietHoursStart, settings.SmsQuietHoursEnd, settings.ThankYouSmsTemplate,
        settings.CashbackPercent, settings.CashbackMaxRials, settings.CashbackMinSpendRials,
        settings.CashbackProductIds, settings.RewardPointsThreshold, settings.RewardDiscountRials,
        settings.RewardProductName,
        DeserializeTiers(settings.LoyaltyTierRulesJson),
        settings.LapsedCustomerDays);

    private static IReadOnlyList<LoyaltyTierRuleDto> DeserializeTiers(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try { return JsonSerializer.Deserialize<LoyaltyTierRuleDto[]>(json) ?? []; }
        catch (JsonException) { return []; }
    }
}

public sealed class UpdateLoyaltyProgramSettingsHandler(IApplicationDbContext db)
    : IRequestHandler<UpdateLoyaltyProgramSettingsCommand, LoyaltyProgramSettingsDto>
{
    public async Task<LoyaltyProgramSettingsDto> Handle(UpdateLoyaltyProgramSettingsCommand request, CancellationToken cancellationToken)
    {
        var settings = await db.StoreSettings.FirstAsync(cancellationToken);
        settings.LoyaltyEarnMode = request.EarnMode;
        settings.LoyaltyEarnAmountRials = request.EarnAmountRials;
        settings.LoyaltyEarnPoints = request.EarnPoints;
        settings.LoyaltyEarnEveryVisits = request.EarnEveryVisits;
        settings.LoyaltyEarnPercent = request.EarnPercent;
        settings.ThankYouSmsEnabled = request.ThankYouSmsEnabled;
        settings.LoyaltySmsEnabled = request.SmsEnabled;
        settings.SmsQuietHoursStart = request.SmsQuietHoursStart;
        settings.SmsQuietHoursEnd = request.SmsQuietHoursEnd;
        settings.ThankYouSmsTemplate = request.ThankYouSmsTemplate;
        settings.CashbackPercent = request.CashbackPercent;
        settings.CashbackMaxRials = request.CashbackMaxRials;
        settings.CashbackMinSpendRials = request.CashbackMinSpendRials;
        settings.CashbackProductIds = request.CashbackProductIds.Distinct().ToArray();
        settings.RewardPointsThreshold = request.RewardPointsThreshold;
        settings.RewardDiscountRials = request.RewardDiscountRials;
        settings.RewardProductName = request.RewardProductName;
        settings.LoyaltyTierRulesJson = JsonSerializer.Serialize(request.Tiers);
        settings.LapsedCustomerDays = request.LapsedCustomerDays;
        await db.SaveChangesAsync(cancellationToken);
        return GetLoyaltyProgramSettingsHandler.Map(settings);
    }
}
