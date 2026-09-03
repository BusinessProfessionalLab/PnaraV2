import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const vazir = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazir",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ToastIran POS — Pnara",
  description: "صندوق فروشگاهی و انبار رستوران و کافه برای بازار ایران",
};

/**
 * Applies the persisted theme before first paint (runs synchronously at the
 * top of <body>, before the app renders below it).
 */
const themeBoot = `try{var s=JSON.parse(localStorage.getItem("toastiran-ui")||"null");if(s&&s.state&&s.state.theme==="dark"){document.documentElement.classList.add("dark");}}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="fa"
      dir="rtl"
      /* The themeBoot script above adds a `dark` class to this element before
         React hydrates (it reads localStorage, which the server can't see), so
         tell React not to diff attributes here — same approach next-themes
         uses to avoid hydration warnings for the theme class. */
      suppressHydrationWarning
    >
      <body className={`${vazir.className} font-sans antialiased`}>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
