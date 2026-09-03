"use client";

import * as Popover from "@radix-ui/react-popover";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { jalaaliMonthLength, toGregorian, toJalaali } from "jalaali-js";
import { cn } from "@/lib/cn";

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const faNum = (value: string | number) =>
  String(value).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);

const MONTHS_FA = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

/** ش = Saturday … ج = Friday (Iranian weeks start on Saturday). */
const WEEKDAYS_FA = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

const pad = (n: number) => n.toString().padStart(2, "0");

type Jd = { jy: number; jm: number; jd: number };

/** Jalali parts of the LOCAL calendar date of an ISO timestamp. */
function jdOf(iso: string): Jd {
  const d = new Date(iso);
  const { jy, jm, jd } = toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return { jy, jm, jd };
}

/** Local-noon ISO identifier for a Jalali date (noon is timezone-safe for
 *  day-level comparisons; callers turn it into day start/end as needed). */
function noonIsoOf(jy: number, jm: number, jd: number): string {
  const { gy, gm, gd } = toGregorian(jy, jm, jd);
  return new Date(gy, gm - 1, gd, 12, 0, 0, 0).toISOString();
}

/** Epoch ms at local noon of the LOCAL date carried by an ISO timestamp. */
function localNoonMs(iso: string): number {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime();
}

function formatJalali({ jy, jm, jd }: Jd) {
  return `${jy}/${pad(jm)}/${pad(jd)}`;
}

/**
 * Persian (Jalali) date picker.
 *
 * A read-only field that opens a Shamsi calendar popover (month grid starts
 * on شنبه, Persian digits, easy month navigation, "امروز" jump). Days outside
 * [minIso, maxIso] (compared by local date) are disabled, which makes it
 * trivial to build a از/تا range: pass the from-value as `minIso` on the to
 * picker and vice versa.
 *
 * `value` is any ISO string (time is ignored — only its local date matters).
 * `onChange` fires with the chosen day at LOCAL NOON as an ISO string; the
 * caller decides the final instant (e.g. day start for "از", day end for
 * "تا") so the backend contract stays unchanged.
 */
export function JalaliDatePicker({
  value,
  onChange,
  minIso,
  maxIso,
  className,
  placeholder = "انتخاب تاریخ",
}: {
  value?: string | null;
  onChange: (noonIso: string) => void;
  /** Earliest selectable date (ISO). */
  minIso?: string;
  /** Latest selectable date (ISO). */
  maxIso?: string;
  className?: string;
  placeholder?: string;
}) {
  const selected = value ? jdOf(value) : null;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<{ jy: number; jm: number }>(() =>
    selected ? { jy: selected.jy, jm: selected.jm } : jdOf(new Date().toISOString()),
  );

  const minNoon = minIso ? localNoonMs(minIso) : undefined;
  const maxNoon = maxIso ? localNoonMs(maxIso) : undefined;

  const today = useMemo(() => jdOf(new Date().toISOString()), []);

  /** Day cells — nulls pad the leading/trailing weeks. */
  const cells = useMemo(() => {
    const first = toGregorian(view.jy, view.jm, 1);
    const firstDate = new Date(first.gy, first.gm - 1, 1, 12);
    const offset = (firstDate.getDay() + 1) % 7; // Saturday-first index
    const length = jalaaliMonthLength(view.jy, view.jm);
    const days: Array<number | null> = Array.from({ length: offset }, () => null);
    for (let d = 1; d <= length; d += 1) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [view]);

  const shiftMonth = (delta: number) => {
    setView((v) => {
      let jy = v.jy;
      let jm = v.jm + delta;
      if (jm < 1) {
        jm = 12;
        jy -= 1;
      } else if (jm > 12) {
        jm = 1;
        jy += 1;
      }
      return { jy, jm };
    });
  };

  const pick = (jd: number) => {
    onChange(noonIsoOf(view.jy, view.jm, jd));
    setOpen(false);
  };

  const isSelected = (jd: number) =>
    !!selected &&
    selected.jy === view.jy &&
    selected.jm === view.jm &&
    selected.jd === jd;

  const isDisabled = (jd: number) => {
    const ms = localNoonMs(noonIsoOf(view.jy, view.jm, jd));
    if (minNoon !== undefined && ms < minNoon) return true;
    if (maxNoon !== undefined && ms > maxNoon) return true;
    return false;
  };

  const todayEnabled =
    (minNoon === undefined || localNoonMs(noonIsoOf(today.jy, today.jm, today.jd)) >= minNoon) &&
    (maxNoon === undefined || localNoonMs(noonIsoOf(today.jy, today.jm, today.jd)) <= maxNoon);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        if (o && selected) setView({ jy: selected.jy, jm: selected.jm });
        setOpen(o);
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={value ? `انتخاب تاریخ — ${faNum(formatJalali(selected!))}` : placeholder}
          className={cn(
            "flex h-11 w-full items-center gap-2.5 rounded-xl border border-input bg-card px-3 text-start outline-none transition-colors duration-150 hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring/50",
            className,
          )}
        >
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-sm font-semibold tabular-nums",
              selected ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {selected ? faNum(formatJalali(selected)) : placeholder}
          </span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          dir="rtl"
          className="animate-scale-in z-50 w-[19.5rem] rounded-2xl border border-border bg-popover p-3 shadow-xl outline-none"
        >
          {/* Month navigation */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="ماه قبل"
              onClick={() => shiftMonth(-1)}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
            <div className="text-sm font-bold tracking-tight">
              {MONTHS_FA[view.jm - 1]}{" "}
              <span className="tabular-nums text-muted-foreground">
                {faNum(view.jy)}
              </span>
            </div>
            <button
              type="button"
              aria-label="ماه بعد"
              onClick={() => shiftMonth(1)}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7">
            {WEEKDAYS_FA.map((w, i) => (
              <div
                key={`${w}-${i}`}
                className={cn(
                  "flex h-8 items-center justify-center text-[11px] font-semibold",
                  i < 5 ? "text-muted-foreground" : "text-danger/80",
                )}
              >
                {w}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7">
            {cells.map((jd, i) =>
              jd === null ? (
                <div key={`pad-${i}`} />
              ) : (
                <button
                  key={jd}
                  type="button"
                  disabled={isDisabled(jd)}
                  onClick={() => pick(jd)}
                  aria-label={`${faNum(jd)} ${MONTHS_FA[view.jm - 1]}`}
                  aria-pressed={isSelected(jd)}
                  className={cn(
                    "flex h-9 items-center justify-center rounded-lg text-[13px] font-medium tabular-nums outline-none transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-ring/50",
                    isSelected(jd)
                      ? "bg-primary-fill font-bold text-primary-foreground"
                      : jd === today.jd && view.jy === today.jy && view.jm === today.jm
                        ? "text-primary ring-1 ring-inset ring-primary/40 hover:bg-primary-soft"
                        : "text-foreground hover:bg-muted",
                    isDisabled(jd) &&
                      "cursor-not-allowed opacity-30 hover:bg-transparent",
                  )}
                >
                  {faNum(jd)}
                </button>
              ),
            )}
          </div>

          {/* Today */}
          <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2">
            <button
              type="button"
              disabled={!todayEnabled}
              onClick={() => {
                onChange(noonIsoOf(today.jy, today.jm, today.jd));
                setOpen(false);
              }}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-primary outline-none transition-colors hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              امروز — {faNum(formatJalali(today))}
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
