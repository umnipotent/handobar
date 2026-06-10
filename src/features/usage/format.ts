import { USAGE_COPY } from "./copy";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function formatReset(iso: string): string {
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return "";

  const diffMs = target - Date.now();
  if (diffMs <= 0) return USAGE_COPY.reset.soon;

  const mins = Math.floor(diffMs / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;

  if (h >= 24) return USAGE_COPY.reset.daysHours(Math.floor(h / 24), h % 24);
  return h > 0 ? USAGE_COPY.reset.hoursMinutes(h, m) : USAGE_COPY.reset.minutes(m);
}

export function formatClock(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function formatKstIsoWithoutTimezone(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  return kst.toISOString().slice(0, 19);
}

export function formatResetExactTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return USAGE_COPY.reset.exactTime(formatKstIsoWithoutTimezone(iso));
}
