//! Antigravity 잔여 사용량 소스(로컬 cockpit quota 캐시).
//!
//! Antigravity는 `~/.antigravity_cockpit/cache/quota_api_v1*` 아래에 현재 모델의 `quotaInfo`
//! 스냅샷을 저장한다. 최신 캐시 파일을 읽어 현재 대표 모델의 잔여 사용량으로 변환한다.

use std::fs;
use std::path::{Path, PathBuf};

use serde_json::Value;

use crate::usage::antigravity::messages;
use crate::usage::model::{UsageSnapshot, UsageWindow};

const MAX_FILES_SCANNED: usize = 40;

pub(super) fn read_latest_snapshot() -> Result<UsageSnapshot, String> {
    let cache_root = cache_root()?;
    if !cache_root.is_dir() {
        return Err(messages::QUOTA_CACHE_NOT_FOUND.to_string());
    }

    let mut files = Vec::new();
    collect_quota_files(&cache_root, &mut files);
    if files.is_empty() {
        return Err(messages::QUOTA_CACHE_NOT_FOUND.to_string());
    }

    files.sort_by_key(|(_, mtime)| std::cmp::Reverse(*mtime));

    let now = chrono::Utc::now();
    for (path, _) in files.into_iter().take(MAX_FILES_SCANNED) {
        match read_snapshot_from_file(&path, now) {
            Ok(Some(snapshot)) => return Ok(snapshot),
            Ok(None) => continue,
            Err(err) => {
                eprintln!(
                    "[handobar][antigravity] 캐시 읽기 실패: {} ({err})",
                    path.display()
                );
            }
        }
    }

    Err(messages::QUOTA_NOT_FOUND.to_string())
}

fn cache_root() -> Result<PathBuf, String> {
    let home = std::env::var("HOME").map_err(|_| messages::HOME_NOT_FOUND.to_string())?;
    Ok(PathBuf::from(home)
        .join(".antigravity_cockpit")
        .join("cache"))
}

fn collect_quota_files(dir: &Path, out: &mut Vec<(PathBuf, std::time::SystemTime)>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_quota_files(&path, out);
            continue;
        }

        if !is_quota_snapshot_file(&path) {
            continue;
        }

        if let Ok(mtime) = entry.metadata().and_then(|m| m.modified()) {
            out.push((path, mtime));
        }
    }
}

fn is_quota_snapshot_file(path: &Path) -> bool {
    path.extension().and_then(|s| s.to_str()) == Some("json")
        && path
            .components()
            .any(|component| matches!(component.as_os_str().to_str(), Some(part) if part.starts_with("quota_api_v1")))
}

fn read_snapshot_from_file(
    path: &Path,
    now: chrono::DateTime<chrono::Utc>,
) -> Result<Option<UsageSnapshot>, String> {
    let content = fs::read_to_string(path).map_err(messages::read_failed)?;
    let value: Value = serde_json::from_str(&content).map_err(messages::read_failed)?;
    Ok(extract_snapshot(&value, now))
}

fn extract_snapshot(value: &Value, now: chrono::DateTime<chrono::Utc>) -> Option<UsageSnapshot> {
    let payload = value.get("payload")?;
    let default_model_id = payload.get("defaultAgentModelId")?.as_str()?;
    let models = payload.get("models")?.as_object()?;
    let model = models.get(default_model_id)?;
    let quota_info = model.get("quotaInfo")?.as_object()?;
    let remaining_fraction = quota_info.get("remainingFraction")?.as_f64()?;
    let resets_at = quota_info
        .get("resetTime")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();

    let model_name = model
        .get("displayName")
        .and_then(|value| value.as_str())
        .unwrap_or(default_model_id)
        .to_string();
    let model_tags = derive_model_tags(models);

    let remaining = (remaining_fraction * 100.0).clamp(0.0, 100.0);
    let used = (100.0 - remaining).clamp(0.0, 100.0);
    let window = UsageWindow::from_used_percent(used, resets_at).reset_if_elapsed(now);

    Some(UsageSnapshot {
        five_hour: Some(window),
        seven_day: None,
        subscription: None,
        model: Some(model_name),
        model_tags,
        fetched_at: now.to_rfc3339(),
        retry_after_secs: None,
        is_stale: false,
    })
}

fn derive_model_tags(models: &serde_json::Map<String, Value>) -> Option<Vec<String>> {
    let mut has_gemini = false;
    let mut has_non_gemini = false;

    for (model_id, value) in models {
        if value.get("quotaInfo").is_none() {
            continue;
        }

        let display_name = value.get("displayName").and_then(|value| value.as_str());
        if is_gemini_model(model_id, display_name) {
            has_gemini = true;
        } else {
            has_non_gemini = true;
        }
    }

    let mut tags = Vec::new();
    if has_gemini {
        tags.push("Gemini 계열".to_string());
    }
    if has_non_gemini {
        tags.push("비 Gemini 계열".to_string());
    }

    if tags.is_empty() {
        None
    } else {
        Some(tags)
    }
}

fn is_gemini_model(model_id: &str, display_name: Option<&str>) -> bool {
    model_id.starts_with("gemini-")
        || display_name
            .map(|name| name.trim_start().starts_with("Gemini"))
            .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(rfc3339: &str) -> chrono::DateTime<chrono::Utc> {
        chrono::DateTime::parse_from_rfc3339(rfc3339)
            .unwrap()
            .with_timezone(&chrono::Utc)
    }

    #[test]
    fn extracts_default_model_quota_from_api_v1_snapshot() {
        let json = r#"{
            "version": 1,
            "source": "authorized",
            "payload": {
                "defaultAgentModelId": "gemini-3.5-flash-low",
                "models": {
                    "gemini-3.5-flash-low": {
                        "displayName": "Gemini 3.5 Flash (Medium)",
                        "quotaInfo": {
                            "remainingFraction": 0.8,
                            "resetTime": "2026-06-05T06:27:09Z"
                        }
                    }
                }
            }
        }"#;
        let value: Value = serde_json::from_str(json).unwrap();
        let snapshot = extract_snapshot(&value, at("2026-06-04T00:00:00Z")).unwrap();

        let five_hour = snapshot.five_hour.unwrap();
        assert_eq!(snapshot.model.as_deref(), Some("Gemini 3.5 Flash (Medium)"));
        assert_eq!(five_hour.used, 20.0);
        assert_eq!(five_hour.remaining, 80.0);
        assert_eq!(five_hour.resets_at, "2026-06-05T06:27:09Z");
        assert!(snapshot.seven_day.is_none());
    }

    #[test]
    fn resets_elapsed_window_to_fresh_state() {
        let json = r#"{
            "payload": {
                "defaultAgentModelId": "gemini-3.5-flash-low",
                "models": {
                    "gemini-3.5-flash-low": {
                        "displayName": "Gemini 3.5 Flash (Medium)",
                        "quotaInfo": {
                            "remainingFraction": 0.4,
                            "resetTime": "2026-06-04T00:00:00Z"
                        }
                    }
                }
            }
        }"#;
        let value: Value = serde_json::from_str(json).unwrap();
        let snapshot = extract_snapshot(&value, at("2026-06-04T01:00:00Z")).unwrap();
        let five_hour = snapshot.five_hour.unwrap();
        assert_eq!(five_hour.used, 0.0);
        assert_eq!(five_hour.remaining, 100.0);
        assert_eq!(five_hour.resets_at, "");
    }
}
