import { useState } from "react";
import { USAGE_COPY } from "./copy";
import { renderMarkdown } from "./markdown";
import "./WindowCard.css";
import "./MemoCard.css";

interface MemoCardProps {
  /** 저장된 메모 원본 텍스트. */
  value: string;
  /** 저장 버튼을 눌렀을 때만 호출 (영속화). */
  onSave: (next: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
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
  );
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// 주간 카드처럼 탭으로 접을 수 있는 자유 메모. 가로 풀 박스 메모지.
// 수정/저장 가능하며, 읽을 때 마크다운 렌더링과 원본 보기를 토글한다.
export function MemoCard({ value, onSave, collapsed, onToggleCollapse }: MemoCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [showSource, setShowSource] = useState(false);

  const startEditing = () => {
    setDraft(value);
    setEditing(true);
  };

  const handleSave = () => {
    onSave(draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const hasContent = value.trim().length > 0;

  return (
    <section
      className={["card", "memo-card", collapsed ? "card-collapsed" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="card-head memo-head">
        <button
          type="button"
          className="memo-collapse-btn"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-label={collapsed ? USAGE_COPY.memo.expand : USAGE_COPY.memo.collapse}
        >
          <span className="title">{USAGE_COPY.memo.title}</span>
          <ChevronIcon collapsed={collapsed} />
        </button>

        {!collapsed && (
          <div className="memo-actions">
            {editing ? (
              <>
                <button type="button" className="memo-action-btn primary" onClick={handleSave}>
                  {USAGE_COPY.memo.save}
                </button>
                <button type="button" className="memo-action-btn" onClick={handleCancel}>
                  {USAGE_COPY.memo.cancel}
                </button>
              </>
            ) : (
              <>
                {hasContent && (
                  <span className="memo-view-toggle" role="group">
                    <button
                      type="button"
                      className={`memo-icon-btn ${!showSource ? "active" : ""}`}
                      onClick={() => setShowSource(false)}
                      aria-pressed={!showSource}
                      aria-label={USAGE_COPY.memo.viewRendered}
                      title={USAGE_COPY.memo.viewRendered}
                    >
                      <EyeIcon />
                    </button>
                    <button
                      type="button"
                      className={`memo-icon-btn ${showSource ? "active" : ""}`}
                      onClick={() => setShowSource(true)}
                      aria-pressed={showSource}
                      aria-label={USAGE_COPY.memo.viewSource}
                      title={USAGE_COPY.memo.viewSource}
                    >
                      <CodeIcon />
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  className="memo-icon-btn"
                  onClick={startEditing}
                  aria-label={USAGE_COPY.memo.edit}
                  title={USAGE_COPY.memo.edit}
                >
                  <PencilIcon />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="memo-body">
          {editing ? (
            <textarea
              className="memo-input"
              value={draft}
              placeholder={USAGE_COPY.memo.placeholder}
              onChange={(event) => setDraft(event.target.value)}
              rows={4}
              autoFocus
            />
          ) : !hasContent ? (
            <p className="memo-empty">{USAGE_COPY.memo.emptyView}</p>
          ) : showSource ? (
            <pre className="memo-source">{value}</pre>
          ) : (
            <div className="memo-rendered">{renderMarkdown(value)}</div>
          )}
        </div>
      )}
    </section>
  );
}
