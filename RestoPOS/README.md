# ToastIran POS — Pnara

اکوسیستم نسل بعد صندوق فروشگاهی و انبار رستوران/کافه برای بازار ایران (ترکیب قابلیت‌های Toast POS، سپیدز و مپرا).

## ساختار مونوریپو

```
RestoPOS/
├── backend/          # .NET 8 Clean Architecture + CQRS
├── frontend/         # Next.js App Router (فاز ۲)
└── docs/
```

## اجرای فرانت‌اند

```bash
cd RestoPOS/frontend
npm install
npm run dev
```

صندوق لمسی: `http://localhost:3000/pos`  
مستندات کامل: `docs/SYSTEM_DOCUMENTATION.md`

## اجرای بک‌اند

پیش‌نیاز: SDK `.NET 8` و SQL Server.

```bash
cd RestoPOS/backend
dotnet restore
dotnet build
dotnet test
dotnet ef database update --project src/Infrastructure --startup-project src/API
dotnet run --project src/API
```

Swagger: `http://localhost:5088/swagger`

اگر دیتابیس شما روی سرور/اعتبارنامه متفاوت اجرا می‌شود، قبل از `dotnet run` مقدار
`ConnectionStrings:SqlServer` را override کنید (در PowerShell):

```powershell
$env:ConnectionStrings__SqlServer = "Server=YOUR_HOST;Database=Pnara;Trusted_Connection=True;TrustServerCertificate=True"
dotnet run --project src/API
```

حساب اولیه: `admin` / `Admin@12345` (فقط Development — در تولید عوض شود).

## ماژول‌ها

- هویت و نقش‌های دانه‌دانه (JWT + Permission policies)
- منو، افزودنی، رسپی (BOM) و کسر خودکار انبار
- موتور صورتحساب ریال/تومان و ارزش افزوده
- پرداخت نقد، کارت‌به‌کارت، درگاه و PC-POS (آسان‌پرداخت / سپ / به‌پرداخت)
- فیش حرارتی ESC/POS و هاب SignalR آشپزخانه/بار
- باشگاه مشتریان و گزارش‌های CQRS

جزئیات معماری در `docs/architecture.md`.
