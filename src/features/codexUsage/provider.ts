import { createTauriUsageGateway } from "../usage/gateway";
import type { UsageProvider } from "../usage/UsagePanel";

// Codex provider: 백엔드 get_codex_usage 커맨드(~/.codex 세션 rollout의 rate_limits 스냅샷).
export const CODEX_USAGE_PROVIDER: UsageProvider = {
  id: "codex",
  title: "Codex",
  gateway: createTauriUsageGateway("get_codex_usage"),
  storageKey: "handobar.codex.intervalMin",
  cliCmd: "codex",
  webUrl: "https://platform.openai.com",
};

