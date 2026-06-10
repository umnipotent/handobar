//! Provider별로 공유하는 사용량 캐시.
//!
//! 짧은 간격의 중복 호출(마운트·트레이·타이머 동시)을 합치고, 네트워크 provider의
//! 429 backoff(`retry_until`) 동안 마지막 값을 stale로 돌려준다. 캐시 상태는
//! provider마다 독립된 `static` 으로 분리되며(`CLAUDE_CACHE`, `CODEX_CACHE`), 로직은 공유한다.
//!
//! Codex처럼 rate limit이 없는 provider는 `remember_retry` 를 호출하지 않을 뿐, 같은 코드를 쓴다(OCP).

use std::sync::Mutex;
use std::time::{Duration, Instant};

use crate::usage::messages;
use crate::usage::model::UsageSnapshot;

const MIN_SPACING: Duration = Duration::from_secs(10);
pub(super) const DEFAULT_RETRY_SECS: u64 = 60;

pub(super) enum FetchDecision {
    UseCached(UsageSnapshot),
    Fetch,
}

pub(super) struct Cache {
    last: Option<UsageSnapshot>,
    last_success: Option<Instant>,
    retry_until: Option<Instant>,
}

impl Cache {
    const fn new() -> Self {
        Cache {
            last: None,
            last_success: None,
            retry_until: None,
        }
    }
}

pub(super) static CLAUDE_CACHE: Mutex<Cache> = Mutex::new(Cache::new());
pub(super) static CODEX_CACHE: Mutex<Cache> = Mutex::new(Cache::new());

/// fetch 전 캐시를 검사해 네트워크/파일 접근을 건너뛸 수 있는지 결정한다.
pub(super) fn before_fetch(cache: &Mutex<Cache>) -> Result<FetchDecision, String> {
    let cache = cache.lock().unwrap();

    if let Some(until) = cache.retry_until {
        if let Some(remaining) = until.checked_duration_since(Instant::now()) {
            return stale_or_error(&cache, remaining.as_secs().max(1)).map(FetchDecision::UseCached);
        }
    }

    if let (Some(ts), Some(last)) = (cache.last_success, cache.last.as_ref()) {
        if ts.elapsed() < MIN_SPACING {
            return Ok(FetchDecision::UseCached(last.clone()));
        }
    }

    Ok(FetchDecision::Fetch)
}

/// 429를 받았을 때 backoff 창을 기록하고, 마지막 값을 stale로 반환한다(네트워크 provider 전용).
pub(super) fn remember_retry(
    cache: &Mutex<Cache>,
    retry_after: u64,
) -> Result<UsageSnapshot, String> {
    let retry_after = normalize_retry_after(retry_after);
    let mut cache = cache.lock().unwrap();
    cache.retry_until = Some(Instant::now() + Duration::from_secs(retry_after));
    stale_or_error(&cache, retry_after)
}

/// 성공 결과를 캐시에 저장한다.
pub(super) fn remember_success(cache: &Mutex<Cache>, usage: &UsageSnapshot) {
    let mut cache = cache.lock().unwrap();
    cache.last = Some(usage.clone());
    cache.last_success = Some(Instant::now());
    cache.retry_until = None;
}

fn stale_or_error(cache: &Cache, retry_after: u64) -> Result<UsageSnapshot, String> {
    match &cache.last {
        Some(last) => {
            let mut snapshot = last.clone();
            snapshot.retry_after_secs = Some(retry_after);
            Ok(snapshot)
        }
        None => Err(messages::rate_limited(retry_after)),
    }
}

fn normalize_retry_after(retry_after: u64) -> u64 {
    if retry_after > 0 {
        retry_after
    } else {
        DEFAULT_RETRY_SECS
    }
}

#[cfg(test)]
fn reset_cache_for_test(cache: &Mutex<Cache>) {
    let mut cache = cache.lock().unwrap();
    cache.last = None;
    cache.last_success = None;
    cache.retry_until = None;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::usage::model::UsageWindow;

    // 테스트 간 상태 격리를 위한 전용 캐시.
    static TEST_CACHE: Mutex<Cache> = Mutex::new(Cache::new());

    fn mock_usage() -> UsageSnapshot {
        UsageSnapshot {
            five_hour: Some(UsageWindow {
                remaining: 50.0,
                used: 50.0,
                resets_at: "2026-06-10T15:00:00Z".to_string(),
            }),
            seven_day: None,
            subscription: Some("pro".to_string()),
            fetched_at: "2026-06-10T14:00:00Z".to_string(),
            retry_after_secs: None,
        }
    }

    #[test]
    fn test_cache_flow() {
        let cache = &TEST_CACHE;
        reset_cache_for_test(cache);
        assert!(matches!(before_fetch(cache).unwrap(), FetchDecision::Fetch));

        let usage = mock_usage();
        remember_success(cache, &usage);
        match before_fetch(cache).unwrap() {
            FetchDecision::UseCached(cached) => {
                assert_eq!(cached.fetched_at, usage.fetched_at);
                assert_eq!(cached.retry_after_secs, None);
            }
            _ => panic!("Expected Cached decision after success"),
        }

        // 빈 캐시에서 429 → 에러
        reset_cache_for_test(cache);
        let res = remember_retry(cache, 10);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("요청이 제한되었습니다"));

        // 이전 성공이 있으면 stale + retry_after_secs
        remember_success(cache, &usage);
        let stale = remember_retry(cache, 30).unwrap();
        assert_eq!(stale.retry_after_secs, Some(30));

        match before_fetch(cache).unwrap() {
            FetchDecision::UseCached(cached) => {
                assert!(cached.retry_after_secs.unwrap() <= 30);
                assert!(cached.retry_after_secs.unwrap() > 0);
            }
            _ => panic!("Expected UseCached during retry limit"),
        }
    }

    #[test]
    fn test_zero_retry_after_uses_default_backoff() {
        let cache = &TEST_CACHE;
        reset_cache_for_test(cache);
        remember_success(cache, &mock_usage());
        let stale = remember_retry(cache, 0).unwrap();
        assert_eq!(stale.retry_after_secs, Some(DEFAULT_RETRY_SECS));
    }
}
