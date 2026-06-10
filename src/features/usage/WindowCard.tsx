import { formatReset, formatResetExactTime } from "./format";
import type { UsageWindow } from "./types";
import { THRESHOLD_DANGER, THRESHOLD_WARNING } from "./config";
import "./WindowCard.css";


interface WindowCardProps {
  title: string;
  hint: string;
  data: UsageWindow | null;
  skeleton?: boolean;
}

export function WindowCard({ title, hint, data, skeleton = false }: WindowCardProps) {
  const remaining = data ? Math.round(data.remaining) : null;
  const isDanger = remaining !== null && remaining <= THRESHOLD_DANGER;
  const isWarning = remaining !== null && remaining <= THRESHOLD_WARNING && remaining > THRESHOLD_DANGER;

  const empty = data === null || skeleton;
  const resetRelative = data ? formatReset(data.resets_at) : "";
  const resetExact = data ? formatResetExactTime(data.resets_at) : "";

  let statusClass = "";
  if (isDanger) {
    statusClass = "danger";
  } else if (isWarning) {
    statusClass = "warning";
  }

  return (
    <section className={`card ${empty ? "empty" : ""}`}>
      <div className="card-head">
        <span className="title">{title}</span>
        <span className="hint">{hint}</span>
      </div>

      {!empty && (
        <>
          <div className={`remaining ${statusClass}`}>
            {remaining}%
          </div>
          <div className="bar">
            <div className={`bar-fill ${statusClass}`} style={{ width: `${remaining}%` }} />
          </div>
          <div className="reset">
            {resetRelative && <span>{resetRelative}</span>}
            {resetExact && <time dateTime={data.resets_at}>{resetExact}</time>}
          </div>
        </>
      )}
    </section>
  );
}
