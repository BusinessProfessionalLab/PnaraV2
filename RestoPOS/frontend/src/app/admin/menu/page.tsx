import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { MenuBomBuilder } from "@/components/admin/menu-bom-builder";
import { CategoryManager } from "@/components/admin/category-manager";
import { DisplayOrderManager } from "@/components/admin/display-order-manager";

export default function Page() {
  return (
    <>
      <PageHeader
        title="منو و رسپی"
        description="ترتیب نمایش، دسته‌بندی‌ها، محصولات، افزودنی‌ها و اتصال مواد به انبار"
        actions={
          <Button asChild variant="outline">
            <Link href="/pos">
              مشاهده در صندوق
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
        }
      />
      <DisplayOrderManager />
      <CategoryManager />
      <MenuBomBuilder />
    </>
  );
}
