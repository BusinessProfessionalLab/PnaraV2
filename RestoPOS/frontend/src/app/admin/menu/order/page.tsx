import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DisplayOrderManager } from "@/components/admin/display-order-manager";

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="ترتیب نمایش منو"
        description="چینش دسته‌بندی‌ها و محصولات در صندوق لمسی"
        actions={
          <Button asChild variant="outline">
            <Link href="/admin/menu">
              <ArrowRight className="size-4" aria-hidden />
              بازگشت به منو
            </Link>
          </Button>
        }
      />
      <DisplayOrderManager />
    </div>
  );
}