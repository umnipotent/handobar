//! Antigravity 잔여 사용량 use-case (orchestration).
//!
//! 캐시 → 로컬 cockpit quota 캐시 → 도메인 스냅샷. 네트워크·인증 없이 동작한다.

mod api;
mod credentials;
mod messages;
mod source;

use crate::usage::cache::{self, FetchDecision, ANTIGRAVITY_CACHE};
use crate::usage::model::UsageSnapshot;

pub(super) async fn get_antigravity_usage(force: bool) -> Result<UsageSnapshot, String> {
    if !force {
        if let FetchDecision::UseCached(usage) = cache::before_fetch(&ANTIGRAVITY_CACHE)? {
            return Ok(usage);
        }
    }

    let access_token = credentials::get_valid_token().await?;
    let project_id = "inbound-messenger-m7q7c";

    let live_quota = match api::fetch_quota(&access_token, project_id).await {
        Ok(quota) => quota,
        Err(err) => {
            // API 호출 실패 시, 마지막 성공 캐시가 있다면 stale로 반환, 없으면 에러
            return cache::remember_fallback_stale(&ANTIGRAVITY_CACHE, err);
        }
    };

    let usage = source::convert_quota_response(&live_quota)?;

    cache::remember_success(&ANTIGRAVITY_CACHE, &usage);
    Ok(usage)
}
