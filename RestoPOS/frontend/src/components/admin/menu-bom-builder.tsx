"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, Input, Label, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { Coins, ImagePlus } from "lucide-react";
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

/** Strip non-digits and format with thousands separator for display */
function formatPriceInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("en-US");
}

function PriceInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Input
        dir="ltr"
        inputMode="numeric"
        placeholder={placeholder}
        className="h-11 pr-14 text-left text-sm font-medium tabular-nums"
        value={formatPriceInput(value)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      />
      <span className="pointer-events-none absolute start-3 top-1/2 flex -translate-y-1/2 items-center gap-1 text-xs text-muted-foreground">
        <Coins className="h-3.5 w-3.5" />
        ریال
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
      <label className="group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4 transition-colors hover:border-primary/40 hover:bg-primary/[0.02]">
        {value ? (
          <>
            <img
              src={value}
              alt="پیش‌نمایش"
              className="h-20 w-20 rounded-lg object-cover outline outline-1 outline-black/10 transition-transform group-hover:scale-[1.02]"
            />
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ImagePlus className="h-3 w-3" />
              <span>برای تعویض کلیک کنید</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 transition-colors group-hover:bg-primary/10">
              <ImagePlus className="h-5 w-5 text-slate-400 transition-colors group-hover:text-primary" />
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-slate-600">عکس محصول</p>
              <p className="text-[10px] text-muted-foreground">برش خودکار ۱:۱</p>
            </div>
          </>
        )}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </label>
    </div>
  );
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

  return <div className="space-y-4">
    <SharedAddonCreator />
    <div className="grid gap-4 lg:grid-cols-[280px_1fr_380px]">
    <Card className="p-4"><h2 className="mb-3 font-black">دسته‌ها</h2><CategoryForm onCreate={(name) => catMut.mutate(name)} /><div className="mt-3 space-y-2">{(cats.data ?? []).slice().sort((a, b) => a.displayPriority - b.displayPriority).map((c) => <div key={c.id} className="rounded-xl border p-2">{editingCategoryId === c.id ? <CategoryForm initialName={c.name} onCreate={(name) => updateCatMut.mutate({ id: c.id, payload: { ...c, name } })} onCancel={() => setEditingCategoryId(null)} /> : <div className="flex items-center gap-2"><div className="min-w-0 flex-1"><div className="font-bold">{c.name}</div>{c.nameEn && <div className="text-xs text-muted-foreground">{c.nameEn}</div>}</div><Button type="button" size="sm" variant="outline" onClick={() => setEditingCategoryId(c.id)}>ویرایش</Button><Button type="button" size="sm" variant="destructive" onClick={() => window.confirm("این دسته حذف شود؟") && deleteCatMut.mutate(c.id)}>حذف</Button></div>}</div>)}</div></Card>
    <Card className="p-4"><h2 className="mb-3 font-black">محصولات</h2><ProductForm categories={cats.data ?? []} /><div className="mt-4 space-y-2">{(items.data ?? []).map((item) => <button key={item.id} onClick={() => setSelectedId(item.id)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-right ${selectedId === item.id ? "border-primary bg-primary/5" : ""}`}>{item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="h-12 w-12 rounded-lg object-cover outline outline-1 outline-black/10" /> : <div className="h-12 w-12 rounded-lg bg-muted" />}<div className="min-w-0 flex-1"><div className="font-bold">{item.title}</div>{item.nameEn && <div className="text-xs text-muted-foreground">{item.nameEn}</div>}<div className="text-xs text-muted-foreground">{item.categoryName}</div></div><div className="text-sm font-bold">{formatToman(item.basePrice)}</div></button>)}</div></Card>
    <Card className="p-4">{selected ? <ItemEditor item={selected} inventory={inv.data ?? []} /> : <p className="text-sm text-muted-foreground">یک محصول را برای ویرایش و مدیریت اضافات انتخاب کنید.</p>}</Card>
    </div>
  </div>;
}

function CategoryForm({ onCreate, initialName = "", onCancel }: { onCreate: (name: string) => void; initialName?: string; onCancel?: () => void }) {
  const [name, setName] = useState(initialName);
  return <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { onCreate(name.trim()); if (!onCancel) setName(""); } }}><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام دسته" /><Button type="submit">{onCancel ? "ذخیره" : "+"}</Button>{onCancel && <Button type="button" variant="ghost" onClick={onCancel}>انصراف</Button>}</form>;
}

function SharedAddonCreator() {
  const qc = useQueryClient();
  const addons = useQuery({ queryKey: ["addons"], queryFn: () => api.addons(false) });
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const update = useMutation({ mutationFn: () => api.updateAddon(editingId!, { name, extraPrice: Number(price) * 10, ticketStation: "Bar", displayPriority: 1, isActive: true }), onSuccess: () => { setEditingId(null); setName(""); setPrice(""); qc.invalidateQueries({ queryKey: ["addons"] }); toast.success("افزودنی ویرایش شد"); }, onError: (e: Error) => toast.error(e.message) });
  const remove = useMutation({ mutationFn: (id: string) => api.deleteAddon(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["addons"] }); qc.invalidateQueries({ queryKey: ["menu"] }); toast.success("افزودنی حذف شد"); }, onError: (e: Error) => toast.error(e.message) });
  const create = useMutation({
    mutationFn: () => api.createAddon({ name, extraPrice: Number(price) * 10, ticketStation: "Bar", displayPriority: (addons.data?.length ?? 0) + 1 }),
    onSuccess: () => { setName(""); setPrice(""); qc.invalidateQueries({ queryKey: ["addons"] }); toast.success("افزودنی مشترک ساخته شد"); },
    onError: (e: Error) => toast.error(e.message),
  });
  return <Card className="p-4"><div className="flex items-center justify-between gap-2"><div><h2 className="font-black">ساخت افزودنی مشترک</h2><p className="text-xs text-muted-foreground">هر افزودنی یک‌بار ساخته می‌شود و برای چند محصول قابل انتخاب است.</p></div><Badge variant="outline">{addons.data?.length ?? 0} افزودنی</Badge></div><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_180px_auto]"><Input placeholder="نام افزودنی" value={name} onChange={(e) => setName(e.target.value)} /><PriceInput value={price} onChange={setPrice} placeholder="قیمت به ریال" /><Button onClick={() => editingId ? update.mutate() : create.mutate()} disabled={!name.trim() || !price || create.isPending || update.isPending}>{editingId ? "ذخیره ویرایش" : "ساخت افزودنی"}</Button></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{(addons.data ?? []).map((a) => <div key={a.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm"><span className="flex-1">{a.name} · {formatToman(a.extraPrice)}</span><Button size="sm" variant="outline" onClick={() => { setEditingId(a.id); setName(a.name); setPrice(String(a.extraPrice / 10)); }}>ویرایش</Button><Button size="sm" variant="destructive" onClick={() => window.confirm("این افزودنی حذف شود؟") && remove.mutate(a.id)}>حذف</Button></div>)}</div></Card>;
}

function SharedAddonManager({ selectedItemId }: { selectedItemId: string | null }) {
  const qc = useQueryClient();
  const addons = useQuery({ queryKey: ["addons"], queryFn: () => api.addons(false) });
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const create = useMutation({
    mutationFn: () => api.createAddon({ name, extraPrice: Number(price) * 10, ticketStation: "Bar", displayPriority: (addons.data?.length ?? 0) + 1 }),
    onSuccess: () => { setName(""); setPrice(""); qc.invalidateQueries({ queryKey: ["addons"] }); toast.success("افزودنی مشترک ساخته شد"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const attach = useMutation({
    mutationFn: (addonId: string) => api.attachAddon(selectedItemId!, addonId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["menu"] }); toast.success("افزودنی به محصول وصل شد"); },
    onError: (e: Error) => toast.error(e.message),
  });
  return <Card className="p-4 lg:col-start-1"><h2 className="mb-2 font-black">افزودنی‌های مشترک</h2><p className="mb-3 text-xs text-muted-foreground">یک قیمت برای چند محصول؛ تغییر قیمت فقط یک‌بار.</p><div className="grid gap-2"><Input placeholder="نام افزودنی" value={name} onChange={(e) => setName(e.target.value)} /><PriceInput value={price} onChange={setPrice} placeholder="قیمت" /><Button onClick={() => create.mutate()} disabled={!name || !price || create.isPending}>ساخت افزودنی</Button></div><div className="mt-3 space-y-1">{(addons.data ?? []).map((a) => <div key={a?.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm"><span className="flex-1">{a?.title} · {formatToman(a?.basePrice ?? 0)}</span><Button size="sm" variant="outline" disabled={!selectedItemId} onClick={() => a && attach.mutate(a.id)}>اتصال</Button></div>)}</div></Card>;
}

function AddonSelector({ addons, selected, onChange }: { addons: import("@/lib/types").AddonDto[]; selected: string[]; onChange: (ids: string[]) => void }) {
  return <details className="sm:col-span-2 rounded-xl border p-3" open={selected.length > 0}><summary className="cursor-pointer list-none font-bold">افزودنی‌های مشترک این محصول <span className="text-xs font-normal text-muted-foreground">{selected.length ? `(${selected.length} انتخاب شده)` : "(انتخاب چندتایی)"}</span></summary><div className="mt-3 grid gap-2 sm:grid-cols-2">{addons.map((a) => <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm"><input type="checkbox" checked={selected.includes(a.id)} onChange={(e) => onChange(e.target.checked ? [...selected, a.id] : selected.filter((id) => id !== a.id))} /><span className="flex-1">{a.name}</span><span>{formatToman(a.extraPrice)}</span></label>)}</div>{addons.length === 0 && <p className="mt-2 text-xs text-muted-foreground">ابتدا یک افزودنی مشترک بسازید.</p>}</details>;
}

function ProductForm({ categories }: { categories: Category[] }) {
  const qc = useQueryClient();
  const addons = useQuery({ queryKey: ["addons"], queryFn: () => api.addons(false) });
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [title, setTitle] = useState(""); const [nameEn, setNameEn] = useState(""); const [price, setPrice] = useState(""); const [imageUrl, setImageUrl] = useState(""); const [categoryId, setCategoryId] = useState(""); const [priority, setPriority] = useState("1"); const [station, setStation] = useState<TicketStation>("Bar");
  const mut = useMutation({
    mutationFn: async () => { const id = await api.createMenuItem({ title, nameEn: nameEn || null, description: null, basePrice: Number(price) * 10, taxInclusive: false, imageUrl: imageUrl || null, displayPriority: Number(priority) || 1, categoryId, isActive: true, ticketStation: station, prepTimeMinutes: 4 }); await Promise.all(selectedAddons.map((addonId) => api.attachAddon(id, addonId))); },
    onSuccess: () => { toast.success("محصول ثبت شد"); qc.invalidateQueries({ queryKey: ["menu"] }); setTitle(""); setNameEn(""); setPrice(""); setImageUrl(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  return <><AddonSelector addons={addons.data ?? []} selected={selectedAddons} onChange={setSelectedAddons} /><form className="grid gap-2 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}><Input placeholder="نام فارسی محصول" value={title} onChange={(e) => setTitle(e.target.value)} /><Input dir="ltr" placeholder="English name" value={nameEn} onChange={(e) => setNameEn(e.target.value)} /><PriceInput value={price} onChange={setPrice} placeholder="قیمت" /><Input type="number" min="1" placeholder="ترتیب نمایش" value={priority} onChange={(e) => setPriority(e.target.value)} /><ImageUpload value={imageUrl} onChange={setImageUrl} /><Select value={categoryId} onValueChange={setCategoryId}><SelectTrigger><SelectValue placeholder="دسته" /></SelectTrigger><SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><Select value={station} onValueChange={(v) => setStation(v as TicketStation)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Bar">بار</SelectItem><SelectItem value="Kitchen">آشپزخانه</SelectItem><SelectItem value="KitchenAndBar">هر دو</SelectItem></SelectContent></Select><Button className="sm:col-span-2" type="submit" disabled={!title || !price || !categoryId || mut.isPending}>{mut.isPending ? "در حال ثبت..." : "ثبت محصول"}</Button></form></>;
}

function ItemEditor({ item, inventory }: { item: MenuItemDto; inventory: { id: string; name: string; sku: string }[] }) {
  const qc = useQueryClient();
  const addons = useQuery({ queryKey: ["addons"], queryFn: () => api.addons(false) });
  const [sharedAddonIds, setSharedAddonIds] = useState<string[]>(() => (item.addons ?? []).map((a) => a.id));
  const [title, setTitle] = useState(item.title); const [nameEn, setNameEn] = useState(item.nameEn ?? ""); const [description, setDescription] = useState(item.description ?? ""); const [price, setPrice] = useState(String(item.basePrice / 10)); const [priority, setPriority] = useState(String(item.displayPriority)); const [imageUrl, setImageUrl] = useState(item.imageUrl ?? "");
  const [modName, setModName] = useState(""); const [modPrice, setModPrice] = useState(""); const [editingMod, setEditingMod] = useState<string | null>(null); const [invId, setInvId] = useState(""); const [qty, setQty] = useState("18"); const [unit, setUnit] = useState<UnitOfMeasure>("Gr");
  const lines = useMemo(() => item.recipe?.lines ?? [], [item]);
  const update = useMutation({ mutationFn: () => api.updateMenuItem(item.id, { title, nameEn: nameEn || null, description: description || null, basePrice: Number(price) * 10, taxInclusive: item.taxInclusive, imageUrl: imageUrl || null, displayPriority: Number(priority) || 1, categoryId: item.categoryId, isActive: item.isActive, ticketStation: item.ticketStation, prepTimeMinutes: item.prepTimeMinutes }), onSuccess: () => { toast.success("اطلاعات محصول ذخیره شد"); qc.invalidateQueries({ queryKey: ["menu"] }); }, onError: (e: Error) => toast.error(e.message) });
  const remove = useMutation({ mutationFn: () => api.deleteMenuItem(item.id), onSuccess: () => { toast.success("محصول حذف شد"); setEditingMod(null); qc.invalidateQueries({ queryKey: ["menu"] }); }, onError: (e: Error) => toast.error(e.message) });
  const saveMod = useMutation({ mutationFn: async () => { if (editingMod) await api.updateModifier(editingMod, { name: modName, extraPrice: Number(modPrice) * 10, ticketStation: item.ticketStation, displayPriority: item.modifiers.find((m) => m.id === editingMod)?.displayPriority ?? 1, isActive: true }); else await api.createModifier({ menuItemId: item.id, name: modName, extraPrice: Number(modPrice) * 10, ticketStation: item.ticketStation, displayPriority: item.modifiers.length + 1 }); }, onSuccess: () => { toast.success(editingMod ? "اضافه ویرایش شد" : "اضافه ثبت شد"); setModName(""); setModPrice(""); setEditingMod(null); qc.invalidateQueries({ queryKey: ["menu"] }); }, onError: (e: Error) => toast.error(e.message) });
  const deleteMod = useMutation({ mutationFn: (id: string) => api.deleteModifier(id), onSuccess: () => { toast.success("اضافه حذف شد"); qc.invalidateQueries({ queryKey: ["menu"] }); }, onError: (e: Error) => toast.error(e.message) });
  const saveBom = useMutation({ mutationFn: () => api.upsertRecipe({ menuItemId: item.id, menuItemModifierId: null, name: `BOM ${item.title}`, lines: invId ? [...lines, { inventoryItemId: invId, quantity: Number(qty), unit }] : lines }), onSuccess: () => { toast.success("رسپی ذخیره شد"); setInvId(""); qc.invalidateQueries({ queryKey: ["menu"] }); }, onError: (e: Error) => toast.error(e.message) });

  return <div className="space-y-4"><AddonSelector addons={addons.data ?? []} selected={sharedAddonIds} onChange={async (ids) => { const added = ids.filter((id) => !sharedAddonIds.includes(id)); const removed = sharedAddonIds.filter((id) => !ids.includes(id)); await Promise.all([...added.map((id) => api.attachAddon(item.id, id)), ...removed.map((id) => api.detachAddon(item.id, id))]); setSharedAddonIds(ids); qc.invalidateQueries({ queryKey: ["menu"] }); }} /><div className="flex items-start gap-3">{item.imageUrl && <img src={item.imageUrl} alt={item.title} className="h-16 w-16 rounded-xl object-cover outline outline-1 outline-black/10" />}<div><h3 className="font-black">{item.title}</h3>{item.nameEn && <p className="text-sm text-muted-foreground">{item.nameEn}</p>}<p className="text-sm">{formatToman(item.basePrice)}</p></div></div><div className="rounded-xl border bg-muted/30 p-3"><Label>ترتیب نمایش در صندوق</Label><div className="mt-1 flex gap-2"><Input type="number" min="1" value={priority} onChange={(e) => setPriority(e.target.value)} /><Button onClick={() => update.mutate()} disabled={update.isPending}>ذخیره ترتیب</Button></div></div>
    <div className="grid gap-2"><Label>ویرایش محصول</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="نام فارسی" /><Input dir="ltr" value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="English name" /><PriceInput value={price} onChange={setPrice} placeholder="قیمت" /><ImageUpload value={imageUrl} onChange={setImageUrl} /><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="توضیحات" /><div className="flex gap-2"><Button className="flex-1" onClick={() => update.mutate()}>ذخیره تغییرات</Button><Button variant="destructive" onClick={() => window.confirm("این محصول حذف شود؟") && remove.mutate()}>حذف محصول</Button></div></div>
    <div className="grid gap-2"><Label>اضافات</Label>{item.modifiers.map((m) => <div key={m.id} className="flex items-center gap-2 rounded-lg border p-2"><Badge>{m.name}</Badge><span className="flex-1 text-xs">{formatToman(m.extraPrice)}</span><Button size="sm" variant="outline" onClick={() => { setEditingMod(m.id); setModName(m.name); setModPrice(String(m.extraPrice / 10)); }}>ویرایش</Button><Button size="sm" variant="destructive" onClick={() => window.confirm("این اضافه حذف شود؟") && deleteMod.mutate(m.id)}>حذف</Button></div>)}<div className="grid grid-cols-2 gap-2"><Input placeholder="نام اضافه" value={modName} onChange={(e) => setModName(e.target.value)} /><PriceInput value={modPrice} onChange={setModPrice} placeholder="قیمت اضافه" /><Button className="col-span-2" variant="outline" onClick={() => saveMod.mutate()} disabled={!modName || !modPrice}>{editingMod ? "ذخیره ویرایش اضافه" : "افزودن اضافه"}</Button></div></div>
    <div><Label>رسپی / اتصال به انبار</Label><ul className="my-2 space-y-1 text-sm">{lines.map((l) => <li key={l.inventoryItemId}>{inventory.find((i) => i.id === l.inventoryItemId)?.name ?? l.inventoryItemId} — {l.quantity} {l.unit}</li>)}</ul><Select value={invId} onValueChange={setInvId}><SelectTrigger><SelectValue placeholder="ماده اولیه" /></SelectTrigger><SelectContent>{inventory.map((i) => <SelectItem key={i.id} value={i.id}>{i.name} ({i.sku})</SelectItem>)}</SelectContent></Select><div className="mt-2 flex gap-2"><Input value={qty} onChange={(e) => setQty(e.target.value)} /><Select value={unit} onValueChange={(v) => setUnit(v as UnitOfMeasure)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Gr", "Ml", "Kg", "Liter", "Count"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div><Button className="mt-2 w-full" onClick={() => saveBom.mutate()}>ذخیره رسپی</Button></div>
  </div>;
}
