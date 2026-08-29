using RestoPOS.Domain.Common;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Domain.Entities;

public class CashierShift : BaseEntity, ISoftDeletable
{
    public Guid StaffId { get; set; }
    public DateTime OpenedAt { get; set; }
    public DateTime? ClosedAt { get; set; }
    public decimal OpeningCash { get; set; }
    public decimal? ClosingCash { get; set; }
    public decimal? ExpectedCash { get; set; }
    public ShiftStatus Status { get; set; } = ShiftStatus.Open;
    public string? Notes { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public void Close(decimal closingCash, decimal expectedCash, string? notes)
    {
        if (Status != ShiftStatus.Open)
            throw new DomainException("شیفت قبلاً بسته شده است.");

        ClosedAt = DateTime.UtcNow;
        ClosingCash = closingCash;
        ExpectedCash = expectedCash;
        Notes = notes;
        Status = ShiftStatus.Closed;
    }
}
