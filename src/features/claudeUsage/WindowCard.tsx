import { CLAUDE_USAGE_COPY } from "./copy";
import { formatReset, formatResetExactTime } from "./format";
import type { UsageWindow } from "./types";

interface WindowCardProps {
  title: string;
  hint: string;
  data: UsageWindow | null;
}

export function WindowCard({ title, hint, data }: WindowCardProps) {
  const remaining = data ? Math.round(data.remaining) : null;
  const low = remaining !== null && remaining <= 15;
  const resetRelative = data ? formatReset(data.resets_at) : "";
  const resetExact = data ? formatResetExactTime(data.resets_at) : "";

  return (
    <section className="card">
      <div className="card-head">
        <span className="title">{title}</span>
        <span className="hint">{hint}</span>
      </div>
      <div className={`remaining ${low ? "low" : ""}`}>
        {remaining !== null ? `${remaining}%` : "—"}
        <span className="remaining-label">{CLAUDE_USAGE_COPY.usage.remainingLabel}</span>
      </div>
      <div className="bar">
        <div
          className={`bar-fill ${low ? "low" : ""}`}
          style={{ width: `${remaining ?? 0}%` }}
        />
      </div>
      <div className="reset">
        {resetRelative && <span>{resetRelative}</span>}
        {resetExact && <time dateTime={data?.resets_at}>{resetExact}</time>}
      </div>
    </section>
  );
}
