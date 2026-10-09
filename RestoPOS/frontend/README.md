# Pnara — Frontend

صندوق لمسی، نمایشگر بار/آشپزخانه و پنل مدیریت Next.js 14.

```bash
npm install
npm run dev
```

- صندوق: [http://localhost:3000/pos](http://localhost:3000/pos)
- ورود پیش‌فرض توسعه: `admin` / `Admin@12345`
- آدرس API: `NEXT_PUBLIC_API_URL` در `.env.local` (پیش‌فرض `http://192.168.100.249:5000`) — همه فراخوانی‌ها از همین مقدار ساخته می‌شوند
- پروکسی API (فقط وقتی `NEXT_PUBLIC_API_URL` خالی باشد): `API_PROXY_TARGET` در `.env.local` (پیش‌فرض `http://192.168.100.249:5000`)

مستندات کامل سیستم: [`../docs/SYSTEM_DOCUMENTATION.md`](../docs/SYSTEM_DOCUMENTATION.md)
