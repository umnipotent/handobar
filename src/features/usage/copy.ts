// provider 공통 화면 문구(한국어). provider별로 다른 것은 제목뿐이라 제목은 패널 prop으로 받는다.
export const USAGE_COPY = {
  lastRefreshLabel: "마지막 갱신",
  statusBar: {
    ariaLabel: "상태 표시줄",
    clockLabel: "현재 시각",
    criticalsLabel: "갱신 임박 한도",
    refreshAll: "일괄 새로고침",
    empty: "여유 있음",
    unknownReset: "리셋 시각 미상",
    // '5시간' 같은 윈도우 명칭은 혼란을 주므로 표시하지 않고 마감(리셋)만 보여준다.
    item: (providerTitle: string, reset: string) => `${providerTitle} · ${reset}`,
  },
  cooldownMessage: (seconds: number) =>
    `요청 제한 중 · ${seconds}초 후 자동 재시도`,
  dismissCooldownLabel: "요청 제한 메시지 닫기",
  staleDataMessage: "API에 일시적으로 접근할 수 없어 이전 데이터를 표시합니다",
  warnings: {
    warning: "슬슬 토큰을 절약하는 세팅으로 바꾸셔야 합니다",
    danger: "언제 작업이 멈춰도 이상하지 않습니다.",
  },

  dismiss: {
    error: "에러 메시지 닫기",
    warning: "경고 닫기",
    exhausted: "메시지 닫기",
  },
  meta: {
    directView: "사용량 웹에서 보기",
  },

  memo: {
    title: "메모",
    placeholder: "여기에 간단한 메모를 남겨보세요 (마크다운 지원)",
    expand: "메모 펼치기",
    collapse: "메모 접기",
    edit: "수정",
    save: "저장",
    cancel: "취소",
    viewRendered: "마크다운 보기",
    viewSource: "원본 보기",
    emptyView: "작성된 메모가 없습니다",
  },
  windows: {
    fiveHour: {
      title: "최근 5시간",
      hint: "5h 한도",
    },
    sevenDay: {
      title: "주간",
      hint: "7일 한도",
    },
  },
  usage: {
    emptyValue: "—",
    exhausted: {
      emoji: "💀",
      message: "토큰이 HP라면 당신은 죽었습니다",
    },
  },
  reset: {
    soon: "곧 리셋",
    minutes: (minutes: number) => `${minutes}분 후 리셋`,
    hoursMinutes: (hours: number, minutes: number) =>
      `${hours}시간 ${minutes}분 후 리셋`,
    daysHours: (days: number, hours: number) =>
      `${days}일 ${hours}시간 후 리셋`,
    exactTime: (time: string) => `리셋 시각 ${time}`,
  },
  controls: {
    intervalLabel: "갱신 주기",
    minuteOption: (minutes: number) => `${minutes}분`,
    loadingButton: "불러오는 중…",
    refreshButton: "새로고침",
    forceRefreshButton: "강제 새로고침",
    cooldownButton: (seconds: number) => `${seconds}초`,
  },
} as const;
