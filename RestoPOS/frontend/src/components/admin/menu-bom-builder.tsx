"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, Input, Label } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { formatToman } from "@/lib/currency";
import type { MenuItemDto, TicketStation, UnitOfMeasure } from "@/lib/types";

export function MenuBomBuilder() {
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ["categories", true], queryFn: () => api.categories(true) });
  const items = useQuery({ queryKey: ["menu", false], queryFn: () => api.menuItems(false) });
  const inv = useQuery({ queryKey: ["inventory"], queryFn: api.inventory });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.data?.find((i) => i.id === selectedId) ?? null;

  const catMut = useMutation({
    mutationFn: (payload: { name: string }) =>
      api.createCategory({ name: payload.name, nameEn: null, displayPriority: (cats.data?.length ?? 0) + 1, isVisible: true, iconUrl: null, imageUrl: null, parentId: null }),
    onSuccess: () => {
      toast.success("دسته ساخته شد");
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  async function moveCat(id: string, dir: -1 | 1) {
    const list = [...(cats.data ?? [])].sort((a, b) => a.displayPriority - b.displayPriority);
    const idx = list.findIndex((c) => c.id === id);
    const swap = list[idx + dir];
    if (!swap) return;
    await api.updateCategory(list[idx].id, { ...list[idx], displayPriority: swap.displayPriority });
    await api.updateCategory(swap.id, { ...swap, displayPriority: list[idx].displayPriority });
    qc.invalidateQueries({ queryKey: ["categories"] });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr_340px]">
      <Card className="p-4">
        <h2 className="mb-3 font-black">دسته‌ها</h2>
        <CategoryForm onCreate={(name) => catMut.mutate({ name })} />
        <div className="mt-3 space-y-2">
          {(cats.data ?? [])
            .slice()
            .sort((a, b) => a.displayPriority - b.displayPriority)
            .map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border p-2">
                <div>
                  <div className="font-bold">{c.name}</div>
                  <div className="text-[11px] text-muted-foreground">اولویت {c.displayPriority}</div>
                </div>
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
            <button
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              className={`flex w-full items-center justify-between rounded-xl border p-3 text-right ${selectedId === item.id ? "border-primary bg-primary/5" : ""}`}
            >
              <div>
                <div className="font-bold">{item.title}</div>
                <div className="text-xs text-muted-foreground">{item.categoryName}</div>
              </div>
              <div className="text-sm font-bold">{formatToman(item.basePrice)}</div>
            </button>
          ))}
        </div>
      </Card>
      <Card className="p-4">
        {selected ? <ItemEditor item={selected} inventory={inv.data ?? []} /> : <p className="text-sm text-muted-foreground">یک محصول را برای افزودنی و رسپی انتخاب کنید.</p>}
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
  const lines = useMemo(() => item.recipe?.lines ?? [], [item]);

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
      const next = invId
        ? [...lines, { inventoryItemId: invId, quantity: Number(qty), unit }]
        : lines;
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
      setInvId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-black">{item.title}</h3>
        <p className="text-sm">{formatToman(item.basePrice)}</p>
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
      <div>
        <Label>رسپی / اتصال به انبار</Label>
        <ul className="my-2 space-y-1 text-sm">
          {lines.map((l) => (
            <li key={l.inventoryItemId}>
              {inventory.find((i) => i.id === l.inventoryItemId)?.name ?? l.inventoryItemId} — {l.quantity} {l.unit}
            </li>
          ))}
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
      </div>
    </div>
  );
}
