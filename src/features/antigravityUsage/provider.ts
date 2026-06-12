import { createTauriUsageGateway } from "../usage/gateway";
import type { UsageProvider } from "../usage/UsagePanel";

// Antigravity provider: 백엔드 get_antigravity_usage 커맨드(로컬 cockpit quota 캐시).
export const ANTIGRAVITY_USAGE_PROVIDER: UsageProvider = {
  id: "antigravity",
  title: "Antigravity",
  // Google Antigravity 아이콘의 단색 실루엣을 currentColor로 합성한다.
  glyph: {
    d: "M12 2C8 2 4.8 5.1 4.8 9v1.2c0 2.5 1 4.8 2.9 6.7 1.4 1.4 2.6 2.4 4.3 4.1.1.1.2.1.3.1s.2 0 .3-.1c1.7-1.7 2.9-2.7 4.3-4.1 1.9-1.9 2.9-4.2 2.9-6.7V9c0-3.9-3.2-7-7-7Zm0 2c2.7 0 5 2.2 5 5v1.1c0 2-.8 3.8-2.2 5.2-1 .9-1.9 1.8-2.8 2.7-.9-.9-1.8-1.8-2.8-2.7C7.8 14.9 7 13.1 7 11.1V9c0-2.8 2.3-5 5-5Z",
  },
  gateway: createTauriUsageGateway("get_antigravity_usage"),
  storageKey: "handobar.antigravity.intervalMin",
  webUrl: "https://antigravity.google/",
  showSevenDayCard: false,
  nullWindowMeaning: "unknown",
};
