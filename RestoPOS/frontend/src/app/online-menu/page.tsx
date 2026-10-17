"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Minus, Plus, ShoppingBag, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatToman } from "@/lib/currency";
import { useRegisterOnlineCustomer } from "@/api";

const menu = [
  { id: "latte", name: "لاته", description: "اسپرسو دوبل با شیر بخار داده‌شده", price: 180000, category: "قهوه گرم" },
  { id: "americano", name: "آمریکانو", description: "اسپرسو با آب داغ", price: 125000, category: "قهوه گرم" },
  { id: "cake", name: "کیک شکلاتی", description: "کیک شکلات تلخ روز", price: 155000, category: "کیک و شیرینی" },
  { id: "iced", name: "آیس لاته", description: "لاته خنک با یخ", price: 195000, category: "نوشیدنی سرد" },
];

export default function OnlineMenuPage() {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const registerCustomer = useRegisterOnlineCustomer();
  const selected = menu.filter((item) => (quantities[item.id] ?? 0) > 0);
  const total = useMemo(() => selected.reduce((sum, item) => sum + item.price * quantities[item.id], 0), [selected, quantities]);
  const update = (id: string, delta: number) => setQuantities((current) => ({ ...current, [id]: Math.max(0, (current[id] ?? 0) + delta) }));

  const checkout = () => {
    if (!selected.length) return toast.error("ابتدا یک محصول به سبد اضافه کنید.");
    if (!name.trim() || phone.replace(/\D/g, "").length < 10) return toast.error("برای ثبت سفارش، نام و شماره موبایل معتبر لازم است.");
    registerCustomer.mutate({ phoneNumber: phone.trim(), fullName: name.trim(), marketingConsent: consent }, {
      onSuccess: () => setSubmitted(true),
      onError: (error: Error) => toast.error(error.message),
    });
  };

  return <main className="min-h-screen bg-muted/30 px-4 py-8" dir="rtl"><div className="mx-auto max-w-5xl space-y-6">
    <header className="flex items-center justify-between"><div><div className="text-xs font-bold text-primary">منوی دیجیتال</div><h1 className="mt-1 text-2xl font-black">کافه پنارا</h1><p className="mt-1 text-sm text-muted-foreground">انتخاب کن، سفارش بده و امتیاز باشگاه بگیر</p></div><Link href="/account" className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm font-semibold"><UserRound className="size-4" /> حساب من</Link></header>
    {submitted ? <Card className="mx-auto max-w-xl p-6 text-center"><div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><ShoppingBag /></div><h2 className="text-xl font-black">سفارش آماده ثبت است</h2><p className="mt-2 text-sm text-muted-foreground">سلام {name}، شماره {phone} به پروفایل باشگاه مشتریان پیوست می‌شود.</p><div className="mt-4 rounded-xl bg-muted p-3 text-sm">مبلغ سفارش: <b>{formatToman(total)}</b> · امتیاز پیش‌بینی‌شده: <b>{Math.floor(total / 10000)}</b></div><Button className="mt-4" onClick={() => toast.info("اتصال به ثبت سفارش و پرداخت آنلاین در مرحله API فعال می‌شود.")}>ادامه به پرداخت <ArrowLeft className="size-4" /></Button></Card> : <div className="grid gap-5 lg:grid-cols-[1fr_340px]"><section className="grid gap-3 sm:grid-cols-2">{menu.map((item) => <Card key={item.id} className="flex flex-col p-4"><div className="mb-3 flex h-28 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-rose-100 text-4xl">☕</div><Badge className="w-fit" variant="outline">{item.category}</Badge><h2 className="mt-2 font-black">{item.name}</h2><p className="mt-1 flex-1 text-xs text-muted-foreground">{item.description}</p><div className="mt-4 flex items-center justify-between"><b>{formatToman(item.price)}</b><div className="flex items-center gap-2"><button aria-label="کم کردن" onClick={() => update(item.id, -1)} className="rounded-lg border p-1.5"><Minus className="size-4" /></button><span className="min-w-5 text-center text-sm font-bold">{(quantities[item.id] ?? 0).toLocaleString("fa-IR")}</span><button aria-label="اضافه کردن" onClick={() => update(item.id, 1)} className="rounded-lg bg-primary p-1.5 text-white"><Plus className="size-4" /></button></div></div></Card>)}</section>
    <Card className="h-fit space-y-4 p-4"><div className="flex items-center gap-2"><ShoppingBag className="size-4 text-primary" /><h2 className="font-black">اطلاعات سفارش و باشگاه</h2></div><div className="space-y-3">{selected.length ? selected.map((item) => <div key={item.id} className="flex justify-between text-sm"><span>{item.name} × {quantities[item.id]}</span><b>{formatToman(item.price * quantities[item.id])}</b></div>) : <p className="text-xs text-muted-foreground">هنوز محصولی انتخاب نشده.</p>}</div><div className="border-t pt-3"><div className="flex justify-between font-black"><span>جمع سفارش</span><span>{formatToman(total)}</span></div><p className="mt-1 text-[11px] text-muted-foreground">امتیاز خرید بعد از پرداخت به حساب شما اضافه می‌شود.</p></div><div className="space-y-3 border-t pt-3"><label className="block space-y-1"><span className="text-xs font-semibold">نام و نام خانوادگی</span><Input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="نام شما" /></label><label className="block space-y-1"><span className="text-xs font-semibold">شماره موبایل</span><Input autoComplete="tel-national" inputMode="tel" dir="ltr" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="09xxxxxxxxx" /></label><label className="flex items-start gap-2 text-[11px] text-muted-foreground"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 accent-primary" /> مایلم پیامک‌های تبلیغاتی و پیشنهادهای کافه را دریافت کنم.</label><Button className="w-full" onClick={checkout} loading={registerCustomer.isPending}>تأیید اطلاعات و ادامه</Button><p className="text-[10px] leading-5 text-muted-foreground">با وارد کردن شماره، خرید به سابقه باشگاه متصل می‌شود. رضایت پیامک تبلیغاتی اختیاری است.</p></div></Card></div>}
  </div></main>;
}
