import { toJalaali } from "jalaali-js";

const pad = (n: number) => n.toString().padStart(2, "0");

export function toShamsiParts(date = new Date()) {
  const { jy, jm, jd } = toJalaali(date);
  return { jy, jm, jd, h: date.getHours(), m: date.getMinutes(), s: date.getSeconds() };
}

export function toShamsiDate(date = new Date()) {
  const { jy, jm, jd } = toShamsiParts(date);
  return `${jy}/${pad(jm)}/${pad(jd)}`;
}

export function toShamsiDateTime(date = new Date()) {
  const p = toShamsiParts(date);
  return `${p.jy}/${pad(p.jm)}/${pad(p.jd)} ${pad(p.h)}:${pad(p.m)}:${pad(p.s)}`;
}

export function toShamsiClock(date = new Date()) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function weekdayFa(date = new Date()) {
  return new Intl.DateTimeFormat("fa-IR", { weekday: "long" }).format(date);
}

export function daysAgoUtc(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}
