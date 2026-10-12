import Link from "next/link";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function LicenseExpiredPage() {
  return (
    <main dir="rtl" className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md rounded-2xl p-8 text-center shadow-md">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Store className="size-6" aria-hidden />
        </div>
        <h1 className="text-xl font-bold">لایسنس معتبر نیست</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          مدت اعتبار لایسنس این نرم‌افزار به پایان رسیده یا لایسنس برای این نصب صادر نشده است. برای تمدید با پشتیبانی تماس بگیرید.
        </p>
        <Button asChild className="mt-6 w-full">
          <Link href="/login">بازگشت به ورود</Link>
        </Button>
      </Card>
    </main>
  );
}
