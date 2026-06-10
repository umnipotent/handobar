import { formatReset, formatResetExactTime } from "./format";
import type { UsageWindow } from "./types";
import { THRESHOLD_DANGER, THRESHOLD_WARNING } from "./config";
import "./WindowCard.css";


interface WindowCardProps {
  title: string;
  hint: string;
  data: UsageWindow | null;
  skeleton?: boolean;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function WindowCard({
  title,
  hint,
  data,
  skeleton = false,
  collapsible = false,
  collapsed = false,
  onToggleCollapse,
}: WindowCardProps) {
  const remaining = data ? Math.round(data.remaining) : null;
  const isDanger = remaining !== null && remaining <= THRESHOLD_DANGER;
  const isWarning =
    remaining !== null &&
    remaining <= THRESHOLD_WARNING &&
    remaining > THRESHOLD_DANGER;

  // data가 없거나 skeleton 중이면 empty 표시
  // 단, remaining === 0 (완전 고갈)은 data가 있으므로 empty가 아님
  const empty = data === null || skeleton;
  const resetRelative = data ? formatReset(data.resets_at) : "";
  const resetExact = data ? formatResetExactTime(data.resets_at) : "";

  let statusClass = "";
  if (isDanger) {
    statusClass = "danger";
  } else if (isWarning) {
    statusClass = "warning";
  }

  const headContent = (
    <>
      <span className="title">{title}</span>
      <span className="card-head-right">
        <span className="hint">{hint}</span>
        {collapsible && (
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`chevron-icon ${collapsed ? "collapsed" : ""}`}
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </span>
    </>
  );

  return (
    <section className={`card ${empty ? "empty" : ""} ${collapsed ? "card-collapsed" : ""}`}>
      {collapsible ? (
        <button
          type="button"
          className="card-head card-head-btn"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-label={`${title} ${collapsed ? "펼치기" : "접기"}`}
        >
          {headContent}
        </button>
      ) : (
        <div className="card-head">{headContent}</div>
      )}

      {!collapsed && !empty && (
        <>
          <div className={`remaining ${statusClass}`}>
            {remaining}%
          </div>
          <div className="bar">
            <div className={`bar-fill ${statusClass}`} style={{ width: `${remaining}%` }} />
          </div>
          <div className="reset">
            {resetRelative && <span>{resetRelative}</span>}
            {resetExact && <time dateTime={data!.resets_at}>{resetExact}</time>}
          </div>
        </>
      )}
    </section>
  );
}
