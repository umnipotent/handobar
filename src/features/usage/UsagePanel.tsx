import { USAGE_COPY } from "./copy";
import { formatKstIsoWithoutTimezone } from "./format";
import type { UsageGateway } from "./gateway";
import { useUsage } from "./useUsage";
import { WindowCard } from "./WindowCard";

export interface UsageProvider {
  title: string;
  gateway: UsageGateway;
  storageKey: string;
}

// 한 provider의 잔여 사용량 패널. provider별로 다른 것은 제목·게이트웨이·저장 키뿐이다.
export function UsagePanel({ title, gateway, storageKey }: UsageProvider) {
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
  } = useUsage(gateway, storageKey);

  return (
    <section className="panel">
      <header className="top">
        <h2>{title}</h2>
        {usage?.subscription && <span className="badge">{usage.subscription}</span>}
      </header>

      {usage?.fetched_at && (
        <p className="last-refresh">
          {USAGE_COPY.lastRefreshLabel}{" "}
          <time dateTime={usage.fetched_at}>{formatKstIsoWithoutTimezone(usage.fetched_at)}</time>
        </p>
      )}

      {error && <p className="error">{error}</p>}
      {cooling && (
        <div className="cooldown" role="status">
          <span>{USAGE_COPY.cooldownMessage(cooldownLeft)}</span>
          <button
            className="cooldown-close"
            type="button"
            onClick={dismissCooldown}
            aria-label={USAGE_COPY.dismissCooldownLabel}
          >
            ×
          </button>
        </div>
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
    </section>
  );
}
