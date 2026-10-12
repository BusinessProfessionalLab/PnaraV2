"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Image as ImageIcon,
  Palette,
  Save,
  Store,
  CreditCard,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useCreatePosDevice,
  useDeletePosDevice,
  usePosDevicesAdmin,
  useSettings,
  useTestPosDevice,
  useUpdateSettings,
} from "@/api";
import { errorMessage } from "@/api/errors";
import { applyTheme, readableForegroundOn } from "@/lib/theme";
import type { IranianPsp, PosProtocol } from "@/lib/types";

const INITIAL_FORM = {
  storeName: "",
  logoUrl: "",
  receiptHeader: "",
  receiptFooter: "",
  primaryColor: "#C41E3A",
  secondaryColor: "#1F2937",
  vatRate: 0.1,
};
type FormState = typeof INITIAL_FORM;

function readImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("فقط فایل تصویری انتخاب کنید."));
  }
  if (file.size > 2 * 1024 * 1024) {
    return Promise.reject(new Error("حجم لوگو باید کمتر از ۲ مگابایت باشد."));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("خواندن فایل لوگو ناموفق بود."));
    reader.readAsDataURL(file);
  });
}

export function SettingsHub() {
  return (
    <Tabs defaultValue="store" className="space-y-4" dir="rtl">
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
      receiptHeader: q.data.receiptHeader ?? "",
      receiptFooter: q.data.receiptFooter ?? "",
      primaryColor: q.data.primaryColor,
      secondaryColor: q.data.secondaryColor,
      vatRate: q.data.vatRate,
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
        receiptHeader: form.receiptHeader || null,
        receiptFooter: form.receiptFooter || null,
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
        description="هویت فروشگاه و تنظیمات فیش"
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
              <Field label="لوگوی فروشگاه">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
                    <ImageIcon className="size-4" aria-hidden />
                    بارگذاری تصویر
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        try {
                          set("logoUrl", await readImage(file));
                        } catch (error) {
                          toast.error((error as Error).message);
                        }
                        event.target.value = "";
                      }}
                    />
                  </label>
                  {form.logoUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={form.logoUrl} alt="پیش‌نمایش لوگو" className="h-12 max-w-36 object-contain" />
                      <Button type="button" size="sm" variant="ghost" onClick={() => set("logoUrl", "")}>
                        حذف لوگو
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">PNG، JPG یا SVG تا ۲ مگابایت</span>
                  )}
                </div>
              </Field>
              <ColorField label="رنگ اصلی" value={form.primaryColor} onChange={(v) => set("primaryColor", v)} />
              <ColorField label="رنگ ثانویه" value={form.secondaryColor} onChange={(v) => set("secondaryColor", v)} />
              <Field label="نرخ ارزش افزوده (۰ تا ۱)">
                <Input type="number" step="0.01" value={form.vatRate} onChange={(e) => set("vatRate", Number(e.target.value))} />
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
                <dt className="text-muted-foreground">ارزش افزوده</dt>
                <dd className="font-semibold tabular-nums">{Math.round(form.vatRate * 100)}٪</dd>
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
  const devices = usePosDevicesAdmin();
  const [name, setName] = useState("");
  const [terminalId, setTerminalId] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [protocol, setProtocol] = useState<PosProtocol>("Lan");
  const [psp, setPsp] = useState<IranianPsp>("Unknown");
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("8080");

  const createMut = useCreatePosDevice();
  const deleteMut = useDeletePosDevice();
  const testMut = useTestPosDevice();

  const submitDevice = () =>
    createMut.mutate(
      {
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
      },
      {
        onSuccess: () => {
          toast.success("کارتخوان اضافه شد");
          setName("");
          setTerminalId("");
          setMerchantId("");
          setIp("");
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  const removeDevice = (id: string) =>
    deleteMut.mutate(id, {
      onSuccess: () => toast.success("حذف شد"),
      onError: (e) => toast.error(errorMessage(e)),
    });

  const testConnection = (id: string) =>
    testMut.mutate(id, {
      onSuccess: (res) =>
        toast.success(
          typeof res === "string" ? res : res?.message || "اتصال موفق",
        ),
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
        <Button onClick={submitDevice} disabled={createMut.isPending || !name || !terminalId}>
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
                <Button size="sm" variant="outline" onClick={() => testConnection(d.id)}>
                  تست
                </Button>
                <Button size="sm" variant="outline" onClick={() => removeDevice(d.id)}>
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
