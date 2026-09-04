import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { CategoryManager } from "@/components/admin/category-manager";

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="دسته‌بندی‌ها"
        description="ساخت، ویرایش و حذف دسته‌بندی‌های منو"
        actions={
          <Button asChild variant="outline">
            <Link href="/admin/menu">
              <ArrowRight className="size-4" aria-hidden />
              بازگشت به منو
            </Link>
          </Button>
        }
      />
      <CategoryManager />
    </div>
  );
}