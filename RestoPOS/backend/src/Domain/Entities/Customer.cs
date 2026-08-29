using RestoPOS.Domain.Common;

namespace RestoPOS.Domain.Entities;

public class Customer : BaseEntity, ISoftDeletable
{
    public string PhoneNumber { get; set; } = default!;
    public string? FullName { get; set; }
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
