export interface UsageWindow {
  remaining: number;
  used: number;
  resets_at: string;
}

export interface ClaudeUsage {
  five_hour: UsageWindow | null;
  seven_day: UsageWindow | null;
  subscription: string | null;
  fetched_at: string;
  retry_after_secs?: number;
}
