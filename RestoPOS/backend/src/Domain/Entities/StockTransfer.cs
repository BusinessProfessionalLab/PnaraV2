using RestoPOS.Domain.Common;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Domain.Entities;

public class StockTransfer : BaseEntity
{
    public Guid InventoryItemId { get; set; }
    public StorageLocation FromLocation { get; set; }
    public StorageLocation ToLocation { get; set; }
    public decimal QuantityInBase { get; set; }
    public StockTransferStatus Status { get; set; } = StockTransferStatus.Requested;
    public Guid? RequestedByUserId { get; set; }
    public Guid? TransferredByUserId { get; set; }
    public DateTime RequestedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? TransferredAtUtc { get; set; }
    public string? Notes { get; set; }

    public InventoryItem InventoryItem { get; set; } = default!;

    public void Complete(Guid? userId)
    {
        if (Status == StockTransferStatus.Transferred)
            throw new ConflictException("این انتقال قبلاً انجام شده است.");
        if (Status == StockTransferStatus.Cancelled)
            throw new DomainException("انتقال لغوشده قابل تکمیل نیست.");
        if (FromLocation == ToLocation)
            throw new DomainException("مبدأ و مقصد یکسان است.");
        if (QuantityInBase <= 0)
            throw new DomainException("مقدار انتقال باید مثبت باشد.");

        Status = StockTransferStatus.Transferred;
        TransferredByUserId = userId;
        TransferredAtUtc = DateTime.UtcNow;
    }

    public void Cancel()
    {
        if (Status != StockTransferStatus.Requested)
            throw new DomainException("فقط انتقال در وضعیت درخواست‌شده قابل لغو است.");
        Status = StockTransferStatus.Cancelled;
    }
}
