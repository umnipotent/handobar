// provider 비종속 사용량 도메인 타입. 백엔드 UsageSnapshot 직렬화 형태와 1:1.
export type WindowRole = "session" | "long" | "other";

export interface UsageWindow {
  id: string;
  role: WindowRole;
  remaining: number;
  used: number;
  resets_at: string;
  chips?: string[];
}

// 가능 사용량이 임계값(20%) 이하인 한 윈도우. 상태 표시줄이 갱신 남은 시간을 보여줄 때 사용한다.
export interface CriticalWindowStatus {
  windowTitle: string;
  remaining: number;
  resetsAt: string;
}

// 한 provider가 보고하는 임계 윈도우 목록. 비어 있으면 임계 상태가 아니다.
export interface ProviderCriticalStatus {
  providerId: string;
  providerTitle: string;
  windows: CriticalWindowStatus[];
}

export interface Usage {
  windows: UsageWindow[];
  subscription: string | null;
  model: string | null;
  model_tags?: string[];
  fetched_at: string;
  retry_after_secs?: number;
  /** API 실패 후 캐시 폴백으로 반환된 데이터. 없거나 false면 신선한 데이터. */
  is_stale?: boolean;
}
