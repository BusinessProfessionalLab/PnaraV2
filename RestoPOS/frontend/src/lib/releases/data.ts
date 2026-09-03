import type { ReleaseNote } from "./types";

/**
 * Static release notes — newest first.
 *
 * This array mirrors real, shipped product capabilities (see the change
 * descriptions). It is intentionally a placeholder that the data-source
 * seam (`fetchReleaseNotes` in `./index.ts`) can later swap for an API
 * response without touching any UI code.
 */
export const releases: ReleaseNote[] = [
  {
    version: "1.4.0",
    date: "2026-09-04",
    title: "تجربه صندوق، بازطراحی شد",
    description:
      "کارت‌های محصولات در صندوق لمسی یکدست و خواناتر شدند و مسیر دیدن تغییرات برنامه باز شد.",
    changes: [
      {
        type: "feature",
        title: "صفحه تاریخچه نسخه‌ها",
        description:
          "از نوار کناری پنل مدیریت، تغییرات هر نسخه را با جزئیات دنبال کنید.",
      },
      {
        type: "improvement",
        title: "کارت‌های محصولات بازطراحی شد",
        description:
          "تصویر محصولات به‌صورت مربعی و کامل نمایش داده می‌شود و چیدمان عنوان و قیمت خواناتر شد.",
      },
      {
        type: "bugfix",
        title: "اصلاح برش تصویر در کارت‌های منو",
        description:
          "تصویر دیگر در چیدمان‌های مختلف بریده نمی‌شود و در همه عرض‌ها یکدست دیده می‌شود.",
      },
      {
        type: "performance",
        title: "بارگذاری سبک‌تر تصاویر منو",
        description:
          "تصاویر به‌صورت تنبل (lazy) بارگذاری می‌شوند تا جابه‌جایی در فهرست سریع‌تر شود.",
      },
    ],
  },
  {
    version: "1.3.0",
    date: "2026-08-10",
    title: "جستجو و سفارش‌های ناتمام",
    changes: [
      {
        type: "feature",
        title: "جستجو با کد مواد اولیه",
        description:
          "جستجوی منو علاوه بر عنوان و دسته، کد (SKU) و نام مواد اولیه را هم پوشش می‌دهد.",
      },
      {
        type: "feature",
        title: "پیش‌نویس و سفارش‌های در انتظار پرداخت",
        description:
          "فاکتور نیمه‌کاره را ذخیره کنید و بعداً از سر بگیرید؛ ردیف سفارش‌های در انتظار پرداخت همیشه در دسترس است.",
      },
      {
        type: "improvement",
        title: "صندوق برای لمس بهینه شد",
        description:
          "دکمه‌ها و اهداف لمسی بزرگ‌تر شدند و جابه‌جایی بین فهرست و صورت‌حساب روان‌تر است.",
      },
      {
        type: "bugfix",
        title: "اصلاح شمارنده تعداد در سبد",
        description: "کاهش و افزایش تعداد اقلام در حالت‌های مختلف سفارش اصلاح شد.",
      },
    ],
  },
  {
    version: "1.2.0",
    date: "2026-07-15",
    title: "نمایشگرها و ظاهر برند",
    changes: [
      {
        type: "feature",
        title: "تفکیک نمایشگر بار و آشپزخانه",
        description:
          "دستورها بر اساس ایستگاه کار (بار یا آشپزخانه) در نمایشگرهای جداگانه دیده می‌شوند.",
      },
      {
        type: "feature",
        title: "رنگ برند قابل تنظیم",
        description:
          "از تنظیمات می‌توانید رنگ اصلی را انتخاب کنید تا در صندوق، نمایشگرها و پنل مدیریت اعمال شود.",
      },
      {
        type: "improvement",
        title: "تم تیره",
        description: "تم تیره در سراسر برنامه — از صندوق تا پنل مدیریت — اعمال می‌شود.",
      },
    ],
  },
  {
    version: "1.1.0",
    date: "2026-06-18",
    title: "منو، رسپی و باشگاه مشتریان",
    changes: [
      {
        type: "feature",
        title: "ساختار رسپی (BOM)",
        description:
          "برای هر آیتم منو مواد اولیه و مقدار مصرف تعریف کنید تا موجودی انبار به‌صورت خودکار کسر شود.",
      },
      {
        type: "feature",
        title: "باشگاه مشتریان و امتیاز وفاداری",
        description:
          "سوابق مشتریان را نگه دارید و بر اساس خرید، امتیاز تخصیص دهید.",
      },
      {
        type: "feature",
        title: "تخفیف روی دسته‌ها و آیتم‌ها",
        description: "تخفیف درصدی روی دسته یا آیتم منو تعریف کنید تا در صندوق اعمال شود.",
      },
      {
        type: "security",
        title: "نشست امن و مدیریت پرسنل",
        description:
          "ورود با نشست معتبر و تعریف پرسنل با نقش‌های مشخص برای استفاده از صندوق و پنل.",
      },
    ],
  },
];
