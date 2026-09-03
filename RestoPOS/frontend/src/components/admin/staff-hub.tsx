"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ClipboardList, ShieldCheck, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
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

const ROLES = ["Cashier", "Manager", "Kitchen"] as const;
const ROLE_LABEL: Record<string, string> = {
  Cashier: "صندوق‌دار",
  Manager: "مدیر",
  Kitchen: "آشپزخانه",
  SuperAdmin: "مدیر کل",
};

export function StaffHub() {
  const staff = useStaff();
  const createStaff = useCreateStaff();
  const [userName, setUserName] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
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
