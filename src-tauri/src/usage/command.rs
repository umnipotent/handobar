use crate::usage::api::{self, UsageApiError};
use crate::usage::cache::{self, FetchDecision};
use crate::usage::credentials::read_credentials;
use crate::usage::messages;
use crate::usage::models::{ClaudeUsage, UsageWindow};

pub async fn get_claude_usage(force: bool) -> Result<ClaudeUsage, String> {
    if !force {
        if let FetchDecision::UseCached(usage) = cache::before_fetch()? {
            return Ok(usage);
        }
    }

    let creds = read_credentials()?;
    if creds.expires_at < chrono::Utc::now().timestamp_millis() {
        return Err(messages::LOGIN_EXPIRED.to_string());
    }

    let api_usage = match api::fetch_usage(&creds.access_token).await {
        Ok(usage) => usage,
        Err(UsageApiError::RateLimited(retry_after)) => {
            return cache::remember_retry(retry_after);
        }
        Err(err) => return Err(String::from(err)),
    };

    let usage = ClaudeUsage {
        five_hour: api_usage.five_hour.map(UsageWindow::from),
        seven_day: api_usage.seven_day.map(UsageWindow::from),
        subscription: creds.subscription_type,
        fetched_at: chrono::Utc::now().to_rfc3339(),
        retry_after_secs: None,
    };

    cache::remember_success(&usage);
    Ok(usage)
}
