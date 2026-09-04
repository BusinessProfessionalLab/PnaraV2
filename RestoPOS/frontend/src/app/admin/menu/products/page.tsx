import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ProductsManager } from "@/components/admin/products-manager";

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="محصولات"
        description="مدیریت محصولات، قیمت‌ها، اضافات و رسپی هر محصول — روی هر کارت کلیک کنید تا در حالت ویرایش باز شود"
        actions={
          <Button asChild variant="outline">
            <Link href="/admin/menu">
              <ArrowRight className="size-4" aria-hidden />
              بازگشت به منو
            </Link>
          </Button>
        }
      />
      <ProductsManager />
    </div>
  );
}