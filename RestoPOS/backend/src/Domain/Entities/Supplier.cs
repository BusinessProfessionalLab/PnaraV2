using RestoPOS.Domain.Common;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Domain.Entities;

public class Supplier : BaseEntity, ISoftDeletable
{
    public string Name { get; set; } = default!;
    public string? Phone { get; set; }
    public string? ContactPerson { get; set; }
    public decimal CurrentBalanceRials { get; set; }
    public string? Address { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public ICollection<PurchaseInvoice> PurchaseInvoices { get; set; } = [];

    public void IncreaseBalance(decimal amountRials)
    {
        if (amountRials < 0)
            throw new DomainException("مبلغ افزایش بدهی تأمین‌کننده نمی‌تواند منفی باشد.");
        CurrentBalanceRials += decimal.Round(amountRials, 0, MidpointRounding.AwayFromZero);
    }

    public void DecreaseBalance(decimal amountRials)
    {
        if (amountRials < 0)
            throw new DomainException("مبلغ کاهش بدهی تأمین‌کننده نمی‌تواند منفی باشد.");
        CurrentBalanceRials -= decimal.Round(amountRials, 0, MidpointRounding.AwayFromZero);
    }
}
