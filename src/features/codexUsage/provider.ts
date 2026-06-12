import { createTauriUsageGateway } from "../usage/gateway";
import type { UsageProvider } from "../usage/UsagePanel";

// Codex provider: 백엔드 get_codex_usage 커맨드(~/.codex 세션 rollout의 rate_limits 스냅샷).
export const CODEX_USAGE_PROVIDER: UsageProvider = {
  id: "codex",
  title: "Codex",
  gateway: createTauriUsageGateway("get_codex_usage"),
  storageKey: "handobar.codex.intervalMin",
  webUrl: "https://chatgpt.com/codex/cloud/settings/analytics",
  // rollout이 윈도우를 null로 기록하면 완전 고갈 → 잔여 0%로 표시
  nullWindowMeaning: "exhausted",
};



