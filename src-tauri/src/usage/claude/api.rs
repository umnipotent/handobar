//! Claude Code OAuth 사용량 엔드포인트 게이트웨이.
//!
//! `GET /api/oauth/usage` 응답(`utilization`)을 공유 도메인 `UsageWindow`(잔여) 로 매핑한다.

use std::time::Duration;

use serde::Deserialize;

use crate::usage::claude::messages;
use crate::usage::messages as shared;
use crate::usage::model::UsageWindow;

const USAGE_URL: &str = "https://api.anthropic.com/api/oauth/usage";
const OAUTH_BETA: &str = "oauth-2025-04-20";
pub(super) const DEFAULT_RETRY_SECS: u64 = 60;

/// 엔드포인트 응답의 한 윈도우(사용률 기반).
#[derive(Deserialize, Debug)]
struct ApiWindow {
    utilization: f64,
    resets_at: String,
}

impl From<ApiWindow> for UsageWindow {
    fn from(w: ApiWindow) -> Self {
        UsageWindow::from_used_percent(w.utilization, w.resets_at)
    }
}

#[derive(Deserialize, Debug)]
struct ApiUsage {
    five_hour: Option<ApiWindow>,
    seven_day: Option<ApiWindow>,
}

/// fetch 성공 시 두 윈도우(잔여)로 변환해 반환.
pub(super) struct UsageWindows {
    pub five_hour: Option<UsageWindow>,
    pub seven_day: Option<UsageWindow>,
}

pub(super) enum UsageApiError {
    RateLimited(u64),
    Message(String),
}

impl From<UsageApiError> for String {
    fn from(err: UsageApiError) -> Self {
        match err {
            UsageApiError::RateLimited(retry_after) => shared::rate_limited(retry_after),
            UsageApiError::Message(message) => message,
        }
    }
}

pub(super) async fn fetch_usage(access_token: &str) -> Result<UsageWindows, UsageApiError> {
    let resp = reqwest::Client::new()
        .get(USAGE_URL)
        .bearer_auth(access_token)
        .header("anthropic-beta", OAUTH_BETA)
        .header("Content-Type", "application/json")
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| UsageApiError::Message(messages::usage_request_failed(e)))?;

    if resp.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
        return Err(UsageApiError::RateLimited(
            parse_retry_after(&resp).unwrap_or(DEFAULT_RETRY_SECS),
        ));
    }
    if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err(UsageApiError::Message(messages::UNAUTHORIZED.to_string()));
    }
    if !resp.status().is_success() {
        return Err(UsageApiError::Message(messages::api_error(resp.status())));
    }

    let api: ApiUsage = resp
        .json()
        .await
        .map_err(|e| UsageApiError::Message(shared::response_parse_failed(e)))?;

    Ok(UsageWindows {
        five_hour: api.five_hour.map(UsageWindow::from),
        seven_day: api.seven_day.map(UsageWindow::from),
    })
}

fn parse_retry_after(resp: &reqwest::Response) -> Option<u64> {
    parse_retry_after_value(resp.headers().get(reqwest::header::RETRY_AFTER)?.to_str().ok()?)
}

fn parse_retry_after_value(value: &str) -> Option<u64> {
    value.trim().parse::<u64>().ok().filter(|secs| *secs > 0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_retry_after_positive_filter() {
        assert_eq!(parse_retry_after_value("0"), None);
        assert_eq!(parse_retry_after_value("30"), Some(30));
    }

    #[test]
    fn api_window_maps_to_remaining() {
        let w = UsageWindow::from(ApiWindow {
            utilization: 28.0,
            resets_at: "2026-06-10T08:50:01Z".to_string(),
        });
        assert_eq!(w.used, 28.0);
        assert_eq!(w.remaining, 72.0);
    }
}
