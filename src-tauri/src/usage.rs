//! Claude Code 잔여 사용량 fetch.
//!
//! 로컬 로그를 파싱하는 대신 Claude의 OAuth 사용량 엔드포인트를 직접 호출한다.
//! 인증은 이미 로그인된 Claude Code의 자격증명을 **OS 키체인**에서 읽어 재사용한다
//! (별도 로그인 불필요, 토큰 갱신은 Claude Code가 담당).
//!
//! - 엔드포인트: `GET https://api.anthropic.com/api/oauth/usage`
//! - 응답의 `utilization`(0~100, 사용률)에서 **잔여 = 100 - utilization** 을 계산한다.
//! - Claude Code 사용량만 대상이며 Codex·Antigravity 등 다른 도구는 포함하지 않는다.
//!
//! 이 엔드포인트는 자체 rate limit이 있어 과도하게 호출하면 `429 (Retry-After)` 를 준다.
//! 따라서 프로세스 전역 캐시로 (1) 짧은 간격의 중복 호출을 합치고,
//! (2) 429를 받으면 `Retry-After` 동안 네트워크 호출을 멈추고 마지막 값을 반환한다.

use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};

const USAGE_URL: &str = "https://api.anthropic.com/api/oauth/usage";
const KEYCHAIN_SERVICE: &str = "Claude Code-credentials";
const OAUTH_BETA: &str = "oauth-2025-04-20";

/// 동일 호출이 짧은 시간에 몰릴 때(마운트·트레이·타이머 동시) 마지막 값을 재사용하는 최소 간격.
const MIN_SPACING: Duration = Duration::from_secs(10);
/// 429 응답에 `Retry-After` 가 없을 때의 기본 대기.
const DEFAULT_RETRY_SECS: u64 = 60;

/// 키체인에 저장된 Claude Code 자격증명(JSON).
#[derive(Deserialize)]
struct StoredCredentials {
    #[serde(rename = "claudeAiOauth")]
    oauth: OauthTokens,
}

#[derive(Deserialize)]
struct OauthTokens {
    #[serde(rename = "accessToken")]
    access_token: String,
    #[serde(rename = "expiresAt")]
    expires_at: i64,
    #[serde(rename = "subscriptionType")]
    subscription_type: Option<String>,
}

/// `/api/oauth/usage` 응답의 한 윈도우.
#[derive(Deserialize)]
struct ApiWindow {
    utilization: f64,
    resets_at: String,
}

#[derive(Deserialize)]
struct ApiUsage {
    five_hour: Option<ApiWindow>,
    seven_day: Option<ApiWindow>,
}

/// 프론트로 전달하는 한 윈도우의 **잔여** 사용량.
#[derive(Serialize, Clone)]
pub struct UsageWindow {
    /// 잔여 비율(0~100).
    pub remaining: f64,
    /// 사용 비율(0~100).
    pub used: f64,
    /// 윈도우가 리셋되는 시각(RFC3339).
    pub resets_at: String,
}

impl From<ApiWindow> for UsageWindow {
    fn from(w: ApiWindow) -> Self {
        UsageWindow {
            remaining: (100.0 - w.utilization).clamp(0.0, 100.0),
            used: w.utilization,
            resets_at: w.resets_at,
        }
    }
}

/// 프론트로 전달하는 잔여 사용량 스냅샷.
#[derive(Serialize, Clone)]
pub struct ClaudeUsage {
    pub five_hour: Option<UsageWindow>,
    pub seven_day: Option<UsageWindow>,
    pub subscription: Option<String>,
    /// fetch 시각(RFC3339).
    pub fetched_at: String,
    /// rate limit 중이면 남은 대기 초. 이 경우 윈도우 값은 마지막으로 받은 값(stale)이다.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retry_after_secs: Option<u64>,
}

/// 프로세스 전역 캐시.
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

/// 마지막 값에 `retry_after_secs` 를 실어 반환한다. 캐시가 비어 있으면 에러 메시지.
fn stale_or_error(cache: &Cache, retry_after: u64) -> Result<ClaudeUsage, String> {
    match &cache.last {
        Some(last) => {
            let mut snapshot = last.clone();
            snapshot.retry_after_secs = Some(retry_after);
            Ok(snapshot)
        }
        None => Err(format!(
            "요청이 제한되었습니다(429). {retry_after}초 후 자동으로 다시 시도합니다."
        )),
    }
}

/// 현재 OS 사용자 이름(키체인 account 키).
fn current_user() -> Result<String, String> {
    std::env::var("USER")
        .or_else(|_| std::env::var("USERNAME"))
        .map_err(|_| "현재 사용자 이름을 확인할 수 없습니다".to_string())
}

/// 키체인에서 Claude Code OAuth 토큰을 읽는다.
fn read_credentials() -> Result<OauthTokens, String> {
    let user = current_user()?;
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, &user).map_err(|e| e.to_string())?;
    let secret = entry.get_password().map_err(|_| {
        "Claude Code 로그인 정보를 찾을 수 없습니다. 터미널에서 `claude` 로 로그인하세요.".to_string()
    })?;
    let creds: StoredCredentials =
        serde_json::from_str(&secret).map_err(|e| format!("자격증명 파싱 실패: {e}"))?;
    Ok(creds.oauth)
}

/// 429 응답의 `Retry-After`(초)를 파싱한다.
fn parse_retry_after(resp: &reqwest::Response) -> Option<u64> {
    resp.headers()
        .get(reqwest::header::RETRY_AFTER)?
        .to_str()
        .ok()?
        .trim()
        .parse::<u64>()
        .ok()
}

/// 잔여 사용량을 직접 fetch한다. 실패 시 사용자에게 보여줄 한국어 메시지를 반환한다.
#[tauri::command]
pub async fn get_claude_usage() -> Result<ClaudeUsage, String> {
    // 1) rate limit / 중복 호출 가드. 잠금은 await 이전에 반드시 해제한다.
    {
        let cache = CACHE.lock().unwrap();
        if let Some(until) = cache.retry_until {
            if let Some(remaining) = until.checked_duration_since(Instant::now()) {
                return stale_or_error(&cache, remaining.as_secs().max(1));
            }
        }
        if let (Some(ts), Some(last)) = (cache.last_success, cache.last.as_ref()) {
            if ts.elapsed() < MIN_SPACING {
                return Ok(last.clone());
            }
        }
    }

    let creds = read_credentials()?;
    if creds.expires_at < chrono::Utc::now().timestamp_millis() {
        return Err("로그인이 만료되었습니다. Claude Code에서 다시 로그인하세요.".to_string());
    }

    let resp = reqwest::Client::new()
        .get(USAGE_URL)
        .bearer_auth(&creds.access_token)
        .header("anthropic-beta", OAUTH_BETA)
        .header("Content-Type", "application/json")
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("사용량 요청 실패: {e}"))?;

    if resp.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
        let retry_after = parse_retry_after(&resp).unwrap_or(DEFAULT_RETRY_SECS);
        let mut cache = CACHE.lock().unwrap();
        cache.retry_until = Some(Instant::now() + Duration::from_secs(retry_after));
        return stale_or_error(&cache, retry_after);
    }
    if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err("인증에 실패했습니다(토큰 만료/무효). Claude Code에서 다시 로그인하세요.".to_string());
    }
    if !resp.status().is_success() {
        return Err(format!("API 오류: {}", resp.status()));
    }

    let api: ApiUsage = resp
        .json()
        .await
        .map_err(|e| format!("응답 파싱 실패: {e}"))?;

    let usage = ClaudeUsage {
        five_hour: api.five_hour.map(UsageWindow::from),
        seven_day: api.seven_day.map(UsageWindow::from),
        subscription: creds.subscription_type,
        fetched_at: chrono::Utc::now().to_rfc3339(),
        retry_after_secs: None,
    };

    let mut cache = CACHE.lock().unwrap();
    cache.last = Some(usage.clone());
    cache.last_success = Some(Instant::now());
    cache.retry_until = None;

    Ok(usage)
}
