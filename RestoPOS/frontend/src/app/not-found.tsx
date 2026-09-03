import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-secondary p-6">
      <div className="text-center">
        <h1 className="text-6xl font-black text-primary">۴۰۴</h1>
        <p className="mt-2 text-lg text-muted-foreground">صفحه مورد نظر یافت نشد</p>
        <Link
          href="/pos"
          className="mt-4 inline-block rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:opacity-90"
        >
          بازگشت به صندوق
        </Link>
      </div>
    </div>
  );
}
