// 폴링/쿨다운 상수 (provider 공통). interval 저장 키는 provider별로 다르므로 여기 두지 않는다.
export const MIN_INTERVAL = 1;
export const MAX_INTERVAL = 10;
export const DEFAULT_INTERVAL = 5;
export const RETRY_BUFFER_SECS = 2;
export const RETRY_FALLBACK_SECS = 60;
export const MANUAL_REFRESH_UNLOCK_SECS = 5;
export const MANUAL_REFRESH_SKELETON_MIN_MS = 2000;

// 사용량 주의/경고 임계값 퍼센트 (%)
export const THRESHOLD_WARNING = 60;  // 60% 이하: 약간의 워닝 모드 (주의)
export const THRESHOLD_DANGER = 40;   // 40% 이하: 위험 모드 (fast mode 비활성화 추천)
export const THRESHOLD_CRITICAL = 20; // 20% 이하: 위급 모드 (복잡한 작업 지양 및 세션 동기화 권고)

