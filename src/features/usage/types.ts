// provider 비종속 사용량 도메인 타입. 백엔드 UsageSnapshot 직렬화 형태와 1:1.
export interface UsageWindow {
  remaining: number;
  used: number;
  resets_at: string;
}

export interface Usage {
  five_hour: UsageWindow | null;
  seven_day: UsageWindow | null;
  subscription: string | null;
  model: string | null;
  fetched_at: string;
  retry_after_secs?: number;
}

