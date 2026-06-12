//! Antigravity OAuth 자격증명을 파일에서 읽는다.

use std::fs;
use std::path::PathBuf;
use std::time::SystemTime;
use serde::{Deserialize, Serialize};

use crate::usage::antigravity::messages;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub(super) struct OauthCreds {
    pub access_token: String,
    pub expiry_date: Option<f64>, // 밀리초 타임스탬프
    pub refresh_token: Option<String>,
}

fn creds_path() -> Result<PathBuf, String> {
    let home = std::env::var("HOME").map_err(|_| messages::HOME_NOT_FOUND.to_string())?;
    Ok(PathBuf::from(home)
        .join(".gemini")
        .join("oauth_creds.json"))
}

pub(super) fn read_credentials() -> Result<OauthCreds, String> {
    let path = creds_path()?;
    if !path.is_file() {
        return Err(messages::CREDENTIALS_NOT_FOUND.to_string());
    }
    let content = fs::read_to_string(&path).map_err(|e| format!("Antigravity 캐시 읽기 실패: {e}"))?;
    let creds: OauthCreds = serde_json::from_str(&content)
        .map_err(|e| format!("Antigravity 로그인 정보 파싱 실패: {e}"))?;
    Ok(creds)
}

/// 만료 검사 후 유효한 access_token을 반환한다.
pub(super) async fn get_valid_token() -> Result<String, String> {
    let creds = read_credentials()?;
    
    if let Some(expiry) = creds.expiry_date {
        let now_ms = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as f64;

        if expiry - now_ms < 0.0 {
            return Err("OAuth token expired. Please run a gemini command to refresh credentials.".to_string());
        }
    }

    Ok(creds.access_token)
}

