"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, Input } from "@/components/ui/input";
import type { CategoryDto } from "@/lib/types";

export function CategoryManager() {
  const qc = useQueryClient();
  const categories = useQuery({ queryKey: ["categories", true], queryFn: () => api.categories(true) });
  const [editing, setEditing] = useState<CategoryDto | null>(null);
  const [name, setName] = useState("");
  const [priority, setPriority] = useState("1");

  const save = useMutation({
    mutationFn: async () => {
      if (editing) await api.updateCategory(editing.id, { ...editing, name, displayPriority: Number(priority) || editing.displayPriority });
      else await api.createCategory({ name, nameEn: null, displayPriority: Number(priority) || (categories.data?.length ?? 0) + 1, isVisible: true, iconUrl: null, imageUrl: null, parentId: null });
    },
    onSuccess: () => {
      toast.success(editing ? "دسته‌بندی ویرایش شد" : "دسته‌بندی اضافه شد");
      setName("");
      setPriority("1");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteCategory(id),
    onSuccess: () => { toast.success("دسته‌بندی حذف شد"); qc.invalidateQueries({ queryKey: ["categories"] }); qc.invalidateQueries({ queryKey: ["menu"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  function startEdit(category: CategoryDto) {
    setEditing(category);
    setName(category.name);
    setPriority(String(category.displayPriority));
  }

  return (
    <Card className="mb-4 p-4">
      <h2 className="mb-3 text-lg font-black">مدیریت دسته‌بندی‌ها</h2>
      <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) save.mutate(); }}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={editing ? "نام جدید دسته‌بندی" : "نام دسته‌بندی جدید"} />
        <Button type="submit" disabled={!name.trim() || save.isPending}>{editing ? "ذخیره" : "افزودن"}</Button>
        {editing && <Button type="button" variant="ghost" onClick={() => { setEditing(null); setName(""); }}>انصراف</Button>}
      </form>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(categories.data ?? []).map((category) => (
          <div key={category.id} className="flex items-center gap-2 rounded-xl border p-3">
            <span className="min-w-0 flex-1 truncate font-semibold">{category.name}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => startEdit(category)}>ویرایش</Button>
            <Button type="button" size="sm" variant="destructive" onClick={() => window.confirm(`دسته «${category.name}» حذف شود؟`) && remove.mutate(category.id)}>حذف</Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
