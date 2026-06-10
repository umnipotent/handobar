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

pub(super) async fn get_claude_usage(force: bool) -> Result<UsageSnapshot, String> {
    if !force {
        if let FetchDecision::UseCached(usage) = cache::before_fetch(&CLAUDE_CACHE)? {
            return Ok(usage);
        }
    }

    let creds = read_credentials()?;
    if creds.expires_at < chrono::Utc::now().timestamp_millis() {
        return Err(messages::LOGIN_EXPIRED.to_string());
    }

    let windows = match api::fetch_usage(&creds.access_token).await {
        Ok(windows) => windows,
        Err(UsageApiError::RateLimited(retry_after)) => {
            return cache::remember_retry(&CLAUDE_CACHE, retry_after);
        }
        Err(err) => return Err(String::from(err)),
    };

    let usage = UsageSnapshot {
        five_hour: windows.five_hour,
        seven_day: windows.seven_day,
        subscription: creds.subscription_type,
        fetched_at: chrono::Utc::now().to_rfc3339(),
        retry_after_secs: None,
    };

    cache::remember_success(&CLAUDE_CACHE, &usage);
    Ok(usage)
}
