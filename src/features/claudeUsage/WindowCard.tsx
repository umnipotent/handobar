import { CLAUDE_USAGE_COPY } from "./copy";
import { formatReset, formatResetExactTime } from "./format";
import type { UsageWindow } from "./types";

interface WindowCardProps {
  title: string;
  hint: string;
  data: UsageWindow | null;
  skeleton?: boolean;
}

export function WindowCard({ title, hint, data, skeleton = false }: WindowCardProps) {
  const remaining = data ? Math.round(data.remaining) : null;
  const low = remaining !== null && remaining <= 15;
  const empty = data === null || skeleton;
  const showValue = data !== null && !skeleton;
  const resetRelative = data ? formatReset(data.resets_at) : "";
  const resetExact = data ? formatResetExactTime(data.resets_at) : "";

  return (
    <section className={`card ${empty ? "empty" : ""}`}>
      <div className="card-head">
        <span className="title">{title}</span>
        <span className="hint">{hint}</span>
      </div>
      <div className={`remaining ${low ? "low" : ""}`}>
        {showValue ? `${remaining}%` : CLAUDE_USAGE_COPY.usage.emptyValue}
        <span className="remaining-label">{CLAUDE_USAGE_COPY.usage.remainingLabel}</span>
      </div>
      <div className="bar">
        <div
          className={`bar-fill ${low ? "low" : ""} ${empty ? "skeleton" : ""}`}
          style={{ width: `${showValue ? remaining : 100}%` }}
        />
      </div>
      <div className="reset">
        {empty ? (
          <>
            <span className="skeleton-line" aria-hidden="true" />
            <span className="skeleton-line short" aria-hidden="true" />
          </>
        ) : (
          <>
            {resetRelative && <span>{resetRelative}</span>}
            {resetExact && <time dateTime={data.resets_at}>{resetExact}</time>}
          </>
        )}
      </div>
    </section>
  );
}
