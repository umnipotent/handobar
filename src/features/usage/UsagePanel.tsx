import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { USAGE_COPY } from "./copy";
import { formatKstIsoWithoutTimezone } from "./format";
import { THRESHOLD_CRITICAL } from "./config";
import type { UsageGateway } from "./gateway";
import { useUsage } from "./useUsage";
import { WindowCard } from "./WindowCard";
import { MemoCard } from "./MemoCard";
import { AlertBanner } from "./AlertBanner";
import type { CriticalWindowStatus, ProviderCriticalStatus } from "./types";
import { loadCollapsed, loadMemo, saveCollapsed, saveMemo } from "./storage";
import { resolveWindow, type NullWindowMeaning } from "./windowPolicy";
import { ProviderIcon } from "./ProviderIcon";
import type { ProviderGlyph } from "./providerGlyph";
import "./UsagePanel.css";

export interface UsageProvider {
  id: string;
  title: string;
  glyph: ProviderGlyph;
  gateway: UsageGateway;
  storageKey: string;
  webUrl?: string;
  showSevenDayCard?: boolean;
  fiveHourTitle?: string | ((usage: any) => string);
  fiveHourHint?: string | ((usage: any) => string);
  sevenDayTitle?: string | ((usage: any) => string);
  sevenDayHint?: string | ((usage: any) => string);
  fiveHourChips?: (usage: any) => string[] | undefined;
  sevenDayChips?: (usage: any) => string[] | undefined;
  showModelBadges?: boolean;
  // usage는 있는데 윈도우가 null일 때의 해석 (기본: 판단 불가 → 빈 카드)
  nullWindowMeaning?: NullWindowMeaning;
}

interface UsagePanelProps extends UsageProvider {
  // 가능 사용량 20% 이하 윈도우를 상위(상태 표시줄)로 보고한다. 임계 아니면 null.
  onCriticalChange?: (providerId: string, status: ProviderCriticalStatus | null) => void;
  // 트레이에 5h 잔여 표시 여부와 토글 콜백 (상위 App이 상태를 소유).
  showInTray?: boolean;
  onToggleShowInTray?: (providerId: string, next: boolean) => void;
  // 5h 잔여(%)를 상위로 보고 (트레이 합성용). 값이 없으면 null.
  onFiveHourRemainingChange?: (providerId: string, remaining: number | null) => void;
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
  id,
  title,
  glyph,
  gateway,
  storageKey,
  webUrl,
  showSevenDayCard = true,
  fiveHourTitle,
  fiveHourHint,
  sevenDayTitle,
  sevenDayHint,
  fiveHourChips,
  sevenDayChips,
  showModelBadges,
  nullWindowMeaning = "unknown",
  onCriticalChange,
  showInTray = false,
  onToggleShowInTray,
  onFiveHourRemainingChange,
}: UsagePanelProps) {
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

  const resolveTitle = (custom: any, fallback: string) => {
    if (typeof custom === "function") return custom(usage);
    return custom ?? fallback;
  };

  const resolveHint = (custom: any, fallback: string) => {
    if (typeof custom === "function") return custom(usage);
    return custom ?? fallback;
  };

  const [sevenDayCollapsed, setSevenDayCollapsed] = useState(() =>
    loadCollapsed(`${storageKey}.sevenDay.collapsed`)
  );

  // 자유 메모: 내용·접힘 상태 모두 localStorage 유지 (기본 접힘).
  const [memo, setMemo] = useState(() => loadMemo(`${storageKey}.memo`));
  const [memoCollapsed, setMemoCollapsed] = useState(() =>
    loadCollapsed(`${storageKey}.memo.collapsed`, true)
  );

  const handleMemoSave = (next: string) => {
    setMemo(next);
    saveMemo(`${storageKey}.memo`, next);
  };

  const toggleMemo = (next: boolean) => {
    setMemoCollapsed(next);
    saveCollapsed(`${storageKey}.memo.collapsed`, next);
  };

  // exhausted 메시지 닫기 상태. 사용량이 0%→양수로 회복되면 자동 리셋.
  const hasUsage = usage != null;
  const fiveHourData = resolveWindow(usage?.five_hour, hasUsage, nullWindowMeaning);
  const sevenDayData = showSevenDayCard ? resolveWindow(usage?.seven_day, hasUsage, nullWindowMeaning) : null;
  const fiveHourRemaining = fiveHourData?.remaining ?? null;
  const sevenDayRemaining = sevenDayData?.remaining ?? null;
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

  // 가능 사용량 20% 이하 윈도우를 모아 상위(상태 표시줄)로 보고한다.
  // 주간을 먼저 담아 둘 다 임계일 때 주간 마감이 우선 표시되도록 한다(windows[0]).
  const criticalWindows: CriticalWindowStatus[] = [];
  if (sevenDayData && sevenDayData.remaining <= THRESHOLD_CRITICAL) {
    criticalWindows.push({
      windowTitle: USAGE_COPY.windows.sevenDay.title,
      remaining: sevenDayData.remaining,
      resetsAt: sevenDayData.resets_at,
    });
  }
  if (fiveHourData && fiveHourData.remaining <= THRESHOLD_CRITICAL) {
    criticalWindows.push({
      windowTitle: USAGE_COPY.windows.fiveHour.title,
      remaining: fiveHourData.remaining,
      resetsAt: fiveHourData.resets_at,
    });
  }
  // 매 렌더 새 배열이라 직렬화 키로 변경 여부만 추려 보고 (무한 루프 방지).
  const criticalKey = JSON.stringify(criticalWindows);
  useEffect(() => {
    if (!onCriticalChange) return;
    const status: ProviderCriticalStatus | null =
      criticalWindows.length > 0
        ? { providerId: id, providerTitle: title, windows: criticalWindows }
        : null;
    onCriticalChange(id, status);
    // criticalWindows는 criticalKey로 대표한다 (객체 동일성 비교 회피).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criticalKey, id, title, onCriticalChange]);

  // 패널 언마운트 시 임계 상태 정리.
  useEffect(() => {
    return () => onCriticalChange?.(id, null);
  }, [id, onCriticalChange]);

  // 5h 잔여를 상위(App)로 보고해 트레이 합성에 쓴다. 언마운트 시 null로 정리.
  useEffect(() => {
    onFiveHourRemainingChange?.(id, fiveHourRemaining);
  }, [id, fiveHourRemaining, onFiveHourRemainingChange]);
  useEffect(() => {
    return () => onFiveHourRemainingChange?.(id, null);
  }, [id, onFiveHourRemainingChange]);

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
            <ProviderIcon glyph={glyph} className="provider-icon" />
            <h2>{title}</h2>
          </div>
        </div>
        {(usage?.model || usage?.subscription) && (
          <div className="header-sub-row">
            {showModelBadges !== false && usage?.model && (
              <span className="badge model-badge">{usage.model}</span>
            )}
            {usage?.subscription && (
              <span className="badge">{usage.subscription}</span>
            )}
            {showModelBadges !== false && usage?.model_tags?.map((tag) => (
              <span key={tag} className="badge">
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="header-actions-row">
          {webUrl && (
            <button
              type="button"
              className="meta-link-btn"
              onClick={() => handleOpenUrl(webUrl)}
            >
              {USAGE_COPY.meta.directView}
            </button>
          )}
          <button
            type="button"
            className={`meta-link-btn tray-toggle-btn${showInTray ? " active" : ""}`}
            aria-pressed={showInTray}
            onClick={() => onToggleShowInTray?.(id, !showInTray)}
          >
            {showInTray ? USAGE_COPY.controls.trayToggle.on : USAGE_COPY.controls.trayToggle.off}
          </button>
        </div>
      </header>

      {usage?.fetched_at && (
        <p className="last-refresh">
          {USAGE_COPY.lastRefreshLabel}{" "}
          <time dateTime={usage.fetched_at}>
            {formatKstIsoWithoutTimezone(usage.fetched_at)}
          </time>
        </p>
      )}

      <WindowCard
        title={resolveTitle(fiveHourTitle, USAGE_COPY.windows.fiveHour.title)}
        hint={resolveHint(fiveHourHint, USAGE_COPY.windows.fiveHour.hint)}
        data={fiveHourData}
        skeleton={showingManualRefreshSkeleton}
        chips={typeof fiveHourChips === "function" ? fiveHourChips(usage) : undefined}
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

      {/* 알림 배너: 카드와 카드 사이 상단 영역에 배치 */}
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

      {showSevenDayCard && (
        <>
          {/* 주간 카드: 헤더 클릭으로 접기/펼치기, 상태 localStorage 유지 */}
          <WindowCard
            title={resolveTitle(sevenDayTitle, USAGE_COPY.windows.sevenDay.title)}
            hint={resolveHint(sevenDayHint, USAGE_COPY.windows.sevenDay.hint)}
            data={sevenDayData}
            skeleton={showingManualRefreshSkeleton}
            collapsible
            collapsed={sevenDayCollapsed}
            onToggleCollapse={() => toggleSevenDay(!sevenDayCollapsed)}
            chips={typeof sevenDayChips === "function" ? sevenDayChips(usage) : undefined}
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
        </>
      )}

      {/* 메모 탭: 하단 풀 폭 메모지 (접기/펼치기 유지) */}
      <MemoCard
        value={memo}
        onSave={handleMemoSave}
        collapsed={memoCollapsed}
        onToggleCollapse={() => toggleMemo(!memoCollapsed)}
      />

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
