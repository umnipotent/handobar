import { openUrl } from "@tauri-apps/plugin-opener";
import { USAGE_COPY } from "./copy";
import { formatKstIsoWithoutTimezone } from "./format";
import type { UsageGateway } from "./gateway";
import { useUsage } from "./useUsage";
import { WindowCard } from "./WindowCard";
import { AlertBanner } from "./AlertBanner";

export interface UsageProvider {
  id: string;
  title: string;
  gateway: UsageGateway;
  storageKey: string;
  cliCmd?: string;
  webUrl?: string;
}

// 한 provider의 잔여 사용량 패널. provider별로 다른 것은 제목·게이트웨이·저장 키뿐이다.
export function UsagePanel({ title, gateway, storageKey, cliCmd, webUrl }: UsageProvider) {
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
        <h2>{title}</h2>
        {(usage?.model || usage?.subscription) && (
          <div className="header-badges">
            {usage?.model && <span className="badge model-badge">{usage.model}</span>}
            {usage?.subscription && <span className="badge">{usage.subscription}</span>}
          </div>
        )}
      </header>

      {usage?.fetched_at && (
        <p className="last-refresh">
          {USAGE_COPY.lastRefreshLabel}{" "}
          <time dateTime={usage.fetched_at}>{formatKstIsoWithoutTimezone(usage.fetched_at)}</time>
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
          message={USAGE_COPY.warnings.fastMode}
          type="danger"
          onDismiss={dismissFastModeWarning}
          dismissLabel={USAGE_COPY.dismiss.warning}
        />
      )}
      {showingSubModelWarning && (
        <AlertBanner
          message={USAGE_COPY.warnings.subModel}
          type="danger"
          onDismiss={dismissSubModelWarning}
          dismissLabel={USAGE_COPY.dismiss.warning}
        />
      )}


      <WindowCard
        title={USAGE_COPY.windows.fiveHour.title}
        hint={USAGE_COPY.windows.fiveHour.hint}
        data={usage?.five_hour ?? null}
        skeleton={showingManualRefreshSkeleton}
      />
      <WindowCard
        title={USAGE_COPY.windows.sevenDay.title}
        hint={USAGE_COPY.windows.sevenDay.hint}
        data={usage?.seven_day ?? null}
        skeleton={showingManualRefreshSkeleton}
      />

      <div className="controls">
        <label>
          {USAGE_COPY.controls.intervalLabel}
          <select value={intervalMin} onChange={(e) => setIntervalMin(Number(e.target.value))}>
            {intervalOptions.map((m) => (
              <option key={m} value={m}>
                {USAGE_COPY.controls.minuteOption(m)}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => refresh({ force: shouldForceManualRefresh, manual: true })}
          disabled={loading || !canManualRefresh}
        >
          {loading
            ? USAGE_COPY.controls.loadingButton
            : cooling
              ? canManualRefresh
                ? USAGE_COPY.controls.forceRefreshButton
                : USAGE_COPY.controls.cooldownButton(cooldownLeft)
              : USAGE_COPY.controls.refreshButton}
        </button>
      </div>

      {(cliCmd || webUrl) && (
        <div className="provider-meta">
          {cliCmd && (
            <div className="meta-item">
              <span className="meta-label">{USAGE_COPY.meta.cliLabel}</span>
              <code
                className="meta-code"
                onClick={() => navigator.clipboard.writeText(cliCmd)}
                title={USAGE_COPY.meta.clipboardCopied}
              >
                {cliCmd}
              </code>
            </div>
          )}
          {webUrl && (
            <div className="meta-item">
              <span className="meta-label">{USAGE_COPY.meta.webLabel}</span>
              <button
                type="button"
                className="meta-link-btn"
                onClick={() => handleOpenUrl(webUrl)}
              >
                {webUrl.replace(/^https?:\/\//, "")}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

