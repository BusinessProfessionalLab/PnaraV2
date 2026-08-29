namespace RestoPOS.Domain.Enums;

public enum OrderStatus
{
    Draft = 0,
    Submitted = 1,
    InPreparation = 2,
    Ready = 3,
    Paid = 4,
    Cancelled = 5
}

public enum OrderType
{
    DineIn = 0,
    Takeaway = 1,
    Bar = 2
}

public enum TicketStation
{
    CustomerReceipt = 0,
    Kitchen = 1,
    Bar = 2,
    KitchenAndBar = 3
}
