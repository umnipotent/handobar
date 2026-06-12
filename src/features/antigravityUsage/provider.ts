import { createTauriUsageGateway } from "../usage/gateway";
import type { UsageProvider } from "../usage/UsagePanel";
import { USAGE_COPY } from "../usage/copy";

// Antigravity provider: 백엔드 get_antigravity_usage 커맨드(로컬 cockpit quota 캐시).
export const ANTIGRAVITY_USAGE_PROVIDER: UsageProvider = {
  id: "antigravity",
  title: "Antigravity",
  // Google Antigravity 아이콘의 단색 실루엣을 currentColor로 합성한다.
  glyph: {
    d: "M20.197 20.618C21.318 21.459 23.000 20.898 21.459 19.357C16.834 14.873 17.815 2.541 12.070 2.541C6.325 2.541 7.306 14.873 2.682 19.357C1.000 21.038 2.822 21.459 3.943 20.618C8.287 17.675 8.006 12.490 12.070 12.490C16.134 12.490 15.853 17.675 20.197 20.618Z",
  },
  gateway: createTauriUsageGateway("get_antigravity_usage"),
  storageKey: "handobar.antigravity.intervalMin",
  webUrl: "https://antigravity.google/",
  showSevenDayCard: true,
  showModelBadges: false,
  fiveHourChips: (usage) => usage?.five_hour_chips,
  sevenDayChips: (usage) => usage?.seven_day_chips,
  fiveHourTitle: (usage) => {
    const isGemini = usage?.model?.toLowerCase().includes("gemini") ?? true;
    return isGemini ? USAGE_COPY.windows.antigravity.geminiTitle : USAGE_COPY.windows.antigravity.nonGeminiTitle;
  },
  fiveHourHint: (usage) => {
    const isGemini = usage?.model?.toLowerCase().includes("gemini") ?? true;
    return isGemini ? USAGE_COPY.windows.antigravity.geminiHint : USAGE_COPY.windows.antigravity.nonGeminiHint;
  },
  sevenDayTitle: (usage) => {
    const isGemini = usage?.model?.toLowerCase().includes("gemini") ?? true;
    return isGemini ? USAGE_COPY.windows.antigravity.nonGeminiTitle : USAGE_COPY.windows.antigravity.geminiTitle;
  },
  sevenDayHint: (usage) => {
    const isGemini = usage?.model?.toLowerCase().includes("gemini") ?? true;
    return isGemini ? USAGE_COPY.windows.antigravity.nonGeminiHint : USAGE_COPY.windows.antigravity.geminiHint;
  },
  nullWindowMeaning: "unknown",
};
