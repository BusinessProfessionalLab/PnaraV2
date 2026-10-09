"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useCategories,
  useCategory,
  useCreateCategory,
  useCreateMenuItem,
  useCreateModifier,
  useCreateModifierGroup,
  useDeleteModifierGroup,
  useDeleteRecipe,
  useInventory,
  useMenuItems,
  useModifierGroups,
  useRecipe,
  useReorderCategories,
  useToggleSoldOut,
  useUpdateCategory,
  useUpdateModifierGroup,
  useAddModifierGroupOption,
  useUpsertRecipe,
} from "@/api";
import { formatToman } from "@/lib/currency";
import type { CategoryDto, MenuItemDto, TicketStation, UnitOfMeasure } from "@/lib/types";

export function MenuBomBuilder() {
  const cats = useCategories(true);
  const items = useMenuItems(false);
  const inv = useInventory();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const selected = items.data?.find((i) => i.id === selectedId) ?? null;

  const sortedCats = useMemo(
    () => [...(cats.data ?? [])].sort((a, b) => a.displayPriority - b.displayPriority),
    [cats.data],
  );

  const catMut = useCreateCategory();
  const reorderMut = useReorderCategories();
  const soldOutMut = useToggleSoldOut();

  const createCategory = (name: string) =>
    catMut.mutate(
      {
        name,
        nameEn: null,
        displayPriority: (cats.data?.length ?? 0) + 1,
        isVisible: true,
        iconUrl: null,
        imageUrl: null,
        parentId: null,
      },
      { onSuccess: () => toast.success("دسته ساخته شد") },
    );

  async function moveCat(id: string, dir: -1 | 1) {
    const list = [...sortedCats];
    const idx = list.findIndex((c) => c.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return;
    [list[idx], list[swapIdx]] = [list[swapIdx], list[idx]];
    try {
      await reorderMut.mutateAsync(list.map((c) => c.id));
      toast.success("ترتیب دسته‌ها ذخیره شد");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در جابجایی");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr_340px]">
      <Card className="p-4">
        <h2 className="mb-3 font-black">دسته‌ها</h2>
        <CategoryForm onCreate={createCategory} />
        {editingCatId ? (
          <CategoryEditForm categoryId={editingCatId} onClose={() => setEditingCatId(null)} />
        ) : null}
        <div className="mt-3 space-y-2">
          {sortedCats.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border p-2">
              <button type="button" className="text-right" onClick={() => setEditingCatId(c.id)}>
                <div className="font-bold">{c.name}</div>
                <div className="text-[11px] text-muted-foreground">اولویت {c.displayPriority}</div>
              </button>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => moveCat(c.id, -1)}>
                  ↑
                </Button>
                <Button size="sm" variant="outline" onClick={() => moveCat(c.id, 1)}>
                  ↓
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-4">
        <h2 className="mb-3 font-black">محصولات</h2>
        <ProductForm categories={cats.data ?? []} />
        <div className="mt-4 space-y-2">
          {(items.data ?? []).map((item) => (
            <div
              key={item.id}
              className={`flex w-full items-center justify-between rounded-xl border p-3 ${selectedId === item.id ? "border-primary bg-primary/5" : ""}`}
            >
              <button type="button" className="flex-1 text-right" onClick={() => setSelectedId(item.id)}>
                <div className="font-bold">{item.title}</div>
                <div className="text-xs text-muted-foreground">{item.categoryName}</div>
              </button>
              <div className="flex flex-col items-end gap-1">
                <div className="text-sm font-bold">{formatToman(item.basePrice)}</div>
                <Button
                  size="sm"
                  variant={item.isSoldOut ? "destructive" : "outline"}
                  onClick={() =>
                    soldOutMut.mutate(
                      { id: item.id, isSoldOut: !item.isSoldOut },
                      {
                        onSuccess: () => toast.success("وضعیت اتمام به‌روز شد"),
                        onError: (e: Error) => toast.error(e.message),
                      },
                    )
                  }
                >
                  {item.isSoldOut ? "اتمام یافت" : "موجود"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-4">
        {selected ? (
          <ItemEditor item={selected} inventory={inv.data ?? []} />
        ) : (
          <p className="text-sm text-muted-foreground">یک محصول را برای افزودنی و رسپی انتخاب کنید.</p>
        )}
      </Card>
    </div>
  );
}

function CategoryForm({ onCreate }: { onCreate: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onCreate(name.trim());
        setName("");
      }}
    >
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام دسته" />
      <Button type="submit">+</Button>
    </form>
  );
}

function CategoryEditForm({
  categoryId,
  onClose,
}: {
  categoryId: string;
  onClose: () => void;
}) {
  const detail = useCategory(categoryId);
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [priority, setPriority] = useState("1");
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!detail.data) return;
    setName(detail.data.name);
    setNameEn(detail.data.nameEn ?? "");
    setPriority(String(detail.data.displayPriority));
    setVisible(detail.data.isVisible);
  }, [detail.data]);

  const mut = useUpdateCategory();

  const saveCategory = () => {
    const base: CategoryDto | undefined = detail.data;
    if (!base) return;
    mut.mutate(
      {
        id: categoryId,
        payload: {
          ...base,
          name: name.trim(),
          nameEn: nameEn.trim() || null,
          displayPriority: Number(priority) || base.displayPriority,
          isVisible: visible,
        },
      },
      {
        onSuccess: () => {
          toast.success("دسته به‌روز شد");
          onClose();
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  if (detail.isLoading) return <p className="mt-3 text-xs text-muted-foreground">در حال بارگذاری دسته…</p>;

  return (
    <div className="mt-3 space-y-2 rounded-xl border p-3">
      <div className="flex items-center justify-between">
        <Label>ویرایش دسته</Label>
        <Button size="sm" variant="ghost" onClick={onClose}>
          بستن
        </Button>
      </div>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام" />
      <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="نام انگلیسی" />
      <Input value={priority} onChange={(e) => setPriority(e.target.value)} placeholder="اولویت نمایش" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
        قابل مشاهده
      </label>
      <Button className="w-full" onClick={saveCategory} disabled={!name.trim() || mut.isPending}>
        ذخیره دسته
      </Button>
    </div>
  );
}

function ProductForm({ categories }: { categories: { id: string; name: string }[] }) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [station, setStation] = useState<TicketStation>("Bar");
  const mut = useCreateMenuItem();

  const submitProduct = () =>
    mut.mutate(
      {
        title,
        description: null,
        basePrice: Number(price) * 10,
        taxInclusive: false,
        imageUrl: null,
        displayPriority: 1,
        categoryId,
        isActive: true,
        ticketStation: station,
        prepTimeMinutes: 4,
      },
      {
        onSuccess: () => {
          toast.success("محصول ثبت شد");
          setTitle("");
          setPrice("");
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );

  return (
    <form
      className="grid grid-cols-2 gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submitProduct();
      }}
    >
      <Input placeholder="نام محصول" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Input placeholder="قیمت (تومان)" value={price} onChange={(e) => setPrice(e.target.value)} />
      <Select value={categoryId} onValueChange={setCategoryId}>
        <SelectTrigger>
          <SelectValue placeholder="دسته" />
        </SelectTrigger>
        <SelectContent>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
      <Button className="col-span-2" type="submit" disabled={!title || !price || !categoryId}>
        ثبت محصول
      </Button>
    </form>
  );
}

function ItemEditor({
  item,
  inventory,
}: {
  item: MenuItemDto;
  inventory: { id: string; name: string; sku: string }[];
}) {
  const [modName, setModName] = useState("");
  const [modPrice, setModPrice] = useState("");
  const [invId, setInvId] = useState("");
  const [qty, setQty] = useState("18");
  const [unit, setUnit] = useState<UnitOfMeasure>("Gr");

  const recipeQ = useRecipe(item.id);
  const groupsQ = useModifierGroups(item.id);

  const lines = useMemo(
    () => recipeQ.data?.lines ?? item.recipe?.lines ?? [],
    [recipeQ.data, item.recipe],
  );

  const addMod = useCreateModifier();
  const saveBom = useUpsertRecipe();
  const deleteBom = useDeleteRecipe();

  const submitModifier = () =>
    addMod.mutate(
      {
        menuItemId: item.id,
        name: modName,
        extraPrice: Number(modPrice) * 10,
        ticketStation: item.ticketStation,
        displayPriority: item.modifiers.length + 1,
      },
      {
        onSuccess: () => {
          toast.success("افزودنی ثبت شد");
          setModName("");
          setModPrice("");
        },
      },
    );

  const submitBom = () => {
    const next = invId ? [...lines, { inventoryItemId: invId, quantity: Number(qty), unit }] : lines;
    saveBom.mutate(
      {
        menuItemId: item.id,
        menuItemModifierId: null,
        name: `BOM ${item.title}`,
        lines: next,
      },
      {
        onSuccess: () => {
          toast.success("رسپی ذخیره شد");
          setInvId("");
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-black">{item.title}</h3>
        <p className="text-sm">{formatToman(item.basePrice)}</p>
        {item.isSoldOut ? <Badge variant="danger">اتمام موجودی</Badge> : null}
        <div className="mt-2 flex flex-wrap gap-1">
          {item.modifiers.map((m) => (
            <Badge key={m.id}>
              {m.name} +{formatToman(m.extraPrice)}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="افزودنی" value={modName} onChange={(e) => setModName(e.target.value)} />
        <Input placeholder="قیمت تومان" value={modPrice} onChange={(e) => setModPrice(e.target.value)} />
        <Button className="col-span-2" variant="outline" onClick={submitModifier} disabled={!modName || !modPrice}>
          افزودن Modifier
        </Button>
      </div>

      <ModifierGroupsPanel
        menuItemId={item.id}
        ticketStation={item.ticketStation}
        groups={groupsQ.data ?? []}
      />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>رسپی / اتصال به انبار</Label>
          <Button
            size="sm"
            variant="outline"
            onClick={() => recipeQ.refetch()}
            disabled={recipeQ.isFetching}
          >
            تازه‌سازی
          </Button>
        </div>
        {recipeQ.data?.name ? (
          <p className="mb-1 text-xs text-muted-foreground">{recipeQ.data.name}</p>
        ) : null}
        <ul className="my-2 space-y-1 text-sm">
          {lines.map((l) => (
            <li key={`${l.inventoryItemId}-${l.quantity}-${l.unit}`}>
              {inventory.find((i) => i.id === l.inventoryItemId)?.name ?? l.inventoryItemId} — {l.quantity} {l.unit}
            </li>
          ))}
          {!lines.length ? <li className="text-muted-foreground">ردیفی ثبت نشده</li> : null}
        </ul>
        <Select value={invId} onValueChange={setInvId}>
          <SelectTrigger>
            <SelectValue placeholder="ماده اولیه" />
          </SelectTrigger>
          <SelectContent>
            {inventory.map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.name} ({i.sku})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="mt-2 flex gap-2">
          <Input value={qty} onChange={(e) => setQty(e.target.value)} />
          <Select value={unit} onValueChange={(v) => setUnit(v as UnitOfMeasure)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["Gr", "Ml", "Kg", "Liter", "Count"].map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button className="mt-2 w-full" onClick={submitBom}>
          ذخیره BOM
        </Button>
        {recipeQ.data?.id ? (
          <Button
            className="mt-2 w-full"
            variant="destructive"
            onClick={() =>
              deleteBom.mutate(recipeQ.data!.id, {
                onSuccess: () => toast.success("رسپی حذف شد"),
                onError: (e: Error) => toast.error(e.message),
              })
            }
          >
            حذف رسپی
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ModifierGroupsPanel({
  menuItemId,
  ticketStation,
  groups,
}: {
  menuItemId: string;
  ticketStation: TicketStation;
  groups: {
    id: string;
    name: string;
    minSelections: number;
    maxSelections: number;
    isRequired: boolean;
    displayPriority: number;
    isActive: boolean;
    options: { id: string; name: string; extraPrice: number }[];
  }[];
}) {
  const [name, setName] = useState("");
  const [minSel, setMinSel] = useState("0");
  const [maxSel, setMaxSel] = useState("1");
  const [required, setRequired] = useState(false);
  const [optName, setOptName] = useState("");
  const [optPrice, setOptPrice] = useState("");
  const [optGroupId, setOptGroupId] = useState("");

  const createMut = useCreateModifierGroup();
  const updateMut = useUpdateModifierGroup();
  const deleteMut = useDeleteModifierGroup();
  const addOptMut = useAddModifierGroupOption();

  const createGroup = () =>
    createMut.mutate(
      {
        menuItemId,
        name: name.trim(),
        minSelections: Number(minSel) || 0,
        maxSelections: Number(maxSel) || 1,
        isRequired: required,
        displayPriority: groups.length + 1,
      },
      {
        onSuccess: () => {
          toast.success("گروه افزودنی ساخته شد");
          setName("");
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );

  const toggleGroup = (g: (typeof groups)[0]) =>
    updateMut.mutate(
      {
        id: g.id,
        payload: {
          name: g.name,
          minSelections: g.minSelections,
          maxSelections: g.maxSelections,
          isRequired: g.isRequired,
          displayPriority: g.displayPriority,
          isActive: !g.isActive,
        },
      },
      {
        onSuccess: () => toast.success("گروه به‌روز شد"),
        onError: (e: Error) => toast.error(e.message),
      },
    );

  const removeGroup = (id: string) =>
    deleteMut.mutate(id, {
      onSuccess: () => toast.success("گروه حذف شد"),
      onError: (e: Error) => toast.error(e.message),
    });

  const addOption = () =>
    addOptMut.mutate(
      {
        groupId: optGroupId,
        payload: {
          name: optName.trim(),
          extraPrice: Number(optPrice) * 10,
          ticketStation,
          displayPriority: (groups.find((g) => g.id === optGroupId)?.options.length ?? 0) + 1,
        },
      },
      {
        onSuccess: () => {
          toast.success("گزینه اضافه شد");
          setOptName("");
          setOptPrice("");
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );

  return (
    <div className="space-y-2 rounded-xl border p-3">
      <Label>گروه‌های افزودنی</Label>
      <div className="space-y-2">
        {groups.map((g) => (
          <div key={g.id} className="rounded-lg border p-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-bold">{g.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {g.minSelections}–{g.maxSelections}
                  {g.isRequired ? " · الزامی" : ""}
                  {!g.isActive ? " · غیرفعال" : ""}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => toggleGroup(g)}>
                  {g.isActive ? "غیرفعال" : "فعال"}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => removeGroup(g.id)}>
                  حذف
                </Button>
              </div>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {g.options.map((o) => (
                <Badge key={o.id}>
                  {o.name} +{formatToman(o.extraPrice)}
                </Badge>
              ))}
            </div>
          </div>
        ))}
        {!groups.length ? <p className="text-xs text-muted-foreground">گروهی تعریف نشده</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Input className="col-span-2" placeholder="نام گروه" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="حداقل انتخاب" value={minSel} onChange={(e) => setMinSel(e.target.value)} />
        <Input placeholder="حداکثر انتخاب" value={maxSel} onChange={(e) => setMaxSel(e.target.value)} />
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          الزامی
        </label>
        <Button className="col-span-2" variant="outline" disabled={!name.trim()} onClick={createGroup}>
          ساخت گروه
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t pt-2">
        <div className="col-span-2">
          <Select value={optGroupId} onValueChange={setOptGroupId}>
            <SelectTrigger>
              <SelectValue placeholder="گروه برای گزینه" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input placeholder="نام گزینه" value={optName} onChange={(e) => setOptName(e.target.value)} />
        <Input placeholder="قیمت تومان" value={optPrice} onChange={(e) => setOptPrice(e.target.value)} />
        <Button
          className="col-span-2"
          variant="outline"
          disabled={!optGroupId || !optName.trim() || !optPrice}
          onClick={addOption}
        >
          افزودن گزینه به گروه
        </Button>
      </div>
    </div>
  );
}
