//! Codex 잔여 사용량 use-case (orchestration).
//!
//! 캐시 → 로컬 rollout 소스 → 도메인 스냅샷. 네트워크·인증·rate limit이 없어 Claude보다 단순하다.

mod messages;
mod source;

use crate::usage::cache::{self, FetchDecision, CODEX_CACHE};
use crate::usage::model::UsageSnapshot;

pub(super) async fn get_codex_usage(force: bool) -> Result<UsageSnapshot, String> {
    if !force {
        if let FetchDecision::UseCached(usage) = cache::before_fetch(&CODEX_CACHE)? {
            return Ok(usage);
        }
    }

    let usage = source::read_latest_snapshot()?;
    cache::remember_success(&CODEX_CACHE, &usage);
    Ok(usage)
}
