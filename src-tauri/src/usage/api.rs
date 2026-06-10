use std::time::Duration;

use crate::usage::messages;
use crate::usage::models::ApiUsage;

const USAGE_URL: &str = "https://api.anthropic.com/api/oauth/usage";
const OAUTH_BETA: &str = "oauth-2025-04-20";
const DEFAULT_RETRY_SECS: u64 = 60;

pub(super) enum UsageApiError {
    RateLimited(u64),
    Message(String),
}

impl From<UsageApiError> for String {
    fn from(err: UsageApiError) -> Self {
        match err {
            UsageApiError::RateLimited(retry_after) => messages::rate_limited(retry_after),
            UsageApiError::Message(message) => message,
        }
    }
}

pub(super) async fn fetch_usage(access_token: &str) -> Result<ApiUsage, UsageApiError> {
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

    resp.json()
        .await
        .map_err(|e| UsageApiError::Message(messages::response_parse_failed(e)))
}

fn parse_retry_after(resp: &reqwest::Response) -> Option<u64> {
    resp.headers()
        .get(reqwest::header::RETRY_AFTER)?
        .to_str()
        .ok()?
        .trim()
        .parse::<u64>()
        .ok()
}
