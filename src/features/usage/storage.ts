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

// 카드 접기 상태 (주간 등). key는 provider + 카드 식별자로 구성.
export function loadCollapsed(key: string, defaultValue = false): boolean {
  const stored = localStorage.getItem(key);
  if (stored === null) return defaultValue;
  return stored === "1";
}

export function saveCollapsed(key: string, collapsed: boolean): void {
  localStorage.setItem(key, collapsed ? "1" : "0");
}

// 자유 메모 텍스트 (provider별). key는 provider 저장 키 기반으로 구성.
export function loadMemo(key: string): string {
  return localStorage.getItem(key) ?? "";
}

export function saveMemo(key: string, value: string): void {
  localStorage.setItem(key, value);
}

// 트레이 표시 토글 저장 키 (provider별).
export const showInTrayKey = (providerId: string) => `handobar.${providerId}.showInTray`;

// 범용 boolean 저장 (트레이 토글 등).
export function loadBool(key: string, defaultValue = false): boolean {
  const stored = localStorage.getItem(key);
  if (stored === null) return defaultValue;
  return stored === "1";
}

export function saveBool(key: string, value: boolean): void {
  localStorage.setItem(key, value ? "1" : "0");
}
