// provider 공통 화면 문구(한국어). provider별로 다른 것은 제목뿐이라 제목은 패널 prop으로 받는다.
export const USAGE_COPY = {
  lastRefreshLabel: "마지막 갱신",
  cooldownMessage: (seconds: number) => `요청 제한 중 · ${seconds}초 후 자동 재시도`,
  dismissCooldownLabel: "요청 제한 메시지 닫기",
  warnings: {
    fastMode: "fast mode 비활성화를 추천합니다",
    subModel: "복잡한 작업 지시를 지양하고 세션 상황을 계속 동기화하세요",
  },

  dismiss: {
    error: "에러 메시지 닫기",
    warning: "경고 닫기",
  },
  meta: {
    cliLabel: "CLI",
    webLabel: "Web",
    clipboardCopied: "클릭하여 복사",
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
    remainingLabel: "잔여",
    emptyValue: "—",
  },
  reset: {
    soon: "곧 리셋",
    minutes: (minutes: number) => `${minutes}분 후 리셋`,
    hoursMinutes: (hours: number, minutes: number) => `${hours}시간 ${minutes}분 후 리셋`,
    daysHours: (days: number, hours: number) => `${days}일 ${hours}시간 후 리셋`,
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
