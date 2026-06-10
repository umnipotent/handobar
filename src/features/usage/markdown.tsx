import type { ReactNode } from "react";

// 외부 의존성 없이 동작하는 경량 마크다운 렌더러. 사용자가 직접 쓰는 로컬 메모용이라
// dangerouslySetInnerHTML을 쓰지 않고 React 노드를 직접 만들어 XSS 위험을 차단한다.
// 지원: 제목(#, ##, ###), 굵게(**), 기울임(*), 인라인 코드(`), 링크([t](u)),
// 코드블록(```), 글머리/번호 목록, 단락(빈 줄 구분, 단락 내 줄바꿈은 <br/>).

// 인라인 마크업을 React 노드 배열로 변환. 중첩은 지원하지 않는다(간단 메모 기준).
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)\s]+\))/;

  let remaining = text;
  let index = 0;
  while (remaining.length > 0) {
    const match = pattern.exec(remaining);
    if (!match) {
      nodes.push(remaining);
      break;
    }
    if (match.index > 0) nodes.push(remaining.slice(0, match.index));

    const token = match[0];
    const key = `${keyPrefix}-${index++}`;
    if (token.startsWith("`")) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else {
      const link = /\[([^\]]+)\]\(([^)\s]+)\)/.exec(token);
      const href = link ? sanitizeHref(link[2]) : "#";
      nodes.push(
        <a key={key} href={href} target="_blank" rel="noreferrer noopener">
          {link ? link[1] : token}
        </a>,
      );
    }
    remaining = remaining.slice(match.index + token.length);
  }
  return nodes;
}

// javascript: 등 위험한 스킴 차단 (사용자 본인 입력이지만 자기방어).
function sanitizeHref(href: string): string {
  const trimmed = href.trim();
  if (/^(https?:|mailto:|#|\/)/i.test(trimmed)) return trimmed;
  return "#";
}

const HEADING_RE = /^(#{1,3})\s+(.*)$/;
const ULIST_RE = /^\s*[-*]\s+(.*)$/;
const OLIST_RE = /^\s*\d+\.\s+(.*)$/;

function isBlockStart(line: string): boolean {
  return (
    line.trim().startsWith("```") ||
    HEADING_RE.test(line) ||
    ULIST_RE.test(line) ||
    OLIST_RE.test(line)
  );
}

function renderHeading(level: number, text: string, key: number): ReactNode {
  const content = renderInline(text, `h-${key}`);
  if (level === 1) return <h3 key={key} className="md-heading md-h1">{content}</h3>;
  if (level === 2) return <h4 key={key} className="md-heading md-h2">{content}</h4>;
  return <h5 key={key} className="md-heading md-h3">{content}</h5>;
}

export function renderMarkdown(source: string): ReactNode {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 코드블록
    if (line.trim().startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // 닫는 펜스 건너뛰기
      blocks.push(
        <pre key={key++} className="md-code-block">
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // 빈 줄
    if (line.trim() === "") {
      i++;
      continue;
    }

    // 제목
    const heading = HEADING_RE.exec(line);
    if (heading) {
      blocks.push(renderHeading(heading[1].length, heading[2], key++));
      i++;
      continue;
    }

    // 목록 (글머리/번호)
    const ordered = OLIST_RE.test(line);
    if (ordered || ULIST_RE.test(line)) {
      const itemRe = ordered ? OLIST_RE : ULIST_RE;
      const items: ReactNode[] = [];
      while (i < lines.length && itemRe.test(lines[i])) {
        const item = itemRe.exec(lines[i]);
        items.push(
          <li key={items.length}>{renderInline(item ? item[1] : "", `li-${key}-${items.length}`)}</li>,
        );
        i++;
      }
      blocks.push(
        ordered ? (
          <ol key={key++} className="md-list">{items}</ol>
        ) : (
          <ul key={key++} className="md-list">{items}</ul>
        ),
      );
      continue;
    }

    // 단락: 다음 블록/빈 줄 전까지 모아 줄바꿈 보존
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !isBlockStart(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    const paraNodes: ReactNode[] = [];
    paraLines.forEach((paraLine, idx) => {
      if (idx > 0) paraNodes.push(<br key={`br-${key}-${idx}`} />);
      paraNodes.push(...renderInline(paraLine, `p-${key}-${idx}`));
    });
    blocks.push(
      <p key={key++} className="md-paragraph">{paraNodes}</p>,
    );
  }

  return <>{blocks}</>;
}
