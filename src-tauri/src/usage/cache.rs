use std::sync::Mutex;
use std::time::{Duration, Instant};

use crate::usage::messages;
use crate::usage::models::ClaudeUsage;

const MIN_SPACING: Duration = Duration::from_secs(10);
const DEFAULT_RETRY_SECS: u64 = crate::usage::api::DEFAULT_RETRY_SECS;

pub(super) enum FetchDecision {
    UseCached(ClaudeUsage),
    Fetch,
}

struct Cache {
    last: Option<ClaudeUsage>,
    last_success: Option<Instant>,
    retry_until: Option<Instant>,
}

static CACHE: Mutex<Cache> = Mutex::new(Cache {
    last: None,
    last_success: None,
    retry_until: None,
});

pub(super) fn before_fetch() -> Result<FetchDecision, String> {
    let cache = CACHE.lock().unwrap();

    if let Some(until) = cache.retry_until {
        if let Some(remaining) = until.checked_duration_since(Instant::now()) {
            return stale_or_error(&cache, remaining.as_secs().max(1))
                .map(FetchDecision::UseCached);
        }
    }

    if let (Some(ts), Some(last)) = (cache.last_success, cache.last.as_ref()) {
        if ts.elapsed() < MIN_SPACING {
            return Ok(FetchDecision::UseCached(last.clone()));
        }
    }

    Ok(FetchDecision::Fetch)
}

pub(super) fn remember_retry(retry_after: u64) -> Result<ClaudeUsage, String> {
    let retry_after = normalize_retry_after(retry_after);
    let mut cache = CACHE.lock().unwrap();
    cache.retry_until = Some(Instant::now() + Duration::from_secs(retry_after));
    stale_or_error(&cache, retry_after)
}

pub(super) fn remember_success(usage: &ClaudeUsage) {
    let mut cache = CACHE.lock().unwrap();
    cache.last = Some(usage.clone());
    cache.last_success = Some(Instant::now());
    cache.retry_until = None;
}

fn stale_or_error(cache: &Cache, retry_after: u64) -> Result<ClaudeUsage, String> {
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
fn reset_cache_for_test() {
    let mut cache = CACHE.lock().unwrap();
    cache.last = None;
    cache.last_success = None;
    cache.retry_until = None;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::usage::models::UsageWindow;

    fn mock_usage() -> ClaudeUsage {
        ClaudeUsage {
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
        // 1. Initial State (Should decide to Fetch)
        reset_cache_for_test();
        match before_fetch().unwrap() {
            FetchDecision::Fetch => {}
            _ => panic!("Expected Fetch decision in initial state"),
        }

        // 2. Remember Success and Fetch immediately (Should use Cached)
        let usage = mock_usage();
        remember_success(&usage);

        match before_fetch().unwrap() {
            FetchDecision::UseCached(cached) => {
                assert_eq!(cached.fetched_at, usage.fetched_at);
                assert_eq!(cached.retry_after_secs, None);
            }
            _ => panic!("Expected Cached decision after success"),
        }

        // 3. 429 Retry Registration
        reset_cache_for_test();
        // Calling remember_retry when cache is empty should return an error
        let res = remember_retry(10);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("요청이 제한되었습니다"));

        // Calling remember_retry when cache has previous success should return stale data with retry_after_secs
        remember_success(&usage);
        let stale = remember_retry(30).unwrap();
        assert_eq!(stale.retry_after_secs, Some(30));

        // During retry cooldown, before_fetch should return UseCached with remaining retry_after_secs
        match before_fetch().unwrap() {
            FetchDecision::UseCached(cached) => {
                assert!(cached.retry_after_secs.unwrap() <= 30);
                assert!(cached.retry_after_secs.unwrap() > 0);
            }
            _ => panic!("Expected UseCached during retry limit"),
        }
    }

    #[test]
    fn test_zero_retry_after_uses_default_backoff() {
        reset_cache_for_test();
        let usage = mock_usage();
        remember_success(&usage);

        let stale = remember_retry(0).unwrap();
        assert_eq!(stale.retry_after_secs, Some(DEFAULT_RETRY_SECS));
    }
}
