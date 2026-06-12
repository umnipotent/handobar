//! Antigravity 자체 사용량 API 게이트웨이.

use std::collections::BTreeMap;
use std::time::Duration;

use serde::Deserialize;

use crate::usage::antigravity::messages;

const HOST: &str = "https://daily-cloudcode-pa.googleapis.com";
const VERSION: &str = "1.0.0";

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub(super) struct LoadCodeAssistResponse {
    pub cloudaicompanion_project: Option<String>,
    pub current_tier: Option<Tier>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub(super) struct Tier {
    pub name: Option<String>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub(super) struct FetchAvailableModelsResponse {
    pub default_agent_model_id: Option<String>,
    pub agent_model_sorts: Option<Vec<AgentModelSort>>,
    pub models: Option<BTreeMap<String, ApiModel>>,
}

#[allow(dead_code)]
#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub(super) struct AgentModelSort {
    pub groups: Option<Vec<AgentModelSortGroup>>,
}

#[allow(dead_code)]
#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub(super) struct AgentModelSortGroup {
    pub model_ids: Option<Vec<String>>,
}

#[allow(dead_code)]
#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub(super) struct ApiModel {
    pub display_name: Option<String>,
    pub model: Option<String>,
    pub api_provider: Option<String>,
    pub model_provider: Option<String>,
    pub recommended: Option<bool>,
    pub quota_info: Option<QuotaInfo>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub(super) struct QuotaInfo {
    pub remaining_fraction: Option<f64>,
    pub reset_time: Option<String>,
}

pub(super) async fn load_code_assist(access_token: &str) -> Result<LoadCodeAssistResponse, String> {
    let body = serde_json::json!({
        "metadata": {
            "ideType": "ANTIGRAVITY",
            "platform": platform(),
            "updateChannel": "stable",
            "pluginType": "GEMINI",
        },
        "mode": "FULL_ELIGIBILITY_CHECK",
    });

    post_json(
        access_token,
        &format!("{HOST}/v1internal:loadCodeAssist"),
        body,
    )
    .await
}

pub(super) async fn fetch_available_models(
    access_token: &str,
    project: Option<&str>,
) -> Result<FetchAvailableModelsResponse, String> {
    let body = match project {
        Some(project) => serde_json::json!({ "project": project }),
        None => serde_json::json!({}),
    };

    post_json(
        access_token,
        &format!("{HOST}/v1internal:fetchAvailableModels"),
        body,
    )
    .await
}

async fn post_json<T: for<'de> Deserialize<'de>>(
    access_token: &str,
    url: &str,
    body: serde_json::Value,
) -> Result<T, String> {
    let resp = reqwest::Client::new()
        .post(url)
        .bearer_auth(access_token)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .header(reqwest::header::USER_AGENT, user_agent())
        .json(&body)
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(messages::api_request_failed)?;

    if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err(messages::UNAUTHORIZED.to_string());
    }
    if !resp.status().is_success() {
        return Err(messages::api_error(resp.status()));
    }

    resp.json().await.map_err(messages::api_request_failed)
}

fn user_agent() -> String {
    format!("antigravity/{VERSION} {}/{}", os(), arch())
}

fn os() -> &'static str {
    match std::env::consts::OS {
        "macos" => "darwin",
        "linux" => "linux",
        other if other.is_empty() => "darwin",
        _ => "darwin",
    }
}

fn arch() -> &'static str {
    match std::env::consts::ARCH {
        "aarch64" => "arm64",
        "x86_64" => "amd64",
        other if other.is_empty() => "arm64",
        _ => "arm64",
    }
}

fn platform() -> &'static str {
    match (os(), arch()) {
        ("darwin", "arm64") => "DARWIN_ARM64",
        ("darwin", "amd64") => "DARWIN_AMD64",
        ("linux", "amd64") => "LINUX_AMD64",
        _ => "PLATFORM_UNSPECIFIED",
    }
}
