//! Claude Code 잔여 사용량 use-case (orchestration).
//!
//! 캐시 → 키체인 자격증명 → OAuth 엔드포인트 → 도메인 스냅샷 순서로 조립한다.

mod api;
mod credentials;
mod messages;

use api::UsageApiError;
use credentials::read_credentials;

use crate::usage::cache::{self, FetchDecision, CLAUDE_CACHE};
use crate::usage::model::UsageSnapshot;

#[derive(serde::Deserialize)]
struct ClaudeSettings {
    model: Option<String>,
}

fn read_claude_model() -> Option<String> {
    let home = std::env::var("HOME").ok()?;
    let settings_path = std::path::PathBuf::from(home)
        .join(".claude")
        .join("settings.json");
    if !settings_path.is_file() {
        return None;
    }
    let content = std::fs::read_to_string(settings_path).ok()?;
    let settings: ClaudeSettings = serde_json::from_str(&content).ok()?;
    settings.model
}

pub(super) async fn get_claude_usage(force: bool) -> Result<UsageSnapshot, String> {
    if !force {
        if let FetchDecision::UseCached(usage) = cache::before_fetch(&CLAUDE_CACHE)? {
            return Ok(usage);
        }
    }

    let creds = read_credentials()?;
    let expires_at_ms = if creds.expires_at < 10_000_000_000 {
        creds.expires_at * 1000
    } else {
        creds.expires_at
    };

    if expires_at_ms < chrono::Utc::now().timestamp_millis() {
        return Err(messages::LOGIN_EXPIRED.to_string());
    }

    let windows = match api::fetch_usage(&creds.access_token).await {
        Ok(windows) => windows,
        Err(UsageApiError::RateLimited(retry_after)) => {
            return cache::remember_retry(&CLAUDE_CACHE, retry_after);
        }
        Err(err) => {
            // 네트워크·파싱 오류: 직전 성공 캐시가 있으면 stale로 반환, 없으면 Err.
            return cache::remember_fallback_stale(&CLAUDE_CACHE, String::from(err));
        }
    };

    // 리셋 시각이 지난 윈도우는 공통 규칙으로 갱신 처리(잔여 100%). Codex와 동일.
    let now = chrono::Utc::now();
    let usage = UsageSnapshot {
        five_hour: windows.five_hour.map(|w| w.reset_if_elapsed(now)),
        seven_day: windows.seven_day.map(|w| w.reset_if_elapsed(now)),
        subscription: creds.subscription_type,
        model: read_claude_model(),
        model_tags: None,
        fetched_at: chrono::Utc::now().to_rfc3339(),
        retry_after_secs: None,
        is_stale: false,
    };

    cache::remember_success(&CLAUDE_CACHE, &usage);
    Ok(usage)
}
