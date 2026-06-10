use serde::{Deserialize, Serialize};

#[derive(Deserialize, Debug)]
pub(super) struct ApiWindow {
    pub utilization: f64,
    pub resets_at: String,
}

#[derive(Deserialize, Debug)]
pub(super) struct ApiUsage {
    pub five_hour: Option<ApiWindow>,
    pub seven_day: Option<ApiWindow>,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct UsageWindow {
    pub remaining: f64,
    pub used: f64,
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

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct ClaudeUsage {
    pub five_hour: Option<UsageWindow>,
    pub seven_day: Option<UsageWindow>,
    pub subscription: Option<String>,
    pub fetched_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retry_after_secs: Option<u64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_usage_window_from_api_window() {
        // Normal case
        let api_w = ApiWindow {
            utilization: 45.5,
            resets_at: "2026-06-10T15:00:00Z".to_string(),
        };
        let usage_w = UsageWindow::from(api_w);
        assert_eq!(usage_w.used, 45.5);
        assert_eq!(usage_w.remaining, 54.5);
        assert_eq!(usage_w.resets_at, "2026-06-10T15:00:00Z");

        // Under 0% utilization (remaining should be clamped to 100.0)
        let api_w_negative = ApiWindow {
            utilization: -5.0,
            resets_at: "2026-06-10T15:00:00Z".to_string(),
        };
        let usage_w_negative = UsageWindow::from(api_w_negative);
        assert_eq!(usage_w_negative.used, -5.0);
        assert_eq!(usage_w_negative.remaining, 100.0);

        // Over 100% utilization (remaining should be clamped to 0.0)
        let api_w_over = ApiWindow {
            utilization: 120.0,
            resets_at: "2026-06-10T15:00:00Z".to_string(),
        };
        let usage_w_over = UsageWindow::from(api_w_over);
        assert_eq!(usage_w_over.used, 120.0);
        assert_eq!(usage_w_over.remaining, 0.0);
    }
}
