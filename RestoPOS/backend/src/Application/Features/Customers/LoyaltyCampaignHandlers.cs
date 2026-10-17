using System.Text.RegularExpressions;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Application.Common.Models;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Application.Features.Customers;

public sealed record SmsAudienceFilter(
    int? MinimumVisits = null,
    int? MaximumVisits = null,
    int? InactiveDays = null,
    string? Gender = null,
    string? PersonalityType = null,
    int? BirthMonth = null,
    int? MinimumPoints = null,
    int? MaximumPoints = null);

public sealed record QueueLoyaltyCampaignCommand(
    string Name,
    string Body,
    Guid[]? CustomerIds = null,
    SmsAudienceFilter? Filter = null,
    DateTime? ScheduledAtUtc = null) : IRequest<LoyaltyCampaignDto>;

public sealed record LoyaltyCampaignDto(
    Guid Id,
    string Name,
    string Body,
    DateTime QueuedAtUtc,
    DateTime? ScheduledAtUtc,
    int RecipientCount,
    int SentCount,
    int DeliveredCount,
    int FailedCount,
    int ConvertedCount,
    decimal AttributedRevenueRials);

public sealed record GetLoyaltyCampaignsQuery(int Page = 1, int PageSize = 25)
    : IRequest<PaginatedList<LoyaltyCampaignDto>>;

public sealed class QueueLoyaltyCampaignValidator : AbstractValidator<QueueLoyaltyCampaignCommand>
{
    private static readonly Regex VariablePattern = new("\\{(?<name>[a-zA-Z]+)\\}", RegexOptions.Compiled);
    private static readonly HashSet<string> AllowedVariables = ["name", "points", "balance", "amount", "tier", "branch", "date"];

    public QueueLoyaltyCampaignValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(160);
        RuleFor(x => x.Body).NotEmpty().MaximumLength(1000)
            .Must(body => VariablePattern.Matches(body).Select(match => match.Groups["name"].Value).All(AllowedVariables.Contains))
            .WithMessage("متن پیام شامل متغیر ناشناخته است.");
        RuleFor(x => x.ScheduledAtUtc).Must(date => date is null || date > DateTime.UtcNow);
        RuleFor(x => x.Filter).Must(filter => filter is null || filter.InactiveDays is null or > 0);
        RuleFor(x => x.Filter).Must(filter => filter is null || filter.BirthMonth is null or >= 1 and <= 12);
    }
}

public sealed class QueueLoyaltyCampaignHandler(IApplicationDbContext db)
    : IRequestHandler<QueueLoyaltyCampaignCommand, LoyaltyCampaignDto>
{
    public async Task<LoyaltyCampaignDto> Handle(QueueLoyaltyCampaignCommand request, CancellationToken cancellationToken)
    {
        var settings = await db.StoreSettings.AsNoTracking().FirstAsync(cancellationToken);
        if (!settings.LoyaltySmsEnabled)
            throw new DomainException("سرویس پیامک باشگاه غیرفعال است.");

        var customers = db.Customers.AsNoTracking().Where(x => x.MarketingConsent);
        if (request.CustomerIds is { Length: > 0 })
            customers = customers.Where(x => request.CustomerIds.Contains(x.Id));
        if (request.Filter is { } filter)
        {
            if (filter.MinimumVisits.HasValue) customers = customers.Where(x => x.VisitCount >= filter.MinimumVisits);
            if (filter.MaximumVisits.HasValue) customers = customers.Where(x => x.VisitCount <= filter.MaximumVisits);
            if (filter.MinimumPoints.HasValue) customers = customers.Where(x => x.LoyaltyPoints >= filter.MinimumPoints);
            if (filter.MaximumPoints.HasValue) customers = customers.Where(x => x.LoyaltyPoints <= filter.MaximumPoints);
            if (!string.IsNullOrWhiteSpace(filter.Gender)) customers = customers.Where(x => x.Gender == filter.Gender);
            if (!string.IsNullOrWhiteSpace(filter.PersonalityType)) customers = customers.Where(x => x.PersonalityType == filter.PersonalityType);
            if (filter.InactiveDays.HasValue)
            {
                var cutoff = DateTime.UtcNow.AddDays(-filter.InactiveDays.Value);
                customers = customers.Where(x => x.LastVisitAt < cutoff);
            }
            if (filter.BirthMonth.HasValue) customers = customers.Where(x => x.BirthDate.HasValue && x.BirthDate.Value.Month == filter.BirthMonth);
        }

        var recipients = await customers.OrderBy(x => x.Id).Take(5000).ToListAsync(cancellationToken);
        if (recipients.Count == 0)
            throw new DomainException("برای این کمپین مشتری دارای رضایت پیامکی پیدا نشد.");

        var campaign = new LoyaltySmsCampaign
        {
            Name = request.Name.Trim(),
            Body = request.Body.Trim(),
            ScheduledAtUtc = request.ScheduledAtUtc
        };
        foreach (var customer in recipients)
        {
            campaign.Messages.Add(new LoyaltySmsMessage
            {
                CustomerId = customer.Id,
                PhoneNumber = customer.PhoneNumber,
                Body = Render(request.Body, customer),
                Status = request.ScheduledAtUtc > DateTime.UtcNow ? "Scheduled" : "Queued",
                NextAttemptAtUtc = request.ScheduledAtUtc
            });
        }
        db.LoyaltySmsCampaigns.Add(campaign);
        await db.SaveChangesAsync(cancellationToken);
        return new LoyaltyCampaignDto(campaign.Id, campaign.Name, campaign.Body, campaign.QueuedAtUtc,
            campaign.ScheduledAtUtc, recipients.Count, 0, 0, 0, 0, 0);
    }

    private static string Render(string template, Customer customer) => Regex.Replace(template, "\\{(?<name>[a-zA-Z]+)\\}", match =>
        match.Groups["name"].Value switch
        {
            "name" => customer.FullName ?? "مشتری",
            "points" => customer.LoyaltyPoints.ToString(),
            "balance" => customer.LoyaltyPoints.ToString(),
            "amount" => customer.TotalSpent.ToString("0"),
            "date" => DateTime.UtcNow.ToString("yyyy/MM/dd"),
            "tier" or "branch" => "",
            _ => match.Value
        });
}

public sealed class GetLoyaltyCampaignsHandler(IApplicationDbContext db)
    : IRequestHandler<GetLoyaltyCampaignsQuery, PaginatedList<LoyaltyCampaignDto>>
{
    public async Task<PaginatedList<LoyaltyCampaignDto>> Handle(GetLoyaltyCampaignsQuery request, CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        var query = db.LoyaltySmsCampaigns.AsNoTracking();
        var total = await query.CountAsync(cancellationToken);
        var rows = await query.OrderByDescending(x => x.QueuedAtUtc)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new LoyaltyCampaignDto(
                x.Id, x.Name, x.Body, x.QueuedAtUtc, x.ScheduledAtUtc,
                x.Messages.Count, x.Messages.Count(m => m.Status == "Sent"),
                x.Messages.Count(m => m.Status == "Delivered"), x.Messages.Count(m => m.Status == "Failed"),
                x.Messages.Count(m => m.SentAtUtc != null && db.Orders.Any(o => o.CustomerId == m.CustomerId && o.Status == Domain.Enums.OrderStatus.Paid && o.PaidAt >= m.SentAtUtc && o.PaidAt <= m.SentAtUtc.Value.AddDays(x.AttributionWindowDays))),
                db.Orders.Where(o => o.Status == Domain.Enums.OrderStatus.Paid && o.PaidAt != null)
                    .Where(o => x.Messages.Any(m => m.CustomerId == o.CustomerId && o.PaidAt >= m.SentAtUtc && o.PaidAt <= m.SentAtUtc.Value.AddDays(x.AttributionWindowDays)))
                    .Sum(o => (decimal?)o.GrandTotal) ?? 0))
            .ToListAsync(cancellationToken);
        return new PaginatedList<LoyaltyCampaignDto> { Items = rows, Page = page, PageSize = pageSize, TotalCount = total };
    }
}
