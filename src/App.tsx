import { CLAUDE_USAGE_COPY } from "./features/claudeUsage/copy";
import { formatKstIsoWithoutTimezone } from "./features/claudeUsage/format";
import { useClaudeUsage } from "./features/claudeUsage/useClaudeUsage";
import { WindowCard } from "./features/claudeUsage/WindowCard";
import "./App.css";

function App() {
  const {
    usage,
    error,
    loading,
    intervalMin,
    setIntervalMin,
    cooldownLeft,
    cooling,
    refresh,
    intervalOptions,
  } = useClaudeUsage();

  return (
    <main className="container">
      <header className="top">
        <h1>{CLAUDE_USAGE_COPY.appTitle}</h1>
        {usage?.subscription && (
          <span className="badge">{usage.subscription}</span>
        )}
      </header>

      {usage?.fetched_at && (
        <p className="last-refresh">
          {CLAUDE_USAGE_COPY.lastRefreshLabel}{" "}
          <time dateTime={usage.fetched_at}>
            {formatKstIsoWithoutTimezone(usage.fetched_at)}
          </time>
        </p>
      )}

      {error && <p className="error">{error}</p>}
      {cooling && (
        <p className="cooldown">{CLAUDE_USAGE_COPY.cooldownMessage(cooldownLeft)}</p>
      )}

      <WindowCard
        title={CLAUDE_USAGE_COPY.windows.fiveHour.title}
        hint={CLAUDE_USAGE_COPY.windows.fiveHour.hint}
        data={usage?.five_hour ?? null}
      />
      <WindowCard
        title={CLAUDE_USAGE_COPY.windows.sevenDay.title}
        hint={CLAUDE_USAGE_COPY.windows.sevenDay.hint}
        data={usage?.seven_day ?? null}
      />

      <div className="controls">
        <label>
          {CLAUDE_USAGE_COPY.controls.intervalLabel}
          <select
            value={intervalMin}
            onChange={(e) => setIntervalMin(Number(e.target.value))}
          >
            {intervalOptions.map((m) => (
              <option key={m} value={m}>
                {CLAUDE_USAGE_COPY.controls.minuteOption(m)}
              </option>
            ))}
          </select>
        </label>
        <button onClick={refresh} disabled={loading || cooling}>
          {loading
            ? CLAUDE_USAGE_COPY.controls.loadingButton
            : cooling
              ? CLAUDE_USAGE_COPY.controls.cooldownButton(cooldownLeft)
              : CLAUDE_USAGE_COPY.controls.refreshButton}
        </button>
      </div>
    </main>
  );
}

export default App;
