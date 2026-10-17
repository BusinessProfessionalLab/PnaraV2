using RestoPOS.Domain.Common;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Domain.Entities;

public class Customer : BaseEntity, ISoftDeletable
{
    public string PhoneNumber { get; set; } = default!;
    public string? FullName { get; set; }
    public DateOnly? BirthDate { get; set; }
    public string? Gender { get; set; }
    public string? PersonalityType { get; set; }
    public string[] FavoriteProducts { get; set; } = [];
    public string[] Tags { get; set; } = [];
    public string? Notes { get; set; }
    public bool MarketingConsent { get; set; }
    public DateTime? MarketingConsentUpdatedAtUtc { get; set; }
    public string RegistrationSource { get; set; } = "Manual";
    public int VisitCount { get; set; }
    public decimal TotalSpent { get; set; }
    public int LoyaltyPoints { get; set; }
    public DateTime FirstVisitAt { get; set; }
    public DateTime LastVisitAt { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public ICollection<Order> Orders { get; set; } = [];

    public void RegisterVisit(decimal grandTotal, int pointsEarned)
    {
        VisitCount++;
        TotalSpent += grandTotal;
        LoyaltyPoints += pointsEarned;
        LastVisitAt = DateTime.UtcNow;
    }

    public LoyaltyPointLedger AdjustPoints(int delta, LoyaltyLedgerType type, Guid? orderId, string? notes, Guid? userId)
    {
        var next = LoyaltyPoints + delta;
        if (next < 0)
            throw new DomainException("موجودی امتیاز کافی نیست.");
        LoyaltyPoints = next;
        return new LoyaltyPointLedger
        {
            CustomerId = Id,
            Type = type,
            PointsDelta = delta,
            BalanceAfter = LoyaltyPoints,
            OrderId = orderId,
            Notes = notes,
            RecordedByUserId = userId,
            OccurredAtUtc = DateTime.UtcNow
        };
    }

    public static Customer Create(string phone, string? fullName)
    {
        var now = DateTime.UtcNow;
        return new Customer
        {
            PhoneNumber = phone,
            FullName = fullName,
            VisitCount = 0,
            FirstVisitAt = now,
            LastVisitAt = now
        };
    }
}
