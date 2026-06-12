//! Antigravity 잔여 사용량 API 응답 변환기.

use crate::usage::model::{UsageSnapshot, UsageWindow};
use crate::usage::antigravity::api::ApiQuotaResponse;

pub(super) fn convert_quota_response(live: &ApiQuotaResponse) -> Result<UsageSnapshot, String> {
    let now = chrono::Utc::now();
    
    let mut flash_window = None;
    let mut pro_window = None;
    let mut model_name = String::from("Gemini");
    
    if let Some(buckets) = &live.buckets {
        for bucket in buckets {
            let remaining = (bucket.remaining_fraction * 100.0).clamp(0.0, 100.0);
            let used = (100.0 - remaining).clamp(0.0, 100.0);
            let resets_at = bucket.reset_time.clone().unwrap_or_default();
            
            let window = UsageWindow::from_used_percent(used, resets_at).reset_if_elapsed(now);
            
            if bucket.model_id.contains("flash") {
                flash_window = Some(window);
                model_name = bucket.model_id.clone();
            } else if bucket.model_id.contains("pro") {
                pro_window = Some(window);
                if flash_window.is_none() {
                    model_name = bucket.model_id.clone();
                }
            }
        }
    }
    
    if flash_window.is_none() && pro_window.is_none() {
        return Err("No valid Gemini model quotas found in API response".to_string());
    }
    
    Ok(UsageSnapshot {
        five_hour: flash_window,
        seven_day: pro_window,
        subscription: Some("Authorized".to_string()),
        model: Some(model_name),
        model_tags: None,
        fetched_at: now.to_rfc3339(),
        retry_after_secs: None,
        is_stale: false,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::usage::antigravity::api::ApiQuotaBucket;

    #[test]
    fn test_convert_quota_response() {
        let live = ApiQuotaResponse {
            buckets: Some(vec![
                ApiQuotaBucket {
                    model_id: "gemini-2.5-flash".to_string(),
                    remaining_fraction: 0.6,
                    reset_time: Some("2026-06-13T11:31:03Z".to_string()),
                    token_type: Some("REQUESTS".to_string()),
                },
                ApiQuotaBucket {
                    model_id: "gemini-2.5-pro".to_string(),
                    remaining_fraction: 0.0,
                    reset_time: Some("2026-06-13T11:30:52Z".to_string()),
                    token_type: Some("REQUESTS".to_string()),
                },
            ]),
        };

        let snapshot = convert_quota_response(&live).unwrap();
        
        let flash = snapshot.five_hour.unwrap();
        assert_eq!(flash.remaining, 60.0);
        assert_eq!(flash.used, 40.0);
        assert_eq!(flash.resets_at, "2026-06-13T11:31:03Z");

        let pro = snapshot.seven_day.unwrap();
        assert_eq!(pro.remaining, 0.0);
        assert_eq!(pro.used, 100.0);
        assert_eq!(pro.resets_at, "2026-06-13T11:30:52Z");

        assert_eq!(snapshot.model.as_deref(), Some("gemini-2.5-flash"));
    }
}
