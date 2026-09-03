"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FolderPlus, Pencil, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import type { CategoryDto } from "@/lib/types";

export function CategoryManager() {
  const qc = useQueryClient();
  const categories = useQuery({ queryKey: ["categories", true], queryFn: () => api.categories(true) });
  const [editing, setEditing] = useState<CategoryDto | null>(null);
  const [name, setName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CategoryDto | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (editing) await api.updateCategory(editing.id, { ...editing, name });
      else {
        const nextPriority = Math.max(
          0,
          ...(categories.data ?? [])
            .filter((category) => !category.isSystem)
            .map((category) => category.displayPriority),
        ) + 1;
        await api.createCategory({ name, nameEn: null, displayPriority: nextPriority, isVisible: true, iconUrl: null, imageUrl: null, parentId: null });
      }
    },
    onSuccess: () => {
      toast.success(editing ? "دسته‌بندی ویرایش شد" : "دسته‌بندی اضافه شد");
      setName("");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteCategory(id),
    onSuccess: () => {
      toast.success("دسته‌بندی حذف شد");
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["menu"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function startEdit(category: CategoryDto) {
    setEditing(category);
    setName(category.name);
  }
  function resetForm() {
    setEditing(null);
    setName("");
  }

  const list = (categories.data ?? []).filter((c) => !c.isSystem);

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border/70 px-5 py-4">
        <h2 className="text-[15px] font-bold">مدیریت دسته‌بندی‌ها</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          دسته‌بندی‌ها در صندوق لمسی به همین ترتیب نمایش داده می‌شوند
        </p>
      </div>

      <div className="space-y-4 p-5">
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) save.mutate();
          }}
        >
          <div className="relative flex-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={editing ? `نام جدید «${editing.name}»` : "نام دسته‌بندی جدید…"}
              className="ps-10"
            />
            <FolderPlus
              className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
          </div>
          {editing ? (
            <div className="flex shrink-0 gap-2">
              <Button type="submit" disabled={!name.trim() || save.isPending} loading={save.isPending}>
                ذخیره تغییرات
              </Button>
              <Button type="button" variant="ghost" onClick={resetForm}>
                <X className="size-4" aria-hidden />
                انصراف
              </Button>
            </div>
          ) : (
            <Button type="submit" disabled={!name.trim() || save.isPending} loading={save.isPending} className="shrink-0">
              افزودن دسته
            </Button>
          )}
        </form>

        {categories.isLoading ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            compact
            icon={FolderPlus}
            title="دسته‌بندی‌ای وجود ندارد"
            description="اولین دسته را بسازید تا محصولات بتوانند گروه‌بندی شوند"
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((category) => (
              <div
                key={category.id}
                className={cn(
                  "flex items-center gap-2 rounded-xl border p-3 transition-colors",
                  editing?.id === category.id ? "border-primary/40 bg-primary-soft/50" : "border-border bg-card",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{category.name}</div>
                  {category.nameEn ? (
                    <div className="truncate text-[11px] text-muted-foreground" dir="ltr">
                      {category.nameEn}
                    </div>
                  ) : null}
                </div>
                <Button type="button" size="icon-sm" variant="ghost" className="text-muted-foreground" aria-label={`ویرایش ${category.name}`} onClick={() => startEdit(category)}>
                  <Pencil className="size-3.5" aria-hidden />
                </Button>
                <Button type="button" size="icon-sm" variant="ghost" className="text-muted-foreground hover:bg-danger/10 hover:text-danger" aria-label={`حذف ${category.name}`} onClick={() => setDeleteTarget(category)}>
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
        title={`حذف دسته «${deleteTarget?.name ?? ""}»`}
        description="این عملیات قابل بازگشت نیست."
        confirmLabel="حذف دسته"
        pending={remove.isPending}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
      />
    </Card>
  );
}
