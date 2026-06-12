//! Codex 잔여 사용량 소스(로컬 파일 게이트웨이).
//!
//! Codex는 요청 응답의 `rate_limits` 스냅샷을 세션 rollout 파일
//! (`~/.codex/sessions/<날짜>/rollout-*.jsonl`)에 기록한다. 네트워크·인증 없이
//! **가장 최근에 갱신된** rollout의 **마지막** `rate_limits` 를 읽어 잔여 사용량으로 변환한다.
//!
//! - `primary`  : 단기 윈도우(window_minutes≈300=5h)  → `five_hour`
//! - `secondary`: 장기 윈도우(window_minutes≈10080=7d) → `seven_day`
//! - 잔여 = 100 - `used_percent`, `resets_at`(epoch secs) → RFC3339

use std::fs;
use std::path::{Path, PathBuf};

use serde::Deserialize;
use serde_json::Value;

use crate::usage::codex::messages;
use crate::usage::model::{UsageSnapshot, UsageWindow};

#[derive(Deserialize)]
struct AuthTokens {
    id_token: Option<String>,
}

#[derive(Deserialize)]
struct StoredAuth {
    tokens: Option<AuthTokens>,
}

/// 최근 rollout 파일을 너무 깊게 거슬러 올라가지 않도록 제한.
const MAX_FILES_SCANNED: usize = 60;

#[derive(Deserialize)]
struct RateWindow {
    used_percent: f64,
    resets_at: Option<i64>,
}

#[derive(Deserialize)]
struct RateLimits {
    primary: Option<RateWindow>,
    secondary: Option<RateWindow>,
}

impl RateLimits {
    fn has_window(&self) -> bool {
        self.primary.is_some() || self.secondary.is_some()
    }
}

pub(super) fn read_latest_snapshot() -> Result<UsageSnapshot, String> {
    let sessions = sessions_dir()?;
    if !sessions.is_dir() {
        return Err(messages::SESSIONS_NOT_FOUND.to_string());
    }

    let mut files = Vec::new();
    collect_rollouts(&sessions, &mut files);
    if files.is_empty() {
        return Err(messages::SESSIONS_NOT_FOUND.to_string());
    }
    // 최근 수정 순으로 정렬해, 활성 세션의 최신 스냅샷부터 본다.
    files.sort_by_key(|(_, mtime)| std::cmp::Reverse(*mtime));

    for (path, _) in files.into_iter().take(MAX_FILES_SCANNED) {
        if let Some(limits) = last_rate_limits(&path)? {
            return Ok(to_snapshot(limits));
        }
    }

    Err(messages::RATE_LIMITS_NOT_FOUND.to_string())
}

fn sessions_dir() -> Result<PathBuf, String> {
    let home = std::env::var("HOME").map_err(|_| messages::HOME_NOT_FOUND.to_string())?;
    Ok(PathBuf::from(home).join(".codex").join("sessions"))
}

/// `dir` 이하의 `rollout-*.jsonl` 파일과 mtime을 모은다.
fn collect_rollouts(dir: &Path, out: &mut Vec<(PathBuf, std::time::SystemTime)>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_rollouts(&path, out);
        } else if is_rollout(&path) {
            if let Ok(mtime) = entry.metadata().and_then(|m| m.modified()) {
                out.push((path, mtime));
            }
        }
    }
}

fn is_rollout(path: &Path) -> bool {
    path.extension().and_then(|s| s.to_str()) == Some("jsonl")
        && path
            .file_name()
            .and_then(|s| s.to_str())
            .is_some_and(|name| name.starts_with("rollout-"))
}

/// 한 파일에서 마지막으로 등장하는, 윈도우가 있는 `rate_limits` 를 찾는다.
fn last_rate_limits(path: &Path) -> Result<Option<RateLimits>, String> {
    let content = fs::read_to_string(path).map_err(messages::read_failed)?;
    let mut latest = None;
    for line in content.lines() {
        if !line.contains("\"rate_limits\"") {
            continue;
        }
        let Ok(value) = serde_json::from_str::<Value>(line) else {
            continue;
        };
        let Some(found) = find_rate_limits(&value) else {
            continue;
        };
        if let Ok(limits) = serde_json::from_value::<RateLimits>(found.clone()) {
            if limits.has_window() {
                latest = Some(limits);
            }
        }
    }
    Ok(latest)
}

/// 임의 깊이의 JSON에서 첫 `rate_limits` 객체를 찾는다(rollout 이벤트 구조에 비의존적).
fn find_rate_limits(value: &Value) -> Option<&Value> {
    match value {
        Value::Object(map) => {
            if let Some(rate_limits) = map.get("rate_limits") {
                if rate_limits.is_object() {
                    return Some(rate_limits);
                }
            }
            map.values().find_map(find_rate_limits)
        }
        Value::Array(items) => items.iter().find_map(find_rate_limits),
        _ => None,
    }
}

fn read_subscription_from_auth() -> Option<String> {
    let home = std::env::var("HOME").ok()?;
    let auth_path = PathBuf::from(home).join(".codex").join("auth.json");
    if !auth_path.is_file() {
        return None;
    }
    let content = fs::read_to_string(auth_path).ok()?;
    let auth: StoredAuth = serde_json::from_str(&content).ok()?;
    let id_token = auth.tokens?.id_token?;

    let parts: Vec<&str> = id_token.split('.').collect();
    if parts.len() < 2 {
        return None;
    }

    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
    let payload_bytes = URL_SAFE_NO_PAD.decode(parts[1]).ok()?;
    let payload: Value = serde_json::from_slice(&payload_bytes).ok()?;

    let plan = payload
        .get("https://api.openai.com/auth")?
        .get("chatgpt_plan_type")?
        .as_str()?;

    Some(plan.to_string())
}

fn read_codex_model() -> Option<String> {
    let home = std::env::var("HOME").ok()?;
    let config_path = PathBuf::from(home).join(".codex").join("config.toml");
    if !config_path.is_file() {
        return None;
    }
    let content = fs::read_to_string(config_path).ok()?;
    for line in content.lines() {
        let line = line.trim();
        if line.starts_with("model") {
            let parts: Vec<&str> = line.split('=').collect();
            if parts.len() >= 2 {
                let model_val = parts[1]
                    .trim()
                    .trim_matches('"')
                    .trim_matches('\'')
                    .to_string();
                return Some(model_val);
            }
        }
    }
    None
}

fn to_snapshot(limits: RateLimits) -> UsageSnapshot {
    let subscription = read_subscription_from_auth();
    let model = read_codex_model();
    UsageSnapshot {
        five_hour: limits.primary.and_then(to_window),
        seven_day: limits.secondary.and_then(to_window),
        subscription,
        model,
        model_tags: None,
        fetched_at: chrono::Utc::now().to_rfc3339(),
        retry_after_secs: None,
        is_stale: false,
    }
}

fn to_window(window: RateWindow) -> Option<UsageWindow> {
    let resets_at = window
        .resets_at
        .and_then(epoch_to_rfc3339)
        .unwrap_or_default();
    // 리셋 시각이 지난 윈도우는 공통 규칙으로 갱신 처리(잔여 100%).
    Some(
        UsageWindow::from_used_percent(window.used_percent, resets_at)
            .reset_if_elapsed(chrono::Utc::now()),
    )
}

fn epoch_to_rfc3339(secs: i64) -> Option<String> {
    chrono::DateTime::from_timestamp(secs, 0).map(|dt| dt.to_rfc3339())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_rate_limits_from_rollout_line() {
        let line = r#"{"type":"event_msg","payload":{"rate_limits":{"limit_id":"codex","primary":{"used_percent":83.0,"window_minutes":300,"resets_at":1781084708},"secondary":{"used_percent":46.0,"window_minutes":10080,"resets_at":1781429231}}}}"#;
        let value: Value = serde_json::from_str(line).unwrap();
        let found = find_rate_limits(&value).expect("rate_limits 발견");
        let limits: RateLimits = serde_json::from_value(found.clone()).unwrap();

        // rollout 라인에서 두 윈도우의 used_percent·resets_at(epoch) 파싱을 확인한다.
        // (리셋 경과 처리는 공통 UsageWindow::reset_if_elapsed 의 단위 테스트가 담당)
        let primary = limits.primary.unwrap();
        assert_eq!(primary.used_percent, 83.0);
        assert_eq!(primary.resets_at, Some(1781084708));
        let secondary = limits.secondary.unwrap();
        assert_eq!(secondary.used_percent, 46.0);
        assert_eq!(secondary.resets_at, Some(1781429231));
        // epoch → RFC3339 변환 확인.
        assert!(epoch_to_rfc3339(1781084708).unwrap().starts_with("2026-"));
    }

    #[test]
    fn ignores_null_windows() {
        let line = r#"{"rate_limits":{"primary":null,"secondary":null}}"#;
        let value: Value = serde_json::from_str(line).unwrap();
        let found = find_rate_limits(&value).unwrap();
        let limits: RateLimits = serde_json::from_value(found.clone()).unwrap();
        assert!(!limits.has_window());
    }
}
