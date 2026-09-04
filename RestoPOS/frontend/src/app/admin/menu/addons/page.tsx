import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SharedAddonsManager } from "@/components/admin/shared-addons-manager";

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="افزودنی‌های مشترک"
        description="افزودنی‌هایی که یک‌بار ساخته می‌شوند و روی چند محصول قابل استفاده هستند"
        actions={
          <Button asChild variant="outline">
            <Link href="/admin/menu">
              <ArrowRight className="size-4" aria-hidden />
              بازگشت به منو
            </Link>
          </Button>
        }
      />
      <SharedAddonsManager />
    </div>
  );
}