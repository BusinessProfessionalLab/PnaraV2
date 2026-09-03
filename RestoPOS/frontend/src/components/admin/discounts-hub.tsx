"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BadgePercent, Layers3, Percent, Save, Search } from "lucide-react";
import { useCategories, useMenuItems, useUpdateCategory, useUpdateMenuItem } from "@/queries/menu";
import { errorMessage } from "@/api/errors";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatToman } from "@/lib/currency";
import type { CategoryDto, MenuItemDto } from "@/lib/types";

export function DiscountsHub() {
  const [search, setSearch] = useState("");
  const categories = useCategories(true);
  const menu = useMenuItems(false);
  const term = search.trim().toLocaleLowerCase();

  const filteredCategories = useMemo(
    () =>
      (categories.data ?? []).filter(
        (c) => !term || `${c.name} ${c.nameEn ?? ""}`.toLocaleLowerCase().includes(term),
      ),
    [categories.data, term],
  );
  const filteredItems = useMemo(
    () =>
      (menu.data ?? []).filter(
        (i) =>
          !term ||
          `${i.title} ${i.nameEn ?? ""} ${i.categoryName}`.toLocaleLowerCase().includes(term),
      ),
    [menu.data, term],
  );

  const saveCategory = useUpdateCategory();
  const saveItem = useUpdateMenuItem();

  async function persistCategory(category: CategoryDto, value: number) {
    try {
      await saveCategory.mutateAsync({
        id: category.id,
        payload: {
          ...category,
          discountPercent: Math.min(100, Math.max(0, value)),
        },
      });
      toast.success("تخفیف گروه ذخیره شد");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function persistItem(item: MenuItemDto, value: number) {
    try {
      await saveItem.mutateAsync({
        id: item.id,
        payload: {
          ...item,
          discountPercent: Math.min(100, Math.max(0, value)),
        },
      });
      toast.success("تخفیف آیتم ذخیره شد");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  const loading = categories.isLoading || menu.isLoading;

  return (
    <div className="space-y-5">
      <PageHeader
        title="تخفیف‌ها"
        description="تخفیف به‌صورت درصدی روی قیمت اعمال می‌شود؛ تخفیف آیتم بر تخفیف گروه اولویت دارد"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-80">
          <Search
            className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="ps-9"
            placeholder="جستجو در آیتم‌ها و گروه‌ها…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {filteredCategories.length + filteredItems.length} مورد
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border/70 px-5 py-4">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Layers3 className="size-4" aria-hidden />
              </div>
              <div>
                <h2 className="text-[15px] font-bold">تخفیف گروه‌ها</h2>
                <p className="text-xs text-muted-foreground">روی همه آیتم‌های گروه اعمال می‌شود</p>
              </div>
            </div>
            {filteredCategories.length === 0 ? (
              <div className="p-5">
                <EmptyState compact icon={Percent} title="گروهی یافت نشد" description="جستجو را تغییر دهید" />
              </div>
            ) : (
              <ul className="divide-y divide-border/70">
                {filteredCategories.map((c) => (
                  <DiscountRow
                    key={c.id}
                    label={c.name}
                    meta="کل آیتم‌های این گروه"
                    value={c.discountPercent}
                    onSave={(value) => persistCategory(c, value)}
                    pending={saveCategory.isPending}
                  />
                ))}
              </ul>
            )}
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border/70 px-5 py-4">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <BadgePercent className="size-4" aria-hidden />
              </div>
              <div>
                <h2 className="text-[15px] font-bold">تخفیف آیتم‌ها</h2>
                <p className="text-xs text-muted-foreground">فقط روی یک محصول اعمال می‌شود</p>
              </div>
            </div>
            {filteredItems.length === 0 ? (
              <div className="p-5">
                <EmptyState compact icon={Percent} title="آیتمی یافت نشد" description="جستجو را تغییر دهید" />
              </div>
            ) : (
              <ul className="divide-y divide-border/70">
                {filteredItems.map((i) => (
                  <DiscountRow
                    key={i.id}
                    label={i.title}
                    meta={`${i.categoryName} · ${formatToman(i.basePrice)}`}
                    value={i.discountPercent}
                    onSave={(value) => persistItem(i, value)}
                    pending={saveItem.isPending}
                  />
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function DiscountRow({
  label,
  meta,
  value,
  onSave,
  pending,
}: {
  label: string;
  meta: string;
  value: number;
  onSave: (value: number) => void;
  pending?: boolean;
}) {
  const [draft, setDraft] = useState(String(value ?? 0));
  const parsed = Number(draft);
  const dirty = (parsed || 0) !== (value ?? 0);
  return (
    <li className="flex flex-wrap items-center gap-2 px-5 py-3 sm:flex-nowrap">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{label}</div>
        <div className="truncate text-xs text-muted-foreground">{meta}</div>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="relative">
          <Input
            className="w-24 pe-7 text-end tabular-nums"
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label={`درصد تخفیف ${label}`}
          />
          <span className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            ٪
          </span>
        </div>
        <Button
          size="sm"
          variant={dirty ? "default" : "outline"}
          disabled={!dirty || pending || parsed < 0 || parsed > 100}
          loading={pending}
          onClick={() => onSave(parsed || 0)}
        >
          <Save className="size-3.5" aria-hidden />
          ذخیره
        </Button>
      </div>
    </li>
  );
}
