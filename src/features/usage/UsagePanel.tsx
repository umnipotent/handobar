import { openUrl } from "@tauri-apps/plugin-opener";
import { useState } from "react";
import { USAGE_COPY } from "./copy";
import { formatKstIsoWithoutTimezone } from "./format";
import type { UsageGateway } from "./gateway";
import { useUsage } from "./useUsage";
import { WindowCard } from "./WindowCard";
import { AlertBanner } from "./AlertBanner";
import type { UsageWindow } from "./types";
import { loadCollapsed, saveCollapsed } from "./storage";
import "./UsagePanel.css";

export interface UsageProvider {
  id: string;
  title: string;
  gateway: UsageGateway;
  storageKey: string;
  webUrl?: string;
}

/** usage가 있는데 윈도우가 null이면 0% 고갈로 처리한다. */
function resolveWindow(
  window: UsageWindow | null | undefined,
  hasUsage: boolean,
): UsageWindow | null {
  if (window != null) return window;
  // usage 자체가 없으면(로딩 전) null 그대로 유지
  if (!hasUsage) return null;
  // usage는 있는데 윈도우가 없으면 → 완전 고갈(0%)
  return { remaining: 0, used: 100, resets_at: "" };
}

function DragHandleIcon() {
  return (
    <svg
      width="12"
      height="14"
      viewBox="0 0 12 14"
      fill="currentColor"
      className="drag-handle-icon"
    >
      <circle cx="3" cy="3" r="1.2" />
      <circle cx="3" cy="7" r="1.2" />
      <circle cx="3" cy="11" r="1.2" />
      <circle cx="9" cy="3" r="1.2" />
      <circle cx="9" cy="7" r="1.2" />
      <circle cx="9" cy="11" r="1.2" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}


// 한 provider의 잔여 사용량 패널. provider별로 다른 것은 제목·게이트웨이·저장 키뿐이다.
export function UsagePanel({
  title,
  gateway,
  storageKey,
  webUrl,
}: UsageProvider) {
  const {
    usage,
    error,
    loading,
    intervalMin,
    setIntervalMin,
    cooldownLeft,
    cooling,
    canManualRefresh,
    shouldForceManualRefresh,
    dismissCooldown,
    showingManualRefreshSkeleton,
    refresh,
    intervalOptions,
    showingFastModeWarning,
    dismissFastModeWarning,
    showingSubModelWarning,
    dismissSubModelWarning,
    dismissError,
  } = useUsage(gateway, storageKey);

  const [sevenDayCollapsed, setSevenDayCollapsed] = useState(() =>
    loadCollapsed(`${storageKey}.sevenDay.collapsed`)
  );

  // exhausted 메시지 닫기 상태. 사용량이 0%→양수로 회복되면 자동 리셋.
  const fiveHourRemaining = usage?.five_hour?.remaining ?? (usage != null ? 0 : null);
  const sevenDayRemaining = usage?.seven_day?.remaining ?? (usage != null ? 0 : null);
  const [fiveHourExhaustedDismissed, setFiveHourExhaustedDismissed] = useState(false);
  const [sevenDayExhaustedDismissed, setSevenDayExhaustedDismissed] = useState(false);

  // 잔여가 0%를 벗어나면 dismiss 상태 초기화 (다음 번 0% 도달 시 다시 표시)
  if (fiveHourRemaining !== null && fiveHourRemaining > 0 && fiveHourExhaustedDismissed) {
    setFiveHourExhaustedDismissed(false);
  }
  if (sevenDayRemaining !== null && sevenDayRemaining > 0 && sevenDayExhaustedDismissed) {
    setSevenDayExhaustedDismissed(false);
  }

  const toggleSevenDay = (next: boolean) => {
    setSevenDayCollapsed(next);
    saveCollapsed(`${storageKey}.sevenDay.collapsed`, next);
  };

  const hasUsage = usage != null;
  const fiveHourData = resolveWindow(usage?.five_hour, hasUsage);
  const sevenDayData = resolveWindow(usage?.seven_day, hasUsage);

  const handleOpenUrl = async (url: string) => {
    try {
      await openUrl(url);
    } catch {
      window.open(url, "_blank");
    }
  };

  return (
    <section className="panel">
      <header className="top">
        <div className="header-main-row">
          <div className="header-title-area">
            <div className="drag-handle" title="드래그하여 순서 변경">
              <DragHandleIcon />
            </div>
            <h2>{title}</h2>
          </div>
        </div>
        {(usage?.model || usage?.subscription || webUrl) && (
          <div className="header-sub-row">
            {usage?.model && (
              <span className="badge model-badge">{usage.model}</span>
            )}
            {usage?.subscription && (
              <span className="badge">{usage.subscription}</span>
            )}
            {webUrl && (
              <button
                type="button"
                className="meta-link-btn"
                onClick={() => handleOpenUrl(webUrl)}
              >
                {USAGE_COPY.meta.directView}
              </button>
            )}
          </div>
        )}
      </header>

      {usage?.fetched_at && (
        <p className="last-refresh">
          {USAGE_COPY.lastRefreshLabel}{" "}
          <time dateTime={usage.fetched_at}>
            {formatKstIsoWithoutTimezone(usage.fetched_at)}
          </time>
        </p>
      )}

      {error && (
        <AlertBanner
          message={error}
          type="danger"
          onDismiss={dismissError}
          dismissLabel={USAGE_COPY.dismiss.error}
        />
      )}

      {usage?.is_stale && !error && (
        <AlertBanner message={USAGE_COPY.staleDataMessage} type="info" />
      )}

      {cooling && (
        <AlertBanner
          message={USAGE_COPY.cooldownMessage(cooldownLeft)}
          type="warning"
          onDismiss={dismissCooldown}
          dismissLabel={USAGE_COPY.dismissCooldownLabel}
        />
      )}
      {showingFastModeWarning && (
        <AlertBanner
          message={USAGE_COPY.warnings.warning}
          type="danger"
          onDismiss={dismissFastModeWarning}
          dismissLabel={USAGE_COPY.dismiss.warning}
        />
      )}
      {showingSubModelWarning && (
        <AlertBanner
          message={USAGE_COPY.warnings.danger}
          type="danger"
          onDismiss={dismissSubModelWarning}
          dismissLabel={USAGE_COPY.dismiss.warning}
        />
      )}

      <WindowCard
        title={USAGE_COPY.windows.fiveHour.title}
        hint={USAGE_COPY.windows.fiveHour.hint}
        data={fiveHourData}
        skeleton={showingManualRefreshSkeleton}
      />

      {/* 5시간 고갈 배너 */}
      {fiveHourData?.remaining === 0 && !fiveHourExhaustedDismissed && (
        <AlertBanner
          message={USAGE_COPY.usage.exhausted.message}
          type="danger"
          onDismiss={() => setFiveHourExhaustedDismissed(true)}
          dismissLabel={USAGE_COPY.dismiss.exhausted}
        />
      )}

      {/* 주간 카드: 헤더 클릭으로 접기/펼치기, 상태 localStorage 유지 */}
      <WindowCard
        title={USAGE_COPY.windows.sevenDay.title}
        hint={USAGE_COPY.windows.sevenDay.hint}
        data={sevenDayData}
        skeleton={showingManualRefreshSkeleton}
        collapsible
        collapsed={sevenDayCollapsed}
        onToggleCollapse={() => toggleSevenDay(!sevenDayCollapsed)}
      />

      {/* 주간 고갈 배너 */}
      {sevenDayData?.remaining === 0 && !sevenDayExhaustedDismissed && (
        <AlertBanner
          message={USAGE_COPY.usage.exhausted.message}
          type="danger"
          onDismiss={() => setSevenDayExhaustedDismissed(true)}
          dismissLabel={USAGE_COPY.dismiss.exhausted}
        />
      )}

      <div className="controls">
        <label>
          {USAGE_COPY.controls.intervalLabel}
          <select
            value={intervalMin}
            onChange={(e) => setIntervalMin(Number(e.target.value))}
          >
            {intervalOptions.map((m) => (
              <option key={m} value={m}>
                {USAGE_COPY.controls.minuteOption(m)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="refresh-btn"
          onClick={() =>
            refresh({ force: shouldForceManualRefresh, manual: true })
          }
          disabled={loading || !canManualRefresh}
        >
          <RefreshIcon
            className={`refresh-icon ${loading ? "spinning" : ""}`}
          />
          {loading
            ? USAGE_COPY.controls.loadingButton
            : cooling
              ? canManualRefresh
                ? USAGE_COPY.controls.forceRefreshButton
                : USAGE_COPY.controls.cooldownButton(cooldownLeft)
              : USAGE_COPY.controls.refreshButton}
        </button>
      </div>
    </section>
  );
}
