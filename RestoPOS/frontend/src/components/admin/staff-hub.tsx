"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api";
import { ClipboardList } from "lucide-react";

export function StaffHub() {
  const qc = useQueryClient();
  const staff = useQuery({ queryKey: ["staff"], queryFn: api.staff });
  const [userName, setUserName] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Cashier");
  const mut = useMutation({
    mutationFn: () =>
      api.createStaff({
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
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <Card className="space-y-2 p-4">
        <h2 className="font-black">افزودن پرسنل</h2>
        <Input placeholder="نام کاربری" value={userName} onChange={(e) => setUserName(e.target.value)} />
        <Input placeholder="نام کامل" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Input placeholder="رمز" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Input placeholder="نقش: Cashier / Manager / Kitchen" value={role} onChange={(e) => setRole(e.target.value)} />
        <Button onClick={() => mut.mutate()}>ثبت</Button>
      </Card>
      <Card className="p-4">
        <h2 className="mb-3 text-lg font-bold">فهرست پرسنل</h2>
        {staff.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : (staff.data ?? []).length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="پرسنلی ثبت نشده"
            description="از فرم سمت چپ پرسنل جدید اضافه کنید"
          />
        ) : (
        <ul className="space-y-2">
          {(staff.data ?? []).map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <div className="font-bold">{s.fullName}</div>
                <div className="text-xs text-muted-foreground">{s.userName}</div>
              </div>
              <div className="flex gap-1">
                {s.roles.map((r) => (
                  <Badge key={r}>{r}</Badge>
                ))}
              </div>
            </li>
          ))}
        </ul>
        )}
      </Card>
    </div>
  );
}
