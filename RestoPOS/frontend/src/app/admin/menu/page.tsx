import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { MenuSections } from "@/components/admin/menu-sections";

export default function Page() {
  return (
    <div data-tour="menu-page" className="space-y-6">
      <PageHeader
        title="منو و رسپی"
        description="مدیریت منوی فروشگاه: ترتیب نمایش، دسته‌بندی‌ها، محصولات و افزودنی‌های مشترک"
        actions={
          <Button asChild variant="outline">
            <Link href="/pos">
              مشاهده در صندوق
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
        }
      />
      <MenuSections />
    </div>
  );
}