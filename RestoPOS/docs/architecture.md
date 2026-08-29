# معماری ToastIran POS

## لایه‌ها

| لایه | پروژه | مسئولیت |
| --- | --- | --- |
| Domain | `src/Domain` | موجودیت‌ها، Value Objectها، رویدادها، قوانین قیمت‌گذاری |
| Application | `src/Application` | CQRS (MediatR)، Validatorها، قرارداد سرویس‌ها |
| Infrastructure | `src/Infrastructure` | EF Core / SQL Server، Identity، PC-POS، ESC/POS، Audit |
| API | `src/API` | کنترلرها، JWT، Swagger، SignalR `OrderKitchenHub` |

وابستگی فقط به سمت داخل است: API → Infrastructure → Application → Domain.

## جریان سفارش

`Draft` → `Submitted` (کسر BOM + فیش آماده‌سازی + پخش SignalR) → `InPreparation` → `Ready` → `Paid`  
پیش‌نویس با `DELETE /api/orders/{id}/draft` به‌صورت Hard Delete پاک می‌شود تا دادهٔ یتیم نماند.

## پول

همهٔ مبالغ در ریال با `decimal(18,0)` ذخیره می‌شوند. تبدیل نمایشی به تومان: `amount / 10`. نرخ ارزش افزوده از `StoreSettings.VatRate` خوانده می‌شود (پیش‌فرض ۱۰٪).

## مجوزها

کد مجوز همان نام Policy است؛ مثلاً `Menu.Manage`، `Orders.CancelDraft`، `Inventory.Manage`. SuperAdmin همه را دور می‌زند.

## سخت‌افزار

- `IPosDeviceService`: شروع تراکنش، Poll شماره پیگیری، تأیید تسویه روی LAN/COM.
- `IEscPosDispatcher`: فیش مشتری و فیش باریستا/آشپزخانه؛ اگر پرینتر در دسترس نباشد فایل در `tickets/` نوشته می‌شود.
