//! Antigravity 잔여 사용량 use-case (orchestration).
//!
//! 캐시 → 로컬 cockpit quota 캐시 → 도메인 스냅샷. 네트워크·인증 없이 동작한다.

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

    let usage = source::read_latest_snapshot()?;
    cache::remember_success(&ANTIGRAVITY_CACHE, &usage);
    Ok(usage)
}
