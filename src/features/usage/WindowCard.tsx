import { formatReset, formatResetExactTime } from "./format";
import type { UsageWindow } from "./types";
import { THRESHOLD_DANGER, THRESHOLD_WARNING } from "./config";
import { USAGE_COPY } from "./copy";
import { AlertBanner } from "./AlertBanner";
import "./WindowCard.css";


interface WindowCardProps {
  title: string;
  hint: string;
  data: UsageWindow | null;
  skeleton?: boolean;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /** exhausted(0%) 메시지를 닫았는지 여부 */
  exhaustedDismissed?: boolean;
  onDismissExhausted?: () => void;
}

export function WindowCard({
  title,
  hint,
  data,
  skeleton = false,
  collapsible = false,
  collapsed = false,
  onToggleCollapse,
  exhaustedDismissed = false,
  onDismissExhausted,
}: WindowCardProps) {
  const remaining = data ? Math.round(data.remaining) : null;
  const isExhausted = remaining === 0;
  const isDanger = remaining !== null && remaining <= THRESHOLD_DANGER;
  const isWarning =
    remaining !== null &&
    remaining <= THRESHOLD_WARNING &&
    remaining > THRESHOLD_DANGER;

  // data가 없거나 skeleton 중이면 empty 표시
  // 단, remaining === 0 (완전 고갈)은 data가 있으므로 empty가 아님
  const empty = data === null || skeleton;

  // 리셋 시각: 0%여도 resets_at이 있으면 표시
  const resetRelative = data?.resets_at ? formatReset(data.resets_at) : "";
  const resetExact = data?.resets_at ? formatResetExactTime(data.resets_at) : "";

  let statusClass = "";
  if (isDanger) {
    statusClass = "danger";
  } else if (isWarning) {
    statusClass = "warning";
  }

  const { emoji, message } = USAGE_COPY.usage.exhausted;

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
    <section
      className={[
        "card",
        empty ? "empty" : "",
        collapsed ? "card-collapsed" : "",
        isExhausted ? "exhausted" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
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
            {isExhausted && (
              <span className="exhausted-emoji" aria-label="고갈">{emoji}</span>
            )}
          </div>
          <div className="bar">
            <div className={`bar-fill ${statusClass}`} style={{ width: `${remaining}%` }} />
          </div>

          {/* exhausted 메시지: 닫기 버튼 포함, 닫힌 상태에서는 숨김 */}
          {isExhausted && !exhaustedDismissed && (
            <AlertBanner
              message={message}
              type="danger"
              onDismiss={onDismissExhausted}
              dismissLabel={USAGE_COPY.dismiss.exhausted}
            />
          )}

          {/* 리셋 시각: 0%여도 데이터가 있으면 표시 */}
          {(resetRelative || resetExact) && (
            <div className="reset">
              {resetRelative && <span>{resetRelative}</span>}
              {resetExact && data?.resets_at && (
                <time dateTime={data.resets_at}>{resetExact}</time>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
