using RestoPOS.Domain.Common;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Events;
using RestoPOS.Domain.Exceptions;
using RestoPOS.Domain.Services;

namespace RestoPOS.Domain.Entities;

public class Order : BaseEntity
{
    public string OrderNumber { get; set; } = default!;
    public OrderStatus Status { get; set; } = OrderStatus.Draft;
    public OrderType OrderType { get; set; }
    public string? TableNumber { get; set; }
    public string? CustomerPhone { get; set; }
    public Guid? CustomerId { get; set; }
    public Guid CashierId { get; set; }
    public Guid? ShiftId { get; set; }
    public decimal Subtotal { get; set; }
    public decimal ModifiersTotal { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal DiscountPercent { get; set; }
    public decimal TaxRate { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal GrandTotal { get; set; }
    public string? Notes { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public DateTime? ReadyAt { get; set; }
    public DateTime? PaidAt { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string? CancelReason { get; set; }
    public bool InventoryDeducted { get; set; }

    public Customer? Customer { get; set; }
    public ICollection<OrderItem> Items { get; set; } = [];
    public ICollection<Payment> Payments { get; set; } = [];

    public static Order CreateDraft(
        string orderNumber,
        OrderType type,
        Guid cashierId,
        Guid? shiftId,
        decimal taxRate,
        string? tableNumber,
        string? customerPhone)
    {
        return new Order
        {
            OrderNumber = orderNumber,
            OrderType = type,
            CashierId = cashierId,
            ShiftId = shiftId,
            TaxRate = taxRate,
            TableNumber = tableNumber,
            CustomerPhone = customerPhone,
            Status = OrderStatus.Draft
        };
    }

    public OrderItem AddItem(MenuItem menuItem, int quantity, string? notes)
    {
        EnsureDraft();
        if (!menuItem.IsActive)
            throw new DomainException("این آیتم منو غیرفعال است.");
        if (quantity <= 0)
            throw new DomainException("تعداد باید حداقل ۱ باشد.");

        var line = new OrderItem
        {
            OrderId = Id,
            MenuItemId = menuItem.Id,
            Title = menuItem.Title,
            Quantity = quantity,
            UnitPrice = menuItem.BasePrice,
            TaxInclusive = menuItem.TaxInclusive,
            TicketStation = menuItem.TicketStation,
            Notes = notes
        };
        Items.Add(line);
        return line;
    }

    public void RemoveItem(Guid orderItemId)
    {
        EnsureDraft();
        var item = Items.FirstOrDefault(i => i.Id == orderItemId)
                   ?? throw new NotFoundException(nameof(OrderItem), orderItemId);
        Items.Remove(item);
    }

    public void ApplyDiscount(decimal percent, decimal amount)
    {
        EnsureDraft();
        if (percent is < 0 or > 100)
            throw new DomainException("درصد تخفیف نامعتبر است.");
        if (amount < 0)
            throw new DomainException("مبلغ تخفیف نامعتبر است.");
        DiscountPercent = percent;
        DiscountAmount = amount;
    }

    public void Recalculate()
    {
        OrderPricingService.Apply(this);
    }

    public void Submit()
    {
        EnsureDraft();
        if (Items.Count == 0)
            throw new DomainException("سفارش بدون آیتم قابل ارسال نیست.");

        Recalculate();
        Status = OrderStatus.Submitted;
        SubmittedAt = DateTime.UtcNow;
        AddDomainEvent(new OrderSubmittedEvent(Id, OrderNumber, CashierId));
    }

    public void StartPreparation()
    {
        EnsureStatus(OrderStatus.Submitted);
        Status = OrderStatus.InPreparation;
    }

    public void MarkReady()
    {
        if (Status is not (OrderStatus.Submitted or OrderStatus.InPreparation))
            throw new DomainException("فقط سفارش در صف یا در حال آماده‌سازی می‌تواند آماده شود.");

        Status = OrderStatus.Ready;
        ReadyAt = DateTime.UtcNow;
    }

    public void MarkPaid()
    {
        if (Status is OrderStatus.Cancelled or OrderStatus.Draft)
            throw new DomainException("سفارش پیش‌نویس یا لغو‌شده قابل تسویه نیست.");

        Recalculate();
        Status = OrderStatus.Paid;
        PaidAt = DateTime.UtcNow;
        AddDomainEvent(new OrderPaidEvent(Id, OrderNumber, GrandTotal, CustomerId));
    }

    public void Cancel(string? reason, bool reverseInventory)
    {
        if (Status is OrderStatus.Paid)
            throw new DomainException("سفارش تسویه‌شده را نمی‌توان لغو کرد. از مسیر استرداد استفاده کنید.");
        if (Status is OrderStatus.Cancelled)
            throw new DomainException("سفارش قبلاً لغو شده است.");

        Status = OrderStatus.Cancelled;
        CancelledAt = DateTime.UtcNow;
        CancelReason = reason;
        AddDomainEvent(new OrderCancelledEvent(Id, OrderNumber, reverseInventory && InventoryDeducted));
    }

    public void DiscardDraft()
    {
        EnsureDraft();
    }

    public IEnumerable<OrderItem> KitchenTicketItems() =>
        Items.Where(i => i.TicketStation is TicketStation.Kitchen or TicketStation.KitchenAndBar);

    public IEnumerable<OrderItem> BarTicketItems() =>
        Items.Where(i => i.TicketStation is TicketStation.Bar or TicketStation.KitchenAndBar);

    private void EnsureDraft()
    {
        if (Status != OrderStatus.Draft)
            throw new DomainException("فقط سفارش پیش‌نویس قابل ویرایش است.");
    }

    private void EnsureStatus(OrderStatus expected)
    {
        if (Status != expected)
            throw new DomainException($"وضعیت سفارش باید {expected} باشد.");
    }
}
