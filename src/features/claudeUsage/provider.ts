import { createTauriUsageGateway } from "../usage/gateway";
import type { UsageProvider } from "../usage/UsagePanel";

// Claude Code provider: 백엔드 get_claude_usage 커맨드(키체인 → OAuth 사용량 엔드포인트).
export const CLAUDE_USAGE_PROVIDER: UsageProvider = {
  title: "Claude Code",
  gateway: createTauriUsageGateway("get_claude_usage"),
  storageKey: "handobar.claude.intervalMin",
};
