"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, Input } from "@/components/ui/input";
import { formatToman } from "@/lib/currency";
import type { CategoryDto, MenuItemDto } from "@/lib/types";

export function DiscountsHub() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const categories = useQuery({ queryKey: ["categories", true], queryFn: () => api.categories(true) });
  const menu = useQuery({ queryKey: ["menu", false], queryFn: () => api.menuItems(false) });
  const term = search.trim().toLocaleLowerCase();
  const filteredCategories = useMemo(() => (categories.data ?? []).filter((c) => !term || `${c.name} ${c.nameEn ?? ""}`.toLocaleLowerCase().includes(term)), [categories.data, term]);
  const filteredItems = useMemo(() => (menu.data ?? []).filter((i) => !term || `${i.title} ${i.nameEn ?? ""} ${i.categoryName}`.toLocaleLowerCase().includes(term)), [menu.data, term]);
  const saveCategory = useMutation({ mutationFn: ({ category, value }: { category: CategoryDto; value: number }) => api.updateCategory(category.id, { ...category, discountPercent: Math.min(100, Math.max(0, value)) }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories"] }); toast.success("تخفیف گروه ذخیره شد"); }, onError: (e: Error) => toast.error(e.message) });
  const saveItem = useMutation({ mutationFn: ({ item, value }: { item: MenuItemDto; value: number }) => api.updateMenuItem(item.id, { ...item, discountPercent: Math.min(100, Math.max(0, value)) }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["menu"] }); toast.success("تخفیف آیتم ذخیره شد"); }, onError: (e: Error) => toast.error(e.message) });
  return <div className="space-y-4"><Card className="p-5"><h1 className="text-xl font-black">تخفیف آیتم‌ها و گروه‌ها</h1><p className="mt-1 text-sm text-muted-foreground">تخفیف فقط درصدی است؛ تخفیف آیتم بر تخفیف گروه اولویت دارد.</p><Input className="mt-4" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجو در آیتم‌ها و گروه‌ها..." /></Card><Card className="p-5"><h2 className="mb-3 font-black">گروه‌ها</h2>{filteredCategories.map((c) => <DiscountRow key={c.id} label={c.name} meta="کل آیتم‌های این گروه" value={c.discountPercent} onSave={(value) => saveCategory.mutate({ category: c, value })} />)}</Card><Card className="p-5"><h2 className="mb-3 font-black">آیتم‌ها</h2>{filteredItems.map((i) => <DiscountRow key={i.id} label={i.title} meta={`${i.categoryName} · ${formatToman(i.basePrice)}`} value={i.discountPercent} onSave={(value) => saveItem.mutate({ item: i, value })} />)}</Card></div>;
}

function DiscountRow({ label, meta, value, onSave }: { label: string; meta: string; value: number; onSave: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value ?? 0));
  return <div className="mb-2 flex items-center gap-3 rounded-xl border p-3"><div className="min-w-0 flex-1"><div className="font-bold">{label}</div><div className="text-xs text-muted-foreground">{meta}</div></div><Input className="w-24" type="number" min="0" max="100" value={draft} onChange={(e) => setDraft(e.target.value)} /><span>%</span><Button size="sm" onClick={() => onSave(Number(draft) || 0)}>ذخیره</Button></div>;
}
