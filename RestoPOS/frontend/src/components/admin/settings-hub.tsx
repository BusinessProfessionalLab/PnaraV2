"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, Input, Label, Textarea } from "@/components/ui/input";
import { api } from "@/lib/api";
import { applyTheme } from "@/lib/theme";

export function SettingsHub() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const [form, setForm] = useState({
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
  });

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
    applyTheme(form.primaryColor, form.secondaryColor);
  }, [form.primaryColor, form.secondaryColor]);

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

  return (
    <Card className="max-w-3xl p-6">
      <h2 className="mb-4 font-black">برندینگ و موتور تم پویا</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="نام فروشگاه" value={form.storeName} onChange={(v) => setForm({ ...form, storeName: v })} />
        <Field label="لوگو URL" value={form.logoUrl} onChange={(v) => setForm({ ...form, logoUrl: v })} />
        <Field label="شناسه مالیاتی" value={form.taxIdentificationNumber} onChange={(v) => setForm({ ...form, taxIdentificationNumber: v })} />
        <Field label="آدرس پرینتر حرارتی" value={form.thermalPrinterHost} onChange={(v) => setForm({ ...form, thermalPrinterHost: v })} />
        <div>
          <Label>رنگ اصلی</Label>
          <Input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
        </div>
        <div>
          <Label>رنگ ثانویه</Label>
          <Input type="color" value={form.secondaryColor} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} />
        </div>
        <Field label="نرخ ارزش افزوده (۰ تا ۱)" value={String(form.vatRate)} onChange={(v) => setForm({ ...form, vatRate: Number(v) })} />
        <Field
          label="امتیاز به ازای هر میلیون ریال"
          value={String(form.loyaltyPointsPerMillionRial)}
          onChange={(v) => setForm({ ...form, loyaltyPointsPerMillionRial: Number(v) })}
        />
        <div className="md:col-span-2">
          <Label>سربرگ فیش</Label>
          <Textarea value={form.receiptHeader} onChange={(e) => setForm({ ...form, receiptHeader: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <Label>پاورقی فیش</Label>
          <Textarea value={form.receiptFooter} onChange={(e) => setForm({ ...form, receiptFooter: e.target.value })} />
        </div>
      </div>
      <div className="mt-4 rounded-2xl p-6 text-white" style={{ background: form.secondaryColor }}>
        <div className="text-sm opacity-70">پیش‌نمایش تم</div>
        <div className="text-2xl font-black">{form.storeName || "نام فروشگاه"}</div>
        <button className="mt-3 rounded-xl px-4 py-2 font-bold text-white" style={{ background: form.primaryColor }}>
          دکمه اصلی صندوق
        </button>
      </div>
      <Button className="mt-4" onClick={() => mut.mutate()} disabled={mut.isPending}>
        ذخیره تنظیمات
      </Button>
    </Card>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => setChange(e, onChange)} />
    </div>
  );
}

function setChange(e: React.ChangeEvent<HTMLInputElement>, onChange: (v: string) => void) {
  onChange(e.target.value);
}
