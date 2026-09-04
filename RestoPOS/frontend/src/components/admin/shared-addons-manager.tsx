"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Boxes, Pencil, Plus, Trash2 } from "lucide-react";
import {
  useAddons,
  useCreateAddon,
  useDeleteAddon,
  useUpdateAddon,
} from "@/queries/menu";
import { errorMessage } from "@/api/errors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatToman } from "@/lib/currency";

export function SharedAddonsManager() {
  const allAddons = useAddons(false);
  const createAddon = useCreateAddon();
  const updateAddon = useUpdateAddon();
  const deleteAddon = useDeleteAddon();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  async function create() {
    try {
      await createAddon.mutateAsync({
        name,
        extraPrice: Number(price) * 10,
        ticketStation: "Bar",
        displayPriority: (allAddons.data?.length ?? 0) + 1,
      });
      setName("");
      setPrice("");
      toast.success("افزودنی مشترک ساخته شد");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function update() {
    try {
      await updateAddon.mutateAsync({
        id: editingId!,
        payload: {
          name,
          extraPrice: Number(price) * 10,
          ticketStation: "Bar",
          displayPriority: 1,
          isActive: true,
        },
      });
      setEditingId(null);
      setName("");
      setPrice("");
      toast.success("افزودنی ویرایش شد");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function remove(id: string) {
    try {
      await deleteAddon.mutateAsync(id);
      setDeleteTarget(null);
      toast.success("افزودنی حذف شد");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

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
          {allAddons.data?.length ?? 0} افزودنی
        </Badge>
      </div>
      <div className="space-y-4 p-5">
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_12rem_auto]">
          <Field label={editingId ? "ویرایش نام افزودنی" : "افزودنی جدید"}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً شیر اضافه" />
          </Field>
          <Field label="قیمت اضافه">
            <MoneyInput value={price} onValueChange={setPrice} />
          </Field>
          {editingId ? (
            <div className="flex gap-2">
              <Button
                loading={updateAddon.isPending}
                disabled={!name.trim() || !price}
                onClick={() => update()}
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
              loading={createAddon.isPending}
              disabled={!name.trim() || !price}
              onClick={() => create()}
            >
              <Plus className="size-4" aria-hidden />
              ساخت افزودنی
            </Button>
          )}
        </div>

        {allAddons.isLoading ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (allAddons.data ?? []).length === 0 ? (
          <EmptyState compact icon={Boxes} title="افزودنی مشترکی نیست" description="برای شروع، افزودنی را از فرم بالا بسازید" />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(allAddons.data ?? []).map((a) => (
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
        pending={deleteAddon.isPending}
        onConfirm={() => deleteTarget && remove(deleteTarget)}
      />
    </Card>
  );
}