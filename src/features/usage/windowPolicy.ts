import type { UsageWindow } from "./types";

/// usage 응답은 왔는데 특정 윈도우가 null일 때 provider가 부여하는 의미.
/// - "fresh": 활성 윈도우 없음 = 미사용 → 잔여 100% (Claude: 사용 기록 없는 구간)
/// - "exhausted": 완전 고갈 → 잔여 0% (Codex: rollout이 null 윈도우를 고갈로 기록)
/// - "unknown": 판단 불가 → 빈 카드 유지
export type NullWindowMeaning = "fresh" | "exhausted" | "unknown";

export function resolveWindow(
  window: UsageWindow | null | undefined,
  hasUsage: boolean,
  nullWindowMeaning: NullWindowMeaning,
): UsageWindow | null {
  if (window != null) return window;
  // usage 자체가 없으면(로딩 전) null 그대로 유지
  if (!hasUsage) return null;
  switch (nullWindowMeaning) {
    case "fresh":
      // 새 윈도우 시작 시각은 알 수 없으므로 resets_at은 비운다 (reset_if_elapsed와 동일 규칙).
      return { remaining: 100, used: 0, resets_at: "" };
    case "exhausted":
      return { remaining: 0, used: 100, resets_at: "" };
    default:
      return null;
  }
}