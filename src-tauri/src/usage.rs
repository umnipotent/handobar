//! Claude Code 사용량 집계.
//!
//! 데이터 소스는 `~/.claude/projects/**/*.jsonl` 트랜스크립트다. 이 디렉터리는
//! Claude Code 세션 전용이므로 Codex·Antigravity 등 다른 도구의 사용량은 섞이지 않는다.
//! 각 assistant 메시지 라인의 `timestamp` 와 `message.usage` 토큰을 읽어
//! **롤링 5시간 / 7일** 윈도우로 합산한다(서버 측 한도와 정확히 일치하지는 않는 근사치).

use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use chrono::{DateTime, Utc};
use serde::Serialize;

const FIVE_HOURS_SECS: i64 = 5 * 60 * 60;
const WEEK_SECS: i64 = 7 * 24 * 60 * 60;

/// 한 시간 윈도우의 누적 사용량.
#[derive(Serialize, Default)]
pub struct UsageWindow {
    /// 입력·출력·캐시(생성/조회)를 모두 합한 총 토큰.
    pub tokens: u64,
    /// 집계에 포함된 assistant 메시지 수.
    pub messages: u64,
}

/// 프론트로 전달하는 Claude Code 사용량 스냅샷.
#[derive(Serialize)]
pub struct ClaudeUsage {
    pub five_hour: UsageWindow,
    pub weekly: UsageWindow,
    /// 집계 시각(RFC3339).
    pub updated_at: String,
}

fn projects_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".claude").join("projects"))
}

/// `dir` 이하의 `.jsonl` 파일을 재귀적으로 모은다.
fn collect_jsonl(dir: &Path, out: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_jsonl(&path, out);
        } else if path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
            out.push(path);
        }
    }
}

/// assistant 메시지의 `usage` 객체에서 총 토큰을 합산한다.
/// 중첩된 `iterations` 는 상위 합계의 재분해이므로 무시하고 최상위 키만 더한다.
fn sum_tokens(usage: &serde_json::Value) -> u64 {
    let field = |key: &str| usage.get(key).and_then(serde_json::Value::as_u64).unwrap_or(0);
    field("input_tokens")
        + field("output_tokens")
        + field("cache_creation_input_tokens")
        + field("cache_read_input_tokens")
}

/// 현재 시점 기준 롤링 5시간 / 7일 사용량을 계산한다.
pub fn compute() -> ClaudeUsage {
    let now = Utc::now();
    let mut five_hour = UsageWindow::default();
    let mut weekly = UsageWindow::default();

    if let Some(dir) = projects_dir() {
        let mut files = Vec::new();
        collect_jsonl(&dir, &mut files);

        // 최근 7일 안에 수정된 적 없는 파일은 주간 윈도우에 기여할 수 없으므로 통째로 건너뛴다.
        let week_ago = SystemTime::now() - Duration::from_secs(WEEK_SECS as u64);

        for path in files {
            if let Ok(modified) = fs::metadata(&path).and_then(|m| m.modified()) {
                if modified < week_ago {
                    continue;
                }
            }
            let Ok(file) = fs::File::open(&path) else {
                continue;
            };
            for line in BufReader::new(file).lines().map_while(Result::ok) {
                // 토큰 사용량이 없는 라인은 빠르게 건너뛴다.
                if !line.contains("\"usage\"") {
                    continue;
                }
                let Ok(value) = serde_json::from_str::<serde_json::Value>(&line) else {
                    continue;
                };
                if value.get("type").and_then(serde_json::Value::as_str) != Some("assistant") {
                    continue;
                }
                let Some(ts) = value.get("timestamp").and_then(serde_json::Value::as_str) else {
                    continue;
                };
                let Ok(ts) = DateTime::parse_from_rfc3339(ts) else {
                    continue;
                };
                let age = now
                    .signed_duration_since(ts.with_timezone(&Utc))
                    .num_seconds();
                if !(0..=WEEK_SECS).contains(&age) {
                    continue;
                }
                let Some(usage) = value.get("message").and_then(|m| m.get("usage")) else {
                    continue;
                };
                let tokens = sum_tokens(usage);

                weekly.tokens += tokens;
                weekly.messages += 1;
                if age <= FIVE_HOURS_SECS {
                    five_hour.tokens += tokens;
                    five_hour.messages += 1;
                }
            }
        }
    }

    ClaudeUsage {
        five_hour,
        weekly,
        updated_at: now.to_rfc3339(),
    }
}

/// 프론트엔드에서 호출하는 Tauri 커맨드.
#[tauri::command]
pub fn get_claude_usage() -> ClaudeUsage {
    compute()
}
