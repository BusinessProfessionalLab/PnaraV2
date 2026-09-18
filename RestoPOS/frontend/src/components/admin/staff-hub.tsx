"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { ClipboardList, ShieldCheck, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, Input, Label } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import type { RoleDto, StaffDto } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStaff, useCreateStaff } from "@/queries/staff";
import { errorMessage } from "@/api/errors";

type RoleWithPermissions = RoleDto & { permissions?: string[] };

const ROLES = ["Cashier", "Manager", "Kitchen"] as const;
const ROLE_LABEL: Record<string, string> = {
  Cashier: "صندوق‌دار",
  Manager: "مدیر",
  Kitchen: "آشپزخانه",
  SuperAdmin: "مدیر کل",
};

export function StaffHub() {
  return (
    <Tabs defaultValue="staff">
      <TabsList className="mb-4">
        <TabsTrigger value="staff">پرسنل</TabsTrigger>
        <TabsTrigger value="roles">نقش‌ها</TabsTrigger>
      </TabsList>
      <TabsContent value="staff">
        <StaffPanel />
      </TabsContent>
      <TabsContent value="roles">
        <RolesPanel />
      </TabsContent>
    </Tabs>
  );
}

function StaffPanel() {
  const qc = useQueryClient();
  const staff = useQuery({ queryKey: ["staff"], queryFn: api.staff });
  const roles = useQuery({ queryKey: ["staff-roles"], queryFn: () => api.staffRoles().catch(() => api.roles()) });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const staff = useStaff();
  const createStaff = useCreateStaff();
  const [userName, setUserName] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Cashier");

  const createMut = useMutation({
    mutationFn: () =>
      api.createStaff({
  const [role, setRole] = useState<string>("Cashier");

  async function submit() {
    try {
      await createStaff.mutateAsync({
        userName,
        password,
        fullName,
        email: null,
        phoneNumber: null,
        personnelCode: null,
        roles: [role],
      }),
    onSuccess: () => {
      toast.success("پرسنل ایجاد شد");
      qc.invalidateQueries({ queryKey: ["staff"] });
      setUserName("");
      setFullName("");
      setPassword("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleNames = useMemo(() => (roles.data ?? []).map((r) => r.name), [roles.data]);

      });
      toast.success("پرسنل ایجاد شد");
      setUserName("");
      setFullName("");
      setPassword("");
      setRole("Cashier");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr_360px]">
      <Card className="space-y-2 p-4">
        <h2 className="font-black">افزودن پرسنل</h2>
        <Input placeholder="نام کاربری" value={userName} onChange={(e) => setUserName(e.target.value)} />
        <Input placeholder="نام کامل" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Input placeholder="رمز" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Input
          placeholder="نقش: Cashier / Manager / Kitchen"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          list="staff-role-options"
        />
        <datalist id="staff-role-options">
          {roleNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <Button
          onClick={() => createMut.mutate()}
          disabled={!userName || !fullName || !password || createMut.isPending}
        >
          ثبت
        </Button>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-black">فهرست پرسنل</h2>
        <ul className="space-y-2">
          {(staff.data ?? []).map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={`flex w-full items-center justify-between rounded-xl border p-3 text-right ${
                  selectedId === s.id ? "border-primary bg-primary/5" : ""
                }`}
              >
                <div>
                  <div className="font-bold">{s.fullName}</div>
                  <div className="text-xs text-muted-foreground">{s.userName}</div>
                  {!s.isActive ? <Badge variant="danger">غیرفعال</Badge> : null}
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  {s.roles.map((r) => (
                    <Badge key={r}>{r}</Badge>
                  ))}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-4">
        {selectedId ? (
          <StaffDetail
            staffId={selectedId}
            availableRoles={roleNames}
            onChanged={() => qc.invalidateQueries({ queryKey: ["staff"] })}
          />
        ) : (
          <p className="text-sm text-muted-foreground">یک پرسنل را برای جزئیات انتخاب کنید.</p>
        )}
      </Card>
    </div>
  );
}

function StaffDetail({
  staffId,
  availableRoles,
  onChanged,
}: {
  staffId: string;
  availableRoles: string[];
  onChanged: () => void;
}) {
  const detail = useQuery({
    queryKey: ["staff", staffId],
    queryFn: () => api.staffById(staffId),
  });

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [personnelCode, setPersonnelCode] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  useEffect(() => {
    if (!detail.data) return;
    const s: StaffDto = detail.data;
    setFullName(s.fullName);
    setEmail(s.email ?? "");
    setPhone(s.phoneNumber ?? "");
    setPersonnelCode(s.personnelCode ?? "");
    setIsActive(s.isActive);
    setSelectedRoles(s.roles ?? []);
  }, [detail.data]);

  const updateMut = useMutation({
    mutationFn: () =>
      api.updateStaff(staffId, {
        fullName: fullName.trim(),
        email: email.trim() || null,
        phoneNumber: phone.trim() || null,
        personnelCode: personnelCode.trim() || null,
        isActive,
      }),
    onSuccess: () => {
      toast.success("پرسنل به‌روز شد");
      onChanged();
      detail.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deactivateMut = useMutation({
    mutationFn: () => api.deactivateStaff(staffId),
    onSuccess: () => {
      toast.success("پرسنل غیرفعال شد");
      onChanged();
      detail.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const passwordMut = useMutation({
    mutationFn: () => api.changeStaffPassword(staffId, newPassword),
    onSuccess: () => {
      toast.success("رمز تغییر کرد");
      setNewPassword("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rolesMut = useMutation({
    mutationFn: () => api.assignStaffRoles(staffId, selectedRoles),
    onSuccess: () => {
      toast.success("نقش‌ها ذخیره شد");
      onChanged();
      detail.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleRole(name: string) {
    setSelectedRoles((prev) => (prev.includes(name) ? prev.filter((r) => r !== name) : [...prev, name]));
  }

  if (detail.isLoading) return <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>;
  if (!detail.data) return <p className="text-sm text-muted-foreground">پرسنل یافت نشد</p>;

  const allRoleOptions = Array.from(new Set([...availableRoles, ...selectedRoles]));

  return (
    <div className="space-y-3">
      <h3 className="font-black">{detail.data.userName}</h3>
      <Label>نام کامل</Label>
      <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
      <Label>ایمیل</Label>
      <Input value={email} onChange={(e) => setEmail(e.target.value)} />
      <Label>موبایل</Label>
      <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
      <Label>کد پرسنلی</Label>
      <Input value={personnelCode} onChange={(e) => setPersonnelCode(e.target.value)} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        فعال
      </label>
      <Button className="w-full" onClick={() => updateMut.mutate()} disabled={!fullName.trim() || updateMut.isPending}>
        ذخیره مشخصات
      </Button>
      <Button className="w-full" variant="destructive" onClick={() => deactivateMut.mutate()} disabled={deactivateMut.isPending}>
        غیرفعال‌سازی
      </Button>

      <div className="space-y-2 border-t pt-3">
        <Label>تغییر رمز</Label>
        <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="رمز جدید" />
        <Button
          className="w-full"
          variant="outline"
          disabled={!newPassword || passwordMut.isPending}
          onClick={() => passwordMut.mutate()}
        >
          تغییر رمز
        </Button>
      </div>

      <div className="space-y-2 border-t pt-3">
        <Label>نقش‌ها</Label>
        <div className="flex flex-wrap gap-2">
          {allRoleOptions.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => toggleRole(r)}
              className={`rounded-lg border px-2 py-1 text-xs ${selectedRoles.includes(r) ? "border-primary bg-primary/10" : ""}`}
            >
              {r}
            </button>
          ))}
        </div>
        <Button className="w-full" variant="outline" onClick={() => rolesMut.mutate()} disabled={rolesMut.isPending}>
          ذخیره نقش‌ها
        </Button>
      </div>
    </div>
  );
}

function RolesPanel() {
  const qc = useQueryClient();
  const roles = useQuery({
    queryKey: ["roles"],
    queryFn: () => api.roles().catch(() => api.staffRoles()),
  });
  const catalog = useQuery({ queryKey: ["permission-catalog"], queryFn: api.permissionCatalog });
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [createPerms, setCreatePerms] = useState<string[]>([]);
  const [editPerms, setEditPerms] = useState<string[]>([]);

  const selected = (roles.data as RoleWithPermissions[] | undefined)?.find((r) => r.id === selectedRoleId) ?? null;

  useEffect(() => {
    if (!selected) {
      setEditPerms([]);
      return;
    }
    setEditPerms([...(selected.permissions ?? [])]);
  }, [selected]);

  const createMut = useMutation({
    mutationFn: () =>
      api.createRole({
        name: name.trim(),
        description: description.trim() || null,
        permissions: createPerms,
      }),
    onSuccess: () => {
      toast.success("نقش ساخته شد");
      setName("");
      setDescription("");
      setCreatePerms([]);
      qc.invalidateQueries({ queryKey: ["roles"] });
      qc.invalidateQueries({ queryKey: ["staff-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePermsMut = useMutation({
    mutationFn: () => api.updateRolePermissions(selectedRoleId!, editPerms),
    onSuccess: () => {
      toast.success("مجوزهای نقش به‌روز شد");
      qc.invalidateQueries({ queryKey: ["roles"] });
      qc.invalidateQueries({ queryKey: ["staff-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function togglePerm(list: string[], code: string, setter: (v: string[]) => void) {
    setter(list.includes(code) ? list.filter((c) => c !== code) : [...list, code]);
  }

  const permsByModule = useMemo(() => {
    const map = new Map<string, { code: string; displayNameFa: string }[]>();
    for (const p of catalog.data ?? []) {
      const arr = map.get(p.module) ?? [];
      arr.push({ code: p.code, displayNameFa: p.displayNameFa });
      map.set(p.module, arr);
    }
    return Array.from(map.entries());
  }, [catalog.data]);

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr_360px]">
      <Card className="space-y-2 p-4">
        <h2 className="font-black">نقش جدید</h2>
        <Input placeholder="نام نقش" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="توضیح" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="max-h-48 space-y-2 overflow-y-auto text-sm">
          {permsByModule.map(([module, items]) => (
            <div key={module}>
              <div className="mb-1 text-xs font-bold text-muted-foreground">{module}</div>
              <div className="flex flex-wrap gap-1">
                {items.map((p) => (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => togglePerm(createPerms, p.code, setCreatePerms)}
                    className={`rounded-lg border px-2 py-1 text-[11px] ${
                      createPerms.includes(p.code) ? "border-primary bg-primary/10" : ""
                    }`}
                  >
                    {p.displayNameFa}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Button disabled={!name.trim() || createMut.isPending} onClick={() => createMut.mutate()}>
          ساخت نقش
        </Button>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-black">فهرست نقش‌ها</h2>
        <ul className="space-y-2">
          {((roles.data as RoleWithPermissions[] | undefined) ?? []).map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSelectedRoleId(r.id)}
                className={`flex w-full flex-col rounded-xl border p-3 text-right ${
                  selectedRoleId === r.id ? "border-primary bg-primary/5" : ""
                }`}
              >
                <span className="font-bold">{r.name}</span>
                <span className="text-xs text-muted-foreground">{r.description || "—"}</span>
                <span className="mt-1 text-[11px] text-muted-foreground">
                  {(r.permissions ?? []).length} مجوز
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-4">
        {!selected ? (
          <p className="text-sm text-muted-foreground">یک نقش را برای ویرایش مجوزها انتخاب کنید.</p>
        ) : (
          <div className="space-y-3">
            <h3 className="font-black">{selected.name}</h3>
            <p className="text-xs text-muted-foreground">{selected.description || "بدون توضیح"}</p>
            <div className="max-h-80 space-y-3 overflow-y-auto">
              {permsByModule.map(([module, items]) => (
                <div key={module}>
                  <div className="mb-1 text-xs font-bold text-muted-foreground">{module}</div>
                  <div className="flex flex-wrap gap-1">
                    {items.map((p) => (
                      <button
                        key={p.code}
                        type="button"
                        onClick={() => togglePerm(editPerms, p.code, setEditPerms)}
                        className={`rounded-lg border px-2 py-1 text-[11px] ${
                          editPerms.includes(p.code) ? "border-primary bg-primary/10" : ""
                        }`}
                      >
                        {p.displayNameFa}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <Button className="w-full" onClick={() => updatePermsMut.mutate()} disabled={updatePermsMut.isPending}>
              ذخیره مجوزها
            </Button>
          </div>
        )}
      </Card>
    </div>
    <div className="space-y-5">
      <PageHeader
        title="پرسنل"
        description="کاربران صندوق، مدیریت و آشپزخانه را تعریف و مدیریت کنید"
      />

      <div className="grid items-start gap-4 lg:grid-cols-[22rem_1fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border/70 px-5 py-4">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <UserPlus className="size-4" aria-hidden />
            </div>
            <h2 className="text-[15px] font-bold">افزودن پرسنل</h2>
          </div>
          <form
            className="space-y-4 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!userName.trim() || !fullName.trim() || !password) {
                toast.error("نام، نام کاربری و رمز را کامل کنید");
                return;
              }
              submit();
            }}
          >
            <Field label="نام کامل">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="مثلاً سارا محمدی" />
            </Field>
            <Field label="نام کاربری">
              <Input value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="sara" dir="ltr" className="text-start" />
            </Field>
            <Field label="رمز عبور" hint="حداقل ۸ کاراکتر">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" dir="ltr" className="text-start" />
            </Field>
            <Field label="نقش">
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button
              type="submit"
              className="w-full"
              loading={createStaff.isPending}
              disabled={!userName.trim() || !fullName.trim() || !password}
            >
              ثبت پرسنل
            </Button>
          </form>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="size-4 text-muted-foreground" aria-hidden />
              <h2 className="text-[15px] font-bold">فهرست پرسنل</h2>
            </div>
            {staff.data ? (
              <Badge variant="neutral" className="tabular-nums">
                {staff.data.length} نفر
              </Badge>
            ) : null}
          </div>

          {staff.isLoading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : (staff.data ?? []).length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={Users}
                title="پرسنلی ثبت نشده"
                description="از فرم «افزودن پرسنل» اولین کاربر را بسازید"
              />
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {(staff.data ?? []).map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
                    {s.fullName?.trim().charAt(0) || "؟"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{s.fullName}</span>
                      {s.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-success">
                          <span className="size-1.5 rounded-full bg-success" aria-hidden />
                          فعال
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">غیرفعال</span>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground" dir="ltr" style={{ textAlign: "start" }}>
                      @{s.userName}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                    {s.roles.map((r) => (
                      <span
                        key={r}
                        className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground"
                      >
                        <ShieldCheck className="size-3" aria-hidden />
                        {ROLE_LABEL[r] ?? r}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
