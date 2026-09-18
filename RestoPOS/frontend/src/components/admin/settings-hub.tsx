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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings, useUpdateSettings } from "@/queries/settings";
import { errorMessage } from "@/api/errors";
import { applyTheme, readableForegroundOn } from "@/lib/theme";
import { Badge, Card, Input, Label, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { applyTheme } from "@/lib/theme";
import type { IranianPsp, PosDeviceDto, PosProtocol } from "@/lib/types";

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
const emptyDevice = {
  name: "",
  protocol: "Lan" as PosProtocol,
  psp: "Unknown" as IranianPsp,
  ipAddress: "",
  port: "10000",
  comPort: "",
  baudRate: "9600",
  terminalId: "",
  merchantId: "",
  isActive: true,
};

export function SettingsHub() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const devices = useQuery({ queryKey: ["pos-devices-admin"], queryFn: api.listPosDevices });
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
  const [deviceForm, setDeviceForm] = useState(emptyDevice);
  const [editingId, setEditingId] = useState<string | null>(null);

export function SettingsHub() {
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
          <Button loading={saveSettings.isPending} onClick={persist}>
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
                    className="rounded-lg px-3.5 py-1.5 text-xs font-bold"
                    style={{ backgroundColor: form.primaryColor, color: readableForegroundOn(form.primaryColor) }}
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
              <Button className="w-full" variant="outline" onClick={persist} disabled={saveSettings.isPending} loading={saveSettings.isPending}>
                ذخیره همه تغییرات
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  const saveDeviceMut = useMutation({
    mutationFn: async () => {
      const payload = {
        name: deviceForm.name.trim(),
        protocol: deviceForm.protocol,
        psp: deviceForm.psp,
        ipAddress: deviceForm.ipAddress.trim() || null,
        port: deviceForm.port ? Number(deviceForm.port) : null,
        comPort: deviceForm.comPort.trim() || null,
        baudRate: deviceForm.baudRate ? Number(deviceForm.baudRate) : null,
        terminalId: deviceForm.terminalId.trim(),
        merchantId: deviceForm.merchantId.trim(),
        isActive: deviceForm.isActive,
      };
      if (!payload.name || !payload.terminalId || !payload.merchantId) {
        throw new Error("نام، ترمینال و پذیرنده الزامی است.");
      }
      if (editingId) return api.updatePosDevice(editingId, payload);
      return api.createPosDevice(payload);
    },
    onSuccess: () => {
      toast.success(editingId ? "کارتخوان به‌روز شد" : "کارتخوان اضافه شد");
      setDeviceForm(emptyDevice);
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["pos-devices-admin"] });
      qc.invalidateQueries({ queryKey: ["pos-devices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deletePosDevice(id),
    onSuccess: () => {
      toast.success("کارتخوان حذف شد");
      qc.invalidateQueries({ queryKey: ["pos-devices-admin"] });
      qc.invalidateQueries({ queryKey: ["pos-devices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testMut = useMutation({
    mutationFn: (id: string) => api.testPosDevice(id),
    onSuccess: (res) => {
      if (typeof res === "string") toast.message(res);
      else if (res && typeof res === "object") {
        const ok = "ok" in res ? res.ok : "success" in res ? Boolean((res as { success?: boolean }).success) : true;
        const message =
          "message" in res && typeof res.message === "string"
            ? res.message
            : ok
              ? "اتصال موفق"
              : "اتصال ناموفق";
        ok ? toast.success(message) : toast.error(message);
      } else toast.success("تست انجام شد");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function startEdit(d: PosDeviceDto) {
    setEditingId(d.id);
    setDeviceForm({
      name: d.name,
      protocol: d.protocol,
      psp: d.psp,
      ipAddress: d.ipAddress ?? "",
      port: d.port != null ? String(d.port) : "",
      comPort: d.comPort ?? "",
      baudRate: d.baudRate != null ? String(d.baudRate) : "",
      terminalId: d.terminalId,
      merchantId: d.merchantId ?? "",
      isActive: d.isActive,
    });
  }

  return (
    <Tabs defaultValue="store" className="space-y-4">
      <TabsList>
        <TabsTrigger value="store">فروشگاه</TabsTrigger>
        <TabsTrigger value="pos">کارتخوان‌ها</TabsTrigger>
      </TabsList>

      <TabsContent value="store">
        <Card className="max-w-3xl p-6">
          <h2 className="mb-4 font-black">برندینگ و موتور تم پویا</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="نام فروشگاه" value={form.storeName} onChange={(v) => setForm({ ...form, storeName: v })} />
            <Field label="لوگو URL" value={form.logoUrl} onChange={(v) => setForm({ ...form, logoUrl: v })} />
            <Field
              label="شناسه مالیاتی"
              value={form.taxIdentificationNumber}
              onChange={(v) => setForm({ ...form, taxIdentificationNumber: v })}
            />
            <Field
              label="آدرس پرینتر حرارتی"
              value={form.thermalPrinterHost}
              onChange={(v) => setForm({ ...form, thermalPrinterHost: v })}
            />
            <div>
              <Label>رنگ اصلی</Label>
              <Input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
            </div>
            <div>
              <Label>رنگ ثانویه</Label>
              <Input
                type="color"
                value={form.secondaryColor}
                onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
              />
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
      </TabsContent>

      <TabsContent value="pos" className="space-y-4">
        <Card className="p-6">
          <h2 className="mb-4 font-black">{editingId ? "ویرایش کارتخوان" : "افزودن کارتخوان"}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="نام" value={deviceForm.name} onChange={(v) => setDeviceForm({ ...deviceForm, name: v })} />
            <Field
              label="شناسه ترمینال"
              value={deviceForm.terminalId}
              onChange={(v) => setDeviceForm({ ...deviceForm, terminalId: v })}
            />
            <Field
              label="شناسه پذیرنده"
              value={deviceForm.merchantId}
              onChange={(v) => setDeviceForm({ ...deviceForm, merchantId: v })}
            />
            <div>
              <Label>پروتکل</Label>
              <Select
                value={deviceForm.protocol}
                onValueChange={(v) => setDeviceForm({ ...deviceForm, protocol: v as PosProtocol })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Lan">Lan</SelectItem>
                  <SelectItem value="Com">Com</SelectItem>
                  <SelectItem value="Serial">Serial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>PSP</Label>
              <Select value={deviceForm.psp} onValueChange={(v) => setDeviceForm({ ...deviceForm, psp: v as IranianPsp })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Unknown">نامشخص</SelectItem>
                  <SelectItem value="AsanPardakht">آسان‌پرداخت</SelectItem>
                  <SelectItem value="SamanKish">سامان‌کیش</SelectItem>
                  <SelectItem value="BehpardakhtMellat">به‌پرداخت ملت</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Field label="IP" value={deviceForm.ipAddress} onChange={(v) => setDeviceForm({ ...deviceForm, ipAddress: v })} />
            <Field label="پورت" value={deviceForm.port} onChange={(v) => setDeviceForm({ ...deviceForm, port: v })} />
            <Field label="COM Port" value={deviceForm.comPort} onChange={(v) => setDeviceForm({ ...deviceForm, comPort: v })} />
            <Field label="Baud Rate" value={deviceForm.baudRate} onChange={(v) => setDeviceForm({ ...deviceForm, baudRate: v })} />
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={deviceForm.isActive}
                onChange={(e) => setDeviceForm({ ...deviceForm, isActive: e.target.checked })}
              />
              فعال
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <Button disabled={saveDeviceMut.isPending} onClick={() => saveDeviceMut.mutate()}>
              {editingId ? "ذخیره تغییرات" : "افزودن"}
            </Button>
            {editingId ? (
              <Button
                variant="outline"
                onClick={() => {
                  setEditingId(null);
                  setDeviceForm(emptyDevice);
                }}
              >
                انصراف
              </Button>
            ) : null}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 font-black">لیست کارتخوان‌ها</h2>
          <div className="space-y-2">
            {(devices.data ?? []).map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-3 text-sm">
                <div>
                  <div className="font-bold">
                    {d.name}{" "}
                    <Badge variant={d.isActive ? "success" : "outline"}>{d.isActive ? "فعال" : "غیرفعال"}</Badge>
                  </div>
                  <div className="text-muted-foreground">
                    {d.protocol} · {d.psp} · ترمینال {d.terminalId}
                    {d.ipAddress ? ` · ${d.ipAddress}:${d.port ?? ""}` : ""}
                    {d.comPort ? ` · ${d.comPort}` : ""}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(d)}>
                    ویرایش
                  </Button>
                  <Button size="sm" variant="secondary" disabled={testMut.isPending} onClick={() => testMut.mutate(d.id)}>
                    تست
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteMut.mutate(d.id)}>
                    حذف
                  </Button>
                </div>
              </div>
            ))}
            {(devices.data ?? []).length === 0 ? <p className="text-muted-foreground">کارتخوانی ثبت نشده</p> : null}
          </div>
        </Card>
      </TabsContent>
    </Tabs>
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
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
