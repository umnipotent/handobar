import { DEFAULT_INTERVAL, MAX_INTERVAL, MIN_INTERVAL } from "./config";

const PANEL_ORDER_STORAGE_KEY = "handobar.usage.panelOrder";

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

export function loadPanelOrder<T extends string>(defaultOrder: readonly T[]): T[] {
  const stored = localStorage.getItem(PANEL_ORDER_STORAGE_KEY);
  if (stored === null) return [...defaultOrder];

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [...defaultOrder];

    const knownIds = new Set(defaultOrder);
    const ordered = parsed.filter((id): id is T => typeof id === "string" && knownIds.has(id as T));
    const missing = defaultOrder.filter((id) => !ordered.includes(id));

    return [...ordered, ...missing];
  } catch {
    return [...defaultOrder];
  }
}

export function savePanelOrder(order: readonly string[]): void {
  localStorage.setItem(PANEL_ORDER_STORAGE_KEY, JSON.stringify(order));
}
