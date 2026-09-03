"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Image as ImageIcon,
  Palette,
  Printer,
  Save,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { applyTheme } from "@/lib/theme";

const INITIAL_FORM = {
  storeName: "",
  logoUrl: "",
  taxIdentificationNumber: "",
  receiptHeader: "",
  receiptFooter: "",
  primaryColor: "#C41E3A",
  secondaryColor: "#1F2937",
  vatRate: 0.1,
  loyaltyPointsPerMillionRial: 10,
  thermalPrinterHost: "",
  thermalPrinterPort: 9100,
};
type FormState = typeof INITIAL_FORM;

export function SettingsHub() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const [form, setForm] = useState<FormState>(INITIAL_FORM);

  useEffect(() => {
    if (!q.data) return;
    setForm({
      storeName: q.data.storeName,
      logoUrl: q.data.logoUrl ?? "",
      taxIdentificationNumber: q.data.taxIdentificationNumber ?? "",
      receiptHeader: q.data.receiptHeader ?? "",
      receiptFooter: q.data.receiptFooter ?? "",
      primaryColor: q.data.primaryColor,
      secondaryColor: q.data.secondaryColor,
      vatRate: q.data.vatRate,
      loyaltyPointsPerMillionRial: q.data.loyaltyPointsPerMillionRial,
      thermalPrinterHost: q.data.thermalPrinterHost ?? "",
      thermalPrinterPort: q.data.thermalPrinterPort,
    });
  }, [q.data]);

  useEffect(() => {
    applyTheme(form.primaryColor);
  }, [form.primaryColor]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const mut = useMutation({
    mutationFn: () =>
      api.updateSettings({
        ...form,
        logoUrl: form.logoUrl || null,
        taxIdentificationNumber: form.taxIdentificationNumber || null,
        receiptHeader: form.receiptHeader || null,
        receiptFooter: form.receiptFooter || null,
        thermalPrinterHost: form.thermalPrinterHost || null,
      }),
    onSuccess: () => {
      toast.success("تنظیمات ذخیره شد");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="تنظیمات فروشگاه"
        description="اطلاعات شناسنامه فیش، ظاهر برند، مالیات و چاپ حرارتی"
        actions={
          <Button loading={mut.isPending} onClick={() => mut.mutate()}>
            <Save className="size-4" aria-hidden />
            ذخیره تنظیمات
          </Button>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Store identity */}
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border/70 px-5 py-4">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Store className="size-4" aria-hidden />
              </div>
              <h2 className="text-[15px] font-bold">شناسنامه فروشگاه</h2>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="نام فروشگاه">
                <Input value={form.storeName} onChange={(e) => set("storeName", e.target.value)} placeholder="مثلاً کافه آرام" />
              </Field>
              <Field label="شناسه مالیاتی" hint="در سربرگ فیش چاپ می‌شود">
                <Input dir="ltr" className="text-start" value={form.taxIdentificationNumber} onChange={(e) => set("taxIdentificationNumber", e.target.value)} placeholder="اقتصادی / ملی" />
              </Field>
              <Field label="آدرس لوگو" hint="آدرس عکس یا لینک اینترنتی">
                <div className="relative">
                  <Input dir="ltr" className="ps-10 text-start" value={form.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://…" />
                  <ImageIcon className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="نرخ ارزش افزوده" hint="۰ تا ۱">
                  <Input type="number" step="0.01" min={0} max={1} dir="ltr" className="text-end" value={form.vatRate} onChange={(e) => set("vatRate", Number(e.target.value) || 0)} />
                </Field>
                <Field label="امتیاز / میلیون ریال">
                  <Input type="number" inputMode="numeric" dir="ltr" className="text-end" value={form.loyaltyPointsPerMillionRial} onChange={(e) => set("loyaltyPointsPerMillionRial", Number(e.target.value) || 0)} />
                </Field>
              </div>
            </div>
          </Card>

          {/* Brand colors */}
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border/70 px-5 py-4">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Palette className="size-4" aria-hidden />
              </div>
              <div>
                <h2 className="text-[15px] font-bold">رنگ برند</h2>
                <p className="text-xs text-muted-foreground">هم‌زمان در صندوق، نمایشگرها و پنل مدیریت اعمال می‌شود</p>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <ColorField label="رنگ اصلی (دکمه و نشانگرها)" value={form.primaryColor} onChange={(v) => set("primaryColor", v)} />
                <ColorField label="رنگ ثانویه (سندهای چاپی)" value={form.secondaryColor} onChange={(v) => set("secondaryColor", v)} />
              </div>

              {/* Theme preview */}
              <div className="overflow-hidden rounded-2xl border border-border">
                <div className="flex items-center gap-2 border-b border-border/60 bg-card px-4 py-2.5">
                  <div className="flex size-5 items-center justify-center rounded-md bg-primary-soft text-primary">
                    <Store className="size-3" aria-hidden />
                  </div>
                  <span className="text-[13px] font-bold">{form.storeName || "نام فروشگاه"}</span>
                  <span className="ms-auto flex h-2 w-2 rounded-full bg-success" aria-hidden />
                </div>
                <div className="flex items-center gap-3 bg-muted/50 px-4 py-3">
                  <span className="text-xs text-muted-foreground">دکمه اصلی صندوق:</span>
                  <span
                    className="rounded-lg px-3.5 py-1.5 text-xs font-bold text-white"
                    style={{ backgroundColor: form.primaryColor }}
                  >
                    ثبت سفارش
                  </span>
                  <span className="rounded-lg border border-border bg-card px-3.5 py-1.5 text-xs font-semibold">
                    دکمه فرعی
                  </span>
                </div>
                <div
                  className="px-4 py-3 text-xs leading-5"
                  style={{ color: form.secondaryColor, backgroundColor: "#f7f8fa" }}
                >
                  نمونه فیش حرارتی · سربرگ و هویت فروشگاه
                </div>
              </div>
            </div>
          </Card>

          {/* Receipt / thermal printer */}
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border/70 px-5 py-4">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Printer className="size-4" aria-hidden />
              </div>
              <div>
                <h2 className="text-[15px] font-bold">فیش حرارتی</h2>
                <p className="text-xs text-muted-foreground">سربرگ، پاورقی و آدرس پرینتر</p>
              </div>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="آدرس پرینتر حرارتی">
                <Input dir="ltr" className="text-start" value={form.thermalPrinterHost} onChange={(e) => set("thermalPrinterHost", e.target.value)} placeholder="192.168.1.20" />
              </Field>
              <Field label="پورت">
                <Input type="number" inputMode="numeric" dir="ltr" className="text-end" value={form.thermalPrinterPort} onChange={(e) => set("thermalPrinterPort", Number(e.target.value) || 0)} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="سربرگ فیش">
                  <Textarea value={form.receiptHeader} onChange={(e) => set("receiptHeader", e.target.value)} placeholder="آدرس، تلفن، توضیحات…" />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="پاورقی فیش">
                  <Textarea value={form.receiptFooter} onChange={(e) => set("receiptFooter", e.target.value)} placeholder="متن تشکر یا اطلاع‌رسانی…" />
                </Field>
              </div>
            </div>
          </Card>
        </div>

        {/* Side summary */}
        <div className="space-y-4 lg:sticky lg:top-6">
          <Card className="overflow-hidden">
            <div className="border-b border-border/70 px-5 py-4">
              <h2 className="flex items-center gap-2 text-[15px] font-bold">
                <Building2 className="size-4 text-muted-foreground" aria-hidden />
                خلاصه
              </h2>
            </div>
            <dl className="divide-y divide-border/70 text-sm">
              <div className="flex items-center justify-between gap-3 px-5 py-3">
                <dt className="text-muted-foreground">نام فروشگاه</dt>
                <dd className="truncate font-semibold">{form.storeName || "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-5 py-3">
                <dt className="text-muted-foreground">شناسه مالیاتی</dt>
                <dd className="truncate font-mono text-xs tabular-nums">{form.taxIdentificationNumber || "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-5 py-3">
                <dt className="text-muted-foreground">ارزش افزوده</dt>
                <dd className="font-semibold tabular-nums">{Math.round(form.vatRate * 100)}٪</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-5 py-3">
                <dt className="text-muted-foreground">امتیاز باشگاه</dt>
                <dd className="font-semibold tabular-nums">{form.loyaltyPointsPerMillionRial} / هر میلیون ریال</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-5 py-3">
                <dt className="text-muted-foreground">پرینتر</dt>
                <dd className="truncate font-mono text-xs tabular-nums" dir="ltr">
                  {form.thermalPrinterHost ? `${form.thermalPrinterHost}:${form.thermalPrinterPort}` : "—"}
                </dd>
              </div>
            </dl>
            <div className="border-t border-border/70 px-5 py-4">
              <Button className="w-full" variant="outline" onClick={() => mut.mutate()} disabled={mut.isPending} loading={mut.isPending}>
                ذخیره همه تغییرات
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex h-10 items-center gap-2 rounded-xl border border-input bg-card px-3 shadow-xs">
        <label className="relative size-6 shrink-0 cursor-pointer overflow-hidden rounded-lg ring-1 ring-inset ring-border">
          <span className="block size-6" style={{ backgroundColor: value }} aria-hidden />
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            aria-label={label}
          />
        </label>
        <span className="font-mono text-xs uppercase text-muted-foreground tabular-nums" dir="ltr">
          {value}
        </span>
      </div>
    </div>
  );
}
