"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, Input, Label } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { formatToman } from "@/lib/currency";
import type { CategoryDto, MenuItemDto, TicketStation, UnitOfMeasure } from "@/lib/types";

export function MenuBomBuilder() {
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ["categories", true], queryFn: () => api.categories(true) });
  const items = useQuery({ queryKey: ["menu", false], queryFn: () => api.menuItems(false) });
  const inv = useQuery({ queryKey: ["inventory"], queryFn: api.inventory });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const selected = items.data?.find((i) => i.id === selectedId) ?? null;

  const sortedCats = useMemo(
    () => [...(cats.data ?? [])].sort((a, b) => a.displayPriority - b.displayPriority),
    [cats.data],
  );

  const catMut = useMutation({
    mutationFn: (payload: { name: string }) =>
      api.createCategory({
        name: payload.name,
        nameEn: null,
        displayPriority: (cats.data?.length ?? 0) + 1,
        isVisible: true,
        iconUrl: null,
        imageUrl: null,
        parentId: null,
      }),
    onSuccess: () => {
      toast.success("دسته ساخته شد");
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  async function moveCat(id: string, dir: -1 | 1) {
    const list = [...sortedCats];
    const idx = list.findIndex((c) => c.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return;
    [list[idx], list[swapIdx]] = [list[swapIdx], list[idx]];
    try {
      await api.reorderCategories(list.map((c) => c.id));
      toast.success("ترتیب دسته‌ها ذخیره شد");
      qc.invalidateQueries({ queryKey: ["categories"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در جابجایی");
    }
  }

  const soldOutMut = useMutation({
    mutationFn: ({ id, isSoldOut }: { id: string; isSoldOut: boolean }) => api.toggleSoldOut(id, isSoldOut),
    onSuccess: () => {
      toast.success("وضعیت اتمام به‌روز شد");
      qc.invalidateQueries({ queryKey: ["menu"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr_340px]">
      <Card className="p-4">
        <h2 className="mb-3 font-black">دسته‌ها</h2>
        <CategoryForm onCreate={(name) => catMut.mutate({ name })} />
        {editingCatId ? (
          <CategoryEditForm
            categoryId={editingCatId}
            onClose={() => setEditingCatId(null)}
            onSaved={() => {
              setEditingCatId(null);
              qc.invalidateQueries({ queryKey: ["categories"] });
            }}
          />
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
                  onClick={() => soldOutMut.mutate({ id: item.id, isSoldOut: !item.isSoldOut })}
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
  onSaved,
}: {
  categoryId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const detail = useQuery({
    queryKey: ["category", categoryId],
    queryFn: () => api.categoryById(categoryId),
  });
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

  const mut = useMutation({
    mutationFn: () => {
      const base: CategoryDto = detail.data!;
      return api.updateCategory(categoryId, {
        ...base,
        name: name.trim(),
        nameEn: nameEn.trim() || null,
        displayPriority: Number(priority) || base.displayPriority,
        isVisible: visible,
      });
    },
    onSuccess: () => {
      toast.success("دسته به‌روز شد");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
      <Button className="w-full" onClick={() => mut.mutate()} disabled={!name.trim() || mut.isPending}>
        ذخیره دسته
      </Button>
    </div>
  );
}

function ProductForm({ categories }: { categories: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [station, setStation] = useState<TicketStation>("Bar");
  const mut = useMutation({
    mutationFn: () =>
      api.createMenuItem({
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
      }),
    onSuccess: () => {
      toast.success("محصول ثبت شد");
      qc.invalidateQueries({ queryKey: ["menu"] });
      setTitle("");
      setPrice("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <form
      className="grid grid-cols-2 gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        mut.mutate();
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
  const qc = useQueryClient();
  const [modName, setModName] = useState("");
  const [modPrice, setModPrice] = useState("");
  const [invId, setInvId] = useState("");
  const [qty, setQty] = useState("18");
  const [unit, setUnit] = useState<UnitOfMeasure>("Gr");

  const recipeQ = useQuery({
    queryKey: ["recipe", item.id],
    queryFn: () => api.getRecipe(item.id),
  });
  const groupsQ = useQuery({
    queryKey: ["modifier-groups", item.id],
    queryFn: () => api.modifierGroups(item.id),
  });

  const lines = useMemo(
    () => recipeQ.data?.lines ?? item.recipe?.lines ?? [],
    [recipeQ.data, item.recipe],
  );

  const addMod = useMutation({
    mutationFn: () =>
      api.createModifier({
        menuItemId: item.id,
        name: modName,
        extraPrice: Number(modPrice) * 10,
        ticketStation: item.ticketStation,
        displayPriority: item.modifiers.length + 1,
      }),
    onSuccess: () => {
      toast.success("افزودنی ثبت شد");
      qc.invalidateQueries({ queryKey: ["menu"] });
      setModName("");
      setModPrice("");
    },
  });

  const saveBom = useMutation({
    mutationFn: async () => {
      const next = invId ? [...lines, { inventoryItemId: invId, quantity: Number(qty), unit }] : lines;
      return api.upsertRecipe({
        menuItemId: item.id,
        menuItemModifierId: null,
        name: `BOM ${item.title}`,
        lines: next,
      });
    },
    onSuccess: () => {
      toast.success("رسپی ذخیره شد");
      qc.invalidateQueries({ queryKey: ["menu"] });
      qc.invalidateQueries({ queryKey: ["recipe", item.id] });
      setInvId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteBom = useMutation({
    mutationFn: (id: string) => api.deleteRecipe(id),
    onSuccess: () => {
      toast.success("رسپی حذف شد");
      qc.invalidateQueries({ queryKey: ["menu"] });
      qc.invalidateQueries({ queryKey: ["recipe", item.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
        <Button className="col-span-2" variant="outline" onClick={() => addMod.mutate()} disabled={!modName || !modPrice}>
          افزودن Modifier
        </Button>
      </div>

      <ModifierGroupsPanel
        menuItemId={item.id}
        ticketStation={item.ticketStation}
        groups={groupsQ.data ?? []}
        onChanged={() => qc.invalidateQueries({ queryKey: ["modifier-groups", item.id] })}
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
        <Button className="mt-2 w-full" onClick={() => saveBom.mutate()}>
          ذخیره BOM
        </Button>
        {recipeQ.data?.id ? (
          <Button
            className="mt-2 w-full"
            variant="destructive"
            onClick={() => deleteBom.mutate(recipeQ.data!.id)}
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
  onChanged,
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
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [minSel, setMinSel] = useState("0");
  const [maxSel, setMaxSel] = useState("1");
  const [required, setRequired] = useState(false);
  const [optName, setOptName] = useState("");
  const [optPrice, setOptPrice] = useState("");
  const [optGroupId, setOptGroupId] = useState("");

  const createMut = useMutation({
    mutationFn: () =>
      api.createModifierGroup({
        menuItemId,
        name: name.trim(),
        minSelections: Number(minSel) || 0,
        maxSelections: Number(maxSel) || 1,
        isRequired: required,
        displayPriority: groups.length + 1,
      }),
    onSuccess: () => {
      toast.success("گروه افزودنی ساخته شد");
      setName("");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (g: (typeof groups)[0]) =>
      api.updateModifierGroup(g.id, {
        name: g.name,
        minSelections: g.minSelections,
        maxSelections: g.maxSelections,
        isRequired: g.isRequired,
        displayPriority: g.displayPriority,
        isActive: !g.isActive,
      }),
    onSuccess: () => {
      toast.success("گروه به‌روز شد");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteModifierGroup(id),
    onSuccess: () => {
      toast.success("گروه حذف شد");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addOptMut = useMutation({
    mutationFn: () =>
      api.addModifierGroupOption(optGroupId, {
        name: optName.trim(),
        extraPrice: Number(optPrice) * 10,
        ticketStation,
        displayPriority: (groups.find((g) => g.id === optGroupId)?.options.length ?? 0) + 1,
      }),
    onSuccess: () => {
      toast.success("گزینه اضافه شد");
      setOptName("");
      setOptPrice("");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
                <Button size="sm" variant="outline" onClick={() => updateMut.mutate(g)}>
                  {g.isActive ? "غیرفعال" : "فعال"}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => deleteMut.mutate(g.id)}>
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
        <Button className="col-span-2" variant="outline" disabled={!name.trim()} onClick={() => createMut.mutate()}>
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
          onClick={() => addOptMut.mutate()}
        >
          افزودن گزینه به گروه
        </Button>
      </div>
    </div>
  );
}
