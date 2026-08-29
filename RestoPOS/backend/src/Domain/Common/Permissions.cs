namespace RestoPOS.Domain.Common;

/// <summary>
/// Granular permission catalog for ToastIran POS. Codes are persisted and also used as JWT claims / policy names.
/// </summary>
public static class Permissions
{
    public const string MenuManage = "Menu.Manage";
    public const string OrdersCreate = "Orders.Create";
    public const string OrdersCancelDraft = "Orders.CancelDraft";
    public const string OrdersSubmit = "Orders.Submit";
    public const string OrdersUpdateStatus = "Orders.UpdateStatus";
    public const string OrdersCancel = "Orders.Cancel";
    public const string OrdersView = "Orders.View";
    public const string PaymentsSettle = "Payments.Settle";
    public const string InventoryManage = "Inventory.Manage";
    public const string InventoryView = "Inventory.View";
    public const string ReportsViewSales = "Reports.ViewSales";
    public const string ReportsViewStaff = "Reports.ViewStaff";
    public const string SettingsUpdate = "Settings.Update";
    public const string SettingsView = "Settings.View";
    public const string StaffManage = "Staff.Manage";
    public const string ShiftsManage = "Shifts.Manage";
    public const string CustomersView = "Customers.View";
    public const string KitchenDisplay = "Kitchen.Display";

    public static IReadOnlyList<(string Code, string DisplayNameFa, string Module)> Catalog { get; } =
    [
        (MenuManage, "مدیریت منو و رسپی", "Menu"),
        (OrdersCreate, "ثبت سفارش", "Orders"),
        (OrdersCancelDraft, "حذف پیش‌نویس سفارش", "Orders"),
        (OrdersSubmit, "ارسال سفارش به آشپزخانه", "Orders"),
        (OrdersUpdateStatus, "تغییر وضعیت سفارش", "Orders"),
        (OrdersCancel, "لغو سفارش", "Orders"),
        (OrdersView, "مشاهده سفارش‌ها", "Orders"),
        (PaymentsSettle, "تسویه پرداخت", "Payments"),
        (InventoryManage, "مدیریت انبار", "Inventory"),
        (InventoryView, "مشاهده موجودی", "Inventory"),
        (ReportsViewSales, "گزارش فروش", "Reports"),
        (ReportsViewStaff, "گزارش عملکرد پرسنل", "Reports"),
        (SettingsUpdate, "ویرایش تنظیمات فروشگاه", "Settings"),
        (SettingsView, "مشاهده تنظیمات", "Settings"),
        (StaffManage, "مدیریت پرسنل و نقش‌ها", "Staff"),
        (ShiftsManage, "مدیریت شیفت صندوق", "Shifts"),
        (CustomersView, "باشگاه مشتریان", "Customers"),
        (KitchenDisplay, "نمایشگر آشپزخانه/بار", "Kitchen")
    ];
}
