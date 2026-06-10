//! Claude Code OAuth 자격증명을 OS 키체인에서 읽는다(인증 게이트웨이).

use serde::Deserialize;

use crate::usage::claude::messages;

const KEYCHAIN_SERVICE: &str = "Claude Code-credentials";

#[derive(Deserialize)]
struct StoredCredentials {
    #[serde(rename = "claudeAiOauth")]
    oauth: OauthTokens,
}

#[derive(Deserialize)]
pub(super) struct OauthTokens {
    #[serde(rename = "accessToken")]
    pub access_token: String,
    #[serde(rename = "expiresAt")]
    pub expires_at: i64,
    #[serde(rename = "subscriptionType")]
    pub subscription_type: Option<String>,
}

pub(super) fn read_credentials() -> Result<OauthTokens, String> {
    let user = current_user()?;
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, &user).map_err(|e| e.to_string())?;
    let secret = entry
        .get_password()
        .map_err(|_| messages::CREDENTIALS_NOT_FOUND.to_string())?;
    let creds: StoredCredentials =
        serde_json::from_str(&secret).map_err(messages::credentials_parse_failed)?;
    Ok(creds.oauth)
}

fn current_user() -> Result<String, String> {
    std::env::var("USER")
        .or_else(|_| std::env::var("USERNAME"))
        .map_err(|_| messages::CURRENT_USER_NOT_FOUND.to_string())
}
