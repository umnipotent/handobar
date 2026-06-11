import { useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { USAGE_COPY } from "./copy";
import { formatClock, formatReset } from "./format";
import type { ProviderCriticalStatus } from "./types";
import "./StatusBar.css";

function RefreshIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

// 최상단 상태 표시줄: 왼쪽 끝에 1초마다 갱신되는 시계(아래에 일괄 새로고침 버튼),
// 오른쪽 끝에 가능 사용량 20% 이하 provider의 갱신 남은 시간(마감)을 표시한다.
// 마감은 우선순위가 가장 높은 윈도우(windows[0]; 주간 > 5시간)를 따르며,
// 혼란을 피하려 윈도우 명칭은 표기하지 않는다.
export function StatusBar({ statuses }: { statuses: readonly ProviderCriticalStatus[] }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // 트레이 새로고침과 동일한 이벤트를 발행해 모든 패널을 한 번에 갱신(쿨다운은 각 패널이 존중).
  const handleRefreshAll = () => {
    void emit("usage-refresh-requested");
  };

  const criticals = statuses.filter((status) => status.windows.length > 0);

  return (
    <div className="status-bar" role="status" aria-label={USAGE_COPY.statusBar.ariaLabel}>
      <div className="status-left">
        <time className="status-clock" aria-label={USAGE_COPY.statusBar.clockLabel}>
          {formatClock(now)}
        </time>
        <button
          type="button"
          className="status-refresh-btn"
          onClick={handleRefreshAll}
          aria-label={USAGE_COPY.statusBar.refreshAll}
        >
          <RefreshIcon />
          {USAGE_COPY.statusBar.refreshAll}
        </button>
      </div>
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
