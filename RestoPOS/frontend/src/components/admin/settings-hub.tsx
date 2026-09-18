"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, Input, Label, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { applyTheme } from "@/lib/theme";
import type { IranianPsp, PosDeviceDto, PosProtocol } from "@/lib/types";

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

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
