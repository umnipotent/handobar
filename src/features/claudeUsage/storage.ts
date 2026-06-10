import { DEFAULT_INTERVAL, INTERVAL_KEY, MAX_INTERVAL, MIN_INTERVAL } from "./config";

export function clampIntervalMin(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_INTERVAL;
  return Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, Math.round(value)));
}

export function loadIntervalMin(): number {
  const stored = localStorage.getItem(INTERVAL_KEY);
  if (stored === null) return DEFAULT_INTERVAL;
  return clampIntervalMin(Number(stored));
}

export function saveIntervalMin(value: number): void {
  localStorage.setItem(INTERVAL_KEY, String(clampIntervalMin(value)));
}
