//! Antigravity Google Cloud Code Companion Quota API 호출.

use serde::Deserialize;

use crate::usage::antigravity::messages;

#[allow(dead_code)]
#[derive(Deserialize, Debug, Clone)]
pub(super) struct ApiQuotaBucket {
    #[serde(rename = "modelId")]
    pub model_id: String,
    #[serde(rename = "remainingFraction")]
    pub remaining_fraction: f64,
    #[serde(rename = "resetTime")]
    pub reset_time: Option<String>,
    #[serde(rename = "tokenType")]
    pub token_type: Option<String>,
}


#[derive(Deserialize, Debug, Clone)]
pub(super) struct ApiQuotaResponse {
    pub buckets: Option<Vec<ApiQuotaBucket>>,
}

pub(super) async fn fetch_quota(access_token: &str, project_id: &str) -> Result<ApiQuotaResponse, String> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "project": project_id
    });

    let resp = client
        .post("https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota")
        .bearer_auth(access_token)
        .json(&body)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| messages::api_request_failed(e))?;

    if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err(messages::UNAUTHORIZED.to_string());
    }
    
    if !resp.status().is_success() {
        return Err(messages::api_error(resp.status()));
    }

    let quota_res: ApiQuotaResponse = resp
        .json()
        .await
        .map_err(|e| messages::api_request_failed(e))?;

    Ok(quota_res)
}
