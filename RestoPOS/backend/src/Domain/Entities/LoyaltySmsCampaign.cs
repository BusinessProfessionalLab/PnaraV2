using RestoPOS.Domain.Common;

namespace RestoPOS.Domain.Entities;

public sealed class LoyaltySmsCampaign : BaseEntity
{
    public string Name { get; set; } = "";
    public string Body { get; set; } = "";
    public DateTime QueuedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ScheduledAtUtc { get; set; }
    public int AttributionWindowDays { get; set; } = 7;
    public ICollection<LoyaltySmsMessage> Messages { get; set; } = [];
}

public sealed class LoyaltySmsMessage : BaseEntity
{
    public Guid CampaignId { get; set; }
    public Guid CustomerId { get; set; }
    public string PhoneNumber { get; set; } = "";
    public string Body { get; set; } = "";
    public string Status { get; set; } = "Queued";
    public bool IsTransactional { get; set; }
    public int AttemptCount { get; set; }
    public DateTime? NextAttemptAtUtc { get; set; }
    public DateTime? SentAtUtc { get; set; }
    public string? ProviderMessageId { get; set; }
    public string? LastError { get; set; }
    public DateTime? DeliveredAtUtc { get; set; }

    public LoyaltySmsCampaign Campaign { get; set; } = default!;
    public Customer Customer { get; set; } = default!;
}
