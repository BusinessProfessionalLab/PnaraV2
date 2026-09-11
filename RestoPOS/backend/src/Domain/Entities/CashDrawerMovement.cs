using RestoPOS.Domain.Common;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Domain.Entities;

public class CashDrawerMovement : BaseEntity
{
    public Guid ShiftId { get; set; }
    public CashDrawerMovementType Type { get; set; }
    public decimal AmountRials { get; set; }
    public string Reason { get; set; } = default!;
    public Guid? RecordedByUserId { get; set; }
    public DateTime OccurredAtUtc { get; set; } = DateTime.UtcNow;

    public CashierShift Shift { get; set; } = default!;

    public static CashDrawerMovement Create(Guid shiftId, CashDrawerMovementType type, decimal amountRials, string reason, Guid? userId)
    {
        if (amountRials <= 0)
            throw new DomainException("مبلغ حرکت صندوق باید مثبت باشد.");
        if (string.IsNullOrWhiteSpace(reason))
            throw new DomainException("علت برداشت/واریز الزامی است.");

        return new CashDrawerMovement
        {
            ShiftId = shiftId,
            Type = type,
            AmountRials = decimal.Round(amountRials, 0, MidpointRounding.AwayFromZero),
            Reason = reason.Trim(),
            RecordedByUserId = userId,
            OccurredAtUtc = DateTime.UtcNow
        };
    }
}
