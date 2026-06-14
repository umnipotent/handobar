import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useMemo, useState } from "react";
import { USAGE_COPY } from "./copy";
import { formatKstIsoWithoutTimezone } from "./format";
import { THRESHOLD_CRITICAL } from "./config";
import type { UsageGateway } from "./gateway";
import { useUsage } from "./useUsage";
import { WindowCard } from "./WindowCard";
import { MemoCard } from "./MemoCard";
import { AlertBanner } from "./AlertBanner";
import type { CriticalWindowStatus, ProviderCriticalStatus, Usage } from "./types";
import {
  loadCollapsed,
  loadMemo,
  saveCollapsed,
  saveMemo,
} from "./storage";
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
  windowLabel?: (id: string, usage: Usage | null) => string;
  windowHint?: (id: string, usage: Usage | null) => string;
  defaultCollapsed?: (id: string) => boolean;
  showModelBadges?: boolean;
}

interface UsagePanelProps extends UsageProvider {
  // 가능 사용량 20% 이하 윈도우를 상위(상태 표시줄)로 보고한다. 임계 아니면 null.
  onCriticalChange?: (providerId: string, status: ProviderCriticalStatus | null) => void;
  // 트레이에 표시할 윈도우 선택과 변경 콜백 (상위 App이 상태를 소유).
  traySelection?: string | null;
  onTraySelectionChange?: (providerId: string, next: string | null) => void;
  // 선택된 트레이 윈도우 잔여(%)를 상위로 보고 (트레이 합성용). 값이 없으면 null.
  onTrayRemainingChange?: (providerId: string, remaining: number | null) => void;
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

const windowCopy = (id: string) => USAGE_COPY.windows[id as keyof typeof USAGE_COPY.windows];


// 한 provider의 잔여 사용량 패널. provider별로 다른 것은 제목·게이트웨이·저장 키뿐이다.
export function UsagePanel({
  id,
  title,
  glyph,
  gateway,
  storageKey,
  webUrl,
  windowLabel,
  windowHint,
  defaultCollapsed,
  showModelBadges,
  onCriticalChange,
  traySelection = null,
  onTraySelectionChange,
  onTrayRemainingChange,
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

  const getWindowLabel = (windowId: string) => {
    return windowLabel?.(windowId, usage) ?? windowCopy(windowId)?.label ?? windowId;
  };

  const getWindowHint = (windowId: string) => {
    return windowHint?.(windowId, usage) ?? windowCopy(windowId)?.hint ?? "";
  };

  const windows = useMemo(() => usage?.windows ?? [], [usage?.windows]);
  const windowIds = useMemo(() => windows.map((window) => window.id), [windows]);

  const [collapsedByWindowId, setCollapsedByWindowId] = useState<Record<string, boolean>>({});
  const [chipsCollapsedByWindowId, setChipsCollapsedByWindowId] = useState<Record<string, boolean>>({});
  const [exhaustedDismissedByWindowId, setExhaustedDismissedByWindowId] = useState<Record<string, boolean>>({});

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

  useEffect(() => {
    setCollapsedByWindowId((current) => {
      let changed = false;
      const next = { ...current };
      for (const windowId of windowIds) {
        if (windowId in next) continue;
        next[windowId] = loadCollapsed(
          `${storageKey}.window.${windowId}.collapsed`,
          defaultCollapsed?.(windowId) ?? false,
        );
        changed = true;
      }
      return changed ? next : current;
    });
  }, [defaultCollapsed, storageKey, windowIds]);

  const toggleWindowCollapsed = (windowId: string, next: boolean) => {
    setCollapsedByWindowId((current) => ({ ...current, [windowId]: next }));
    saveCollapsed(`${storageKey}.window.${windowId}.collapsed`, next);
  };

  useEffect(() => {
    setChipsCollapsedByWindowId((current) => {
      let changed = false;
      const next = { ...current };
      for (const window of windows) {
        if (!window.chips?.length || window.id in next) continue;
        next[window.id] = loadCollapsed(`${storageKey}.window.${window.id}.chipsCollapsed`, false);
        changed = true;
      }
      return changed ? next : current;
    });
  }, [storageKey, windows]);

  const toggleWindowChips = (windowId: string, next: boolean) => {
    setChipsCollapsedByWindowId((current) => ({ ...current, [windowId]: next }));
    saveCollapsed(`${storageKey}.window.${windowId}.chipsCollapsed`, next);
  };

  // 잔여가 0%를 벗어나면 dismiss 상태 초기화 (다음 번 0% 도달 시 다시 표시)
  useEffect(() => {
    setExhaustedDismissedByWindowId((current) => {
      let changed = false;
      const next = { ...current };
      for (const window of windows) {
        if (window.remaining > 0 && next[window.id]) {
          delete next[window.id];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [windows]);

  const sessionWindow = windows.find((window) => window.role === "session") ?? null;
  const traySelectedWindow = traySelection
    ? windows.find((window) => window.id === traySelection) ?? null
    : null;
  const trayRemaining = traySelectedWindow?.remaining ?? null;
  const trayButtonActive = traySelection != null;
  const traySelectedLabel = traySelection ? getWindowLabel(traySelectedWindow?.id ?? traySelection) : "";
  const trayButtonLabel = traySelection
    ? sessionWindow
      ? USAGE_COPY.controls.trayToggle.on
      : USAGE_COPY.controls.trayToggle.selected(traySelectedLabel)
    : USAGE_COPY.controls.trayToggle.off;

  const handleTrayToggle = () => {
    if (sessionWindow) {
      onTraySelectionChange?.(id, traySelection === sessionWindow.id ? null : sessionWindow.id);
      return;
    }

    if (windows.length === 0) {
      onTraySelectionChange?.(id, null);
      return;
    }

    const selectedIndex = traySelection
      ? windows.findIndex((window) => window.id === traySelection)
      : -1;
    const nextIndex = selectedIndex + 1;
    onTraySelectionChange?.(id, nextIndex < windows.length ? windows[nextIndex].id : null);
  };

  // 가능 사용량 20% 이하 윈도우를 모아 상위(상태 표시줄)로 보고한다.
  // 장기/기타 윈도우를 먼저 담아 둘 다 임계일 때 긴 주기의 마감이 우선 표시되도록 한다(windows[0]).
  const criticalWindows: CriticalWindowStatus[] = [...windows]
    .filter((window) => window.remaining <= THRESHOLD_CRITICAL)
    .sort((left, right) => Number(left.role === "session") - Number(right.role === "session"))
    .map((window) => ({
      windowTitle: getWindowLabel(window.id),
      remaining: window.remaining,
      resetsAt: window.resets_at,
    }));
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

  // 선택된 트레이 윈도우 잔여를 상위(App)로 보고해 트레이 합성에 쓴다. 언마운트 시 null로 정리.
  useEffect(() => {
    onTrayRemainingChange?.(id, trayRemaining);
  }, [id, trayRemaining, onTrayRemainingChange]);
  useEffect(() => {
    return () => onTrayRemainingChange?.(id, null);
  }, [id, onTrayRemainingChange]);

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
            <div className="drag-handle" title={USAGE_COPY.meta.dragHandle}>
              <DragHandleIcon />
            </div>
            <ProviderIcon glyph={glyph} className="provider-icon" />
            <h2>{title}</h2>
          </div>
        </div>
        {(usage?.subscription || (showModelBadges !== false && (usage?.model || usage?.model_tags?.length))) && (
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
            className={`meta-link-btn tray-toggle-btn${trayButtonActive ? " active" : ""}`}
            aria-pressed={trayButtonActive}
            onClick={handleTrayToggle}
          >
            {trayButtonLabel}
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

      {windows.map((window) => {
        const collapsed = collapsedByWindowId[window.id] ?? (defaultCollapsed?.(window.id) ?? false);
        const chipsCollapsed = chipsCollapsedByWindowId[window.id] ?? false;
        const hasChips = (window.chips?.length ?? 0) > 0;
        return (
          <WindowCard
            key={window.id}
            title={getWindowLabel(window.id)}
            hint={getWindowHint(window.id)}
            data={window}
            skeleton={showingManualRefreshSkeleton}
            collapsible
            collapsed={collapsed}
            onToggleCollapse={() => toggleWindowCollapsed(window.id, !collapsed)}
            chips={window.chips}
            chipsCollapsible={hasChips}
            chipsCollapsed={chipsCollapsed}
            onToggleChips={() => toggleWindowChips(window.id, !chipsCollapsed)}
          />
        );
      })}

      <div className="panel-messages">
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
        {windows
          .filter((window) => window.remaining === 0 && !exhaustedDismissedByWindowId[window.id])
          .map((window) => (
            <AlertBanner
              key={window.id}
              message={USAGE_COPY.usage.exhausted.windowMessage(getWindowLabel(window.id))}
              type="danger"
              onDismiss={() =>
                setExhaustedDismissedByWindowId((current) => ({
                  ...current,
                  [window.id]: true,
                }))
              }
              dismissLabel={USAGE_COPY.dismiss.exhausted}
            />
          ))}
      </div>

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
