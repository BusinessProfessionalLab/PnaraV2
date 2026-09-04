"use client";

import { ArrowLeft, Boxes, FolderTree, GripVertical, PackageOpen } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useAddons, useCategories, useMenuItems } from "@/queries/menu";

export function MenuSections() {
  const categories = useCategories(true);
  const items = useMenuItems(false);
  const addons = useAddons(false);

  const sections = [
    {
      href: "/admin/menu/order",
      title: "ترتیب نمایش منو",
      description: "چینش دسته‌بندی‌ها و محصولات در صندوق لمسی را با کشیدن و رها کردن مرتب کنید",
      icon: GripVertical,
      count: null as number | null,
    },
    {
      href: "/admin/menu/categories",
      title: "دسته‌بندی‌ها",
      description: "ساخت، ویرایش و حذف دسته‌بندی‌های منو",
      icon: FolderTree,
      count: (categories.data ?? []).filter((c) => !c.isSystem).length,
    },
    {
      href: "/admin/menu/products",
      title: "محصولات",
      description: "محصولات، قیمت‌ها، اضافات و رسپی هر محصول",
      icon: PackageOpen,
      count: items.data?.length ?? null,
    },
    {
      href: "/admin/menu/addons",
      title: "افزودنی‌های مشترک",
      description: "افزودنی‌هایی که یک‌بار ساخته می‌شوند و روی چند محصول استفاده می‌شوند",
      icon: Boxes,
      count: addons.data?.length ?? null,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {sections.map((section) => {
        const Icon = section.icon;
        return (
          <Link
            key={section.href}
            href={section.href}
            className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs outline-none transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card-hover focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary transition-colors duration-200 group-hover:bg-primary-fill group-hover:text-primary-foreground">
                <Icon className="size-5" strokeWidth={1.9} aria-hidden />
              </span>
              {section.count !== null ? (
                <Badge variant="neutral" className="tabular-nums">
                  {section.count} مورد
                </Badge>
              ) : null}
            </div>
            <div className="flex-1">
              <h3 className="text-[15px] font-bold">{section.title}</h3>
              <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{section.description}</p>
            </div>
            <span className="flex items-center gap-1 text-[13px] font-semibold text-primary">
              ورود به بخش
              <ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5" aria-hidden />
            </span>
          </Link>
        );
      })}
    </div>
  );
}