"use client";

import {
  Activity,
  BarChart3,
  Cake,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Gift,
  MessageSquareText,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { formatToman } from "@/lib/currency";
import { useCreateCustomer, useCustomersPaged, useCustomerOrders, useCustomerPointHistory, useLoyaltySettings, useQueueLoyaltyCampaign, useUpdateLoyaltySettings } from "@/api";
import type { CustomerDto } from "@/lib/types";

type Section = "overview" | "members" | "rewards" | "campaigns" | "reports" | "portal";
type Member = {
  id: string;
  name: string;
  phone: string;
  tier: string;
  visits: number;
  spend: number;
  points: number;
  wallet: number;
  lastVisit: string;
  consent: boolean;
  gender: string;
  personality: string;
  birthday: string;
  favorites: string[];
};

const initialMembers: Member[] = [
  { id: "1", name: "سارا محمدی", phone: "09121234567", tier: "طلایی", visits: 28, spend: 18600000, points: 2480, wallet: 320000, lastVisit: "امروز", consent: true, gender: "زن", personality: "درون‌گرا", birthday: "1375/08/12", favorites: ["لاته", "کیک شکلاتی"] },
  { id: "2", name: "امیر رضایی", phone: "09129876543", tier: "نقره‌ای", visits: 12, spend: 7420000, points: 960, wallet: 0, lastVisit: "۳ روز پیش", consent: true, gender: "مرد", personality: "برون‌گرا", birthday: "1370/03/22", favorites: ["آمریکانو"] },
  { id: "3", name: "نرگس احمدی", phone: "09351234567", tier: "برنزی", visits: 4, spend: 2180000, points: 180, wallet: 54000, lastVisit: "۴۲ روز پیش", consent: false, gender: "زن", personality: "متعادل", birthday: "1380/11/02", favorites: ["چای ماسالا"] },
  { id: "4", name: "آرمان کریمی", phone: "09125550123", tier: "طلایی", visits: 34, spend: 23100000, points: 3190, wallet: 180000, lastVisit: "دیروز", consent: true, gender: "مرد", personality: "درون‌گرا", birthday: "1368/05/17", favorites: ["اسپرسو", "ساندویچ مرغ"] },
  { id: "5", name: "مریم کاظمی", phone: "09127770123", tier: "نقره‌ای", visits: 9, spend: 5130000, points: 610, wallet: 75000, lastVisit: "۱۱ روز پیش", consent: true, gender: "زن", personality: "متعادل", birthday: "1378/02/06", favorites: ["کاپوچینو"] },
];

const sectionItems: { id: Section; title: string; icon: typeof Users }[] = [
  { id: "overview", title: "نمای کلی", icon: BarChart3 },
  { id: "members", title: "مشتری‌ها", icon: Users },
  { id: "rewards", title: "امتیاز و پاداش", icon: Gift },
  { id: "campaigns", title: "پیامک‌ها", icon: MessageSquareText },
  { id: "reports", title: "گزارش‌ها", icon: Activity },
  { id: "portal", title: "پیش‌نمایش اکانت", icon: ShieldCheck },
];

const peakHours = [
  { label: "۸", value: 22 }, { label: "۱۰", value: 46 }, { label: "۱۲", value: 62 },
  { label: "۱۴", value: 48 }, { label: "۱۶", value: 76 }, { label: "۱۸", value: 91 },
  { label: "۲۰", value: 100 }, { label: "۲۲", value: 57 },
];

function toMember(customer: CustomerDto): Member {
  return {
    id: customer.id,
    name: customer.fullName || "مشتری بدون نام",
    phone: customer.phoneNumber,
    tier: "برنزی",
    visits: customer.visitCount,
    spend: customer.totalSpent,
    points: customer.loyaltyPoints,
    wallet: 0,
    lastVisit: customer.lastVisitShamsi || "—",
    consent: Boolean(customer.marketingConsent),
    gender: customer.gender || "نامشخص",
    personality: customer.personalityType || "متعادل",
    birthday: customer.birthDate || "",
    favorites: customer.favoriteProducts || [],
  };
}

export function LoyaltyClubHub() {
  const [section, setSection] = useState<Section>("overview");
  const [members, setMembers] = useState(initialMembers);
  const [selected, setSelected] = useState<Member>(initialMembers[0]);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("همه سطح‌ها");
  const [consentFilter, setConsentFilter] = useState("همه");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newBirthday, setNewBirthday] = useState("");
  const [newGender, setNewGender] = useState("نامشخص");
  const [newPersonality, setNewPersonality] = useState("متعادل");
  const [newFavorite, setNewFavorite] = useState("");
  const [newConsent, setNewConsent] = useState(false);
  const [selectedForSms, setSelectedForSms] = useState<string[]>([]);
  const [campaignText, setCampaignText] = useState("سلام {name} عزیز، دلتنگ دیدارتان هستیم. با مراجعه بعدی از هدیه ویژه‌تان استفاده کنید.");
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [smsQuietHoursStart, setSmsQuietHoursStart] = useState("21:00");
  const [smsQuietHoursEnd, setSmsQuietHoursEnd] = useState("09:00");
  const [thankYouEnabled, setThankYouEnabled] = useState(true);
  const [thankYouText, setThankYouText] = useState("{name} عزیز، از خرید شما سپاسگزاریم. {points} امتیاز به حساب شما اضافه شد.");
  const [earnMode, setEarnMode] = useState("مبلغ خرید");
  const [earnAmount, setEarnAmount] = useState("10000");
  const [earnPoints, setEarnPoints] = useState("1");
  const [earnEveryVisits, setEarnEveryVisits] = useState("1");
  const [earnPercent, setEarnPercent] = useState("2");
  const [cashback, setCashback] = useState("3");
  const [cashbackMax, setCashbackMax] = useState("200000");
  const [cashbackMin, setCashbackMin] = useState("150000");
  const [cashbackProductIds, setCashbackProductIds] = useState("");
  const [rewardPoints, setRewardPoints] = useState("500");
  const [rewardDiscount, setRewardDiscount] = useState("50000");
  const [rewardProduct, setRewardProduct] = useState("");
  const customerQuery = useCustomersPaged(1, 100);
  const createCustomerMutation = useCreateCustomer();
  const programSettingsQuery = useLoyaltySettings();
  const updateProgramSettings = useUpdateLoyaltySettings();
  const queueCampaign = useQueueLoyaltyCampaign();

  useEffect(() => {
    if (customerQuery.data) {
      const liveMembers = customerQuery.data.items.map(toMember);
      setMembers(liveMembers);
      if (liveMembers.length) setSelected((current) => liveMembers.find((member) => member.id === current.id) || liveMembers[0]);
    }
  }, [customerQuery.data]);

  useEffect(() => {
    const settings = programSettingsQuery.data;
    if (!settings) return;
    setEarnMode(settings.earnMode === "Amount" ? "مبلغ خرید" : settings.earnMode === "Visit" ? "تعداد خرید" : "درصد مبلغ خرید");
    setEarnAmount(String(settings.earnAmountRials / 10));
    setEarnPoints(String(settings.earnPoints));
    setEarnEveryVisits(String(settings.earnEveryVisits));
    setEarnPercent(String(settings.earnPercent));
    setCashback(String(settings.cashbackPercent));
    setCashbackMax(String(settings.cashbackMaxRials / 10));
    setCashbackMin(String(settings.cashbackMinSpendRials / 10));
    setCashbackProductIds(settings.cashbackProductIds.join(", "));
    setRewardPoints(String(settings.rewardPointsThreshold));
    setRewardDiscount(String(settings.rewardDiscountRials / 10));
    setRewardProduct(settings.rewardProductName);
    setSmsEnabled(settings.smsEnabled);
    setSmsQuietHoursStart(settings.smsQuietHoursStart);
    setSmsQuietHoursEnd(settings.smsQuietHoursEnd);
    setThankYouEnabled(settings.thankYouSmsEnabled);
    setThankYouText(settings.thankYouSmsTemplate);
  }, [programSettingsQuery.data]);

  const saveProgramSettings = (kind: "rules" | "sms") => {
    const settings = programSettingsQuery.data;
    if (!settings) return toast.error("تنظیمات باشگاه در دسترس نیست.");
    updateProgramSettings.mutate({
      ...settings,
      earnMode: earnMode === "تعداد خرید" ? "Visit" : earnMode === "درصد مبلغ خرید" ? "Percent" : "Amount",
      earnAmountRials: (Number(earnAmount) || 0) * 10,
      earnPoints: Number(earnPoints) || 0,
      earnEveryVisits: Number(earnEveryVisits) || 1,
      earnPercent: Number(earnPercent) || 0,
      thankYouSmsEnabled: thankYouEnabled,
      smsEnabled,
      smsQuietHoursStart,
      smsQuietHoursEnd,
      thankYouSmsTemplate: thankYouText,
      cashbackPercent: Number(cashback) || 0,
      cashbackMaxRials: (Number(cashbackMax) || 0) * 10,
      cashbackMinSpendRials: (Number(cashbackMin) || 0) * 10,
      cashbackProductIds: cashbackProductIds.split(",").map((id) => id.trim()).filter(Boolean),
      rewardPointsThreshold: Number(rewardPoints) || 1,
      rewardDiscountRials: (Number(rewardDiscount) || 0) * 10,
      rewardProductName: rewardProduct.trim(),
      tiers: settings.tiers.length ? settings.tiers : [
        { name: "برنزی", minimumVisits: 0, minimumSpendRials: 0, pointsMultiplier: 1, cashbackPercent: 0 },
        { name: "نقره‌ای", minimumVisits: 8, minimumSpendRials: 50000000, pointsMultiplier: 1.2, cashbackPercent: 3 },
        { name: "طلایی", minimumVisits: 20, minimumSpendRials: 150000000, pointsMultiplier: 1.5, cashbackPercent: 5 },
      ],
    }, {
      onSuccess: () => toast.success(kind === "rules" ? "قوانین وفاداری ذخیره شد." : "تنظیم پیامک ذخیره شد."),
      onError: (error: Error) => toast.error(error.message),
    });
  };

  const filteredMembers = useMemo(() => members.filter((member) => {
    const matchesSearch = `${member.name} ${member.phone}`.includes(search.trim());
    const matchesTier = tierFilter === "همه سطح‌ها" || member.tier === tierFilter;
    const matchesConsent = consentFilter === "همه" || (consentFilter === "رضایت دارد" ? member.consent : !member.consent);
    return matchesSearch && matchesTier && matchesConsent;
  }), [members, search, tierFilter, consentFilter]);

  const createMember = () => {
    if (!newName.trim() || newPhone.trim().length < 10) {
      toast.error("نام و شماره موبایل معتبر را وارد کنید.");
      return;
    }
    createCustomerMutation.mutate({
      phoneNumber: newPhone.trim(),
      fullName: newName.trim(),
      birthDate: newBirthday || null,
      gender: newGender === "نامشخص" ? null : newGender,
      personalityType: newPersonality,
      favoriteProducts: newFavorite ? [newFavorite] : [],
      marketingConsent: newConsent,
      registrationSource: "Manual",
    }, {
      onSuccess: (created) => {
        const member = toMember(created);
        setMembers((current) => [member, ...current.filter((x) => x.id !== member.id)]);
        setSelected(member);
        setShowNew(false);
        setNewName(""); setNewPhone(""); setNewBirthday(""); setNewFavorite(""); setNewConsent(false);
        toast.success("مشتری در باشگاه ثبت شد.");
      },
      onError: (error: Error) => toast.error(error.message),
    });
  };

  const sendCampaign = () => {
    const recipients = selectedForSms.filter((id) => members.some((member) => member.id === id && member.consent));
    queueCampaign.mutate({
      name: `Loyalty campaign ${new Date().toLocaleDateString("en-CA")}`,
      body: campaignText,
      customerIds: recipients.length ? recipients : undefined,
    }, {
      onSuccess: (campaign) => toast.success(`Campaign queued for ${campaign.recipientCount} opted-in customers.`),
      onError: (error: Error) => toast.error(error.message),
    });
  };

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-primary"><Sparkles className="size-4" /> باشگاه مشتریان</div>
          <h1 className="text-2xl font-black tracking-tight">وفاداری مشتری‌ها، با یک نگاه</h1>
          <p className="mt-1 text-sm text-muted-foreground">پروفایل، امتیاز، کیف پول، پیامک و بازگشت مشتری‌ها</p>
        </div>
        <Button onClick={() => { setSection("members"); setShowNew(true); }}><Plus className="ml-1 size-4" /> افزودن مشتری</Button>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-muted/50 p-1">
        {sectionItems.map(({ id, title, icon: Icon }) => (
          <button key={id} onClick={() => setSection(id)} className={cn("flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground transition", section === id && "bg-card text-primary shadow-sm")}>
            <Icon className="size-4" />{title}
          </button>
        ))}
      </div>

      {section === "overview" && <Overview members={members} onOpenMembers={() => setSection("members")} />}
      {section === "members" && <MembersSection
        members={filteredMembers} selected={selected} onSelect={setSelected} search={search} setSearch={setSearch}
        tierFilter={tierFilter} setTierFilter={setTierFilter} consentFilter={consentFilter} setConsentFilter={setConsentFilter}
        showNew={showNew} setShowNew={setShowNew} newName={newName} setNewName={setNewName}
        newPhone={newPhone} setNewPhone={setNewPhone} newBirthday={newBirthday} setNewBirthday={setNewBirthday}
        newGender={newGender} setNewGender={setNewGender} newPersonality={newPersonality} setNewPersonality={setNewPersonality}
        newFavorite={newFavorite} setNewFavorite={setNewFavorite} newConsent={newConsent} setNewConsent={setNewConsent}
        createMember={createMember} selectedForSms={selectedForSms} setSelectedForSms={setSelectedForSms}
        creating={createCustomerMutation.isPending}
      />}
      {section === "rewards" && <RewardsSection
        earnMode={earnMode} setEarnMode={setEarnMode} earnAmount={earnAmount} setEarnAmount={setEarnAmount}
        earnPoints={earnPoints} setEarnPoints={setEarnPoints} earnEveryVisits={earnEveryVisits} setEarnEveryVisits={setEarnEveryVisits} earnPercent={earnPercent} setEarnPercent={setEarnPercent}
        cashback={cashback} setCashback={setCashback}
        cashbackMax={cashbackMax} setCashbackMax={setCashbackMax} cashbackMin={cashbackMin} setCashbackMin={setCashbackMin}
        cashbackProductIds={cashbackProductIds} setCashbackProductIds={setCashbackProductIds}
        rewardPoints={rewardPoints} setRewardPoints={setRewardPoints} rewardDiscount={rewardDiscount} setRewardDiscount={setRewardDiscount}
        rewardProduct={rewardProduct} setRewardProduct={setRewardProduct}
        onSave={() => saveProgramSettings("rules")} saving={updateProgramSettings.isPending}
      />}
      {section === "campaigns" && <CampaignSection
        members={members} selectedForSms={selectedForSms} setSelectedForSms={setSelectedForSms}
        campaignText={campaignText} setCampaignText={setCampaignText} sendCampaign={sendCampaign}
        sending={queueCampaign.isPending}
        smsEnabled={smsEnabled} setSmsEnabled={setSmsEnabled} thankYouEnabled={thankYouEnabled} setThankYouEnabled={setThankYouEnabled}
        thankYouText={thankYouText} setThankYouText={setThankYouText}
        quietHoursStart={smsQuietHoursStart} setQuietHoursStart={setSmsQuietHoursStart}
        quietHoursEnd={smsQuietHoursEnd} setQuietHoursEnd={setSmsQuietHoursEnd}
        onSave={() => saveProgramSettings("sms")} saving={updateProgramSettings.isPending}
      />}
      {section === "reports" && <ReportsSection members={members} />}
      {section === "portal" && <PortalPreview member={selected} />}
    </div>
  );
}

function Metric({ title, value, detail, icon: Icon, trend }: { title: string; value: string; detail: string; icon: typeof Users; trend?: string }) {
  return <Card className="p-4"><div className="flex items-start justify-between"><span className="text-xs font-medium text-muted-foreground">{title}</span><span className="rounded-xl bg-primary/10 p-2 text-primary"><Icon className="size-4" /></span></div><div className="mt-3 text-2xl font-black tabular-nums">{value}</div><div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">{trend && <span className="font-bold text-emerald-600">{trend}</span>}{detail}</div></Card>;
}

function BarRows({ rows, color = "bg-primary" }: { rows: { label: string; value: number; suffix?: string }[]; color?: string }) {
  return <div className="space-y-3">{rows.map((row) => <div key={row.label} className="grid grid-cols-[68px_1fr_42px] items-center gap-2 text-xs"><span className="text-muted-foreground">{row.label}</span><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(100, row.value)}%` }} /></div><span className="text-left font-bold tabular-nums">{row.value}{row.suffix ?? "%"}</span></div>)}</div>;
}

function Overview({ members, onOpenMembers }: { members: Member[]; onOpenMembers: () => void }) {
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric title="اعضای باشگاه" value={members.length.toLocaleString("fa-IR")} detail="در کل دوره" icon={Users} trend="۱۲٪+" />
      <Metric title="مشتری فعال" value={members.filter((x) => !x.lastVisit.includes("روز")).length.toLocaleString("fa-IR")} detail="مراجعه در ۳۰ روز اخیر" icon={Activity} trend="۸٪+" />
      <Metric title="امتیاز صادرشده" value="۲۴٬۸۶۰" detail="این ماه · ۳٬۴۲۰ مصرف‌شده" icon={Star} />
      <Metric title="تعهد کیف پول" value={formatToman(629000)} detail="مانده قابل استفاده مشتریان" icon={Wallet} />
    </div>
    <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
      <Card className="p-5"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-black">ساعت‌های پرتردد</h2><p className="mt-1 text-xs text-muted-foreground">سفارش‌های ۳۰ روز اخیر، همه مشتریان</p></div><Badge variant="neutral">۳۰ روز</Badge></div><div className="flex h-44 items-end gap-2">{peakHours.map((item) => <div key={item.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="flex h-full w-full items-end"><div className={cn("w-full rounded-t-md", item.value > 75 ? "bg-primary" : "bg-primary/35")} style={{ height: `${item.value}%` }} /></div><span className="text-[10px] text-muted-foreground">{item.label}</span></div>)}</div><div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-4 text-primary" /> اوج مراجعه: ۱۸ تا ۲۱</div></Card>
      <Card className="p-5"><div className="mb-5"><h2 className="font-black">ترکیب سطح مشتری‌ها</h2><p className="mt-1 text-xs text-muted-foreground">بر اساس تعداد اعضا</p></div><BarRows rows={[{ label: "طلایی", value: 26 }, { label: "نقره‌ای", value: 42 }, { label: "برنزی", value: 68 }]} color="bg-amber-500" /><div className="mt-5 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-muted/60 p-2"><div className="font-black">۴۸</div><div className="text-[10px] text-muted-foreground">ارتقا این ماه</div></div><div className="rounded-xl bg-muted/60 p-2"><div className="font-black">۷۲٪</div><div className="text-[10px] text-muted-foreground">بازگشت مشتری</div></div><div className="rounded-xl bg-muted/60 p-2"><div className="font-black">۹٫۴م</div><div className="text-[10px] text-muted-foreground">فروش اعضا</div></div></div></Card>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-black">نیازمند پیگیری</h2><p className="mt-1 text-xs text-muted-foreground">اعضایی که دیرتر از روال معمول برگشته‌اند</p></div><Button variant="outline" size="sm" onClick={onOpenMembers}>دیدن همه</Button></div><div className="space-y-3">{members.filter((m) => m.lastVisit.includes("روز")).slice(0, 3).map((member) => <div key={member.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div><div className="text-sm font-bold">{member.name}</div><div className="mt-1 text-xs text-muted-foreground">آخرین مراجعه {member.lastVisit}</div></div><Badge variant="outline" className="text-amber-700">بازگشت با تأخیر</Badge></div>)}</div></Card>
      <Card className="p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-black">اعضا در برابر مهمان‌ها</h2><p className="mt-1 text-xs text-muted-foreground">سهم فروش دوره جاری</p></div><span className="text-xs text-muted-foreground">این ماه</span></div><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl bg-primary/5 p-4"><div className="text-xs text-muted-foreground">اعضای باشگاه</div><div className="mt-2 text-xl font-black">۶۸٪ فروش</div><div className="mt-1 text-xs text-emerald-700">میانگین فاکتور ۴۸۰ هزار تومان</div></div><div className="rounded-2xl bg-muted p-4"><div className="text-xs text-muted-foreground">مهمان‌ها</div><div className="mt-2 text-xl font-black">۳۲٪ فروش</div><div className="mt-1 text-xs text-muted-foreground">میانگین فاکتور ۲۷۰ هزار تومان</div></div></div></Card>
    </div>
  </div>;
}

type MembersProps = {
  members: Member[]; selected: Member; onSelect: (member: Member) => void; search: string; setSearch: (v: string) => void;
  tierFilter: string; setTierFilter: (v: string) => void; consentFilter: string; setConsentFilter: (v: string) => void;
  showNew: boolean; setShowNew: (v: boolean) => void; newName: string; setNewName: (v: string) => void;
  newPhone: string; setNewPhone: (v: string) => void; newBirthday: string; setNewBirthday: (v: string) => void;
  newGender: string; setNewGender: (v: string) => void; newPersonality: string; setNewPersonality: (v: string) => void;
  newFavorite: string; setNewFavorite: (v: string) => void; newConsent: boolean; setNewConsent: (v: boolean) => void;
  createMember: () => void; selectedForSms: string[]; setSelectedForSms: (v: string[] | ((old: string[]) => string[])) => void;
  creating: boolean;
};

function MembersSection(p: MembersProps) {
  const ordersQuery = useCustomerOrders(p.selected.id);
  const pointsQuery = useCustomerPointHistory(p.selected.id);
  const toggle = (id: string) => p.setSelectedForSms((old) => old.includes(id) ? old.filter((x) => x !== id) : [...old, id]);
  return <div className="grid gap-4 xl:grid-cols-[1fr_350px]">
    <div className="space-y-3">
      <Card className="flex flex-wrap items-center gap-2 p-3"><div className="relative min-w-52 flex-1"><Search className="absolute right-3 top-2.5 size-4 text-muted-foreground" /><Input className="pr-9" value={p.search} onChange={(e) => p.setSearch(e.target.value)} placeholder="جست‌وجوی نام یا شماره" /></div><select className="h-10 rounded-xl border bg-card px-3 text-sm" value={p.tierFilter} onChange={(e) => p.setTierFilter(e.target.value)}><option>همه سطح‌ها</option><option>طلایی</option><option>نقره‌ای</option><option>برنزی</option></select><select className="h-10 rounded-xl border bg-card px-3 text-sm" value={p.consentFilter} onChange={(e) => p.setConsentFilter(e.target.value)}><option>همه</option><option>رضایت دارد</option><option>رضایت ندارد</option></select><Button variant="outline" onClick={() => p.setShowNew(!p.showNew)}><Plus className="ml-1 size-4" /> افزودن عضو</Button></Card>
      {p.showNew && <Card className="space-y-3 p-4"><div className="flex items-center justify-between"><h2 className="font-black">ثبت مشتری جدید</h2><Badge variant="neutral">ورود دستی / منوی دیجیتال</Badge></div><div className="grid gap-3 sm:grid-cols-2"><Field label="نام و نام خانوادگی"><Input value={p.newName} onChange={(e) => p.setNewName(e.target.value)} placeholder="مثلاً سارا محمدی" /></Field><Field label="شماره موبایل"><Input dir="ltr" value={p.newPhone} onChange={(e) => p.setNewPhone(e.target.value)} placeholder="09xxxxxxxxx" /></Field><Field label="تاریخ تولد"><Input type="date" value={p.newBirthday} onChange={(e) => p.setNewBirthday(e.target.value)} /></Field><Field label="جنسیت"><select className="h-10 rounded-xl border bg-card px-3 text-sm" value={p.newGender} onChange={(e) => p.setNewGender(e.target.value)}><option>نامشخص</option><option>زن</option><option>مرد</option></select></Field><Field label="تیپ شخصیتی"><select className="h-10 rounded-xl border bg-card px-3 text-sm" value={p.newPersonality} onChange={(e) => p.setNewPersonality(e.target.value)}><option>متعادل</option><option>درون‌گرا</option><option>برون‌گرا</option><option>تحلیل‌گر</option><option>سفارشی</option></select></Field><Field label="محصول موردعلاقه"><Input value={p.newFavorite} onChange={(e) => p.setNewFavorite(e.target.value)} placeholder="مثل لاته" /></Field></div><label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={p.newConsent} onChange={(e) => p.setNewConsent(e.target.checked)} className="accent-primary" /> رضایت برای دریافت پیامک‌های تبلیغاتی ثبت شد</label><Button onClick={p.createMember} loading={p.creating}>ثبت در باشگاه</Button></Card>}
      <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-right text-sm"><thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="p-3">انتخاب</th><th>مشتری</th><th>سطح</th><th>مراجعه</th><th>خرید کل</th><th>امتیاز</th><th>آخرین مراجعه</th><th>پیامک</th></tr></thead><tbody>{p.members.map((member) => <tr key={member.id} onClick={() => p.onSelect(member)} className={cn("cursor-pointer border-t hover:bg-muted/30", p.selected.id === member.id && "bg-primary/5")}><td className="p-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`انتخاب ${member.name}`} checked={p.selectedForSms.includes(member.id)} onChange={() => toggle(member.id)} className="accent-primary" /></td><td><div className="font-bold">{member.name}</div><div dir="ltr" className="mt-0.5 text-right text-xs text-muted-foreground">{member.phone}</div></td><td><Badge variant="outline">{member.tier}</Badge></td><td>{member.visits.toLocaleString("fa-IR")}</td><td>{formatToman(member.spend)}</td><td className="font-bold text-primary">{member.points.toLocaleString("fa-IR")}</td><td>{member.lastVisit}</td><td>{member.consent ? <Badge className="bg-emerald-100 text-emerald-800">مجاز</Badge> : <Badge variant="neutral">غیرفعال</Badge>}</td></tr>)}</tbody></table>{p.members.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">مشتری با این فیلتر پیدا نشد.</div>}</div><div className="border-t p-3 text-xs text-muted-foreground">{p.members.length.toLocaleString("fa-IR")} مشتری در این فهرست</div></Card>
    </div>
    <Card className="h-fit space-y-4 p-4"><div><div className="flex items-center justify-between"><h2 className="font-black">پروفایل مشتری</h2><Badge>{p.selected.tier}</Badge></div><div className="mt-3 text-lg font-black">{p.selected.name}</div><div dir="ltr" className="mt-1 text-right text-sm text-muted-foreground">{p.selected.phone}</div></div><div className="grid grid-cols-2 gap-2"><MiniStat label="امتیاز" value={p.selected.points.toLocaleString("fa-IR")} /><MiniStat label="کیف پول" value={formatToman(p.selected.wallet)} /><MiniStat label="تعداد مراجعه" value={p.selected.visits.toLocaleString("fa-IR")} /><MiniStat label="مجموع خرید" value={formatToman(p.selected.spend)} /></div><div className="space-y-2 border-t pt-3 text-xs"><ProfileRow icon={Cake} label="تولد" value={p.selected.birthday || "ثبت نشده"} /><ProfileRow icon={Users} label="جنسیت / شخصیت" value={`${p.selected.gender} · ${p.selected.personality}`} /><ProfileRow icon={Star} label="علاقه‌مندی‌ها" value={p.selected.favorites.join("، ") || "ثبت نشده"} /></div><div className="border-t pt-3"><div className="mb-2 font-bold">????? ???? ? ??????</div><div className="space-y-2 text-xs">{ordersQuery.data?.items.slice(0, 4).map((order) => <div key={order.id} className="flex justify-between rounded-xl bg-muted/50 p-2"><span>????? {order.orderNumber} ? {order.createdAtShamsi}</span><b>{formatToman(order.grandTotal)}</b></div>)}{pointsQuery.data?.items.slice(0, 4).map((entry) => <div key={entry.id} className="flex justify-between rounded-xl bg-muted/50 p-2"><span>{entry.notes || entry.type} ? {new Date(entry.occurredAtUtc).toLocaleDateString("fa-IR")}</span><b className={entry.pointsDelta < 0 ? "text-rose-600" : "text-emerald-700"}>{entry.pointsDelta > 0 ? "+" : ""}{entry.pointsDelta.toLocaleString("fa-IR")} ??????</b></div>)}{!ordersQuery.data?.items.length && !pointsQuery.data?.items.length && <span className="text-muted-foreground">???? ???????? ??? ???? ???.</span>}</div></div><Button variant="outline" className="w-full" onClick={() => toast.info("ویرایش کامل پروفایل پس از اتصال API فعال می‌شود.")}>مشاهده پروفایل کامل</Button></Card>
  </div>;
}

function RewardsSection(p: { earnMode: string; setEarnMode: (v: string) => void; earnAmount: string; setEarnAmount: (v: string) => void; earnPoints: string; setEarnPoints: (v: string) => void; earnEveryVisits: string; setEarnEveryVisits: (v: string) => void; earnPercent: string; setEarnPercent: (v: string) => void; cashback: string; setCashback: (v: string) => void; cashbackMax: string; setCashbackMax: (v: string) => void; cashbackMin: string; setCashbackMin: (v: string) => void; cashbackProductIds: string; setCashbackProductIds: (v: string) => void; rewardPoints: string; setRewardPoints: (v: string) => void; rewardDiscount: string; setRewardDiscount: (v: string) => void; rewardProduct: string; setRewardProduct: (v: string) => void; onSave: () => void; saving: boolean }) {
  return <div className="space-y-4"><div className="grid gap-4 xl:grid-cols-2"><Card className="space-y-4 p-5"><div className="flex items-center gap-2"><Star className="size-5 text-amber-500" /><div><h2 className="font-black">قانون کسب امتیاز</h2><p className="text-xs text-muted-foreground">برای خریدها امتیاز ثابت یا درصدی تعریف کنید</p></div></div><Field label="مبنای امتیاز"><select className="h-10 w-full rounded-xl border bg-card px-3 text-sm" value={p.earnMode} onChange={(e) => p.setEarnMode(e.target.value)}><option>مبلغ خرید</option><option>تعداد خرید</option><option>درصد مبلغ خرید</option></select></Field>{p.earnMode === "مبلغ خرید" ? <div className="grid grid-cols-2 gap-3"><Field label="به ازای هر (تومان)"><Input value={p.earnAmount} onChange={(e) => p.setEarnAmount(e.target.value)} /></Field><Field label="امتیاز"><Input value={p.earnPoints} onChange={(e) => p.setEarnPoints(e.target.value)} /></Field></div> : p.earnMode === "تعداد خرید" ? <div className="grid grid-cols-2 gap-3"><Field label="به ازای هر چند خرید"><Input type="number" value={p.earnEveryVisits} onChange={(e) => p.setEarnEveryVisits(e.target.value)} /></Field><Field label="امتیاز هر نوبت"><Input type="number" value={p.earnPoints} onChange={(e) => p.setEarnPoints(e.target.value)} /></Field></div> : <Field label="درصد بازگشت به امتیاز"><Input value={p.earnPercent} onChange={(e) => p.setEarnPercent(e.target.value)} /></Field>}<div className="rounded-xl bg-primary/5 p-3 text-xs text-muted-foreground">پیش‌نمایش: خرید ۵۰۰٬۰۰۰ تومانی حدود <b className="text-primary">{p.earnMode === "درصد مبلغ خرید" ? Math.floor(5_000_000 * Number(p.earnPercent || 0) / 100 / 1000).toLocaleString("fa-IR") : Math.floor(500000 / Math.max(1, Number(p.earnAmount || 10000)) * Number(p.earnPoints || 1)).toLocaleString("fa-IR")} امتیاز</b> می‌گیرد.</div><Button onClick={p.onSave} loading={p.saving}>ذخیره قانون</Button></Card>
      <Card className="space-y-4 p-5"><div className="flex items-center gap-2"><CircleDollarSign className="size-5 text-emerald-600" /><div><h2 className="font-black">کش‌بک و کیف پول</h2><p className="text-xs text-muted-foreground">بازگشت وجه با دامنه محصولی و سقف قابل تنظیم</p></div></div><div className="grid grid-cols-2 gap-3"><Field label="درصد کش‌بک"><Input type="number" value={p.cashback} onChange={(e) => p.setCashback(e.target.value)} /></Field><Field label="سقف هر سفارش (تومان)"><Input type="number" value={p.cashbackMax} onChange={(e) => p.setCashbackMax(e.target.value)} /></Field></div><Field label="حداقل خرید برای کش‌بک (تومان)"><Input type="number" value={p.cashbackMin} onChange={(e) => p.setCashbackMin(e.target.value)} /></Field><Field label="Product IDs eligible for cashback (comma separated)"><Input value={p.cashbackProductIds} onChange={(e) => p.setCashbackProductIds(e.target.value)} placeholder="Leave blank for all products" /></Field><p className="text-xs text-muted-foreground">موجودی کیف پول در فاکتور بعدی به‌عنوان روش پرداخت قابل انتخاب خواهد بود.</p><Button onClick={p.onSave} loading={p.saving}>ذخیره کش‌بک</Button></Card></div>
    <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]"><Card className="space-y-4 p-5"><div className="flex items-center gap-2"><Gift className="size-5 text-primary" /><div><h2 className="font-black">تبدیل امتیاز به تخفیف یا محصول</h2><p className="text-xs text-muted-foreground">اعضا می‌توانند امتیاز را در منو خرج کنند</p></div></div><div className="grid gap-3 sm:grid-cols-3"><Field label="امتیاز لازم"><Input type="number" defaultValue="500" /></Field><Field label="نوع پاداش"><select className="h-10 rounded-xl border bg-card px-3 text-sm"><option>تخفیف مبلغی</option><option>تخفیف درصدی</option><option>محصول رایگان</option></select></Field><Field label="ارزش / محصول"><Input defaultValue="۵۰٬۰۰۰ تومان" /></Field></div><Field label="??? ????? ????? (???????)"><Input value={p.rewardProduct} onChange={(e) => p.setRewardProduct(e.target.value)} /></Field><div className="grid gap-2 sm:grid-cols-2"><RewardCard title="لاته رایگان" cost="۸۰۰ امتیاز" stock="موجودی نامحدود" /><RewardCard title="تخفیف ۱۰٪" cost="۵۰۰ امتیاز" stock="سقف ۱۰۰٬۰۰۰ تومان" /></div><Button variant="outline"><Plus className="ml-1 size-4" /> تعریف پاداش جدید</Button></Card><Card className="space-y-4 p-5"><div className="flex items-center gap-2"><Star className="size-5 text-amber-500" /><div><h2 className="font-black">سطح‌بندی مشتریان</h2><p className="text-xs text-muted-foreground">براساس مراجعه و مجموع خرید</p></div></div><div className="space-y-2"><TierRow name="طلایی" visits="۲۰ مراجعه یا ۱۵ میلیون خرید" bonus="۱٫۵× امتیاز · ۵٪ کش‌بک" color="bg-amber-400" /><TierRow name="نقره‌ای" visits="۸ مراجعه یا ۵ میلیون خرید" bonus="۱٫۲× امتیاز · ۳٪ کش‌بک" color="bg-slate-400" /><TierRow name="برنزی" visits="عضویت پایه" bonus="۱× امتیاز" color="bg-orange-500" /></div><Button variant="outline"><Settings2 className="ml-1 size-4" /> تنظیم شرط و مزایا</Button></Card></div>
  </div>;
}

function CampaignSection(p: { members: Member[]; selectedForSms: string[]; setSelectedForSms: (v: string[] | ((old: string[]) => string[])) => void; campaignText: string; setCampaignText: (v: string) => void; sendCampaign: () => void; sending: boolean; smsEnabled: boolean; setSmsEnabled: (v: boolean) => void; thankYouEnabled: boolean; setThankYouEnabled: (v: boolean) => void; thankYouText: string; setThankYouText: (v: string) => void; quietHoursStart: string; setQuietHoursStart: (v: string) => void; quietHoursEnd: string; setQuietHoursEnd: (v: string) => void; onSave: () => void; saving: boolean }) {
  const eligible = p.members.filter((m) => m.consent);
  return <div className="grid gap-4 xl:grid-cols-2"><Card className="space-y-4 p-5"><div className="flex items-center justify-between"><div><h2 className="font-black">ساخت کمپین پیامکی</h2><p className="mt-1 text-xs text-muted-foreground">انتخاب گروه، نوشتن متن و پیش‌نمایش گیرندگان</p></div><Badge variant="neutral">{eligible.length} شماره مجاز</Badge></div><div className="grid grid-cols-2 gap-3"><Field label="فیلتر مشتری"><select className="h-10 w-full rounded-xl border bg-card px-3 text-sm"><option>انتخاب دستی یا همه فیلترشده</option><option>سطح طلایی</option><option>بیش از ۳۰ روز غیرفعال</option><option>تولد این ماه</option><option>رضایت پیامک دارد</option></select></Field><Field label="زمان ارسال"><select className="h-10 w-full rounded-xl border bg-card px-3 text-sm"><option>ارسال فوری</option><option>زمان‌بندی کمپین</option></select></Field></div><Field label="متن پیام"><textarea className="min-h-28 w-full rounded-xl border bg-card p-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" value={p.campaignText} onChange={(e) => p.setCampaignText(e.target.value)} /></Field><div className="flex flex-wrap gap-1.5">{["{name}", "{points}", "{balance}", "{tier}", "{date}"].map((token) => <button key={token} type="button" onClick={() => p.setCampaignText(`${p.campaignText} ${token}`)} className="rounded-lg border px-2 py-1 font-mono text-[10px] text-primary">{token}</button>)}</div><div className="flex items-center justify-between rounded-xl bg-muted/60 p-3 text-xs"><span>گیرندگان واجد شرایط: <b>{p.selectedForSms.length || eligible.length} شماره</b></span><span>تقریباً ۱ پیامک برای هر شماره</span></div><Button onClick={p.sendCampaign} loading={p.sending}><Send className="ml-1 size-4" /> پیش‌نمایش و ارسال</Button></Card>
    <div className="space-y-4"><Card className="space-y-4 p-5"><div className="flex items-center justify-between"><div><h2 className="font-black">پیام خودکار بعد از خرید</h2><p className="mt-1 text-xs text-muted-foreground">تشکر از خرید و اعلام امتیاز کسب‌شده</p></div><input aria-label="فعال بودن پیامک تشکر" type="checkbox" checked={p.thankYouEnabled} onChange={(e) => p.setThankYouEnabled(e.target.checked)} className="size-5 accent-primary" /></div><textarea className="min-h-20 w-full rounded-xl border bg-card p-3 text-sm" value={p.thankYouText} onChange={(e) => p.setThankYouText(e.target.value)} /><Field label="تأخیر ارسال"><select className="h-10 w-full rounded-xl border bg-card px-3 text-sm"><option>بلافاصله بعد از تسویه</option><option>۱۵ دقیقه بعد</option><option>۱ ساعت بعد</option></select></Field></Card><Card className="space-y-3 p-5"><div className="flex items-center justify-between"><div><h2 className="font-black">تنظیمات سرویس پیامک</h2><p className="mt-1 text-xs text-muted-foreground">فعال‌سازی و ساعت سکوت</p></div><input aria-label="فعال بودن پیامک" type="checkbox" checked={p.smsEnabled} onChange={(e) => p.setSmsEnabled(e.target.checked)} className="size-5 accent-primary" /></div><div className="grid grid-cols-2 gap-3"><Field label="ساعت شروع"><Input type="time" value={p.quietHoursStart} onChange={(e) => p.setQuietHoursStart(e.target.value)} /></Field><Field label="ساعت پایان"><Input type="time" value={p.quietHoursEnd} onChange={(e) => p.setQuietHoursEnd(e.target.value)} /></Field></div><p className="text-[11px] text-muted-foreground">پیام تبلیغاتی فقط برای مشتریان دارای رضایت ارسال می‌شود.</p><Button onClick={p.onSave} loading={p.saving}>Save SMS settings</Button></Card><Card className="p-5"><h2 className="font-black">عملکرد کمپین اخیر</h2><div className="mt-3 grid grid-cols-3 gap-2 text-center"><MiniStat label="تحویل" value="۹۲٪" /><MiniStat label="بازگشت به کافه" value="۱۸٪" /><MiniStat label="فروش منتسب" value="۱۲٫۴م" /></div></Card></div>
  </div>;
}

function ReportsSection({ members }: { members: Member[] }) {
  return <div className="space-y-4"><Card className="flex flex-wrap items-end gap-3 p-4"><Field label="بازه گزارش"><select className="h-10 rounded-xl border bg-card px-3 text-sm"><option>۳۰ روز اخیر</option><option>ماه جاری</option><option>سه ماه اخیر</option><option>بازه دلخواه</option></select></Field><Field label="مقایسه با"><select className="h-10 rounded-xl border bg-card px-3 text-sm"><option>دوره قبل</option><option>سال قبل</option><option>بدون مقایسه</option></select></Field><Button variant="outline">اعمال فیلتر</Button></Card><div className="grid gap-4 xl:grid-cols-2"><Card className="p-5"><h2 className="font-black">مقایسه اعضا و مهمان‌ها</h2><p className="mb-5 mt-1 text-xs text-muted-foreground">درآمد، میانگین فاکتور و دفعات مراجعه</p><BarRows rows={[{ label: "سهم فروش اعضا", value: 68 }, { label: "میانگین فاکتور اعضا", value: 82 }, { label: "نرخ بازگشت اعضا", value: 72 }, { label: "بازگشت مهمان‌ها", value: 31 }]} /></Card><Card className="p-5"><h2 className="font-black">بازگشت مشتری (Retention)</h2><p className="mb-5 mt-1 text-xs text-muted-foreground">درصد مشتریانی که بعد از اولین خرید برگشته‌اند</p><div className="flex h-36 items-end gap-3">{[{ m: "فروردین", v: 42 }, { m: "اردیبهشت", v: 51 }, { m: "خرداد", v: 48 }, { m: "تیر", v: 63 }, { m: "مرداد", v: 70 }, { m: "شهریور", v: 74 }].map((x) => <div key={x.m} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="flex h-full w-full items-end"><div className="w-full rounded-t-md bg-emerald-500/70" style={{ height: `${x.v}%` }} /></div><span className="text-[9px] text-muted-foreground">{x.m}</span></div>)}</div><div className="mt-3 text-sm font-bold text-emerald-700">روند شش‌ماهه: ۳۲٪ رشد</div></Card><Card className="p-5"><h2 className="font-black">اثربخشی پیامک تبلیغاتی</h2><p className="mb-4 mt-1 text-xs text-muted-foreground">خرید در بازه انتساب ۷ روزه پس از ارسال</p><div className="grid grid-cols-3 gap-2"><MiniStat label="ارسال‌شده" value="۱٬۲۸۰" /><MiniStat label="خرید پس از پیام" value="۲۳۱" /><MiniStat label="درآمد منتسب" value="۴۸٫۶م" /></div><div className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">نرخ تبدیل ۱۸٪ · افزایش بازگشت نسبت به گروه مشابه ۶٫۲٪</div></Card><Card className="p-5"><h2 className="font-black">مراجعه با تأخیر یا ریزش احتمالی</h2><p className="mb-3 mt-1 text-xs text-muted-foreground">بر اساس فاصله معمول خرید و آخرین بازدید</p>{members.filter((m) => m.lastVisit.includes("روز")).map((m) => <div key={m.id} className="flex items-center justify-between border-t py-3 text-sm"><div><b>{m.name}</b><div className="text-xs text-muted-foreground">آخرین مراجعه: {m.lastVisit}</div></div><Badge variant="outline" className="text-amber-700">ارسال پیام بازگشت</Badge></div>)}</Card></div><Card className="p-5"><div className="flex items-center gap-2"><Clock3 className="size-4 text-primary" /><h2 className="font-black">ساعات پرتردد کافه</h2></div><p className="mb-4 mt-1 text-xs text-muted-foreground">ترکیب سفارش اعضا و مهمان‌ها به تفکیک ساعت</p><div className="grid grid-cols-4 gap-2 sm:grid-cols-8">{peakHours.map((item) => <div key={item.label} className="rounded-xl border p-2 text-center"><div className="mx-auto mb-2 h-16 w-4 overflow-hidden rounded-full bg-muted"><div className="mt-auto w-full rounded-full bg-primary" style={{ height: `${item.value}%`, marginTop: `${100 - item.value}%` }} /></div><div className="text-xs font-bold">{item.label}</div><div className="text-[9px] text-muted-foreground">{item.value}٪</div></div>)}</div></Card></div>;
}

function PortalPreview({ member }: { member: Member }) {
  return <div className="mx-auto max-w-3xl space-y-4"><Card className="overflow-hidden"><div className="bg-gradient-to-l from-primary to-rose-700 p-6 text-white"><div className="flex items-center justify-between"><div><div className="text-sm text-white/80">سلام {member.name} 👋</div><h2 className="mt-1 text-2xl font-black">باشگاه مشتریان پنارا</h2></div><Badge className="bg-white/20 text-white">سطح {member.tier}</Badge></div><div className="mt-6 grid grid-cols-3 gap-2"><div><div className="text-xs text-white/70">امتیاز شما</div><div className="mt-1 text-2xl font-black">{member.points.toLocaleString("fa-IR")}</div></div><div><div className="text-xs text-white/70">کیف پول</div><div className="mt-1 text-lg font-black">{formatToman(member.wallet)}</div></div><div><div className="text-xs text-white/70">مراجعه‌ها</div><div className="mt-1 text-2xl font-black">{member.visits.toLocaleString("fa-IR")}</div></div></div></div><div className="space-y-5 p-5"><div><div className="mb-2 flex justify-between text-xs"><b>پیشرفت تا سطح بعدی</b><span className="text-muted-foreground">۷۲٪</span></div><div className="h-2 rounded-full bg-muted"><div className="h-full w-[72%] rounded-full bg-amber-400" /></div><p className="mt-2 text-[11px] text-muted-foreground">۴ مراجعه دیگر تا سطح طلایی</p></div><div><h3 className="mb-3 font-black">پاداش‌های قابل دریافت</h3><div className="grid gap-3 sm:grid-cols-2"><RewardCard title="لاته رایگان" cost="۸۰۰ امتیاز" stock="قابل دریافت" /><RewardCard title="تخفیف ۱۰٪ سفارش" cost="۵۰۰ امتیاز" stock="قابل دریافت" /></div></div><div><h3 className="mb-2 font-black">آخرین فعالیت‌ها</h3><div className="space-y-2 text-xs"><div className="flex justify-between rounded-xl bg-muted/50 p-3"><span>خرید کافه · امروز</span><b className="text-emerald-700">+۱۲۰ امتیاز</b></div><div className="flex justify-between rounded-xl bg-muted/50 p-3"><span>مصرف امتیاز · ۸ روز پیش</span><b className="text-rose-600">−۳۰۰ امتیاز</b></div></div></div></div></Card><Card className="flex flex-wrap items-center justify-between gap-3 p-4"><div><div className="font-bold">ثبت‌نام از منوی آنلاین</div><div className="mt-1 text-xs text-muted-foreground">پیش از پرداخت، نام و موبایل گرفته و حساب باشگاه ساخته می‌شود.</div></div><Button onClick={() => toast.info("فرم ثبت‌نام منوی دیجیتال در صفحه عمومی پیاده‌سازی می‌شود.")}>پیش‌نمایش فرم عضویت</Button></Card></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-1.5"><span className="text-xs font-semibold text-muted-foreground">{label}</span>{children}</label>; }
function MiniStat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-muted/60 p-3"><div className="text-[10px] text-muted-foreground">{label}</div><div className="mt-1 truncate text-sm font-black">{value}</div></div>; }
function ProfileRow({ icon: Icon, label, value }: { icon: typeof Cake; label: string; value: string }) { return <div className="flex items-center gap-2"><Icon className="size-3.5 text-muted-foreground" /><span className="w-24 text-muted-foreground">{label}</span><b>{value}</b></div>; }
function RewardCard({ title, cost, stock }: { title: string; cost: string; stock: string }) { return <div className="flex items-center justify-between gap-2 rounded-xl border p-3"><div className="flex items-center gap-2"><span className="rounded-lg bg-primary/10 p-2 text-primary"><Gift className="size-4" /></span><div><div className="text-sm font-bold">{title}</div><div className="text-[10px] text-muted-foreground">{stock}</div></div></div><Badge variant="outline">{cost}</Badge></div>; }
function TierRow({ name, visits, bonus, color }: { name: string; visits: string; bonus: string; color: string }) { return <div className="flex items-start gap-3 rounded-xl border p-3"><span className={cn("mt-1 size-3 shrink-0 rounded-full", color)} /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><b className="text-sm">{name}</b><ChevronDown className="size-4 text-muted-foreground" /></div><div className="mt-1 text-[10px] text-muted-foreground">{visits}</div><div className="mt-1 text-[10px] font-semibold text-primary">{bonus}</div></div></div>; }
