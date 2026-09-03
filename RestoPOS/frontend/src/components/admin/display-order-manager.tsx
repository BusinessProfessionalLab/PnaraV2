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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Badge, Card } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
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
  const qc = useQueryClient();
  const categoriesQuery = useQuery({
    queryKey: ["categories", true],
    queryFn: () => api.categories(true),
  });
  const itemsQuery = useQuery({
    queryKey: ["menu", false],
    queryFn: () => api.menuItems(false),
  });
  const categories = useMemo(
    () =>
      (categoriesQuery.data ?? []).filter((category) => !category.isSystem),
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

  const entriesById = useMemo(
    () => new Map(sourceEntries.map((entry) => [entry.id, entry])),
    [sourceEntries],
  );
  const orderedEntries = orderedIds
    .map((id) => entriesById.get(id))
    .filter((entry): entry is OrderEntry => Boolean(entry));
  const hasChanges = orderedIds.join("|") !== savedIds.join("|");

  const save = useMutation({
    mutationFn: () =>
      mode === "categories"
        ? api.reorderCategories(orderedIds)
        : api.reorderMenuItems(categoryId, orderedIds),
    onSuccess: async () => {
      setSavedIds(orderedIds);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["categories"] }),
        qc.invalidateQueries({ queryKey: ["menu"] }),
      ]);
      toast.success("ترتیب نمایش ذخیره شد");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= orderedIds.length) return;
    setOrderedIds((current) => arrayMove(current, index, nextIndex));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setOrderedIds((current) => {
      const oldIndex = current.indexOf(String(active.id));
      const newIndex = current.indexOf(String(over.id));
      return oldIndex < 0 || newIndex < 0
        ? current
        : arrayMove(current, oldIndex, newIndex);
    });
  };

  const isLoading = categoriesQuery.isLoading || itemsQuery.isLoading;

  return (
    <Card className="mb-4 overflow-hidden">
      <div className="border-b bg-muted/30 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black">
              <Layers3 className="h-5 w-5 text-primary" />
              ترتیب نمایش منو
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              ردیف‌ها را بکشید یا با فلش‌ها جابه‌جا کنید. موارد قدیمی،
              مخفی و غیرفعال نیز در این فهرست هستند.
            </p>
          </div>
          <Badge variant="outline">{orderedEntries.length} مورد</Badge>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr]">
          <div className="flex rounded-xl border bg-card p-1">
            <ModeButton
              active={mode === "categories"}
              onClick={() => setMode("categories")}
              icon={<Layers3 className="h-4 w-4" />}
            >
              دسته‌بندی‌ها
            </ModeButton>
            <ModeButton
              active={mode === "items"}
              onClick={() => setMode("items")}
              icon={<PackageOpen className="h-4 w-4" />}
            >
              محصولات
            </ModeButton>
          </div>

          {mode === "items" && (
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="bg-card">
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
          )}
        </div>
      </div>

      <div className="p-4">
        {isLoading ? (
          <EmptyMessage>در حال دریافت ترتیب فعلی...</EmptyMessage>
        ) : orderedEntries.length === 0 ? (
          <EmptyMessage>
            {mode === "items"
              ? "در این دسته‌بندی محصولی وجود ندارد."
              : "دسته‌بندی‌ای وجود ندارد."}
          </EmptyMessage>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={orderedIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="grid gap-2">
                {orderedEntries.map((entry, index) => (
                  <SortableOrderRow
                    key={entry.id}
                    entry={entry}
                    index={index}
                    count={orderedEntries.length}
                    onMove={move}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <p className="text-xs text-muted-foreground">
            شماره ردیف جدید، اولویت نمایش در صندوق خواهد بود.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!hasChanges || save.isPending}
              onClick={() => setOrderedIds(savedIds)}
            >
              <RotateCcw className="h-4 w-4" />
              بازنشانی
            </Button>
            <Button
              type="button"
              disabled={
                !hasChanges || save.isPending || orderedIds.length === 0
              }
              onClick={() => save.mutate()}
            >
              <Check className="h-4 w-4" />
              {save.isPending ? "در حال ذخیره..." : "ذخیره ترتیب"}
            </Button>
          </div>
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
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-xl border bg-card p-2 shadow-sm transition-shadow",
        isDragging && "relative z-10 shadow-lg ring-2 ring-primary/30",
        entry.muted && "bg-muted/30",
      )}
    >
      <button
        type="button"
        className="touch-none cursor-grab rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
        aria-label={`جابه‌جایی ${entry.title}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-black text-primary">
        {index + 1}
      </span>
      {entry.imageUrl ? (
        <Image
          src={entry.imageUrl}
          alt=""
          width={40}
          height={40}
          unoptimized
          className="h-10 w-10 shrink-0 rounded-lg object-cover"
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-bold">{entry.title}</span>
          {entry.mutedLabel ? (
            <Badge variant="outline">{entry.mutedLabel}</Badge>
          ) : null}
        </div>
        {entry.subtitle ? (
          <p className="truncate text-xs text-muted-foreground">
            {entry.subtitle}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          disabled={index === 0}
          aria-label={`انتقال ${entry.title} به بالا`}
          onClick={() => onMove(index, -1)}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          disabled={index === count - 1}
          aria-label={`انتقال ${entry.title} به پایین`}
          onClick={() => onMove(index, 1)}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
