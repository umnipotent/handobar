//! Provider 비종속 사용량 도메인 모델.
//!
//! Claude Code(네트워크+키체인)와 Codex(로컬 rollout 파일)는 출처가 다르지만,
//! 프론트에는 동일한 잔여 사용량 스냅샷 형태로 노출한다. 두 provider가 공유하는 타입을 둔다.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// 한 시간 윈도우의 **잔여** 사용량. 직렬화 필드명은 프론트 계약이므로 유지한다.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct UsageWindow {
    /// 잔여 비율(0~100).
    pub remaining: f64,
    /// 사용 비율(0~100).
    pub used: f64,
    /// 윈도우가 리셋되는 시각(RFC3339).
    pub resets_at: String,
}

impl UsageWindow {
    /// 사용률(0~100)과 리셋 시각으로 윈도우를 만든다. 잔여는 `100 - used` 를 0~100으로 clamp.
    pub fn from_used_percent(used: f64, resets_at: String) -> Self {
        UsageWindow {
            remaining: (100.0 - used).clamp(0.0, 100.0),
            used,
            resets_at,
        }
    }

    /// 리셋 시각(`resets_at`, RFC3339)이 `now` 기준 이미 지났으면 윈도우가 갱신된 것으로 보고
    /// 사용량을 0(잔여 100%)으로 만들고 리셋 시각을 비운다(새 윈도우 시각은 알 수 없음).
    /// `resets_at` 이 비어 있거나 RFC3339 파싱이 안 되면 그대로 둔다.
    ///
    /// provider 공통: Claude(API)·Codex(rollout) 모두 저장된 리셋 시각이 지난 구간을 같은 규칙으로 처리한다.
    pub fn reset_if_elapsed(self, now: DateTime<Utc>) -> Self {
        match DateTime::parse_from_rfc3339(&self.resets_at) {
            Ok(reset) if reset.with_timezone(&Utc) <= now => {
                UsageWindow::from_used_percent(0.0, String::new())
            }
            _ => self,
        }
    }
}

/// 프론트로 전달하는 잔여 사용량 스냅샷. Claude·Codex 공통.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct UsageSnapshot {
    pub five_hour: Option<UsageWindow>,
    pub seven_day: Option<UsageWindow>,
    pub subscription: Option<String>,
    pub model: Option<String>,
    /// fetch 시각(RFC3339).
    pub fetched_at: String,
    /// rate limit 중이면 남은 대기 초(있을 때만 직렬화). Codex는 항상 `None`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retry_after_secs: Option<u64>,
    /// API 실패 후 캐시 폴백으로 반환된 데이터임을 나타냄. false(기본)는 직렬화 생략.
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    #[serde(default)]
    pub is_stale: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn from_used_percent_computes_and_clamps_remaining() {
        let w = UsageWindow::from_used_percent(45.5, "2026-06-10T15:00:00Z".to_string());
        assert_eq!(w.used, 45.5);
        assert_eq!(w.remaining, 54.5);
        assert_eq!(w.resets_at, "2026-06-10T15:00:00Z");

        // 음수 사용률 → 잔여 100 clamp
        assert_eq!(
            UsageWindow::from_used_percent(-5.0, "t".to_string()).remaining,
            100.0
        );
        // 100% 초과 → 잔여 0 clamp
        assert_eq!(
            UsageWindow::from_used_percent(120.0, "t".to_string()).remaining,
            0.0
        );
    }

    fn at(rfc3339: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(rfc3339).unwrap().with_timezone(&Utc)
    }

    #[test]
    fn reset_if_elapsed_resets_passed_window() {
        let w = UsageWindow::from_used_percent(90.0, "2026-06-10T08:00:00Z".to_string());
        let after = w.reset_if_elapsed(at("2026-06-10T09:00:00Z"));
        assert_eq!(after.used, 0.0);
        assert_eq!(after.remaining, 100.0);
        assert_eq!(after.resets_at, "");
    }

    #[test]
    fn reset_if_elapsed_keeps_future_window() {
        let w = UsageWindow::from_used_percent(90.0, "2026-06-10T10:00:00Z".to_string());
        let after = w.clone().reset_if_elapsed(at("2026-06-10T09:00:00Z"));
        assert_eq!(after, w);
    }

    #[test]
    fn reset_if_elapsed_ignores_empty_or_unparsable() {
        let empty = UsageWindow::from_used_percent(90.0, String::new());
        assert_eq!(empty.clone().reset_if_elapsed(at("2026-06-10T09:00:00Z")), empty);

        let garbage = UsageWindow::from_used_percent(90.0, "not-a-date".to_string());
        assert_eq!(garbage.clone().reset_if_elapsed(at("2026-06-10T09:00:00Z")), garbage);
    }
}
