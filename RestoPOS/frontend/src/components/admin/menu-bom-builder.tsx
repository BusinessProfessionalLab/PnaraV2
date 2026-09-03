"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
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
import { api } from "@/lib/api";
import {
  Boxes,
  CirclePlus,
  Coins,
  FolderTree,
  ImagePlus,
  Layers3,
  Pencil,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { formatToman } from "@/lib/currency";
import { cn } from "@/lib/cn";
import type { MenuItemDto, TicketStation, UnitOfMeasure } from "@/lib/types";

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

/** Keep only digits and show thousands separator for display. */
function formatPriceInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("en-US");
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
  return (
    <div className="relative">
      <Input
        dir="ltr"
        inputMode="numeric"
        placeholder={placeholder}
        className="pe-20 ps-3 text-left font-medium tabular-nums"
        value={formatPriceInput(value)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      />
      <span className="pointer-events-none absolute end-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1 text-xs text-muted-foreground">
        <Coins className="size-3.5" aria-hidden />
        تومان
      </span>
    </div>
  );
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

export function MenuBomBuilder() {
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ["categories", true], queryFn: () => api.categories(true) });
  const items = useQuery({ queryKey: ["menu", false], queryFn: () => api.menuItems(false) });
  const inv = useQuery({ queryKey: ["inventory"], queryFn: api.inventory });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const selected = items.data?.find((i) => i.id === selectedId) ?? null;

  const catMut = useMutation({
    mutationFn: (name: string) => {
      const displayPriority =
        Math.max(0, ...(cats.data ?? []).filter((c) => !c.isSystem).map((c) => c.displayPriority)) + 1;
      return api.createCategory({ name, nameEn: null, displayPriority, isVisible: true, iconUrl: null, imageUrl: null, parentId: null });
    },
    onSuccess: () => {
      toast.success("دسته ساخته شد");
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateCatMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: unknown }) => api.updateCategory(id, payload),
    onSuccess: () => {
      toast.success("دسته ویرایش شد");
      setEditingCategoryId(null);
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <SharedAddonCreator />
      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-[18rem_1fr_24rem]">
        {/* Categories */}
        <Card className="overflow-hidden">
          <CardHead icon={<FolderTree className="size-4" aria-hidden />} title="دسته‌ها" count={cats.data?.length} />
          <div className="space-y-3 p-4">
            <CategoryForm onCreate={(name) => catMut.mutate(name)} />
            <div className="space-y-2">
              {cats.isLoading ? (
                <>
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </>
              ) : (
                (cats.data ?? [])
                  .slice()
                  .sort((a, b) => a.displayPriority - b.displayPriority)
                  .map((c) =>
                    editingCategoryId === c.id ? (
                      <CategoryForm
                        key={c.id}
                        initialName={c.name}
                        onCreate={(name) => updateCatMut.mutate({ id: c.id, payload: { ...c, name } })}
                        onCancel={() => setEditingCategoryId(null)}
                      />
                    ) : (
                      <div key={c.id} className="flex items-center gap-2 rounded-xl border border-border bg-card p-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{c.name}</div>
                          {c.nameEn ? (
                            <div className="truncate text-[11px] text-muted-foreground" dir="ltr">
                              {c.nameEn}
                            </div>
                          ) : null}
                        </div>
                        <Button type="button" size="icon-sm" variant="ghost" className="text-muted-foreground" aria-label={`ویرایش ${c.name}`} onClick={() => setEditingCategoryId(c.id)}>
                          <Pencil className="size-3.5" aria-hidden />
                        </Button>
                      </div>
                    ),
                  )
              )}
            </div>
          </div>
        </Card>

        {/* Products */}
        <Card className="overflow-hidden">
          <CardHead icon={<Layers3 className="size-4" aria-hidden />} title="محصولات" count={items.data?.length} />
          <div className="space-y-4 p-4">
            <ProductForm categories={cats.data ?? []} />
            <div className="space-y-2">
              {items.isLoading ? (
                <>
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </>
              ) : (items.data ?? []).length === 0 ? (
                <EmptyState compact icon={Layers3} title="محصولی ثبت نشده" description="از فرم بالا اولین محصول را بسازید" />
              ) : (
                (items.data ?? []).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border bg-card p-2.5 text-start outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/50",
                      selectedId === item.id
                        ? "border-primary/40 bg-primary-soft/50 ring-1 ring-primary/20"
                        : "border-border hover:border-border-strong",
                    )}
                  >
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt="" className="size-10 shrink-0 rounded-lg object-cover ring-1 ring-border" />
                    ) : (
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Layers3 className="size-4" aria-hidden />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{item.title}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{item.categoryName}</div>
                    </div>
                    <span className="text-[13px] font-bold text-muted-foreground tabular-nums">
                      {formatToman(item.basePrice)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </Card>

        {/* Editor — full width below xl so the recipe editor has room */}
        <Card className="overflow-hidden md:col-span-2 xl:col-span-1">
          <CardHead icon={<Pencil className="size-4" aria-hidden />} title="ویرایش محصول و رسپی" />
          <div className="p-4">
            {selected ? (
              <ItemEditor key={selected.id} item={selected} inventory={inv.data ?? []} />
            ) : (
              <EmptyState
                compact
                icon={Pencil}
                title="محصولی انتخاب نشده"
                description="برای ویرایش نام، قیمت، افزودنی‌ها و اتصال به انبار، محصولی را انتخاب کنید"
              />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function CardHead({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3.5">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary-soft text-primary">{icon}</span>
        <h2 className="text-sm font-bold">{title}</h2>
      </div>
      {count !== undefined ? (
        <Badge variant="neutral" className="tabular-nums">
          {count}
        </Badge>
      ) : null}
    </div>
  );
}

function CategoryForm({
  onCreate,
  initialName = "",
  onCancel,
}: {
  onCreate: (name: string) => void;
  initialName?: string;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initialName);
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) {
          onCreate(name.trim());
          if (!onCancel) setName("");
        }
      }}
    >
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام دسته جدید…" />
      <Button type="submit" variant={onCancel ? "outline" : "default"} aria-label="ذخیره دسته">
        {onCancel ? <Save className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
      </Button>
      {onCancel ? (
        <Button type="button" variant="ghost" onClick={onCancel}>
          انصراف
        </Button>
      ) : null}
    </form>
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

function ProductForm({ categories }: { categories: Category[] }) {
  const qc = useQueryClient();
  const addons = useQuery({ queryKey: ["addons"], queryFn: () => api.addons(false) });
  const items = useQuery({ queryKey: ["menu", false], queryFn: () => api.menuItems(false) });
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [station, setStation] = useState<TicketStation>("Bar");

  const mut = useMutation({
    mutationFn: async () => {
      const displayPriority =
        Math.max(0, ...(items.data ?? []).filter((item) => item.categoryId === categoryId).map((item) => item.displayPriority)) + 1;
      const id = await api.createMenuItem({
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
      });
      await Promise.all(selectedAddons.map((addonId) => api.attachAddon(id, addonId)));
    },
    onSuccess: () => {
      toast.success("محصول ثبت شد");
      qc.invalidateQueries({ queryKey: ["menu"] });
      setTitle("");
      setNameEn("");
      setPrice("");
      setImageUrl("");
      setSelectedAddons([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      className="grid gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        mut.mutate();
      }}
    >
      <Field label="نام فارسی محصول">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً اسپرسو" />
      </Field>
      <Field label="نام انگلیسی (اختیاری)">
        <Input dir="ltr" className="text-start" value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Espresso" />
      </Field>
      <Field label="قیمت">
        <PriceInput value={price} onChange={setPrice} placeholder="قیمت به تومان" />
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
        <AddonSelector addons={addons.data ?? []} selected={selectedAddons} onChange={setSelectedAddons} />
      </div>
      <Button
        type="submit"
        className="sm:col-span-2"
        loading={mut.isPending}
        disabled={!title.trim() || !price || !categoryId}
      >
        <CirclePlus className="size-4" aria-hidden />
        ثبت محصول
      </Button>
    </form>
  );
}

/* ──────────────────────────────────────────────────────────────── */

function SharedAddonCreator() {
  const qc = useQueryClient();
  const addons = useQuery({ queryKey: ["addons"], queryFn: () => api.addons(false) });
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api.createAddon({
        name,
        extraPrice: Number(price) * 10,
        ticketStation: "Bar",
        displayPriority: (addons.data?.length ?? 0) + 1,
      }),
    onSuccess: () => {
      setName("");
      setPrice("");
      qc.invalidateQueries({ queryKey: ["addons"] });
      toast.success("افزودنی مشترک ساخته شد");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: () =>
      api.updateAddon(editingId!, {
        name,
        extraPrice: Number(price) * 10,
        ticketStation: "Bar",
        displayPriority: 1,
        isActive: true,
      }),
    onSuccess: () => {
      setEditingId(null);
      setName("");
      setPrice("");
      qc.invalidateQueries({ queryKey: ["addons"] });
      toast.success("افزودنی ویرایش شد");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteAddon(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["addons"] });
      qc.invalidateQueries({ queryKey: ["menu"] });
      setDeleteTarget(null);
      toast.success("افزودنی حذف شد");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-5 py-4">
        <div>
          <h2 className="text-[15px] font-bold">افزودنی‌های مشترک</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            یک‌بار ساخته می‌شود و روی چند محصول قابل استفاده است؛ تغییر قیمت فقط یک‌بار انجام می‌شود
          </p>
        </div>
        <Badge variant="neutral" className="tabular-nums">
          {addons.data?.length ?? 0} افزودنی
        </Badge>
      </div>
      <div className="space-y-4 p-5">
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_12rem_auto]">
          <Field label={editingId ? "ویرایش نام افزودنی" : "افزودنی جدید"}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً شیر اضافه" />
          </Field>
          <Field label="قیمت اضافه">
            <PriceInput value={price} onChange={setPrice} placeholder="تومان" />
          </Field>
          {editingId ? (
            <div className="flex gap-2">
              <Button
                loading={update.isPending}
                disabled={!name.trim() || !price}
                onClick={() => update.mutate()}
              >
                ذخیره
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  setName("");
                  setPrice("");
                }}
              >
                انصراف
              </Button>
            </div>
          ) : (
            <Button
              loading={create.isPending}
              disabled={!name.trim() || !price}
              onClick={() => create.mutate()}
            >
              <Plus className="size-4" aria-hidden />
              ساخت افزودنی
            </Button>
          )}
        </div>

        {addons.isLoading ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (addons.data ?? []).length === 0 ? (
          <EmptyState compact icon={Boxes} title="افزودنی مشترکی نیست" description="برای شروع، افزودنی را از فرم بالا بسازید" />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(addons.data ?? []).map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-xl border border-border bg-card p-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{a.name}</div>
                  <div className="text-[11px] text-muted-foreground tabular-nums">{formatToman(a.extraPrice)}</div>
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  aria-label={`ویرایش ${a.name}`}
                  onClick={() => {
                    setEditingId(a.id);
                    setName(a.name);
                    setPrice(String(a.extraPrice / 10));
                  }}
                >
                  <Pencil className="size-3.5" aria-hidden />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground hover:bg-danger/10 hover:text-danger"
                  aria-label={`حذف ${a.name}`}
                  onClick={() => setDeleteTarget(a.id)}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="حذف افزودنی مشترک"
        description="این افزودنی از همه محصولات متصل نیز حذف می‌شود."
        confirmLabel="حذف"
        pending={remove.isPending}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget)}
      />
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────── */

function ItemEditor({
  item,
  inventory,
}: {
  item: MenuItemDto;
  inventory: { id: string; name: string; sku: string }[];
}) {
  const qc = useQueryClient();
  const addons = useQuery({ queryKey: ["addons"], queryFn: () => api.addons(false) });
  const [sharedAddonIds, setSharedAddonIds] = useState<string[]>(() => (item.addons ?? []).map((a) => a.id));
  const [title, setTitle] = useState(item.title);
  const [nameEn, setNameEn] = useState(item.nameEn ?? "");
  const [description, setDescription] = useState(item.description ?? "");
  const [price, setPrice] = useState(String(item.basePrice / 10));
  const [imageUrl, setImageUrl] = useState(item.imageUrl ?? "");
  const [modName, setModName] = useState("");
  const [modPrice, setModPrice] = useState("");
  const [editingMod, setEditingMod] = useState<string | null>(null);
  const [invId, setInvId] = useState("");
  const [qty, setQty] = useState("18");
  const [unit, setUnit] = useState<UnitOfMeasure>("Gr");
  const [confirmDelete, setConfirmDelete] = useState<null | { kind: "product" } | { kind: "modifier"; id: string; name: string }>(null);
  const lines = useMemo(() => item.recipe?.lines ?? [], [item]);

  const update = useMutation({
    mutationFn: () =>
      api.updateMenuItem(item.id, {
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
      }),
    onSuccess: () => {
      toast.success("اطلاعات محصول ذخیره شد");
      qc.invalidateQueries({ queryKey: ["menu"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => api.deleteMenuItem(item.id),
    onSuccess: () => {
      toast.success("محصول حذف شد");
      setConfirmDelete(null);
      qc.invalidateQueries({ queryKey: ["menu"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMod = useMutation({
    mutationFn: async () => {
      if (editingMod) {
        await api.updateModifier(editingMod, {
          name: modName,
          extraPrice: Number(modPrice) * 10,
          ticketStation: item.ticketStation,
          displayPriority: item.modifiers.find((m) => m.id === editingMod)?.displayPriority ?? 1,
          isActive: true,
        });
      } else {
        await api.createModifier({
          menuItemId: item.id,
          name: modName,
          extraPrice: Number(modPrice) * 10,
          ticketStation: item.ticketStation,
          displayPriority: item.modifiers.length + 1,
        });
      }
    },
    onSuccess: () => {
      toast.success(editingMod ? "اضافه ویرایش شد" : "اضافه ثبت شد");
      setModName("");
      setModPrice("");
      setEditingMod(null);
      qc.invalidateQueries({ queryKey: ["menu"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMod = useMutation({
    mutationFn: (id: string) => api.deleteModifier(id),
    onSuccess: () => {
      toast.success("اضافه حذف شد");
      qc.invalidateQueries({ queryKey: ["menu"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveBom = useMutation({
    mutationFn: () =>
      api.upsertRecipe({
        menuItemId: item.id,
        menuItemModifierId: null,
        name: `BOM ${item.title}`,
        lines: invId ? [...lines, { inventoryItemId: invId, quantity: Number(qty), unit }] : lines,
      }),
    onSuccess: () => {
      toast.success("رسپی ذخیره شد");
      setInvId("");
      qc.invalidateQueries({ queryKey: ["menu"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
        <Button loading={update.isPending} onClick={() => update.mutate()}>
          <Save className="size-4" aria-hidden />
          ذخیره تغییرات
        </Button>
      </div>

      {/* Shared addons */}
      <AddonSelector
        addons={addons.data ?? []}
        selected={sharedAddonIds}
        onChange={async (ids) => {
          const added = ids.filter((id) => !sharedAddonIds.includes(id));
          const removed = sharedAddonIds.filter((id) => !ids.includes(id));
          await Promise.all([
            ...added.map((id) => api.attachAddon(item.id, id)),
            ...removed.map((id) => api.detachAddon(item.id, id)),
          ]);
          setSharedAddonIds(ids);
          qc.invalidateQueries({ queryKey: ["menu"] });
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
          onClick={() => saveMod.mutate()}
          disabled={!modName.trim() || !modPrice || saveMod.isPending}
          loading={saveMod.isPending}
        >
          <Plus className="size-4" aria-hidden />
          {editingMod ? "ذخیره ویرایش اضافه" : "افزودن اضافه"}
        </Button>
      </div>

      {/* Recipe / BOM */}
      <div className="space-y-3 rounded-xl border border-border p-3.5">
        <SectionLabel>رسپی و اتصال به انبار</SectionLabel>
        {lines.length > 0 ? (
          <ul className="space-y-1 rounded-lg bg-muted/40 p-2.5">
            {lines.map((l) => (
              <li key={l.inventoryItemId} className="flex items-center justify-between text-[13px]">
                <span>{inventory.find((i) => i.id === l.inventoryItemId)?.name ?? l.inventoryItemId}</span>
                <span className="text-muted-foreground tabular-nums">
                  {l.quantity} {l.unit}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            هنوز ماده‌ای به رسپی وصل نشده؛ پس از اتصال، موجودی هنگام فروش به‌صورت خودکار کم می‌شود.
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <Select value={invId} onValueChange={setInvId}>
            <SelectTrigger>
              <SelectValue placeholder="ماده اولیه از انبار…" />
            </SelectTrigger>
            <SelectContent>
              {inventory.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.name} ({i.sku})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input type="number" inputMode="numeric" className="tabular-nums" value={qty} onChange={(e) => setQty(e.target.value)} aria-label="مقدار مصرف" />
            <Select value={unit} onValueChange={(v) => setUnit(v as UnitOfMeasure)}>
              <SelectTrigger className="w-28 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["Gr", "Ml", "Kg", "Liter", "Count"] as UnitOfMeasure[]).map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          variant="secondary"
          className="w-full"
          loading={saveBom.isPending}
          disabled={!invId || !qty || saveBom.isPending}
          onClick={() => saveBom.mutate()}
        >
          <Save className="size-4" aria-hidden />
          افزودن به رسپی و ذخیره
        </Button>
      </div>

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
        pending={remove.isPending || deleteMod.isPending}
        onConfirm={() => {
          if (confirmDelete?.kind === "modifier") {
            deleteMod.mutate(confirmDelete.id);
          } else if (confirmDelete?.kind === "product") {
            remove.mutate();
          }
        }}
      />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-bold">{children}</h3>;
}
