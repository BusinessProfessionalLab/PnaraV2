using RestoPOS.Domain.Common;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Domain.Entities;

public class DiningArea : BaseEntity, ISoftDeletable
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public int DisplayPriority { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public ICollection<DiningTable> Tables { get; set; } = [];
}

public class DiningTable : BaseEntity, ISoftDeletable
{
    public Guid DiningAreaId { get; set; }
    public string Code { get; set; } = default!;
    public string? Name { get; set; }
    public int Capacity { get; set; } = 2;
    public TableStatus Status { get; set; } = TableStatus.Available;
    public Guid? CurrentOrderId { get; set; }
    public int DisplayPriority { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public DiningArea DiningArea { get; set; } = default!;
    public Order? CurrentOrder { get; set; }

    public void SetStatus(TableStatus status)
    {
        Status = status;
        if (status == TableStatus.Available)
            CurrentOrderId = null;
    }

    public void Occupy(Guid orderId)
    {
        if (Status is TableStatus.Occupied)
            throw new ConflictException($"میز {Code} هم‌اکنون اشغال است.");
        Status = TableStatus.Occupied;
        CurrentOrderId = orderId;
    }

    public void TransferTo(DiningTable target)
    {
        if (CurrentOrderId is null)
            throw new DomainException("میز مبدأ سفارش فعالی ندارد.");
        if (target.Status == TableStatus.Occupied)
            throw new ConflictException($"میز مقصد {target.Code} اشغال است.");

        target.Status = TableStatus.Occupied;
        target.CurrentOrderId = CurrentOrderId;
        Status = TableStatus.Cleaning;
        CurrentOrderId = null;
    }
}
