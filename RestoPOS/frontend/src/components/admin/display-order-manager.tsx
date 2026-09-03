"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  ArrowDown,
  ArrowUp,
  Check,
  GripVertical,
  Layers3,
  PackageOpen,
  RotateCcw,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCategories,
  useMenuItems,
  useReorderCategories,
  useReorderMenuItems,
} from "@/queries/menu";
import { errorMessage } from "@/api/errors";
import { cn } from "@/lib/cn";

type OrderMode = "categories" | "items";
type OrderEntry = {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  muted?: boolean;
  mutedLabel?: string;
};

export function DisplayOrderManager() {
  const categoriesQuery = useCategories(true);
  const itemsQuery = useMenuItems(false);
  const categories = useMemo(
    () => (categoriesQuery.data ?? []).filter((category) => !category.isSystem),
    [categoriesQuery.data],
  );
  const [mode, setMode] = useState<OrderMode>("categories");
  const [categoryId, setCategoryId] = useState("");
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!categoryId && categories.length > 0) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  const sourceEntries = useMemo<OrderEntry[]>(() => {
    if (mode === "categories") {
      return categories.map((category) => ({
        id: category.id,
        title: category.name,
        subtitle: category.nameEn ?? undefined,
        imageUrl: category.imageUrl,
        muted: !category.isVisible,
        mutedLabel: !category.isVisible ? "مخفی" : undefined,
      }));
    }
    return (itemsQuery.data ?? [])
      .filter((item) => item.categoryId === categoryId)
      .map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: item.nameEn ?? undefined,
        imageUrl: item.imageUrl,
        muted: !item.isActive,
        mutedLabel: !item.isActive ? "غیرفعال" : undefined,
      }));
  }, [categories, categoryId, itemsQuery.data, mode]);

  useEffect(() => {
    const ids = sourceEntries.map((entry) => entry.id);
    setOrderedIds(ids);
    setSavedIds(ids);
  }, [sourceEntries]);

  const entriesById = useMemo(() => new Map(sourceEntries.map((entry) => [entry.id, entry])), [sourceEntries]);
  const orderedEntries = orderedIds
    .map((id) => entriesById.get(id))
    .filter((entry): entry is OrderEntry => Boolean(entry));
  const hasChanges = orderedIds.join("|") !== savedIds.join("|");

  const reorderCategories = useReorderCategories();
  const reorderMenuItems = useReorderMenuItems();
  const savePending = reorderCategories.isPending || reorderMenuItems.isPending;

  async function save() {
    try {
      if (mode === "categories") {
        await reorderCategories.mutateAsync(orderedIds);
      } else {
        await reorderMenuItems.mutateAsync({ categoryId, orderedIds });
      }
      setSavedIds(orderedIds);
      toast.success("ترتیب نمایش ذخیره شد");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= orderedIds.length) return;
    setOrderedIds((current) => arrayMove(current, index, nextIndex));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setOrderedIds((current) => {
      const oldIndex = current.indexOf(String(active.id));
      const newIndex = current.indexOf(String(over.id));
      return oldIndex < 0 || newIndex < 0 ? current : arrayMove(current, oldIndex, newIndex);
    });
  };

  const isLoading = categoriesQuery.isLoading || itemsQuery.isLoading;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Layers3 className="size-[18px]" aria-hidden />
          </div>
          <div>
            <h2 className="text-[15px] font-bold">ترتیب نمایش منو</h2>
            <p className="mt-0.5 max-w-lg text-[13px] leading-5 text-muted-foreground">
              ردیف‌ها را بکشید یا با فلش‌ها جابه‌جا کنید — شماره ردیف، اولویت نمایش در صندوق است
            </p>
          </div>
        </div>
        <Badge variant="neutral" className="tabular-nums">
          {isLoading ? "…" : `${orderedEntries.length} مورد`}
        </Badge>
      </div>

      <div className="flex flex-col gap-3 border-b border-border/70 bg-muted/30 px-5 py-3 sm:flex-row sm:items-center">
        <div className="flex rounded-xl bg-card p-1 ring-1 ring-border">
          <ModeButton
            active={mode === "categories"}
            onClick={() => setMode("categories")}
            icon={<Layers3 className="size-4" aria-hidden />}
          >
            دسته‌بندی‌ها
          </ModeButton>
          <ModeButton
            active={mode === "items"}
            onClick={() => setMode("items")}
            icon={<PackageOpen className="size-4" aria-hidden />}
          >
            محصولات
          </ModeButton>
        </div>
        {mode === "items" ? (
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="sm:w-72" aria-label="دسته‌بندی">
              <SelectValue placeholder="انتخاب دسته‌بندی" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                  {!category.isVisible ? " — مخفی" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {hasChanges ? (
          <span className="text-xs font-medium text-warning sm:ms-auto">تغییرات ذخیره‌نشده</span>
        ) : (
          <span className="text-xs text-muted-foreground sm:ms-auto">
            {mode === "items" ? "محصولات این دسته" : "ترتیب نمایش دسته‌ها"} ذخیره شده
          </span>
        )}
      </div>

      <div className="p-5">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : orderedEntries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-background/60 px-6 py-10 text-center">
            <p className="text-sm font-semibold">
              {mode === "items" ? "در این دسته‌بندی محصولی وجود ندارد" : "دسته‌بندی‌ای وجود ندارد"}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {mode === "items"
                ? "از «سازنده منو و رسپی» محصول اضافه کنید"
                : "از «مدیریت دسته‌بندی‌ها» دسته بسازید"}
            </p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
              <div className="grid gap-2">
                {orderedEntries.map((entry, index) => (
                  <SortableOrderRow key={entry.id} entry={entry} index={index} count={orderedEntries.length} onMove={move} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-border/70 pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={!hasChanges || savePending}
            onClick={() => setOrderedIds(savedIds)}
          >
            <RotateCcw className="size-4" aria-hidden />
            بازنشانی
          </Button>
          <Button
            type="button"
            disabled={!hasChanges || savePending || orderedIds.length === 0}
            loading={savePending}
            onClick={save}
          >
            <Check className="size-4" aria-hidden />
            ذخیره ترتیب
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-lg px-4 py-1.5 text-[13px] font-semibold outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/50",
        active
          ? "bg-primary-fill text-primary-foreground shadow-xs"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function SortableOrderRow({
  entry,
  index,
  count,
  onMove,
}: {
  entry: OrderEntry;
  index: number;
  count: number;
  onMove: (index: number, direction: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-xl border bg-card p-2 transition-shadow",
        isDragging && "relative z-10 border-primary/40 shadow-lg",
        entry.muted && "bg-muted/40 opacity-70",
      )}
    >
      <button
        type="button"
        className="touch-none cursor-grab rounded-lg p-2 text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 active:cursor-grabbing"
        aria-label={`جابه‌جایی ${entry.title}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-[13px] font-black text-primary tabular-nums">
        {index + 1}
      </span>
      {entry.imageUrl ? (
        <Image src={entry.imageUrl} alt="" width={40} height={40} unoptimized className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-border" />
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{entry.title}</span>
          {entry.mutedLabel ? <Badge variant="neutral">{entry.mutedLabel}</Badge> : null}
        </div>
        {entry.subtitle ? (
          <p className="truncate text-xs text-muted-foreground" dir="ltr" style={{ textAlign: "start" }}>
            {entry.subtitle}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-0.5">
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="text-muted-foreground"
          disabled={index === 0}
          aria-label={`انتقال ${entry.title} به بالا`}
          onClick={() => onMove(index, -1)}
        >
          <ArrowUp className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="text-muted-foreground"
          disabled={index === count - 1}
          aria-label={`انتقال ${entry.title} به پایین`}
          onClick={() => onMove(index, 1)}
        >
          <ArrowDown className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
