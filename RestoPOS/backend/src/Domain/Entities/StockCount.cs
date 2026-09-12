using RestoPOS.Domain.Common;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Domain.Entities;

public class StockCount : BaseEntity
{
    public string Title { get; set; } = default!;
    public StockCountStatus Status { get; set; } = StockCountStatus.Draft;
    public StorageLocation? LocationFilter { get; set; }
    public Guid? StartedByUserId { get; set; }
    public Guid? ApprovedByUserId { get; set; }
    public DateTime StartedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAtUtc { get; set; }
    public DateTime? ApprovedAtUtc { get; set; }
    public string? Notes { get; set; }

    public ICollection<StockCountItem> Items { get; set; } = [];

    public void MarkInProgress()
    {
        if (Status is StockCountStatus.Approved or StockCountStatus.Completed)
            throw new DomainException("انبارگردانی تأیید/تکمیل‌شده قابل تغییر وضعیت به درحال‌اجرا نیست.");
        Status = StockCountStatus.InProgress;
    }

    public void SubmitCounts()
    {
        if (Status is not (StockCountStatus.Draft or StockCountStatus.InProgress))
            throw new DomainException("فقط انبارگردانی پیش‌نویس یا درحال‌اجرا قابل ثبت شمارش است.");
        if (Items.Count == 0)
            throw new DomainException("هیچ قلمی برای شمارش وجود ندارد.");
        Status = StockCountStatus.Completed;
        CompletedAtUtc = DateTime.UtcNow;
    }

    public void Approve(Guid? userId)
    {
        if (Status != StockCountStatus.Completed)
            throw new DomainException("ابتدا شمارش فیزیکی باید تکمیل شود.");
        Status = StockCountStatus.Approved;
        ApprovedByUserId = userId;
        ApprovedAtUtc = DateTime.UtcNow;
    }
}

public class StockCountItem : BaseEntity
{
    public Guid StockCountId { get; set; }
    public Guid InventoryItemId { get; set; }
    public decimal SystemSnapshotQty { get; set; }
    public decimal? PhysicalCountQty { get; set; }
    public decimal DiscrepancyQty => (PhysicalCountQty ?? SystemSnapshotQty) - SystemSnapshotQty;
    public decimal CostVarianceRials { get; set; }
    public decimal SnapshotUnitCostRials { get; set; }

    public StockCount StockCount { get; set; } = default!;
    public InventoryItem InventoryItem { get; set; } = default!;

    public void SetPhysicalCount(decimal physicalQty, decimal unitCostRials)
    {
        if (physicalQty < 0)
            throw new DomainException("موجودی فیزیکی نمی‌تواند منفی باشد.");
        PhysicalCountQty = decimal.Round(physicalQty, 4, MidpointRounding.AwayFromZero);
        SnapshotUnitCostRials = unitCostRials;
        CostVarianceRials = decimal.Round(DiscrepancyQty * unitCostRials, 0, MidpointRounding.AwayFromZero);
    }
}
