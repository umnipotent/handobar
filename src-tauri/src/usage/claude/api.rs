//! Claude Code OAuth 사용량 엔드포인트 게이트웨이.
//!
//! `GET /api/oauth/usage` 응답(`utilization`)을 공유 도메인 `UsageWindow`(잔여) 로 매핑한다.

use std::time::Duration;

use serde::Deserialize;

use crate::usage::claude::messages;
use crate::usage::messages as shared;
use crate::usage::model::{UsageWindow, WindowRole};

const USAGE_URL: &str = "https://api.anthropic.com/api/oauth/usage";
const OAUTH_BETA: &str = "oauth-2025-04-20";
pub(super) const DEFAULT_RETRY_SECS: u64 = 60;

// API 응답에서 사용하는 User-Agent (429 방지).
const USER_AGENT: &str = "claude-code/1.0.0";

/// 엔드포인트 응답의 한 윈도우(사용률 기반).
/// `utilization`이 null로 내려오는 경우(e.g. extra_usage)를 Option으로 수용.
#[derive(Deserialize, Debug)]
struct ApiWindow {
    utilization: Option<f64>,
    resets_at: Option<String>,
}

impl TryFrom<ApiWindow> for UsageWindow {
    type Error = ();

    fn try_from(w: ApiWindow) -> Result<Self, Self::Error> {
        match (w.utilization, w.resets_at) {
            (Some(utilization), Some(resets_at)) => {
                Ok(UsageWindow::from_used_percent(utilization, resets_at))
            }
            _ => Err(()),
        }
    }
}

/// API 최상위 응답 구조.
/// `#[serde(deny_unknown_fields)]` 를 쓰지 않아 미지 필드(extra_usage 등)가 추가돼도 파싱 실패 없음.
#[derive(Deserialize, Debug)]
struct ApiUsage {
    five_hour: Option<ApiWindow>,
    seven_day: Option<ApiWindow>,
}

/// fetch 성공 시 두 윈도우(잔여)로 변환해 반환.
pub(super) struct UsageWindows {
    pub five_hour: UsageWindow,
    pub seven_day: UsageWindow,
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
        .header(reqwest::header::USER_AGENT, USER_AGENT)
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

    // 파싱 실패 시 원본 body를 로그에 남겨 디버깅을 돕는다.
    let body = resp
        .text()
        .await
        .map_err(|e| UsageApiError::Message(shared::response_read_failed(e)))?;

    let api: ApiUsage = serde_json::from_str(&body).map_err(|e| {
        eprintln!("[handobar][claude] 응답 파싱 실패. body={body}");
        UsageApiError::Message(shared::response_parse_failed(e))
    })?;

    Ok(UsageWindows {
        five_hour: api_window(
            "five_hour",
            WindowRole::Session,
            api.five_hour.and_then(|w| UsageWindow::try_from(w).ok()),
        ),
        seven_day: api_window(
            "seven_day",
            WindowRole::Long,
            api.seven_day.and_then(|w| UsageWindow::try_from(w).ok()),
        ),
    })
}

fn api_window(id: &str, role: WindowRole, window: Option<UsageWindow>) -> UsageWindow {
    let (used, resets_at) = window
        .map(|w| (w.used, w.resets_at))
        .unwrap_or_else(|| (0.0, String::new()));
    UsageWindow::new(id, role, used, resets_at, None)
}

fn parse_retry_after(resp: &reqwest::Response) -> Option<u64> {
    parse_retry_after_value(
        resp.headers()
            .get(reqwest::header::RETRY_AFTER)?
            .to_str()
            .ok()?,
    )
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
        let w = UsageWindow::try_from(ApiWindow {
            utilization: Some(28.0),
            resets_at: Some("2026-06-10T08:50:01Z".to_string()),
        })
        .unwrap();
        assert_eq!(w.used, 28.0);
        assert_eq!(w.remaining, 72.0);
        assert_eq!(w.role, WindowRole::Other);
    }

    #[test]
    fn api_window_null_utilization_returns_err() {
        let result = UsageWindow::try_from(ApiWindow {
            utilization: None,
            resets_at: Some("2026-06-10T08:50:01Z".to_string()),
        });
        assert!(result.is_err());
    }

    #[test]
    fn api_usage_ignores_extra_fields() {
        // extra_usage 같은 미지 필드가 포함된 응답도 파싱 성공해야 한다.
        let json = r#"{
            "five_hour": {"utilization": 33.0, "resets_at": "2026-04-11T07:00:00Z"},
            "seven_day": {"utilization": 13.0, "resets_at": "2026-04-17T00:59:59Z"},
            "seven_day_opus": null,
            "seven_day_sonnet": {"utilization": 1.0, "resets_at": "2026-04-16T03:00:00Z"},
            "extra_usage": {"is_enabled": false, "monthly_limit": null, "used_credits": null, "utilization": null}
        }"#;
        let api: ApiUsage = serde_json::from_str(json).expect("파싱 성공해야 함");
        assert!(api.five_hour.is_some());
        assert!(api.seven_day.is_some());
    }

    #[test]
    fn api_window_null_maps_to_fresh_usage() {
        let w = api_window("five_hour", WindowRole::Session, None);

        assert_eq!(w.id, "five_hour");
        assert_eq!(w.role, WindowRole::Session);
        assert_eq!(w.used, 0.0);
        assert_eq!(w.remaining, 100.0);
        assert_eq!(w.resets_at, "");
    }
}
