"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { RecipeEditor } from "@/components/admin/recipe-editor";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useAddons,
  useAttachAddon,
  useCategories,
  useCreateMenuItem,
  useCreateModifier,
  useDeleteMenuItem,
  useDeleteModifier,
  useDetachAddon,
  useMenuItems,
  useUpdateMenuItem,
  useUpdateModifier,
} from "@/queries/menu";
import { useInventory } from "@/queries/inventory";
import { errorMessage } from "@/api/errors";
import {
  CirclePlus,
  FolderTree,
  ImagePlus,
  Layers3,
  PackageOpen,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { formatToman } from "@/lib/currency";
import { fuzzyScore } from "@/lib/fuzzy-search";
import { cn } from "@/lib/cn";
import type { InventoryItemDto, MenuItemDto, RecipeLineDto, TicketStation } from "@/lib/types";

type Category = { id: string; name: string };

async function cropImageToSquare(file: File): Promise<string> {
  const source = await new Promise<HTMLImageElement>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("امکان خواندن تصویر وجود ندارد."));
      image.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error("امکان خواندن فایل وجود ندارد."));
    reader.readAsDataURL(file);
  });
  const side = Math.min(source.naturalWidth, source.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 800;
  canvas.getContext("2d")?.drawImage(
    source,
    (source.naturalWidth - side) / 2,
    (source.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    800,
    800,
  );
  return canvas.toDataURL("image/jpeg", 0.86);
}

function PriceInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  // The تومان chip lives inside MoneyInput itself, so every price field in
  // the product gets the exact same unit indicator without duplicating it.
  return <MoneyInput value={value} onValueChange={onChange} placeholder={placeholder} />;
}

function ImageUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      onChange(await cropImageToSquare(file));
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">عکس محصول</Label>
      <label className="group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 p-4 outline-none transition-colors duration-150 hover:border-primary/40 hover:bg-primary-soft/40 focus-visible:ring-2 focus-visible:ring-ring/50">
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="پیش‌نمایش محصول"
              className="h-16 w-16 rounded-lg object-cover ring-1 ring-border"
            />
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ImagePlus className="size-3" aria-hidden />
              <span>برای تعویض کلیک کنید</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors duration-150 group-hover:text-primary">
              <ImagePlus className="size-4" aria-hidden />
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-foreground">بارگذاری عکس</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">برش خودکار مربعی ۱:۱</p>
            </div>
          </>
        )}
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => handleFile(e.target.files?.[0])} />
      </label>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */

export function ProductsManager() {
  const cats = useCategories(true);
  const items = useMenuItems(false);
  const inv = useInventory();
  const [categoryId, setCategoryId] = useState("all");
  const [query, setQuery] = useState("");
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const categories = useMemo(() => (cats.data ?? []).filter((c) => !c.isSystem), [cats.data]);

  const filtered = useMemo(() => {
    const list = items.data ?? [];
    return list.filter((item) => {
      if (categoryId !== "all" && item.categoryId !== categoryId) return false;
      if (!query.trim()) return true;
      return (
        fuzzyScore(
          query,
          `${item.title} ${item.nameEn ?? ""} ${item.description ?? ""} ${item.categoryName}`,
        ) > 0
      );
    });
  }, [items.data, categoryId, query]);

  const editingItem = useMemo(
    () => items.data?.find((i) => i.id === editItemId) ?? null,
    [items.data, editItemId],
  );

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border/70 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <PackageOpen className="size-[18px]" aria-hidden />
            </span>
            <div>
              <h2 className="text-[15px] font-bold">محصولات منو</h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {items.isLoading ? "در حال بارگذاری…" : `${items.data?.length ?? 0} محصول`}
              </p>
            </div>
          </div>
          <Button
            className="ms-auto"
            onClick={() => setCreateOpen(true)}
            disabled={categories.length === 0}
            title={categories.length === 0 ? "ابتدا یک دسته‌بندی بسازید" : undefined}
          >
            <CirclePlus className="size-4" aria-hidden />
            افزودن محصول
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 border-b border-border/70 bg-muted/30 px-5 py-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجوی نام یا توضیحات محصول…"
              className="ps-10"
            />
          </div>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="sm:w-64" aria-label="فیلتر دسته‌بندی">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه دسته‌ها</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Product grid */}
        <div className="p-5">
          {items.isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-2.5">
                  <Skeleton className="aspect-square w-full rounded-xl" />
                  <div className="flex flex-col gap-2 p-2">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-5 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={PackageOpen}
              title="محصولی یافت نشد"
              description={
                query.trim() || categoryId !== "all"
                  ? "فیلترها یا عبارت جستجو را تغییر دهید"
                  : "هنوز محصولی ثبت نشده است؛ با دکمه «افزودن محصول» شروع کنید"
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filtered.map((item) => (
                <ProductCard key={item.id} item={item} onClick={() => setEditItemId(item.id)} />
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Edit modal — opens in edit mode when a product card is clicked */}
      <Dialog open={Boolean(editItemId)} onOpenChange={(open) => !open && setEditItemId(null)}>
        <DialogContent wide>
          <DialogHeader className="pe-12">
            <DialogTitle>ویرایش محصول و رسپی</DialogTitle>
            <DialogDescription>
              {editingItem ? `${editingItem.title} — ${editingItem.categoryName}` : "محصول انتخاب‌شده"}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {editingItem ? (
              <ItemEditor
                key={editingItem.id}
                item={editingItem}
                inventory={inv.data ?? []}
                onDeleted={() => setEditItemId(null)}
              />
            ) : null}
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Create modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent wide>
          <DialogHeader className="pe-12">
            <DialogTitle>افزودن محصول جدید</DialogTitle>
            <DialogDescription>نام، قیمت، دسته و عکس محصول جدید را وارد کنید</DialogDescription>
          </DialogHeader>
          <DialogBody>
            {categories.length === 0 ? (
              <EmptyState
                compact
                icon={FolderTree}
                title="دسته‌ای وجود ندارد"
                description="ابتدا از بخش «دسته‌بندی‌ها» یک دسته بسازید"
              />
            ) : (
              <ProductForm categories={categories} inventory={inv.data ?? []} onCreated={() => setCreateOpen(false)} />
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductCard({ item, onClick }: { item: MenuItemDto; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-start shadow-xs outline-none transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card-hover focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <div className="relative mx-2.5 mt-2.5">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.title}
            className="aspect-square w-full rounded-xl object-cover ring-1 ring-border/50"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Layers3 className="size-6" aria-hidden />
          </div>
        )}
        {!item.isActive ? (
          <Badge variant="neutral" className="absolute end-2 top-2 backdrop-blur-sm">
            غیرفعال
          </Badge>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-3">
        <div className="line-clamp-2 text-[15px] leading-6 font-bold break-words">{item.title}</div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">{item.categoryName}</div>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
          <span className="truncate text-[15px] font-extrabold text-primary tabular-nums">
            {formatToman(item.basePrice)}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors duration-150 group-hover:text-primary">
            <Pencil className="size-3" aria-hidden />
            ویرایش
          </span>
        </div>
      </div>
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────── */

function AddonSelector({
  addons,
  selected,
  onChange,
}: {
  addons: import("@/lib/types").AddonDto[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">افزودنی‌های مشترک این محصول</span>
        <Badge variant="neutral" className="tabular-nums">
          {selected.length} انتخاب
        </Badge>
      </div>
      {addons.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">ابتدا یک افزودنی مشترک بسازید.</p>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {addons.map((a) => {
            const on = selected.includes(a.id);
            return (
              <label
                key={a.id}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm transition-colors duration-150",
                  on ? "border-primary/40 bg-primary-soft/50" : "border-border hover:border-border-strong",
                )}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => onChange(e.target.checked ? [...selected, a.id] : selected.filter((id) => id !== a.id))}
                  className="size-4 rounded border-border accent-(--color-primary)"
                />
                <span className="min-w-0 flex-1 truncate">{a.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{formatToman(a.extraPrice)}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProductForm({
  categories,
  inventory,
  onCreated,
}: {
  categories: Category[];
  inventory: InventoryItemDto[];
  onCreated?: () => void;
}) {
  const allAddons = useAddons(false);
  const allItems = useMenuItems(false);
  const createItem = useCreateMenuItem();
  const attachAddon = useAttachAddon();
  const [submitting, setSubmitting] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [station, setStation] = useState<TicketStation>("Bar");
  const [recipeLines, setRecipeLines] = useState<RecipeLineDto[]>([]);

  async function submit() {
    if (!title.trim() || !price || !categoryId) return;
    setSubmitting(true);
    try {
      const displayPriority =
        Math.max(0, ...(allItems.data ?? []).filter((item) => item.categoryId === categoryId).map((item) => item.displayPriority)) + 1;
      const id = await createItem.mutateAsync({
        title,
        nameEn: nameEn || null,
        description: null,
        basePrice: Number(price) * 10,
        taxInclusive: false,
        imageUrl: imageUrl || null,
        displayPriority,
        categoryId,
        isActive: true,
        ticketStation: station,
        prepTimeMinutes: 4,
        recipeLines,
      });
      await Promise.all(
        selectedAddons.map((addonId) =>
          attachAddon.mutateAsync({ menuItemId: id, addonId }),
        ),
      );
      toast.success("محصول ثبت شد");
      setTitle("");
      setNameEn("");
      setPrice("");
      setImageUrl("");
      setSelectedAddons([]);
      onCreated?.();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="grid gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Field label="نام فارسی محصول">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً اسپرسو" />
      </Field>
      <Field label="نام انگلیسی (اختیاری)">
        <Input dir="ltr" className="text-start" value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Espresso" />
      </Field>
      <Field label="قیمت">
        <PriceInput value={price} onChange={setPrice} placeholder="قیمت محصول" />
      </Field>
      <Field label="دسته">
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger>
            <SelectValue placeholder="انتخاب دسته" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="ایستگاه چاپ فیش">
        <Select value={station} onValueChange={(v) => setStation(v as TicketStation)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Bar">بار</SelectItem>
            <SelectItem value="Kitchen">آشپزخانه</SelectItem>
            <SelectItem value="KitchenAndBar">هر دو</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <ImageUpload value={imageUrl} onChange={setImageUrl} />
      <div className="sm:col-span-2">
        <AddonSelector addons={allAddons.data ?? []} selected={selectedAddons} onChange={setSelectedAddons} />
      </div>
      <div className="sm:col-span-2">
        <RecipeEditor item={null} inventory={inventory} onLinesChange={setRecipeLines} />
      </div>
      <Button
        type="submit"
        className="sm:col-span-2"
        loading={submitting}
        disabled={!title.trim() || !price || !categoryId}
      >
        <CirclePlus className="size-4" aria-hidden />
        ثبت محصول
      </Button>
    </form>
  );
}

/* ──────────────────────────────────────────────────────────────── */

function ItemEditor({
  item,
  inventory,
  onDeleted,
}: {
  item: MenuItemDto;
  inventory: InventoryItemDto[];
  onDeleted?: () => void;
}) {
  const allAddons = useAddons(false);
  const updateItem = useUpdateMenuItem();
  const deleteItem = useDeleteMenuItem();
  const createModifier = useCreateModifier();
  const editModifier = useUpdateModifier();
  const removeModifier = useDeleteModifier();
  const attachAddon = useAttachAddon();
  const detachAddon = useDetachAddon();
  const [sharedAddonIds, setSharedAddonIds] = useState<string[]>(() => (item.addons ?? []).map((a) => a.id));
  const [title, setTitle] = useState(item.title);
  const [nameEn, setNameEn] = useState(item.nameEn ?? "");
  const [description, setDescription] = useState(item.description ?? "");
  const [price, setPrice] = useState(String(item.basePrice / 10));
  const [imageUrl, setImageUrl] = useState(item.imageUrl ?? "");
  const [modName, setModName] = useState("");
  const [modPrice, setModPrice] = useState("");
  const [editingMod, setEditingMod] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<null | { kind: "product" } | { kind: "modifier"; id: string; name: string }>(null);

  async function update() {
    try {
      await updateItem.mutateAsync({
        id: item.id,
        payload: {
          title,
          nameEn: nameEn || null,
          description: description || null,
          basePrice: Number(price) * 10,
          taxInclusive: item.taxInclusive,
          imageUrl: imageUrl || null,
          displayPriority: item.displayPriority,
          categoryId: item.categoryId,
          isActive: item.isActive,
          ticketStation: item.ticketStation,
          prepTimeMinutes: item.prepTimeMinutes,
        },
      });
      toast.success("اطلاعات محصول ذخیره شد");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function remove() {
    try {
      await deleteItem.mutateAsync(item.id);
      toast.success("محصول حذف شد");
      setConfirmDelete(null);
      onDeleted?.();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function saveMod() {
    try {
      if (editingMod) {
        await editModifier.mutateAsync({
          id: editingMod,
          payload: {
            name: modName,
            extraPrice: Number(modPrice) * 10,
            ticketStation: item.ticketStation,
            displayPriority:
              item.modifiers.find((m) => m.id === editingMod)?.displayPriority ?? 1,
            isActive: true,
          },
        });
      } else {
        await createModifier.mutateAsync({
          menuItemId: item.id,
          name: modName,
          extraPrice: Number(modPrice) * 10,
          ticketStation: item.ticketStation,
          displayPriority: item.modifiers.length + 1,
        });
      }
      toast.success(editingMod ? "اضافه ویرایش شد" : "اضافه ثبت شد");
      setModName("");
      setModPrice("");
      setEditingMod(null);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function deleteMod(id: string) {
    try {
      await removeModifier.mutateAsync(id);
      toast.success("اضافه حذف شد");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="space-y-5">
      {/* Product identity */}
      <div className="flex items-center gap-3">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.title} className="size-12 rounded-xl object-cover ring-1 ring-border" />
        ) : (
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Layers3 className="size-5" aria-hidden />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold">{item.title}</div>
          <div className="text-xs text-muted-foreground">
            {item.categoryName} · {formatToman(item.basePrice)}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 text-danger hover:bg-danger/10 hover:text-danger"
          onClick={() => setConfirmDelete({ kind: "product" })}
        >
          <Trash2 className="size-3.5" aria-hidden />
          حذف محصول
        </Button>
      </div>

      {/* Basic info */}
      <div className="space-y-3 rounded-xl border border-border p-3.5">
        <SectionLabel>ویرایش محصول</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="نام فارسی">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="نام انگلیسی">
            <Input dir="ltr" className="text-start" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          </Field>
          <Field label="قیمت">
            <PriceInput value={price} onChange={setPrice} />
          </Field>
          <div className="sm:col-span-2">
            <ImageUpload value={imageUrl} onChange={setImageUrl} />
          </div>
          <div className="sm:col-span-2">
            <Field label="توضیحات">
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="توضیحی که در صندوق نمایش داده شود" />
            </Field>
          </div>
        </div>
        <Button loading={updateItem.isPending} onClick={() => update()}>
          <Save className="size-4" aria-hidden />
          ذخیره تغییرات
        </Button>
      </div>

      {/* Shared addons */}
      <AddonSelector
        addons={allAddons.data ?? []}
        selected={sharedAddonIds}
        onChange={async (ids) => {
          const added = ids.filter((id) => !sharedAddonIds.includes(id));
          const removed = sharedAddonIds.filter((id) => !ids.includes(id));
          await Promise.all([
            ...added.map((id) =>
              attachAddon.mutateAsync({ menuItemId: item.id, addonId: id }),
            ),
            ...removed.map((id) =>
              detachAddon.mutateAsync({ menuItemId: item.id, addonId: id }),
            ),
          ]);
          setSharedAddonIds(ids);
        }}
      />

      {/* Item-specific extras */}
      <div className="space-y-3 rounded-xl border border-border p-3.5">
        <SectionLabel>اضافات این محصول</SectionLabel>
        {item.modifiers.length > 0 ? (
          <ul className="space-y-1.5">
            {item.modifiers.map((m) => (
              <li key={m.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold">{m.name}</span>
                  <span className="ms-2 text-xs text-muted-foreground tabular-nums">
                    +{formatToman(m.extraPrice)}
                  </span>
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  aria-label={`ویرایش ${m.name}`}
                  onClick={() => {
                    setEditingMod(m.id);
                    setModName(m.name);
                    setModPrice(String(m.extraPrice / 10));
                  }}
                >
                  <Pencil className="size-3.5" aria-hidden />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground hover:bg-danger/10 hover:text-danger"
                  aria-label={`حذف ${m.name}`}
                  onClick={() => setConfirmDelete({ kind: "modifier", id: m.id, name: m.name })}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">اضافه‌ای برای این محصول ثبت نشده است.</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Input value={modName} onChange={(e) => setModName(e.target.value)} placeholder="نام اضافه، مثلاً شات اضافه" />
          <PriceInput value={modPrice} onChange={setModPrice} placeholder="قیمت اضافه" />
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => saveMod()}
          disabled={!modName.trim() || !modPrice || createModifier.isPending || editModifier.isPending}
          loading={createModifier.isPending || editModifier.isPending}
        >
          <Plus className="size-4" aria-hidden />
          {editingMod ? "ذخیره ویرایش اضافه" : "افزودن اضافه"}
        </Button>
      </div>

      {/* Recipe / BOM */}
      <RecipeEditor item={item} inventory={inventory} />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={confirmDelete?.kind === "modifier" ? `حذف اضافه «${confirmDelete.name}»` : "حذف محصول"}
        description={
          confirmDelete?.kind === "modifier"
            ? "این اضافه از محصول حذف می‌شود."
            : "محصول به‌همراه رسپی و ارتباط‌هایش حذف می‌شود."
        }
        confirmLabel="حذف"
        pending={deleteItem.isPending || removeModifier.isPending}
        onConfirm={() => {
          if (confirmDelete?.kind === "modifier") {
            deleteMod(confirmDelete.id);
          } else if (confirmDelete?.kind === "product") {
            remove();
          }
        }}
      />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-bold">{children}</h3>;
}
