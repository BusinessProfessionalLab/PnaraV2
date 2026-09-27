// Get site URL from environment variable, use default value if not set.
// Note: set the real PUBLIC_SITE_URL in .env before deploying so the canonical
// URL, sitemap and Open Graph tags point at the production domain.
const SITE_URL = import.meta.env.PUBLIC_SITE_URL || 'https://pnara.ir';

export const siteConfig = {
	/** Persian brand name — used in the UI, footer and headings. */
	title: 'پینارا',
	/** Latin wordmark, exactly as the product itself renders it. */
	latinTitle: 'Pnara',
	author: 'پینارا',
	url: SITE_URL,
	mail: 'hello@pnara.ir',

	utm: {
		source: `${SITE_URL}`,
		medium: 'referral',
		campaign: 'navigation',
	},

	meta: {
		title: 'پینارا — صندوق لمسی، انبار و گزارش فروش کافه و رستوران',
		description:
			'صندوق لمسی کافه و رستوران: ثبت سفارش، کسر خودکار مواد اولیه بر اساس رسپی، بلیت بار و آشپزخانه، انبار با فاکتور خرید و ضایعات، باشگاه مشتریان و گزارش سود. مبالغ به تومان و تاریخ‌ها شمسی.',
		keywords:
			'صندوق کافه, صندوق فروش رستوران, نرم‌افزار مدیریت کافه, انبار کافه, رسپی و BOM, کارتخوان PC-POS, پرینتر حرارتی, گزارش فروش و سود کافه, صندوق لمسی, نمایشگر آشپزخانه',
		image: `${SITE_URL}/og.png`,
		twitterHandle: '',
	},

	/**
	 * Facts that are true of the shipped product (verifiable in the repository),
	 * kept in one place so page copy never drifts from the implementation.
	 */
	product: {
		version: '۱.۴.۰',
		versionLatin: '1.4.0',
		runtime: '.NET 8',
		database: 'SQL Server',
	},
};
