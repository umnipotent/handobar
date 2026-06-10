import { invoke } from "@tauri-apps/api/core";
import type { ClaudeUsage } from "./types";

export interface UsageGateway {
  fetchClaudeUsage(options?: { force?: boolean }): Promise<ClaudeUsage>;
}

export const tauriUsageGateway: UsageGateway = {
  fetchClaudeUsage(options) {
    return invoke<ClaudeUsage>("get_claude_usage", { force: options?.force ?? false });
  },
};
