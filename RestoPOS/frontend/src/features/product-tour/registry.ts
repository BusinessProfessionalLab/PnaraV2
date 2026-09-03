import type { TourDefinition, TourStep } from "./types";

/*
 * Tour content — Persian, friendly and concrete.
 *
 * Targets reference stable `data-tour` attributes added to real product UI
 * (treated as a contract: never target nth-child or generated classes).
 * Steps that point at elements which only exist on some viewports declare
 * several selectors; the manager picks the first visible one.
 */

/** POS register quick tour (single route: /pos). */
export const REGISTER_STEPS: TourStep[] = [
  {
    id: "pos-search",
    route: "/pos",
    element: '[data-tour="pos-search"]',
    title: "جستجوی سریع منو",
    description:
      "نام محصول، دسته یا حتی کد مواد اولیه را بنویسید تا آیتم موردنظر فوراً پیدا شود — لازم نیست کل فهرست را بالا و پایین کنید.",
  },
  {
    id: "pos-categories",
    route: "/pos",
    element: '[data-tour="pos-categories"]',
    title: "دسته‌بندی آیتم‌ها",
    description:
      "با انتخاب هر دسته فقط محصولات همان گروه نمایش داده می‌شود. عدد داخل هر دکمه، تعداد آیتم‌های آن دسته را نشان می‌دهد.",
  },
  {
    id: "pos-products",
    route: "/pos",
    element: '[data-tour="pos-products"]',
    title: "افزودن به فاکتور",
    description:
      "با یک لمس روی هر محصول، آن را به فاکتور اضافه کنید. روی هر کارت وضعیت موجودی و قیمت نهایی دیده می‌شود.",
  },
  {
    id: "pos-cart",
    route: "/pos",
    element: ['[data-tour="pos-cart-pane"]', '[data-tour="pos-cart-bar"]'],
    title: "فاکتور جاری",
    description:
      "اقلام انتخاب‌شده این‌جا جمع می‌شوند؛ می‌توانید تعداد را کم و زیاد کنید، ردیف را حذف کنید یا فاکتور را موقتاً ذخیره کنید.",
  },
  {
    id: "pos-checkout",
    route: "/pos",
    element: [
      '[data-tour="pos-checkout-desktop"]',
      '[data-tour="pos-checkout-mobile"]',
    ],
    title: "تسویه حساب",
    description:
      "برای پرداخت دکمه «تسویه و پرداخت» را بزنید و روش پرداخت را انتخاب کنید؛ پس از تأیید، فیش حرارتی هم چاپ می‌شود.",
  },
];

/** Full application onboarding — spans POS + management panel. */
export const ONBOARDING_STEPS: TourStep[] = [
  {
    id: "welcome",
    route: "/pos",
    title: "به برنامه خوش آمدید 👋",
    description:
      "در چند قدم کوتاه با مهم‌ترین بخش‌های برنامه آشنا می‌شوید: ثبت سفارش در صندوق و سپس مدیریت فروشگاه. هر وقت خواستید می‌توانید آموزش را ببندید و بعداً از دکمه راهنما دوباره اجرا کنید.",
  },
  ...REGISTER_STEPS,
  {
    id: "admin-nav",
    route: "/admin",
    element: '[data-tour="admin-nav"]',
    title: "ناوبری پنل مدیریت",
    description:
      "از این منو به داشبورد، منو و رسپی، تخفیف‌ها، انبار، گزارش‌ها و بقیه بخش‌های مدیریتی می‌روید.",
    side: "bottom",
  },
  {
    id: "dashboard",
    route: "/admin",
    element: '[data-tour="dashboard"]',
    title: "داشبورد",
    description:
      "نمای کلی وضعیت فروشگاه: سفارش‌های در جریان، کالاهای رو به اتمام و وضعیت شیفت را یک‌جا می‌بینید و از دسترسی سریع وارد هر بخش می‌شوید.",
  },
  {
    id: "menu",
    route: "/admin/menu",
    element: '[data-tour="menu-page"]',
    title: "منو و رسپی",
    description:
      "محصولات، افزودنی‌ها و مواد اولیه هر دستور (BOM) را این‌جا مدیریت می‌کنید؛ با ثبت سفارش، موجودی انبار خودکار کم می‌شود.",
  },
  {
    id: "settings",
    route: "/admin/settings",
    element: '[data-tour="settings-page"]',
    title: "تنظیمات فروشگاه",
    description:
      "نام فروشگاه، رنگ برند، نرخ مالیات و چاپگر حرارتی را این‌جا پیکربندی کنید؛ تغییرات در صندوق و نمایشگرها هم اعمال می‌شود.",
  },
  {
    id: "version",
    route: "/admin/version",
    element: '[data-tour="version-page"]',
    title: "تاریخچه نسخه‌ها",
    description:
      "نسخه فعلی برنامه و تغییرات هر انتشار را این‌جا ببینید. این صفحه همیشه از پیوند «نسخه برنامه» در نوار کناری در دسترس است.",
  },
  {
    id: "help-trigger",
    route: "/admin/version",
    element: '[data-tour="tour-trigger"]',
    title: "دکمه راهنما",
    description:
      "هر زمان خواستید این آموزش را دوباره ببینید یا نسخه جدیدی منتشر شد، از دکمه راهنما در بالای صفحه استفاده کنید.",
    side: "bottom",
  },
  {
    id: "done",
    route: "/admin/version",
    title: "آشنایی کامل شد 🎉",
    description:
      "با مهم‌ترین بخش‌های برنامه آشنا شدید. می‌توانید هر وقت خواستید از دکمه راهنما این آموزش را دوباره اجرا کنید.",
  },
];

export const tourRegistry: Record<string, TourDefinition> = {
  onboarding: {
    id: "onboarding",
    version: "1",
    steps: ONBOARDING_STEPS,
  },
  register: {
    id: "register",
    version: "1",
    steps: [
      {
        id: "register-welcome",
        route: "/pos",
        title: "ثبت سفارش در صندوق 👋",
        description:
          "در چند قدم با نحوه ثبت سفارش و تسویه در صندوق آشنا می‌شوید؛ این آموزش را هر وقت نیاز داشتید از دکمه راهنما اجرا کنید.",
      },
      ...REGISTER_STEPS,
      {
        id: "register-done",
        route: "/pos",
        title: "آماده‌اید! 🎉",
        description:
          "حالا می‌توانید اولین سفارش را ثبت کنید. برای دیدن بخش‌های مدیریتی، آموزش کامل برنامه را از همین دکمه راهنما اجرا کنید.",
      },
    ],
  },
} as const satisfies Record<string, TourDefinition>;
