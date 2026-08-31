"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, Input, Label, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { formatToman } from "@/lib/currency";
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
  canvas.getContext("2d")?.drawImage(source, (source.naturalWidth - side) / 2, (source.naturalHeight - side) / 2, side, side, 0, 0, 800, 800);
  return canvas.toDataURL("image/jpeg", 0.86);
}

export function MenuBomBuilder() {
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ["categories", true], queryFn: () => api.categories(true) });
  const items = useQuery({ queryKey: ["menu", false], queryFn: () => api.menuItems(false) });
  const inv = useQuery({ queryKey: ["inventory"], queryFn: api.inventory });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const selected = items.data?.find((i) => i.id === selectedId) ?? null;

  const catMut = useMutation({
    mutationFn: (name: string) => api.createCategory({ name, nameEn: null, displayPriority: (cats.data?.length ?? 0) + 1, isVisible: true, iconUrl: null, imageUrl: null, parentId: null }),
    onSuccess: () => { toast.success("دسته ساخته شد"); qc.invalidateQueries({ queryKey: ["categories"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateCatMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: unknown }) => api.updateCategory(id, payload),
    onSuccess: () => { toast.success("دسته ویرایش شد"); setEditingCategoryId(null); qc.invalidateQueries({ queryKey: ["categories"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteCatMut = useMutation({
    mutationFn: (id: string) => api.deleteCategory(id),
    onSuccess: () => { toast.success("دسته حذف شد"); qc.invalidateQueries({ queryKey: ["categories"] }); qc.invalidateQueries({ queryKey: ["menu"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return <div className="grid gap-4 lg:grid-cols-[280px_1fr_380px]">
    <Card className="p-4"><h2 className="mb-3 font-black">دسته‌ها</h2><CategoryForm onCreate={(name) => catMut.mutate(name)} /><div className="mt-3 space-y-2">{(cats.data ?? []).slice().sort((a, b) => a.displayPriority - b.displayPriority).map((c) => <div key={c.id} className="rounded-xl border p-2">{editingCategoryId === c.id ? <CategoryForm initialName={c.name} onCreate={(name) => updateCatMut.mutate({ id: c.id, payload: { ...c, name } })} onCancel={() => setEditingCategoryId(null)} /> : <div className="flex items-center gap-2"><div className="min-w-0 flex-1"><div className="font-bold">{c.name}</div>{c.nameEn && <div className="text-xs text-muted-foreground">{c.nameEn}</div>}</div><Button type="button" size="sm" variant="outline" onClick={() => setEditingCategoryId(c.id)}>ویرایش</Button><Button type="button" size="sm" variant="destructive" onClick={() => window.confirm("این دسته حذف شود؟") && deleteCatMut.mutate(c.id)}>حذف</Button></div>}</div>)}</div></Card>
    <Card className="p-4"><h2 className="mb-3 font-black">محصولات</h2><ProductForm categories={cats.data ?? []} /><div className="mt-4 space-y-2">{(items.data ?? []).map((item) => <button key={item.id} onClick={() => setSelectedId(item.id)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-right ${selectedId === item.id ? "border-primary bg-primary/5" : ""}`}>{item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="h-12 w-12 rounded-lg object-cover" /> : <div className="h-12 w-12 rounded-lg bg-muted" />}<div className="min-w-0 flex-1"><div className="font-bold">{item.title}</div>{item.nameEn && <div className="text-xs text-muted-foreground">{item.nameEn}</div>}<div className="text-xs text-muted-foreground">{item.categoryName}</div></div><div className="text-sm font-bold">{formatToman(item.basePrice)}</div></button>)}</div></Card>
    <Card className="p-4">{selected ? <ItemEditor item={selected} inventory={inv.data ?? []} /> : <p className="text-sm text-muted-foreground">یک محصول را برای ویرایش و مدیریت اضافات انتخاب کنید.</p>}</Card>
  </div>;
}

function CategoryForm({ onCreate, initialName = "", onCancel }: { onCreate: (name: string) => void; initialName?: string; onCancel?: () => void }) {
  const [name, setName] = useState(initialName);
  return <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { onCreate(name.trim()); if (!onCancel) setName(""); } }}><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام دسته" /><Button type="submit">{onCancel ? "ذخیره" : "+"}</Button>{onCancel && <Button type="button" variant="ghost" onClick={onCancel}>انصراف</Button>}</form>;
}

function ProductForm({ categories }: { categories: Category[] }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(""); const [nameEn, setNameEn] = useState(""); const [price, setPrice] = useState(""); const [imageUrl, setImageUrl] = useState(""); const [categoryId, setCategoryId] = useState(""); const [station, setStation] = useState<TicketStation>("Bar");
  const mut = useMutation({
    mutationFn: () => api.createMenuItem({ title, nameEn: nameEn || null, description: null, basePrice: Number(price) * 10, taxInclusive: false, imageUrl: imageUrl || null, displayPriority: 1, categoryId, isActive: true, ticketStation: station, prepTimeMinutes: 4 }),
    onSuccess: () => { toast.success("محصول ثبت شد"); qc.invalidateQueries({ queryKey: ["menu"] }); setTitle(""); setNameEn(""); setPrice(""); setImageUrl(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  return <form className="grid gap-2 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}><Input placeholder="نام فارسی محصول" value={title} onChange={(e) => setTitle(e.target.value)} /><Input dir="ltr" placeholder="English name" value={nameEn} onChange={(e) => setNameEn(e.target.value)} /><Input placeholder="قیمت (تومان)" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} /><Input dir="ltr" placeholder="آدرس عکس (URL)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} /><Select value={categoryId} onValueChange={setCategoryId}><SelectTrigger><SelectValue placeholder="دسته" /></SelectTrigger><SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><Select value={station} onValueChange={(v) => setStation(v as TicketStation)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Bar">بار</SelectItem><SelectItem value="Kitchen">آشپزخانه</SelectItem><SelectItem value="KitchenAndBar">هر دو</SelectItem></SelectContent></Select><Button className="sm:col-span-2" type="submit" disabled={!title || !price || !categoryId || mut.isPending}>{mut.isPending ? "در حال ثبت..." : "ثبت محصول"}</Button></form>;
}

function ItemEditor({ item, inventory }: { item: MenuItemDto; inventory: { id: string; name: string; sku: string }[] }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(item.title); const [nameEn, setNameEn] = useState(item.nameEn ?? ""); const [description, setDescription] = useState(item.description ?? ""); const [price, setPrice] = useState(String(item.basePrice / 10)); const [imageUrl, setImageUrl] = useState(item.imageUrl ?? "");
  const [modName, setModName] = useState(""); const [modPrice, setModPrice] = useState(""); const [editingMod, setEditingMod] = useState<string | null>(null); const [invId, setInvId] = useState(""); const [qty, setQty] = useState("18"); const [unit, setUnit] = useState<UnitOfMeasure>("Gr");
  const lines = useMemo(() => item.recipe?.lines ?? [], [item]);
  const update = useMutation({ mutationFn: () => api.updateMenuItem(item.id, { title, nameEn: nameEn || null, description: description || null, basePrice: Number(price) * 10, taxInclusive: item.taxInclusive, imageUrl: imageUrl || null, displayPriority: item.displayPriority, categoryId: item.categoryId, isActive: item.isActive, ticketStation: item.ticketStation, prepTimeMinutes: item.prepTimeMinutes }), onSuccess: () => { toast.success("اطلاعات محصول ذخیره شد"); qc.invalidateQueries({ queryKey: ["menu"] }); }, onError: (e: Error) => toast.error(e.message) });
  const remove = useMutation({ mutationFn: () => api.deleteMenuItem(item.id), onSuccess: () => { toast.success("محصول حذف شد"); setEditingMod(null); qc.invalidateQueries({ queryKey: ["menu"] }); }, onError: (e: Error) => toast.error(e.message) });
  const saveMod = useMutation({ mutationFn: async () => { if (editingMod) await api.updateModifier(editingMod, { name: modName, extraPrice: Number(modPrice) * 10, ticketStation: item.ticketStation, displayPriority: item.modifiers.find((m) => m.id === editingMod)?.displayPriority ?? 1, isActive: true }); else await api.createModifier({ menuItemId: item.id, name: modName, extraPrice: Number(modPrice) * 10, ticketStation: item.ticketStation, displayPriority: item.modifiers.length + 1 }); }, onSuccess: () => { toast.success(editingMod ? "اضافه ویرایش شد" : "اضافه ثبت شد"); setModName(""); setModPrice(""); setEditingMod(null); qc.invalidateQueries({ queryKey: ["menu"] }); }, onError: (e: Error) => toast.error(e.message) });
  const deleteMod = useMutation({ mutationFn: (id: string) => api.deleteModifier(id), onSuccess: () => { toast.success("اضافه حذف شد"); qc.invalidateQueries({ queryKey: ["menu"] }); }, onError: (e: Error) => toast.error(e.message) });
  const saveBom = useMutation({ mutationFn: () => api.upsertRecipe({ menuItemId: item.id, menuItemModifierId: null, name: `BOM ${item.title}`, lines: invId ? [...lines, { inventoryItemId: invId, quantity: Number(qty), unit }] : lines }), onSuccess: () => { toast.success("رسپی ذخیره شد"); setInvId(""); qc.invalidateQueries({ queryKey: ["menu"] }); }, onError: (e: Error) => toast.error(e.message) });

  return <div className="space-y-4"><div className="flex items-start gap-3">{item.imageUrl && <img src={item.imageUrl} alt={item.title} className="h-16 w-16 rounded-xl object-cover" />}<div><h3 className="font-black">{item.title}</h3>{item.nameEn && <p className="text-sm text-muted-foreground">{item.nameEn}</p>}<p className="text-sm">{formatToman(item.basePrice)}</p></div></div>
    <div className="grid gap-2"><Label>ویرایش محصول</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="نام فارسی" /><Input dir="ltr" value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="English name" /><Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="قیمت (تومان)" /><Input dir="ltr" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="آدرس عکس (URL)" /><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="توضیحات" /><div className="flex gap-2"><Button className="flex-1" onClick={() => update.mutate()}>ذخیره تغییرات</Button><Button variant="destructive" onClick={() => window.confirm("این محصول حذف شود؟") && remove.mutate()}>حذف محصول</Button></div></div>
    <div className="grid gap-2"><Label>اضافات</Label>{item.modifiers.map((m) => <div key={m.id} className="flex items-center gap-2 rounded-lg border p-2"><Badge>{m.name}</Badge><span className="flex-1 text-xs">{formatToman(m.extraPrice)}</span><Button size="sm" variant="outline" onClick={() => { setEditingMod(m.id); setModName(m.name); setModPrice(String(m.extraPrice / 10)); }}>ویرایش</Button><Button size="sm" variant="destructive" onClick={() => window.confirm("این اضافه حذف شود؟") && deleteMod.mutate(m.id)}>حذف</Button></div>)}<div className="grid grid-cols-2 gap-2"><Input placeholder="نام اضافه" value={modName} onChange={(e) => setModName(e.target.value)} /><Input placeholder="قیمت تومان" value={modPrice} onChange={(e) => setModPrice(e.target.value)} /><Button className="col-span-2" variant="outline" onClick={() => saveMod.mutate()} disabled={!modName || !modPrice}>{editingMod ? "ذخیره ویرایش اضافه" : "افزودن اضافه"}</Button></div></div>
    <div><Label>رسپی / اتصال به انبار</Label><ul className="my-2 space-y-1 text-sm">{lines.map((l) => <li key={l.inventoryItemId}>{inventory.find((i) => i.id === l.inventoryItemId)?.name ?? l.inventoryItemId} — {l.quantity} {l.unit}</li>)}</ul><Select value={invId} onValueChange={setInvId}><SelectTrigger><SelectValue placeholder="ماده اولیه" /></SelectTrigger><SelectContent>{inventory.map((i) => <SelectItem key={i.id} value={i.id}>{i.name} ({i.sku})</SelectItem>)}</SelectContent></Select><div className="mt-2 flex gap-2"><Input value={qty} onChange={(e) => setQty(e.target.value)} /><Select value={unit} onValueChange={(v) => setUnit(v as UnitOfMeasure)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Gr", "Ml", "Kg", "Liter", "Count"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div><Button className="mt-2 w-full" onClick={() => saveBom.mutate()}>ذخیره رسپی</Button></div>
  </div>;
}
