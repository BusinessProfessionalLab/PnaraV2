"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Image as ImageIcon,
  Palette,
  Printer,
  Save,
  Store,
  CreditCard,
  Trash2,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettings, useUpdateSettings } from "@/queries/settings";
import { errorMessage } from "@/api/errors";
import { applyTheme, readableForegroundOn } from "@/lib/theme";
import { paymentsService } from "@/services/payments.service";
import type { IranianPsp, PosProtocol } from "@/lib/types";

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
  return (
    <Tabs defaultValue="store" className="space-y-4">
      <TabsList>
        <TabsTrigger value="store">فروشگاه</TabsTrigger>
        <TabsTrigger value="pos">کارتخوان‌ها</TabsTrigger>
      </TabsList>
      <TabsContent value="store">
        <StoreSettingsPanel />
      </TabsContent>
      <TabsContent value="pos">
        <PosDevicesPanel />
      </TabsContent>
    </Tabs>
  );
}

function StoreSettingsPanel() {
  const q = useSettings();
  const saveSettings = useUpdateSettings();
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

  async function persist() {
    try {
      await saveSettings.mutateAsync({
        ...form,
        logoUrl: form.logoUrl || null,
        taxIdentificationNumber: form.taxIdentificationNumber || null,
        receiptHeader: form.receiptHeader || null,
        receiptFooter: form.receiptFooter || null,
        thermalPrinterHost: form.thermalPrinterHost || null,
      });
      toast.success("تنظیمات ذخیره شد");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="تنظیمات فروشگاه"
        description="برندینگ، فیش و پرینتر"
        actions={
          <Button onClick={persist} disabled={saveSettings.isPending} loading={saveSettings.isPending}>
            <Save className="size-4" aria-hidden />
            ذخیره
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="mb-4 flex items-center gap-2 text-[15px] font-bold">
              <Store className="size-4 text-muted-foreground" aria-hidden />
              هویت فروشگاه
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="نام فروشگاه">
                <Input value={form.storeName} onChange={(e) => set("storeName", e.target.value)} />
              </Field>
              <Field label="لوگو URL">
                <Input value={form.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} dir="ltr" />
              </Field>
              <Field label="شناسه مالیاتی">
                <Input value={form.taxIdentificationNumber} onChange={(e) => set("taxIdentificationNumber", e.target.value)} />
              </Field>
              <Field label="آدرس پرینتر حرارتی">
                <Input value={form.thermalPrinterHost} onChange={(e) => set("thermalPrinterHost", e.target.value)} dir="ltr" />
              </Field>
              <ColorField label="رنگ اصلی" value={form.primaryColor} onChange={(v) => set("primaryColor", v)} />
              <ColorField label="رنگ ثانویه" value={form.secondaryColor} onChange={(v) => set("secondaryColor", v)} />
              <Field label="نرخ ارزش افزوده (۰ تا ۱)">
                <Input type="number" step="0.01" value={form.vatRate} onChange={(e) => set("vatRate", Number(e.target.value))} />
              </Field>
              <Field label="امتیاز به ازای هر میلیون ریال">
                <Input
                  type="number"
                  value={form.loyaltyPointsPerMillionRial}
                  onChange={(e) => set("loyaltyPointsPerMillionRial", Number(e.target.value))}
                />
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

          <Card
            className="overflow-hidden p-6 text-white"
            style={{ background: form.secondaryColor, color: readableForegroundOn(form.secondaryColor) }}
          >
            <div className="flex items-center gap-2 text-sm opacity-70">
              <Palette className="size-4" aria-hidden />
              پیش‌نمایش تم
            </div>
            <div className="mt-1 text-2xl font-black">{form.storeName || "نام فروشگاه"}</div>
            <button
              type="button"
              className="mt-3 rounded-xl px-4 py-2 font-bold"
              style={{ background: form.primaryColor, color: readableForegroundOn(form.primaryColor) }}
            >
              دکمه نمونه
            </button>
            {form.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logoUrl} alt="" className="mt-4 h-12 object-contain" />
            ) : (
              <div className="mt-4 flex items-center gap-2 text-xs opacity-60">
                <ImageIcon className="size-4" aria-hidden />
                بدون لوگو
              </div>
            )}
            <div className="mt-3 flex items-center gap-2 text-xs opacity-60">
              <Printer className="size-4" aria-hidden />
              {form.thermalPrinterHost || "پرینتر تنظیم نشده"}
            </div>
          </Card>
        </div>

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
              <Button className="w-full" variant="outline" onClick={persist} disabled={saveSettings.isPending} loading={saveSettings.isPending}>
                ذخیره همه تغییرات
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PosDevicesPanel() {
  const qc = useQueryClient();
  const devices = useQuery({ queryKey: ["pos-devices-admin"], queryFn: paymentsService.listPosDevicesAdmin });
  const [name, setName] = useState("");
  const [terminalId, setTerminalId] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [protocol, setProtocol] = useState<PosProtocol>("Lan");
  const [psp, setPsp] = useState<IranianPsp>("Unknown");
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("8080");

  const createMut = useMutation({
    mutationFn: () =>
      paymentsService.createPosDevice({
        name,
        protocol,
        psp,
        ipAddress: ip || null,
        port: port ? Number(port) : null,
        comPort: null,
        baudRate: null,
        terminalId,
        merchantId: merchantId || "",
        isActive: true,
      }),
    onSuccess: () => {
      toast.success("کارتخوان اضافه شد");
      qc.invalidateQueries({ queryKey: ["pos-devices-admin"] });
      setName("");
      setTerminalId("");
      setMerchantId("");
      setIp("");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => paymentsService.deletePosDevice(id),
    onSuccess: () => {
      toast.success("حذف شد");
      qc.invalidateQueries({ queryKey: ["pos-devices-admin"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const testMut = useMutation({
    mutationFn: (id: string) => paymentsService.testPosDevice(id),
    onSuccess: (res) => toast.success(typeof res === "string" ? res : res?.message || "اتصال موفق"),
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="space-y-4">
      <PageHeader title="کارتخوان‌ها" description="مدیریت ترمینال‌های POS و تست اتصال" />
      <Card className="space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-bold">
          <CreditCard className="size-4" aria-hidden />
          افزودن دستگاه
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Input placeholder="نام" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Terminal ID" value={terminalId} onChange={(e) => setTerminalId(e.target.value)} dir="ltr" />
          <Input placeholder="Merchant ID" value={merchantId} onChange={(e) => setMerchantId(e.target.value)} dir="ltr" />
          <Select value={protocol} onValueChange={(v) => setProtocol(v as PosProtocol)}>
            <SelectTrigger>
              <SelectValue placeholder="پروتکل" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Lan">Lan</SelectItem>
              <SelectItem value="Com">Com</SelectItem>
              <SelectItem value="Serial">Serial</SelectItem>
            </SelectContent>
          </Select>
          <Select value={psp} onValueChange={(v) => setPsp(v as IranianPsp)}>
            <SelectTrigger>
              <SelectValue placeholder="PSP" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Unknown">Unknown</SelectItem>
              <SelectItem value="AsanPardakht">AsanPardakht</SelectItem>
              <SelectItem value="SamanKish">SamanKish</SelectItem>
              <SelectItem value="BehpardakhtMellat">BehpardakhtMellat</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="IP" value={ip} onChange={(e) => setIp(e.target.value)} dir="ltr" />
          <Input placeholder="Port" value={port} onChange={(e) => setPort(e.target.value)} dir="ltr" />
        </div>
        <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !name || !terminalId}>
          ثبت کارتخوان
        </Button>
      </Card>
      <Card className="p-5">
        <ul className="space-y-2">
          {(devices.data ?? []).map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
              <div>
                <div className="font-bold">{d.name}</div>
                <div className="text-xs text-muted-foreground" dir="ltr">
                  {d.protocol} · {d.psp} · {d.terminalId}
                  {d.ipAddress ? ` · ${d.ipAddress}:${d.port ?? ""}` : ""}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => testMut.mutate(d.id)}>
                  تست
                </Button>
                <Button size="sm" variant="outline" onClick={() => deleteMut.mutate(d.id)}>
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
          {!devices.data?.length ? <li className="text-sm text-muted-foreground">دستگاهی ثبت نشده</li> : null}
        </ul>
      </Card>
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
