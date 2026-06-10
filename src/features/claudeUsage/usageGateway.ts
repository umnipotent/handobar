import { invoke } from "@tauri-apps/api/core";
import type { ClaudeUsage } from "./types";

export interface UsageGateway {
  fetchClaudeUsage(): Promise<ClaudeUsage>;
}

export const tauriUsageGateway: UsageGateway = {
  fetchClaudeUsage() {
    return invoke<ClaudeUsage>("get_claude_usage");
  },
};
