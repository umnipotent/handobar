import { useEffect, useState } from "react";
import { USAGE_COPY } from "./copy";
import { formatClock, formatReset } from "./format";
import type { ProviderCriticalStatus } from "./types";
import "./StatusBar.css";

// 최상단 상태 표시줄: 왼쪽 끝에 1초마다 갱신되는 시계, 오른쪽 끝에 가능 사용량 20% 이하
// provider의 갱신 남은 시간(마감)을 표시한다. 마감은 우선순위가 가장 높은
// 윈도우(windows[0]; 주간 > 5시간)를 따르며, 혼란을 피하려 윈도우 명칭은 표기하지 않는다.
export function StatusBar({ statuses }: { statuses: readonly ProviderCriticalStatus[] }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const criticals = statuses.filter((status) => status.windows.length > 0);

  return (
    <div className="status-bar" role="status" aria-label={USAGE_COPY.statusBar.ariaLabel}>
      <time className="status-clock" aria-label={USAGE_COPY.statusBar.clockLabel}>
        {formatClock(now)}
      </time>
      <div className="status-criticals" aria-label={USAGE_COPY.statusBar.criticalsLabel}>
        {criticals.length === 0 ? (
          <span className="status-empty">{USAGE_COPY.statusBar.empty}</span>
        ) : (
          criticals.map((status) => {
            const window = status.windows[0];
            const reset = formatReset(window.resetsAt) || USAGE_COPY.statusBar.unknownReset;
            return (
              <span key={status.providerId} className="status-critical-item">
                {USAGE_COPY.statusBar.item(status.providerTitle, reset)}
              </span>
            );
          })
        )}
      </div>
    </div>
  );
}
