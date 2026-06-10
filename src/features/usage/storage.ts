import { DEFAULT_INTERVAL, MAX_INTERVAL, MIN_INTERVAL } from "./config";

export function clampIntervalMin(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_INTERVAL;
  return Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, Math.round(value)));
}

// interval 저장 키는 provider별로 다르므로 인자로 받는다.
export function loadIntervalMin(key: string): number {
  const stored = localStorage.getItem(key);
  if (stored === null) return DEFAULT_INTERVAL;
  return clampIntervalMin(Number(stored));
}

export function saveIntervalMin(key: string, value: number): void {
  localStorage.setItem(key, String(clampIntervalMin(value)));
}
