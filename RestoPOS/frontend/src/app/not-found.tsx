import Link from "next/link";
import { ArrowLeft, Store } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div className="w-full max-w-md animate-fade-up text-center">
        <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Store className="size-7" strokeWidth={1.8} aria-hidden />
        </div>
        <p className="text-6xl font-black tracking-tight text-foreground">۴۰۴</p>
        <p className="mt-3 text-[15px] font-semibold text-foreground">صفحه مورد نظر یافت نشد</p>
        <p className="mx-auto mt-1.5 max-w-xs text-[13px] leading-6 text-muted-foreground">
          نشانی اشتباه است یا صفحه حذف شده. از مسیر اصلی ادامه دهید.
        </p>
        <div className="mt-7 flex items-center justify-center gap-2">
          <Button asChild size="lg">
            <Link href="/pos">
              بازگشت به صندوق
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/admin">پنل مدیریت</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
