"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCreateDiningArea,
  useCreateDiningTable,
  useDeleteDiningArea,
  useDeleteDiningTable,
  useDiningArea,
  useDiningAreas,
  useDiningTable,
  useDiningTables,
  useTablesByArea,
  useTransferTable,
  useUpdateDiningArea,
  useUpdateDiningTable,
  useUpdateTableStatus,
} from "@/api";
import type { DiningAreaDto, DiningTableDto, TableStatus } from "@/lib/types";

const TABLE_STATUSES: { value: TableStatus; label: string }[] = [
  { value: "Available", label: "آزاد" },
  { value: "Occupied", label: "اشغال" },
  { value: "Reserved", label: "رزرو" },
  { value: "Cleaning", label: "نظافت" },
];

function statusLabel(s: TableStatus | string) {
  return TABLE_STATUSES.find((x) => x.value === s)?.label ?? s;
}

function statusVariant(s: TableStatus | string): "success" | "danger" | "warning" | "outline" {
  switch (s) {
    case "Available":
      return "success";
    case "Occupied":
      return "danger";
    case "Reserved":
      return "warning";
    default:
      return "outline";
  }
}

export function TablesHub() {
  return (
    <Tabs defaultValue="areas" className="space-y-4" dir="rtl">
      <TabsList>
        <TabsTrigger value="areas">سالن‌ها</TabsTrigger>
        <TabsTrigger value="tables">میزها</TabsTrigger>
      </TabsList>
      <TabsContent value="areas">
        <AreasTab />
      </TabsContent>
      <TabsContent value="tables">
        <TablesTab />
      </TabsContent>
    </Tabs>
  );
}

/* ───────────────────── سالن‌ها ───────────────────── */

function AreasTab() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [displayPriority, setDisplayPriority] = useState("0");
  const [isActive, setIsActive] = useState(true);

  const areas = useDiningAreas(false);
  const createMut = useCreateDiningArea();

  const submitArea = () =>
    createMut.mutate(
      {
        name: name.trim(),
        description: description.trim() || null,
        displayPriority: Number(displayPriority) || 0,
        isActive,
      },
      {
        onSuccess: () => {
          toast.success("سالن ثبت شد");
          setName("");
          setDescription("");
          setDisplayPriority("0");
          setIsActive(true);
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );

  const sorted = useMemo(
    () => [...(areas.data ?? [])].sort((a, b) => a.displayPriority - b.displayPriority || a.name.localeCompare(b.name, "fa")),
    [areas.data],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr_360px]">
      <Card className="space-y-3 p-4">
        <h2 className="font-black">سالن جدید</h2>
        <div className="space-y-2">
          <Label>نام</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً سالن اصلی" />
        </div>
        <div className="space-y-2">
          <Label>توضیحات</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>
        <div className="space-y-2">
          <Label>اولویت نمایش</Label>
          <Input
            type="number"
            value={displayPriority}
            onChange={(e) => setDisplayPriority(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          فعال
        </label>
        <Button
          onClick={submitArea}
          disabled={!name.trim() || createMut.isPending}
        >
          ثبت سالن
        </Button>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-black">فهرست سالن‌ها</h2>
        {areas.isLoading ? (
          <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
        ) : (
          <ul className="space-y-2">
            {sorted.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(a.id)}
                  className={`flex w-full items-center justify-between rounded-xl border p-3 text-right ${
                    selectedId === a.id ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <div>
                    <div className="font-bold">{a.name}</div>
                    {a.description ? (
                      <div className="text-xs text-muted-foreground line-clamp-1">{a.description}</div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">اولویت {a.displayPriority}</Badge>
                    {a.isActive ? (
                      <Badge variant="success">فعال</Badge>
                    ) : (
                      <Badge variant="outline">غیرفعال</Badge>
                    )}
                  </div>
                </button>
              </li>
            ))}
            {!sorted.length ? (
              <li className="text-sm text-muted-foreground">سالنی ثبت نشده است.</li>
            ) : null}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        {selectedId ? (
          <AreaDetail areaId={selectedId} onDeleted={() => setSelectedId(null)} />
        ) : (
          <p className="text-sm text-muted-foreground">یک سالن را برای ویرایش انتخاب کنید.</p>
        )}
      </Card>
    </div>
  );
}

function AreaDetail({
  areaId,
  onDeleted,
}: {
  areaId: string;
  onDeleted: () => void;
}) {
  const detail = useDiningArea(areaId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [displayPriority, setDisplayPriority] = useState("0");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!detail.data) return;
    const a: DiningAreaDto = detail.data;
    setName(a.name);
    setDescription(a.description ?? "");
    setDisplayPriority(String(a.displayPriority));
    setIsActive(a.isActive);
  }, [detail.data]);

  const updateMut = useUpdateDiningArea();
  const deleteMut = useDeleteDiningArea();

  const saveArea = () =>
    updateMut.mutate(
      {
        id: areaId,
        payload: {
          name: name.trim(),
          description: description.trim() || null,
          displayPriority: Number(displayPriority) || 0,
          isActive,
        },
      },
      { onSuccess: () => toast.success("سالن به‌روز شد"), onError: (e: Error) => toast.error(e.message) },
    );

  const removeArea = () =>
    deleteMut.mutate(areaId, {
      onSuccess: () => {
        toast.success("سالن حذف شد");
        onDeleted();
      },
      onError: (e: Error) => toast.error(e.message),
    });

  if (detail.isLoading) return <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>;
  if (!detail.data) return <p className="text-sm text-muted-foreground">سالن یافت نشد</p>;

  return (
    <div className="space-y-3">
      <h3 className="font-black">ویرایش سالن</h3>
      <div className="space-y-2">
        <Label>نام</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>توضیحات</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </div>
      <div className="space-y-2">
        <Label>اولویت نمایش</Label>
        <Input type="number" value={displayPriority} onChange={(e) => setDisplayPriority(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        فعال
      </label>
      <Button className="w-full" onClick={saveArea} disabled={!name.trim() || updateMut.isPending}>
        ذخیره تغییرات
      </Button>
      <Button className="w-full" variant="destructive" onClick={removeArea} disabled={deleteMut.isPending}>
        حذف سالن
      </Button>
    </div>
  );
}

/* ───────────────────── میزها ───────────────────── */

function TablesTab() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterAreaId, setFilterAreaId] = useState<string>("all");
  const [diningAreaId, setDiningAreaId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("4");
  const [displayPriority, setDisplayPriority] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [transferFrom, setTransferFrom] = useState("");
  const [transferTo, setTransferTo] = useState("");

  const areas = useDiningAreas(false);
  const allTables = useDiningTables(false);
  const byArea = useTablesByArea(filterAreaId === "all" ? null : filterAreaId, false);

  const tablesLoading = filterAreaId === "all" ? allTables.isLoading : byArea.isLoading;

  const sorted = useMemo(() => {
    const tables =
      filterAreaId === "all" ? (allTables.data ?? []) : (byArea.data ?? []);
    return [...tables].sort(
      (a, b) =>
        a.displayPriority - b.displayPriority ||
        a.code.localeCompare(b.code, "fa", { numeric: true }),
    );
  }, [filterAreaId, allTables.data, byArea.data]);

  const areaOptions = useMemo(
    () => [...(areas.data ?? [])].sort((a, b) => a.displayPriority - b.displayPriority),
    [areas.data],
  );

  useEffect(() => {
    if (!diningAreaId && areaOptions.length) setDiningAreaId(areaOptions[0].id);
  }, [areaOptions, diningAreaId]);

  const createMut = useCreateDiningTable();
  const transferMut = useTransferTable();

  const submitTable = () =>
    createMut.mutate(
      {
        diningAreaId,
        code: code.trim(),
        name: name.trim() || null,
        capacity: Number(capacity) || 1,
        displayPriority: Number(displayPriority) || 0,
        isActive,
      },
      {
        onSuccess: () => {
          toast.success("میز ثبت شد");
          setCode("");
          setName("");
          setCapacity("4");
          setDisplayPriority("0");
          setIsActive(true);
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );

  const submitTransfer = () =>
    transferMut.mutate(
      { fromTableId: transferFrom, toTableId: transferTo },
      {
        onSuccess: () => {
          toast.success("انتقال میز انجام شد");
          setTransferFrom("");
          setTransferTo("");
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );

  const allForSelect = allTables.data ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[360px_1fr_360px]">
        <Card className="space-y-3 p-4">
          <h2 className="font-black">میز جدید</h2>
          <div className="space-y-2">
            <Label>سالن</Label>
            <Select value={diningAreaId || undefined} onValueChange={setDiningAreaId}>
              <SelectTrigger>
                <SelectValue placeholder="انتخاب سالن" />
              </SelectTrigger>
              <SelectContent>
                {areaOptions.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>کد میز</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="مثلاً T-12" />
          </div>
          <div className="space-y-2">
            <Label>نام (اختیاری)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً میز وی‌آی‌پی" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>ظرفیت</Label>
              <Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>اولویت</Label>
              <Input type="number" value={displayPriority} onChange={(e) => setDisplayPriority(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            فعال
          </label>
          <Button
            onClick={submitTable}
            disabled={!diningAreaId || !code.trim() || createMut.isPending}
          >
            ثبت میز
          </Button>
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-black">فهرست میزها</h2>
            <Select value={filterAreaId} onValueChange={setFilterAreaId}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه سالن‌ها</SelectItem>
                {areaOptions.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {tablesLoading ? (
            <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-right text-muted-foreground">
                    <th className="p-2">کد</th>
                    <th>نام</th>
                    <th>سالن</th>
                    <th>ظرفیت</th>
                    <th>وضعیت</th>
                    <th>فعال</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((t) => (
                    <tr
                      key={t.id}
                      className={`cursor-pointer border-t hover:bg-muted/40 ${selectedId === t.id ? "bg-primary/5" : ""}`}
                      onClick={() => setSelectedId(t.id)}
                    >
                      <td className="p-2 font-mono font-bold">{t.code}</td>
                      <td>{t.name || "—"}</td>
                      <td>{t.diningAreaName || "—"}</td>
                      <td>{t.capacity}</td>
                      <td>
                        <Badge variant={statusVariant(t.status)}>{statusLabel(t.status)}</Badge>
                      </td>
                      <td>
                        {t.isActive ? (
                          <Badge variant="success">فعال</Badge>
                        ) : (
                          <Badge variant="outline">غیرفعال</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!sorted.length ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-muted-foreground">
                        میزی یافت نشد
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-4">
          {selectedId ? (
            <TableDetail
              tableId={selectedId}
              areas={areaOptions}
              onDeleted={() => setSelectedId(null)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">یک میز را برای ویرایش انتخاب کنید.</p>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="mb-3 font-black">انتقال سفارش بین میزها</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label>از میز</Label>
            <Select value={transferFrom || undefined} onValueChange={setTransferFrom}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="انتخاب مبدأ" />
              </SelectTrigger>
              <SelectContent>
                {allForSelect.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.code}
                    {t.name ? ` — ${t.name}` : ""} ({statusLabel(t.status)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>به میز</Label>
            <Select value={transferTo || undefined} onValueChange={setTransferTo}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="انتخاب مقصد" />
              </SelectTrigger>
              <SelectContent>
                {allForSelect
                  .filter((t) => t.id !== transferFrom)
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.code}
                      {t.name ? ` — ${t.name}` : ""} ({statusLabel(t.status)})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={!transferFrom || !transferTo || transferFrom === transferTo || transferMut.isPending}
            onClick={submitTransfer}
          >
            انتقال
          </Button>
        </div>
      </Card>
    </div>
  );
}

function TableDetail({
  tableId,
  areas,
  onDeleted,
}: {
  tableId: string;
  areas: DiningAreaDto[];
  onDeleted: () => void;
}) {
  const detail = useDiningTable(tableId);

  const [diningAreaId, setDiningAreaId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("4");
  const [displayPriority, setDisplayPriority] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [status, setStatus] = useState<TableStatus>("Available");

  useEffect(() => {
    if (!detail.data) return;
    const t: DiningTableDto = detail.data;
    setDiningAreaId(t.diningAreaId);
    setCode(t.code);
    setName(t.name ?? "");
    setCapacity(String(t.capacity));
    setDisplayPriority(String(t.displayPriority));
    setIsActive(t.isActive);
    setStatus(t.status);
  }, [detail.data]);

  const updateMut = useUpdateDiningTable();
  const statusMut = useUpdateTableStatus();
  const deleteMut = useDeleteDiningTable();

  const saveTable = () =>
    updateMut.mutate(
      {
        id: tableId,
        payload: {
          diningAreaId,
          code: code.trim(),
          name: name.trim() || null,
          capacity: Number(capacity) || 1,
          displayPriority: Number(displayPriority) || 0,
          isActive,
        },
      },
      { onSuccess: () => toast.success("میز به‌روز شد"), onError: (e: Error) => toast.error(e.message) },
    );

  const changeStatus = (next: TableStatus) =>
    statusMut.mutate(
      { id: tableId, status: next },
      {
        onSuccess: () => {
          toast.success(`وضعیت به «${statusLabel(next)}» تغییر کرد`);
          setStatus(next);
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );

  const removeTable = () =>
    deleteMut.mutate(tableId, {
      onSuccess: () => {
        toast.success("میز حذف شد");
        onDeleted();
      },
      onError: (e: Error) => toast.error(e.message),
    });

  if (detail.isLoading) return <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>;
  if (!detail.data) return <p className="text-sm text-muted-foreground">میز یافت نشد</p>;

  return (
    <div className="space-y-3">
      <h3 className="font-black">ویرایش میز</h3>
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant={statusVariant(detail.data.status)}>{statusLabel(detail.data.status)}</Badge>
        {detail.data.currentOrderId ? <Badge variant="outline">سفارش فعال</Badge> : null}
      </div>
      <div className="space-y-2">
        <Label>وضعیت</Label>
        <Select
          value={status}
          onValueChange={(v) => changeStatus(v as TableStatus)}
          disabled={statusMut.isPending}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TABLE_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>سالن</Label>
        <Select value={diningAreaId || undefined} onValueChange={setDiningAreaId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {areas.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>کد</Label>
        <Input value={code} onChange={(e) => setCode(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>نام</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>ظرفیت</Label>
          <Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>اولویت</Label>
          <Input type="number" value={displayPriority} onChange={(e) => setDisplayPriority(e.target.value)} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        فعال
      </label>
      <Button
        className="w-full"
        onClick={saveTable}
        disabled={!diningAreaId || !code.trim() || updateMut.isPending}
      >
        ذخیره تغییرات
      </Button>
      <Button className="w-full" variant="destructive" onClick={removeTable} disabled={deleteMut.isPending}>
        حذف میز
      </Button>
    </div>
  );
}
