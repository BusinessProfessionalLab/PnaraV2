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
import { useCreateCustomer, useCreateLoyaltyReward, useCustomersPaged, useCustomer, useCustomerOrders, useCustomerPointHistory, useCustomerWallet, useCustomerPortalPreview, useLoyaltyOverview, useLoyaltyRewards, useLoyaltySettings, useLoyaltyClubReport, useQueueLoyaltyCampaign, useUpdateCustomer, useUpdateLoyaltySettings, type LoyaltyOverviewDto, type LoyaltyRewardDto, type LoyaltyTierRuleDto } from "@/api";
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

const emptyMember: Member = {
  id: "", name: "", phone: "", tier: "برنزی", visits: 0, spend: 0, points: 0, wallet: 0,
  lastVisit: "—", consent: false, gender: "نامشخص", personality: "متعادل", birthday: "", favorites: [],
};

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

function toMember(customer: CustomerDto, configuredTiers?: LoyaltyTierRuleDto[]): Member {
  const tiers = configuredTiers?.length ? configuredTiers : [
    { name: "برنزی", minimumVisits: 0, minimumSpendRials: 0, pointsMultiplier: 1, cashbackPercent: 0 },
    { name: "نقره‌ای", minimumVisits: 8, minimumSpendRials: 50_000_000, pointsMultiplier: 1.2, cashbackPercent: 3 },
    { name: "طلایی", minimumVisits: 20, minimumSpendRials: 150_000_000, pointsMultiplier: 1.5, cashbackPercent: 5 },
  ];
  const tier = [...tiers]
    .sort((a, b) => b.minimumVisits - a.minimumVisits || b.minimumSpendRials - a.minimumSpendRials)
    .find((item) => customer.visitCount >= item.minimumVisits || customer.totalSpent >= item.minimumSpendRials);
  return {
    id: customer.id,
    name: customer.fullName || "مشتری بدون نام",
    phone: customer.phoneNumber,
    tier: tier?.name || "برنزی",
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
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Member>(emptyMember);
  const [membersPage, setMembersPage] = useState(1);
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
  const [rewardType, setRewardType] = useState<0 | 1 | 2>(0);
  const programSettingsQuery = useLoyaltySettings();
  const loyaltyRewardsQuery = useLoyaltyRewards();
  const customerQuery = useCustomersPaged(1, 100);
  const marketingConsentFilter = consentFilter === "همه" ? undefined : consentFilter === "رضایت دارد";
  const tierFilterQuery = tierFilter === "همه سطح‌ها" ? undefined : tierFilter;
  const memberListQuery = useCustomersPaged(
    membersPage, 25, search.trim() || undefined, section === "members", marketingConsentFilter, tierFilterQuery,
  );
  const loyaltyOverviewQuery = useLoyaltyOverview(section === "overview");
  const createCustomerMutation = useCreateCustomer();
  const updateProgramSettings = useUpdateLoyaltySettings();
  const createLoyaltyReward = useCreateLoyaltyReward();
  const queueCampaign = useQueueLoyaltyCampaign();

  useEffect(() => {
    if (customerQuery.data) {
      const liveMembers = customerQuery.data.items.map((customer) => toMember(customer, programSettingsQuery.data?.tiers));
      setMembers(liveMembers);
      if (liveMembers.length) setSelected((current) => liveMembers.find((member) => member.id === current.id) || (current.id ? current : liveMembers[0]));
    }
  }, [customerQuery.data, programSettingsQuery.data?.tiers]);

  const pageMembers = useMemo(
    () => (memberListQuery.data?.items ?? []).map((customer) => toMember(customer, programSettingsQuery.data?.tiers)),
    [memberListQuery.data, programSettingsQuery.data?.tiers],
  );

  useEffect(() => {
    if (section === "members" && pageMembers.length)
      setSelected((current) => pageMembers.find((member) => member.id === current.id) ?? pageMembers[0]);
  }, [section, pageMembers]);

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

  const createReward = () => {
    const pointsCost = Math.trunc(Number(rewardPoints));
    const value = Number(rewardDiscount);
    if (pointsCost <= 0 || !Number.isFinite(pointsCost) || (rewardType !== 2 && (!Number.isFinite(value) || value <= 0))) {
      toast.error("امتیاز لازم و ارزش پاداش را به‌درستی وارد کنید.");
      return;
    }
    if (rewardType === 2 && !rewardProduct.trim()) {
      toast.error("برای پاداش محصول رایگان، نام محصول را وارد کنید.");
      return;
    }
    const name = rewardProduct.trim() || (rewardType === 0
      ? `تخفیف ${formatToman(value * 10)}`
      : rewardType === 1 ? `${value}% تخفیف` : "محصول رایگان");
    createLoyaltyReward.mutate({
      name,
      type: rewardType,
      pointsCost,
      discountRials: rewardType === 0 ? value * 10 : 0,
      discountPercent: rewardType === 1 ? value : 0,
      maxDiscountRials: rewardType === 1 ? 1_000_000 : 0,
      productName: rewardType === 2 ? rewardProduct.trim() : null,
    }, {
      onSuccess: () => toast.success("پاداش به فهرست باشگاه اضافه شد."),
      onError: (error: Error) => toast.error(error.message),
    });
  };

  const changeRewardType = (type: 0 | 1 | 2) => {
    setRewardType(type);
    if (type === 1 && (Number(rewardDiscount) <= 0 || Number(rewardDiscount) > 100))
      setRewardDiscount("10");
    if (type === 0 && Number(rewardDiscount) <= 100)
      setRewardDiscount(String((programSettingsQuery.data?.rewardDiscountRials ?? 500_000) / 10));
  };

  const filteredMembers = pageMembers;

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
        const member = toMember(created, programSettingsQuery.data?.tiers);
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

      {section === "overview" && <Overview overview={loyaltyOverviewQuery.data} onOpenMembers={() => setSection("members")} />}
      {section === "members" && <MembersSection
        members={filteredMembers} selected={selected} onSelect={setSelected} search={search} setSearch={(value) => { setSearch(value); setMembersPage(1); }}
        tierFilter={tierFilter} setTierFilter={(value) => { setTierFilter(value); setMembersPage(1); }} consentFilter={consentFilter} setConsentFilter={(value) => { setConsentFilter(value); setMembersPage(1); }}
        page={membersPage} pageSize={25} totalCount={memberListQuery.data?.totalCount ?? 0}
        loading={memberListQuery.isLoading} error={memberListQuery.isError}
        onPageChange={setMembersPage} tiers={programSettingsQuery.data?.tiers ?? []}
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
        rewardType={rewardType} setRewardType={changeRewardType}
        rewards={loyaltyRewardsQuery.data ?? []} rewardsLoading={loyaltyRewardsQuery.isLoading} rewardsError={loyaltyRewardsQuery.isError}
        createReward={createReward} creatingReward={createLoyaltyReward.isPending}
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
      {section === "reports" && <ReportsSection />}
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

function Overview({ overview, onOpenMembers }: { overview: LoyaltyOverviewDto | undefined; onOpenMembers: () => void }) {
  const hourlyOrders = overview?.hourlyOrders ?? [];
  const maxOrders = Math.max(1, ...hourlyOrders.map((item) => item.orderCount));
  const tierRows = overview?.tierDistribution.map((tier) => ({ label: tier.name, value: Math.round(tier.memberSharePercent) })) ?? [];
  const activeChange = (overview?.activeMembersLast30Days ?? 0) - (overview?.activeMembersPrevious30Days ?? 0);
  const activeTrend = activeChange === 0 ? undefined : (activeChange > 0 ? "+" : "") + activeChange.toLocaleString("fa-IR");
  const peakHour = overview?.peakHour ?? undefined;
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric title="اعضای باشگاه" value={overview?.totalMembers.toLocaleString("fa-IR") ?? "—"} detail="در کل دوره" icon={Users} />
      <Metric title="مشتری فعال" value={overview?.activeMembersLast30Days.toLocaleString("fa-IR") ?? "—"} detail="مراجعه در ۳۰ روز اخیر" icon={Activity} trend={activeTrend} />
      <Metric title="امتیاز صادرشده" value={overview?.pointsIssuedThisMonth.toLocaleString("fa-IR") ?? "—"} detail="این ماه" icon={Star} />
      <Metric title="تعهد کیف پول" value={overview ? formatToman(overview.walletOutstandingRials) : "—"} detail="مانده قابل استفاده مشتریان" icon={Wallet} />
    </div>
    <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
      <Card className="p-5"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-black">ساعت‌های پرتردد</h2><p className="mt-1 text-xs text-muted-foreground">سفارش‌های ۳۰ روز اخیر، همه مشتریان</p></div><Badge variant="neutral">۳۰ روز</Badge></div><div className="flex h-44 items-end gap-2">{hourlyOrders.map((item) => <div key={item.hour} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="flex h-full w-full items-end"><div className={cn("w-full rounded-t-md", item.orderCount === maxOrders && item.orderCount > 0 ? "bg-primary" : "bg-primary/35")} style={{ height: ((item.orderCount / maxOrders) * 100) + "%" }} /></div><span className="text-[10px] text-muted-foreground">{item.hour.toLocaleString("fa-IR")}</span></div>)}</div><div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-4 text-primary" /> {peakHour === undefined ? "سفارشی در این بازه ثبت نشده" : "اوج مراجعه: " + peakHour.toLocaleString("fa-IR") + " تا " + (peakHour + 3).toLocaleString("fa-IR")}</div></Card>
      <Card className="p-5"><div className="mb-5"><h2 className="font-black">ترکیب سطح مشتری‌ها</h2><p className="mt-1 text-xs text-muted-foreground">بر اساس تعداد اعضا</p></div><BarRows rows={tierRows} color="bg-amber-500" /><div className="mt-5 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-muted/60 p-2"><div className="font-black">{overview?.newMembersThisMonth.toLocaleString("fa-IR") ?? "—"}</div><div className="text-[10px] text-muted-foreground">عضو جدید این ماه</div></div><div className="rounded-xl bg-muted/60 p-2"><div className="font-black">{overview ? overview.returningMemberRatePercent.toLocaleString("fa-IR") + "٪" : "—"}</div><div className="text-[10px] text-muted-foreground">بازگشت مشتری</div></div><div className="rounded-xl bg-muted/60 p-2"><div className="font-black">{overview ? overview.memberSalesSharePercent.toLocaleString("fa-IR") + "٪" : "—"}</div><div className="text-[10px] text-muted-foreground">فروش اعضا</div></div></div></Card>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-black">نیازمند پیگیری</h2><p className="mt-1 text-xs text-muted-foreground">اعضایی که دیرتر از روال معمول برگشته‌اند</p></div><Button variant="outline" size="sm" onClick={onOpenMembers}>دیدن همه</Button></div><div className="space-y-3">{overview?.lapsedCustomers.map((customer) => <div key={customer.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div><div className="text-sm font-bold">{customer.name}</div><div className="mt-1 text-xs text-muted-foreground">آخرین مراجعه {customer.daysSinceLastVisit.toLocaleString("fa-IR")} روز پیش</div></div><Badge variant="outline" className="text-amber-700">بازگشت با تأخیر</Badge></div>)}{overview && overview.lapsedCustomers.length === 0 && <p className="py-3 text-sm text-muted-foreground">موردی برای پیگیری نیست.</p>}</div></Card>
      <Card className="p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-black">اعضا در برابر مهمان‌ها</h2><p className="mt-1 text-xs text-muted-foreground">سهم فروش دوره جاری</p></div><span className="text-xs text-muted-foreground">۳۰ روز اخیر</span></div><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl bg-primary/5 p-4"><div className="text-xs text-muted-foreground">اعضای باشگاه</div><div className="mt-2 text-xl font-black">{overview ? overview.memberSalesSharePercent.toLocaleString("fa-IR") + "٪ فروش" : "—"}</div><div className="mt-1 text-xs text-emerald-700">میانگین فاکتور {overview ? formatToman(overview.memberAverageTicketRials) : "—"}</div></div><div className="rounded-2xl bg-muted p-4"><div className="text-xs text-muted-foreground">مهمان‌ها</div><div className="mt-2 text-xl font-black">{overview ? overview.guestSalesSharePercent.toLocaleString("fa-IR") + "٪ فروش" : "—"}</div><div className="mt-1 text-xs text-muted-foreground">میانگین فاکتور {overview ? formatToman(overview.guestAverageTicketRials) : "—"}</div></div></div></Card>
    </div>
  </div>;
}

type MembersProps = {
  members: Member[]; selected: Member; onSelect: (member: Member) => void; search: string; setSearch: (v: string) => void;
  tierFilter: string; setTierFilter: (v: string) => void; consentFilter: string; setConsentFilter: (v: string) => void;
  page: number; pageSize: number; totalCount: number; loading: boolean; error: boolean; onPageChange: (page: number) => void;
  tiers: LoyaltyTierRuleDto[];
  showNew: boolean; setShowNew: (v: boolean) => void; newName: string; setNewName: (v: string) => void;
  newPhone: string; setNewPhone: (v: string) => void; newBirthday: string; setNewBirthday: (v: string) => void;
  newGender: string; setNewGender: (v: string) => void; newPersonality: string; setNewPersonality: (v: string) => void;
  newFavorite: string; setNewFavorite: (v: string) => void; newConsent: boolean; setNewConsent: (v: boolean) => void;
  createMember: () => void; selectedForSms: string[]; setSelectedForSms: (v: string[] | ((old: string[]) => string[])) => void;
  creating: boolean;
};

function MembersSection(p: MembersProps) {
  const customerQuery = useCustomer(p.selected.id || null);
  const walletQuery = useCustomerWallet(p.selected.id || null);
  const ordersQuery = useCustomerOrders(p.selected.id);
  const pointsQuery = useCustomerPointHistory(p.selected.id);
  const updateCustomerMutation = useUpdateCustomer();
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState(p.selected.name);
  const [editPhone, setEditPhone] = useState(p.selected.phone);
  const [editConsent, setEditConsent] = useState(p.selected.consent);
  const profile = customerQuery.data ? toMember(customerQuery.data, p.tiers) : p.selected;
  useEffect(() => {
    setEditName(profile.name);
    setEditPhone(profile.phone);
    setEditConsent(profile.consent);
    setEditingProfile(false);
  }, [profile.id, profile.name, profile.phone, profile.consent]);

  const saveProfile = () => {
    if (!profile.id || !editName.trim() || editPhone.trim().length < 10) {
      toast.error("نام و شماره موبایل معتبر را وارد کنید.");
      return;
    }
    updateCustomerMutation.mutate({
      id: profile.id,
      payload: {
        fullName: editName.trim(),
        phoneNumber: editPhone.trim(),
        marketingConsent: editConsent,
      },
    }, {
      onSuccess: () => {
        setEditingProfile(false);
        toast.success("پروفایل مشتری ذخیره شد.");
      },
      onError: (error: Error) => toast.error(error.message),
    });
  };

  const toggle = (id: string) => p.setSelectedForSms((old) => old.includes(id) ? old.filter((x) => x !== id) : [...old, id]);
  return <div className="grid gap-4 xl:grid-cols-[1fr_350px]">
    <div className="space-y-3">
      <Card className="flex flex-wrap items-center gap-2 p-3"><div className="relative min-w-52 flex-1"><Search className="absolute right-3 top-2.5 size-4 text-muted-foreground" /><Input className="pr-9" value={p.search} onChange={(e) => p.setSearch(e.target.value)} placeholder="جست‌وجوی نام یا شماره" /></div><select className="h-10 rounded-xl border bg-card px-3 text-sm" value={p.tierFilter} onChange={(e) => p.setTierFilter(e.target.value)}><option value="همه سطح‌ها">همه سطح‌ها</option>{(p.tiers.length ? p.tiers : [{ name: "طلایی" }, { name: "نقره‌ای" }, { name: "برنزی" }]).map((tier) => <option key={tier.name} value={tier.name}>{tier.name}</option>)}</select><select className="h-10 rounded-xl border bg-card px-3 text-sm" value={p.consentFilter} onChange={(e) => p.setConsentFilter(e.target.value)}><option>همه</option><option>رضایت دارد</option><option>رضایت ندارد</option></select><Button variant="outline" onClick={() => p.setShowNew(!p.showNew)}><Plus className="ml-1 size-4" /> افزودن عضو</Button></Card>
      {p.showNew && <Card className="space-y-3 p-4"><div className="flex items-center justify-between"><h2 className="font-black">ثبت مشتری جدید</h2><Badge variant="neutral">ورود دستی / منوی دیجیتال</Badge></div><div className="grid gap-3 sm:grid-cols-2"><Field label="نام و نام خانوادگی"><Input value={p.newName} onChange={(e) => p.setNewName(e.target.value)} placeholder="مثلاً سارا محمدی" /></Field><Field label="شماره موبایل"><Input dir="ltr" value={p.newPhone} onChange={(e) => p.setNewPhone(e.target.value)} placeholder="09xxxxxxxxx" /></Field><Field label="تاریخ تولد"><Input type="date" value={p.newBirthday} onChange={(e) => p.setNewBirthday(e.target.value)} /></Field><Field label="جنسیت"><select className="h-10 rounded-xl border bg-card px-3 text-sm" value={p.newGender} onChange={(e) => p.setNewGender(e.target.value)}><option>نامشخص</option><option>زن</option><option>مرد</option></select></Field><Field label="تیپ شخصیتی"><select className="h-10 rounded-xl border bg-card px-3 text-sm" value={p.newPersonality} onChange={(e) => p.setNewPersonality(e.target.value)}><option>متعادل</option><option>درون‌گرا</option><option>برون‌گرا</option><option>تحلیل‌گر</option><option>سفارشی</option></select></Field><Field label="محصول موردعلاقه"><Input value={p.newFavorite} onChange={(e) => p.setNewFavorite(e.target.value)} placeholder="مثل لاته" /></Field></div><label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={p.newConsent} onChange={(e) => p.setNewConsent(e.target.checked)} className="accent-primary" /> رضایت برای دریافت پیامک‌های تبلیغاتی ثبت شد</label><Button onClick={p.createMember} loading={p.creating}>ثبت در باشگاه</Button></Card>}
      <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-right text-sm"><thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="p-3">انتخاب</th><th>مشتری</th><th>سطح</th><th>مراجعه</th><th>خرید کل</th><th>امتیاز</th><th>آخرین مراجعه</th><th>پیامک</th></tr></thead><tbody>{p.members.map((member) => <tr key={member.id} onClick={() => p.onSelect(member)} className={cn("cursor-pointer border-t hover:bg-muted/30", p.selected.id === member.id && "bg-primary/5")}><td className="p-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`انتخاب ${member.name}`} checked={p.selectedForSms.includes(member.id)} onChange={() => toggle(member.id)} className="accent-primary" /></td><td><div className="font-bold">{member.name}</div><div dir="ltr" className="mt-0.5 text-right text-xs text-muted-foreground">{member.phone}</div></td><td><Badge variant="outline">{member.tier}</Badge></td><td>{member.visits.toLocaleString("fa-IR")}</td><td>{formatToman(member.spend)}</td><td className="font-bold text-primary">{member.points.toLocaleString("fa-IR")}</td><td>{member.lastVisit}</td><td>{member.consent ? <Badge className="bg-emerald-100 text-emerald-800">مجاز</Badge> : <Badge variant="neutral">غیرفعال</Badge>}</td></tr>)}</tbody></table>{p.loading ? <div className="p-8 text-center text-sm text-muted-foreground">در حال دریافت مشتری‌ها…</div> : p.error ? <div className="p-8 text-center text-sm text-rose-600">دریافت فهرست مشتری‌ها ناموفق بود.</div> : p.members.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">مشتری با این فیلتر پیدا نشد.</div>}</div><div className="flex items-center justify-between gap-3 border-t p-3 text-xs text-muted-foreground"><span>{p.totalCount.toLocaleString("fa-IR")} مشتری در این فهرست</span><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={p.page <= 1 || p.loading} onClick={() => p.onPageChange(p.page - 1)}>قبلی</Button><span>صفحه {p.page.toLocaleString("fa-IR")} از {Math.max(1, Math.ceil(p.totalCount / p.pageSize)).toLocaleString("fa-IR")}</span><Button size="sm" variant="outline" disabled={p.page >= Math.ceil(p.totalCount / p.pageSize) || p.loading} onClick={() => p.onPageChange(p.page + 1)}>بعدی</Button></div></div></Card>
    </div>
    <Card className="h-fit space-y-4 p-4">
      <div><div className="flex items-center justify-between"><h2 className="font-black">پروفایل مشتری</h2><Badge>{profile.tier}</Badge></div><div className="mt-3 text-lg font-black">{profile.name || "مشتری انتخاب‌نشده"}</div><div dir="ltr" className="mt-1 text-right text-sm text-muted-foreground">{profile.phone}</div></div>
      {editingProfile ? <div className="space-y-3"><Field label="نام و نام خانوادگی"><Input value={editName} onChange={(event) => setEditName(event.target.value)} /></Field><Field label="شماره موبایل"><Input dir="ltr" value={editPhone} onChange={(event) => setEditPhone(event.target.value)} /></Field><label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={editConsent} onChange={(event) => setEditConsent(event.target.checked)} className="accent-primary" /> رضایت دریافت پیامک تبلیغاتی</label><div className="flex gap-2"><Button className="flex-1" onClick={saveProfile} loading={updateCustomerMutation.isPending}>ذخیره پروفایل</Button><Button variant="outline" onClick={() => setEditingProfile(false)}>لغو</Button></div></div> : <>
        <div className="grid grid-cols-2 gap-2"><MiniStat label="امتیاز" value={profile.points.toLocaleString("fa-IR")} /><MiniStat label="کیف پول" value={walletQuery.data ? formatToman(walletQuery.data.balanceRials) : walletQuery.isLoading ? "…" : "—"} /><MiniStat label="تعداد مراجعه" value={profile.visits.toLocaleString("fa-IR")} /><MiniStat label="مجموع خرید" value={formatToman(profile.spend)} /></div>
        <div className="space-y-2 border-t pt-3 text-xs"><ProfileRow icon={Cake} label="تولد" value={profile.birthday || "ثبت نشده"} /><ProfileRow icon={Users} label="جنسیت / شخصیت" value={profile.gender + " · " + profile.personality} /><ProfileRow icon={Star} label="علاقه‌مندی‌ها" value={profile.favorites.join("، ") || "ثبت نشده"} /></div>
      </>}
      <div className="border-t pt-3"><div className="mb-2 font-bold">سفارش‌ها و گردش امتیاز</div><div className="space-y-2 text-xs">{ordersQuery.data?.items.slice(0, 4).map((order) => <div key={order.id} className="flex justify-between rounded-xl bg-muted/50 p-2"><span>سفارش {order.orderNumber} · {order.createdAtShamsi}</span><b>{formatToman(order.grandTotal)}</b></div>)}{pointsQuery.data?.items.slice(0, 4).map((entry) => <div key={entry.id} className="flex justify-between rounded-xl bg-muted/50 p-2"><span>{entry.notes || entry.type} · {new Date(entry.occurredAtUtc).toLocaleDateString("fa-IR")}</span><b className={entry.pointsDelta < 0 ? "text-rose-600" : "text-emerald-700"}>{entry.pointsDelta > 0 ? "+" : ""}{entry.pointsDelta.toLocaleString("fa-IR")} امتیاز</b></div>)}{ordersQuery.isLoading || pointsQuery.isLoading ? <span className="text-muted-foreground">در حال دریافت سوابق…</span> : !ordersQuery.data?.items.length && !pointsQuery.data?.items.length && <span className="text-muted-foreground">سابقه‌ای برای نمایش وجود ندارد.</span>}</div></div>
      {!editingProfile && <Button variant="outline" className="w-full" disabled={!profile.id} onClick={() => setEditingProfile(true)}>ویرایش پروفایل</Button>}
    </Card>
  </div>;
}

function RewardsSection(p: { earnMode: string; setEarnMode: (v: string) => void; earnAmount: string; setEarnAmount: (v: string) => void; earnPoints: string; setEarnPoints: (v: string) => void; earnEveryVisits: string; setEarnEveryVisits: (v: string) => void; earnPercent: string; setEarnPercent: (v: string) => void; cashback: string; setCashback: (v: string) => void; cashbackMax: string; setCashbackMax: (v: string) => void; cashbackMin: string; setCashbackMin: (v: string) => void; cashbackProductIds: string; setCashbackProductIds: (v: string) => void; rewardPoints: string; setRewardPoints: (v: string) => void; rewardDiscount: string; setRewardDiscount: (v: string) => void; rewardProduct: string; setRewardProduct: (v: string) => void; rewardType: 0 | 1 | 2; setRewardType: (v: 0 | 1 | 2) => void; rewards: LoyaltyRewardDto[]; rewardsLoading: boolean; rewardsError: boolean; createReward: () => void; creatingReward: boolean; onSave: () => void; saving: boolean }) {
  return <div className="space-y-4"><div className="grid gap-4 xl:grid-cols-2"><Card className="space-y-4 p-5"><div className="flex items-center gap-2"><Star className="size-5 text-amber-500" /><div><h2 className="font-black">قانون کسب امتیاز</h2><p className="text-xs text-muted-foreground">برای خریدها امتیاز ثابت یا درصدی تعریف کنید</p></div></div><Field label="مبنای امتیاز"><select className="h-10 w-full rounded-xl border bg-card px-3 text-sm" value={p.earnMode} onChange={(e) => p.setEarnMode(e.target.value)}><option>مبلغ خرید</option><option>تعداد خرید</option><option>درصد مبلغ خرید</option></select></Field>{p.earnMode === "مبلغ خرید" ? <div className="grid grid-cols-2 gap-3"><Field label="به ازای هر (تومان)"><Input value={p.earnAmount} onChange={(e) => p.setEarnAmount(e.target.value)} /></Field><Field label="امتیاز"><Input value={p.earnPoints} onChange={(e) => p.setEarnPoints(e.target.value)} /></Field></div> : p.earnMode === "تعداد خرید" ? <div className="grid grid-cols-2 gap-3"><Field label="به ازای هر چند خرید"><Input type="number" value={p.earnEveryVisits} onChange={(e) => p.setEarnEveryVisits(e.target.value)} /></Field><Field label="امتیاز هر نوبت"><Input type="number" value={p.earnPoints} onChange={(e) => p.setEarnPoints(e.target.value)} /></Field></div> : <Field label="درصد بازگشت به امتیاز"><Input value={p.earnPercent} onChange={(e) => p.setEarnPercent(e.target.value)} /></Field>}<div className="rounded-xl bg-primary/5 p-3 text-xs text-muted-foreground">پیش‌نمایش: خرید ۵۰۰٬۰۰۰ تومانی حدود <b className="text-primary">{p.earnMode === "درصد مبلغ خرید" ? Math.floor(5_000_000 * Number(p.earnPercent || 0) / 100 / 1000).toLocaleString("fa-IR") : Math.floor(500000 / Math.max(1, Number(p.earnAmount || 10000)) * Number(p.earnPoints || 1)).toLocaleString("fa-IR")} امتیاز</b> می‌گیرد.</div><Button onClick={p.onSave} loading={p.saving}>ذخیره قانون</Button></Card>
      <Card className="space-y-4 p-5"><div className="flex items-center gap-2"><CircleDollarSign className="size-5 text-emerald-600" /><div><h2 className="font-black">کش‌بک و کیف پول</h2><p className="text-xs text-muted-foreground">بازگشت وجه با دامنه محصولی و سقف قابل تنظیم</p></div></div><div className="grid grid-cols-2 gap-3"><Field label="درصد کش‌بک"><Input type="number" value={p.cashback} onChange={(e) => p.setCashback(e.target.value)} /></Field><Field label="سقف هر سفارش (تومان)"><Input type="number" value={p.cashbackMax} onChange={(e) => p.setCashbackMax(e.target.value)} /></Field></div><Field label="حداقل خرید برای کش‌بک (تومان)"><Input type="number" value={p.cashbackMin} onChange={(e) => p.setCashbackMin(e.target.value)} /></Field><Field label="Product IDs eligible for cashback (comma separated)"><Input value={p.cashbackProductIds} onChange={(e) => p.setCashbackProductIds(e.target.value)} placeholder="Leave blank for all products" /></Field><p className="text-xs text-muted-foreground">موجودی کیف پول در فاکتور بعدی به‌عنوان روش پرداخت قابل انتخاب خواهد بود.</p><Button onClick={p.onSave} loading={p.saving}>ذخیره کش‌بک</Button></Card></div>
    <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]"><Card className="space-y-4 p-5"><div className="flex items-center gap-2"><Gift className="size-5 text-primary" /><div><h2 className="font-black">تبدیل امتیاز به تخفیف یا محصول</h2><p className="text-xs text-muted-foreground">اعضا می‌توانند امتیاز را در منو خرج کنند</p></div></div><div className="grid gap-3 sm:grid-cols-3"><Field label="امتیاز لازم"><Input type="number" value={p.rewardPoints} onChange={(e) => p.setRewardPoints(e.target.value)} /></Field><Field label="نوع پاداش"><select className="h-10 rounded-xl border bg-card px-3 text-sm" value={p.rewardType} onChange={(e) => p.setRewardType(Number(e.target.value) as 0 | 1 | 2)}><option value={0}>تخفیف مبلغی</option><option value={1}>تخفیف درصدی</option><option value={2}>محصول رایگان</option></select></Field><Field label="ارزش / محصول"><Input type="number" value={p.rewardDiscount} onChange={(e) => p.setRewardDiscount(e.target.value)} /></Field></div><Field label="??? ????? ????? (???????)"><Input value={p.rewardProduct} onChange={(e) => p.setRewardProduct(e.target.value)} /></Field><div className="grid gap-2 sm:grid-cols-2">{p.rewardsLoading && <div className="col-span-2 py-3 text-center text-sm text-muted-foreground">در حال دریافت پاداش‌ها…</div>}{p.rewardsError && <div className="col-span-2 py-3 text-center text-sm text-rose-600">دریافت پاداش‌ها ناموفق بود.</div>}{!p.rewardsLoading && !p.rewardsError && p.rewards.length === 0 && <div className="col-span-2 py-3 text-center text-sm text-muted-foreground">هنوز پاداشی تعریف نشده است.</div>}{p.rewards.map((reward) => <RewardCard key={reward.id} title={reward.name} cost={`${reward.pointsCost.toLocaleString("fa-IR")} امتیاز`} stock={reward.type === 0 ? formatToman(reward.discountRials) : reward.type === 1 ? `${reward.discountPercent.toLocaleString("fa-IR")}٪ تخفیف` : reward.productName ?? "محصول رایگان"} />)}</div><Button variant="outline" onClick={p.createReward} loading={p.creatingReward}><Plus className="ml-1 size-4" /> تعریف پاداش جدید</Button></Card><Card className="space-y-4 p-5"><div className="flex items-center gap-2"><Star className="size-5 text-amber-500" /><div><h2 className="font-black">سطح‌بندی مشتریان</h2><p className="text-xs text-muted-foreground">براساس مراجعه و مجموع خرید</p></div></div><div className="space-y-2"><TierRow name="طلایی" visits="۲۰ مراجعه یا ۱۵ میلیون خرید" bonus="۱٫۵× امتیاز · ۵٪ کش‌بک" color="bg-amber-400" /><TierRow name="نقره‌ای" visits="۸ مراجعه یا ۵ میلیون خرید" bonus="۱٫۲× امتیاز · ۳٪ کش‌بک" color="bg-slate-400" /><TierRow name="برنزی" visits="عضویت پایه" bonus="۱× امتیاز" color="bg-orange-500" /></div><Button variant="outline"><Settings2 className="ml-1 size-4" /> تنظیم شرط و مزایا</Button></Card></div>
  </div>;
}

function CampaignSection(p: { members: Member[]; selectedForSms: string[]; setSelectedForSms: (v: string[] | ((old: string[]) => string[])) => void; campaignText: string; setCampaignText: (v: string) => void; sendCampaign: () => void; sending: boolean; smsEnabled: boolean; setSmsEnabled: (v: boolean) => void; thankYouEnabled: boolean; setThankYouEnabled: (v: boolean) => void; thankYouText: string; setThankYouText: (v: string) => void; quietHoursStart: string; setQuietHoursStart: (v: string) => void; quietHoursEnd: string; setQuietHoursEnd: (v: string) => void; onSave: () => void; saving: boolean }) {
  const eligible = p.members.filter((m) => m.consent);
  return <div className="grid gap-4 xl:grid-cols-2"><Card className="space-y-4 p-5"><div className="flex items-center justify-between"><div><h2 className="font-black">ساخت کمپین پیامکی</h2><p className="mt-1 text-xs text-muted-foreground">انتخاب گروه، نوشتن متن و پیش‌نمایش گیرندگان</p></div><Badge variant="neutral">{eligible.length} شماره مجاز</Badge></div><div className="grid grid-cols-2 gap-3"><Field label="فیلتر مشتری"><select className="h-10 w-full rounded-xl border bg-card px-3 text-sm"><option>انتخاب دستی یا همه فیلترشده</option><option>سطح طلایی</option><option>بیش از ۳۰ روز غیرفعال</option><option>تولد این ماه</option><option>رضایت پیامک دارد</option></select></Field><Field label="زمان ارسال"><select className="h-10 w-full rounded-xl border bg-card px-3 text-sm"><option>ارسال فوری</option><option>زمان‌بندی کمپین</option></select></Field></div><Field label="متن پیام"><textarea className="min-h-28 w-full rounded-xl border bg-card p-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" value={p.campaignText} onChange={(e) => p.setCampaignText(e.target.value)} /></Field><div className="flex flex-wrap gap-1.5">{["{name}", "{points}", "{balance}", "{tier}", "{date}"].map((token) => <button key={token} type="button" onClick={() => p.setCampaignText(`${p.campaignText} ${token}`)} className="rounded-lg border px-2 py-1 font-mono text-[10px] text-primary">{token}</button>)}</div><div className="flex items-center justify-between rounded-xl bg-muted/60 p-3 text-xs"><span>گیرندگان واجد شرایط: <b>{p.selectedForSms.length || eligible.length} شماره</b></span><span>تقریباً ۱ پیامک برای هر شماره</span></div><Button onClick={p.sendCampaign} loading={p.sending}><Send className="ml-1 size-4" /> پیش‌نمایش و ارسال</Button></Card>
    <div className="space-y-4"><Card className="space-y-4 p-5"><div className="flex items-center justify-between"><div><h2 className="font-black">پیام خودکار بعد از خرید</h2><p className="mt-1 text-xs text-muted-foreground">تشکر از خرید و اعلام امتیاز کسب‌شده</p></div><input aria-label="فعال بودن پیامک تشکر" type="checkbox" checked={p.thankYouEnabled} onChange={(e) => p.setThankYouEnabled(e.target.checked)} className="size-5 accent-primary" /></div><textarea className="min-h-20 w-full rounded-xl border bg-card p-3 text-sm" value={p.thankYouText} onChange={(e) => p.setThankYouText(e.target.value)} /><Field label="تأخیر ارسال"><select className="h-10 w-full rounded-xl border bg-card px-3 text-sm"><option>بلافاصله بعد از تسویه</option><option>۱۵ دقیقه بعد</option><option>۱ ساعت بعد</option></select></Field></Card><Card className="space-y-3 p-5"><div className="flex items-center justify-between"><div><h2 className="font-black">تنظیمات سرویس پیامک</h2><p className="mt-1 text-xs text-muted-foreground">فعال‌سازی و ساعت سکوت</p></div><input aria-label="فعال بودن پیامک" type="checkbox" checked={p.smsEnabled} onChange={(e) => p.setSmsEnabled(e.target.checked)} className="size-5 accent-primary" /></div><div className="grid grid-cols-2 gap-3"><Field label="ساعت شروع"><Input type="time" value={p.quietHoursStart} onChange={(e) => p.setQuietHoursStart(e.target.value)} /></Field><Field label="ساعت پایان"><Input type="time" value={p.quietHoursEnd} onChange={(e) => p.setQuietHoursEnd(e.target.value)} /></Field></div><p className="text-[11px] text-muted-foreground">پیام تبلیغاتی فقط برای مشتریان دارای رضایت ارسال می‌شود.</p><Button onClick={p.onSave} loading={p.saving}>Save SMS settings</Button></Card><Card className="p-5"><h2 className="font-black">عملکرد کمپین اخیر</h2><div className="mt-3 grid grid-cols-3 gap-2 text-center"><MiniStat label="تحویل" value="۹۲٪" /><MiniStat label="بازگشت به کافه" value="۱۸٪" /><MiniStat label="فروش منتسب" value="۱۲٫۴م" /></div></Card></div>
  </div>;
}

function ReportsSection() {
  const [period, setPeriod] = useState<"Last30Days" | "ThisMonth" | "Last3Months" | "CustomRange">("Last30Days");
  const [comparison, setComparison] = useState<"PreviousPeriod" | "PreviousYear" | "None">("PreviousPeriod");
  const [appliedPeriod, setAppliedPeriod] = useState(period);
  const [appliedComparison, setAppliedComparison] = useState(comparison);
  const reportQuery = useLoyaltyClubReport(appliedPeriod, appliedComparison, null, null, { enabled: appliedPeriod !== "CustomRange" });
  const report = reportQuery.data;
  const peakHours = report?.peakHours ?? [];
  const applyFilters = () => { if (period === "CustomRange") { toast.info("برای بازه دلخواه، تاریخ شروع و پایان لازم است."); return; } setAppliedPeriod(period); setAppliedComparison(comparison); };
  const number = (value: number) => value.toLocaleString("fa-IR");
  const percent = (value: number) => number(value) + "٪";
  const reportBars = report ? [{ label: "سهم فروش اعضا", value: report.memberSalesSharePercent }, { label: "میانگین فاکتور عضو نسبت به مهمان", value: report.memberAverageTicketPercentOfGuest }, { label: "نرخ بازگشت اعضا", value: report.memberReturningRatePercent }, { label: "بازگشت مهمان‌ها", value: report.guestReturningRatePercent }] : [];
  return <div className="space-y-4">
    <Card className="flex flex-wrap items-end gap-3 p-4"><Field label="بازه گزارش"><select value={period} onChange={(event) => setPeriod(event.target.value as typeof period)} className="h-10 rounded-xl border bg-card px-3 text-sm"><option value="Last30Days">۳۰ روز اخیر</option><option value="ThisMonth">ماه جاری</option><option value="Last3Months">سه ماه اخیر</option><option value="CustomRange">بازه دلخواه</option></select></Field><Field label="مقایسه با"><select value={comparison} onChange={(event) => setComparison(event.target.value as typeof comparison)} className="h-10 rounded-xl border bg-card px-3 text-sm"><option value="PreviousPeriod">دوره قبل</option><option value="PreviousYear">سال قبل</option><option value="None">بدون مقایسه</option></select></Field><Button variant="outline" onClick={applyFilters} loading={reportQuery.isFetching}>اعمال فیلتر</Button>{report && <span className="text-xs text-muted-foreground">بازه داده: {report.periodLabelFa}</span>}</Card>
    {reportQuery.isError && <Card className="p-4 text-sm text-destructive">دریافت گزارش با خطا مواجه شد. دوباره تلاش کنید.</Card>}
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="p-5"><h2 className="font-black">مقایسه اعضا و مهمان‌ها</h2><p className="mb-5 mt-1 text-xs text-muted-foreground">درآمد، میانگین فاکتور و دفعات مراجعه</p>{report ? <BarRows rows={reportBars} /> : <div className="py-8 text-center text-sm text-muted-foreground">{reportQuery.isLoading ? "در حال دریافت گزارش…" : "داده‌ای برای نمایش نیست"}</div>}<div className="mt-4 text-xs text-muted-foreground">میانگین فاکتور اعضا: {report ? formatToman(report.memberAverageTicketRials) : "—"}</div></Card>
      <Card className="p-5"><h2 className="font-black">بازگشت مشتری (Retention)</h2><p className="mb-5 mt-1 text-xs text-muted-foreground">درصد مشتریانی که بعد از اولین خرید برگشته‌اند</p><div className="flex h-36 items-end gap-3">{(report?.retentionByMonth ?? []).map((item) => <div key={item.monthLabel} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="flex h-full w-full items-end"><div className="w-full rounded-t-md bg-emerald-500/70" style={{ height: Math.max(0, Math.min(100, item.returningRatePercent)) + "%" }} /></div><span className="text-[9px] text-muted-foreground">{item.monthLabel}</span></div>)}</div><div className="mt-3 text-sm font-bold text-emerald-700">{report?.retentionByMonth.length ? "میزان بازگشت آخرین ماه: " + percent(report.retentionByMonth[report.retentionByMonth.length - 1].returningRatePercent) : "اطلاعات بازگشت موجود نیست"}</div></Card>
      <Card className="p-5"><h2 className="font-black">اثربخشی پیامک تبلیغاتی</h2><p className="mb-4 mt-1 text-xs text-muted-foreground">خرید منتسب‌شده تا ۷ روز پس از ارسال</p><div className="grid grid-cols-3 gap-2"><MiniStat label="ارسال‌شده" value={report ? number(report.smsSentCount) : "—"} /><MiniStat label="خرید منتسب" value={report ? number(report.smsAttributedOrderCount) : "—"} /><MiniStat label="درآمد منتسب" value={report ? formatToman(report.smsAttributedRevenueRials) : "—"} /></div><div className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">نرخ تبدیل {report ? percent(report.smsConversionRatePercent) : "—"}{report?.smsConversionChangePercentagePoints != null ? " · تغییر نسبت به مقایسه: " + (report.smsConversionChangePercentagePoints > 0 ? "+" : "") + number(report.smsConversionChangePercentagePoints) + " واحد درصد" : ""}</div></Card>
      <Card className="p-5"><h2 className="font-black">مراجعه با تأخیر یا ریزش احتمالی</h2><p className="mb-3 mt-1 text-xs text-muted-foreground">بر اساس فاصله معمول خرید و آخرین بازدید</p>{report?.atRiskCustomers.map((customer) => <div key={customer.id} className="flex items-center justify-between border-t py-3 text-sm"><div><b>{customer.name}</b><div className="text-xs text-muted-foreground">آخرین مراجعه: {customer.lastVisitShamsi} · {number(customer.daysSinceLastVisit)} روز پیش</div></div><Badge variant="outline" className="text-amber-700">ارسال پیام بازگشت</Badge></div>)}{report && report.atRiskCustomers.length === 0 && <div className="py-5 text-center text-sm text-muted-foreground">مشتری در معرض ریزش پیدا نشد.</div>}</Card>
    </div>
    <Card className="p-5"><div className="flex items-center gap-2"><Clock3 className="size-4 text-primary" /><h2 className="font-black">ساعات پرتردد کافه</h2></div><p className="mb-4 mt-1 text-xs text-muted-foreground">ترکیب سفارش اعضا و مهمان‌ها به تفکیک ساعت</p><div className="grid grid-cols-4 gap-2 sm:grid-cols-8">{peakHours.map((item) => <div key={item.hour} className="rounded-xl border p-2 text-center"><div className="mx-auto mb-2 h-16 w-4 overflow-hidden rounded-full bg-muted"><div className="w-full rounded-full bg-primary" style={{ height: item.percentOfPeak + "%", marginTop: (100 - item.percentOfPeak) + "%" }} /></div><div className="text-xs font-bold">{number(item.hour)}</div><div className="text-[9px] text-muted-foreground">{number(item.orderCount)} سفارش · {percent(item.percentOfPeak)}</div></div>)}{report && peakHours.length === 0 && <div className="col-span-full py-4 text-center text-sm text-muted-foreground">سفارشی در این بازه ثبت نشده است.</div>}</div></Card>
  </div>;
}
function PortalPreview({ member }: { member: Member }) {
  const query = useCustomerPortalPreview(member.id || null);
  const data = query.data;
  const rewards = data?.rewards ?? [];
  const activities = data?.recentActivities ?? [];
  return <div className="mx-auto max-w-3xl space-y-4"><Card className="overflow-hidden"><div className="bg-gradient-to-l from-primary to-rose-700 p-6 text-white"><div className="flex items-center justify-between"><div><div className="text-sm text-white/80">سلام {data?.customerName ?? member.name} 👋</div><h2 className="mt-1 text-2xl font-black">باشگاه مشتریان پنارا</h2></div><Badge className="bg-white/20 text-white">سطح {data?.currentTierName ?? member.tier}</Badge></div><div className="mt-6 grid grid-cols-3 gap-2"><div><div className="text-xs text-white/70">امتیاز شما</div><div className="mt-1 text-2xl font-black">{(data?.loyaltyPoints ?? member.points).toLocaleString("fa-IR")}</div></div><div><div className="text-xs text-white/70">کیف پول</div><div className="mt-1 text-lg font-black">{formatToman(data?.walletBalanceRials ?? member.wallet)}</div></div><div><div className="text-xs text-white/70">مراجعه‌ها</div><div className="mt-1 text-2xl font-black">{(data?.visitCount ?? member.visits).toLocaleString("fa-IR")}</div></div></div></div><div className="space-y-5 p-5"><div><div className="mb-2 flex justify-between text-xs"><b>پیشرفت تا سطح بعدی</b><span className="text-muted-foreground">{data ? data.nextTierProgressPercent.toLocaleString("fa-IR") + "٪" : "—"}</span></div><div className="h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-amber-400" style={{ width: (data?.nextTierProgressPercent ?? 0) + "%" }} /></div><p className="mt-2 text-[11px] text-muted-foreground">{query.isLoading ? "در حال دریافت اطلاعات..." : data?.nextTierName ? "سطح بعدی: " + data.nextTierName + (data.visitsToNextTier > 0 ? " · " + data.visitsToNextTier.toLocaleString("fa-IR") + " مراجعه دیگر" : "") : "بالاترین سطح باشگاه"}</p></div><div><h3 className="mb-3 font-black">پاداش‌های قابل دریافت</h3><div className="grid gap-3 sm:grid-cols-2">{rewards.map((reward) => <RewardCard key={reward.id} title={reward.name} cost={reward.pointsCost.toLocaleString("fa-IR") + " امتیاز"} stock={reward.canRedeem ? "قابل دریافت" : reward.pointsNeeded.toLocaleString("fa-IR") + " امتیاز دیگر لازم است"} />)}{!query.isLoading && rewards.length === 0 && <div className="text-xs text-muted-foreground">پاداش فعالی برای نمایش وجود ندارد.</div>}</div></div><div><h3 className="mb-2 font-black">آخرین فعالیت‌ها</h3><div className="space-y-2 text-xs">{activities.map((activity) => <div key={activity.id} className="flex justify-between gap-3 rounded-xl bg-muted/50 p-3"><span>{activity.notes || (activity.type === "Redeem" ? "دریافت پاداش" : activity.type === "ManualAdjust" ? "اصلاح امتیاز" : "امتیاز خرید")} · {new Date(activity.occurredAtUtc).toLocaleDateString("fa-IR")}</span><b className={activity.pointsDelta >= 0 ? "text-emerald-700" : "text-rose-600"}>{activity.pointsDelta > 0 ? "+" : ""}{activity.pointsDelta.toLocaleString("fa-IR")} امتیاز</b></div>)}{!query.isLoading && activities.length === 0 && <div className="rounded-xl bg-muted/50 p-3 text-muted-foreground">فعالیتی ثبت نشده است.</div>}{query.isError && <div className="text-rose-600">اطلاعات پیش‌نمایش دریافت نشد.</div>}</div></div></div></Card><Card className="flex flex-wrap items-center justify-between gap-3 p-4"><div><div className="font-bold">ثبت‌نام از منوی آنلاین</div><div className="mt-1 text-xs text-muted-foreground">پیش از پرداخت، نام و موبایل گرفته شده و حساب باشگاه ساخته می‌شود.</div></div><Button onClick={() => toast.info("فرم ثبت‌نام منوی دیجیتال در صفحه عمومی پیاده‌سازی می‌شود.")}>پیش‌نمایش فرم عضویت</Button></Card></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-1.5"><span className="text-xs font-semibold text-muted-foreground">{label}</span>{children}</label>; }
function MiniStat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-muted/60 p-3"><div className="text-[10px] text-muted-foreground">{label}</div><div className="mt-1 truncate text-sm font-black">{value}</div></div>; }
function ProfileRow({ icon: Icon, label, value }: { icon: typeof Cake; label: string; value: string }) { return <div className="flex items-center gap-2"><Icon className="size-3.5 text-muted-foreground" /><span className="w-24 text-muted-foreground">{label}</span><b>{value}</b></div>; }
function RewardCard({ title, cost, stock }: { title: string; cost: string; stock: string }) { return <div className="flex items-center justify-between gap-2 rounded-xl border p-3"><div className="flex items-center gap-2"><span className="rounded-lg bg-primary/10 p-2 text-primary"><Gift className="size-4" /></span><div><div className="text-sm font-bold">{title}</div><div className="text-[10px] text-muted-foreground">{stock}</div></div></div><Badge variant="outline">{cost}</Badge></div>; }
function TierRow({ name, visits, bonus, color }: { name: string; visits: string; bonus: string; color: string }) { return <div className="flex items-start gap-3 rounded-xl border p-3"><span className={cn("mt-1 size-3 shrink-0 rounded-full", color)} /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><b className="text-sm">{name}</b><ChevronDown className="size-4 text-muted-foreground" /></div><div className="mt-1 text-[10px] text-muted-foreground">{visits}</div><div className="mt-1 text-[10px] font-semibold text-primary">{bonus}</div></div></div>; }
