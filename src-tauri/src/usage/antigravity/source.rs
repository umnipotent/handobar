//! Antigravity 모델 목록 응답을 공유 사용량 스냅샷으로 변환한다.

use std::collections::{BTreeMap, HashMap};

use chrono::Utc;

use crate::usage::antigravity::api::ApiModel;
use crate::usage::model::{UsageSnapshot, UsageWindow};

const API_PROVIDER_GEMINI: &str = "API_PROVIDER_GOOGLE_GEMINI";
const API_PROVIDER_INTERNAL: &str = "API_PROVIDER_INTERNAL";

pub(super) fn convert(
    models: &BTreeMap<String, ApiModel>,
    default_agent_model_id: Option<&str>,
    model_priority: &[String],
    tier_name: Option<String>,
) -> Result<UsageSnapshot, String> {
    let now = Utc::now();
    let priority_ranks = priority_ranks(default_agent_model_id, model_priority);
    let gemini = pick_representative(
        models
            .iter()
            .filter(|(_, model)| model.api_provider.as_deref() == Some(API_PROVIDER_GEMINI)),
        &priority_ranks,
    );
    let third_party = pick_representative(
        models.iter().filter(|(_, model)| {
            model.display_name.is_some()
                && model.api_provider.as_deref() != Some(API_PROVIDER_GEMINI)
                && model.api_provider.as_deref() != Some(API_PROVIDER_INTERNAL)
        }),
        &priority_ranks,
    );

    if gemini.is_none() && third_party.is_none() {
        return Err("Antigravity 사용량을 확인할 대표 모델을 찾을 수 없습니다".to_string());
    }

    let five_hour = gemini
        .map(|(_, model)| usage_window(model, now))
        .unwrap_or(None);
    let seven_day = third_party
        .map(|(_, model)| usage_window(model, now))
        .unwrap_or(None);
    let model_name = gemini.and_then(|(_, model)| model.display_name.clone());
    let third_party_name = third_party.and_then(|(_, model)| model.display_name.clone());

    Ok(UsageSnapshot {
        five_hour,
        seven_day,
        subscription: tier_name.or_else(|| Some("Authorized".to_string())),
        model: model_name,
        model_tags: third_party_name.map(|name| vec![name]),
        fetched_at: now.to_rfc3339(),
        retry_after_secs: None,
        is_stale: false,
    })
}

fn priority_ranks(
    default_agent_model_id: Option<&str>,
    model_priority: &[String],
) -> HashMap<String, usize> {
    let mut ranks = HashMap::new();
    if let Some(model_id) = default_agent_model_id {
        ranks.insert(model_id.to_string(), 0);
    }

    let mut next_rank = 1;
    for model_id in model_priority {
        if !ranks.contains_key(model_id) {
            ranks.insert(model_id.clone(), next_rank);
            next_rank += 1;
        }
    }

    ranks
}

fn pick_representative<'a, I>(
    models: I,
    priority_ranks: &HashMap<String, usize>,
) -> Option<(&'a String, &'a ApiModel)>
where
    I: Iterator<Item = (&'a String, &'a ApiModel)>,
{
    models
        .filter(|(_, model)| model.display_name.is_some())
        .min_by_key(|(model_key, model)| {
            (
                if has_quota_info(model) { 0 } else { 1 },
                priority_ranks
                    .get(model_key.as_str())
                    .copied()
                    .unwrap_or(usize::MAX),
                model_key.as_str(),
            )
        })
}

fn has_quota_info(model: &ApiModel) -> bool {
    model.quota_info.is_some()
}

fn usage_window(model: &ApiModel, now: chrono::DateTime<Utc>) -> Option<UsageWindow> {
    let quota = model.quota_info.as_ref()?;
    let remaining_fraction = quota.remaining_fraction.unwrap_or(0.0);
    let used = 100.0 - (remaining_fraction * 100.0);
    Some(
        UsageWindow::from_used_percent(used, quota.reset_time.clone().unwrap_or_default())
            .reset_if_elapsed(now),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::usage::antigravity::api::QuotaInfo;

    fn model(
        display_name: Option<&str>,
        api_provider: &str,
        recommended: Option<bool>,
        remaining_fraction: Option<f64>,
        reset_time: Option<&str>,
    ) -> ApiModel {
        ApiModel {
            display_name: display_name.map(str::to_string),
            model: None,
            api_provider: Some(api_provider.to_string()),
            model_provider: None,
            recommended,
            quota_info: Some(QuotaInfo {
                remaining_fraction,
                reset_time: reset_time.map(str::to_string),
            }),
        }
    }

    fn model_without_quota(
        display_name: Option<&str>,
        api_provider: &str,
        recommended: Option<bool>,
    ) -> ApiModel {
        ApiModel {
            display_name: display_name.map(str::to_string),
            model: None,
            api_provider: Some(api_provider.to_string()),
            model_provider: None,
            recommended,
            quota_info: None,
        }
    }

    #[test]
    fn groups_models_and_selects_recommended_with_quota() {
        let mut models = BTreeMap::new();
        models.insert(
            "gemini-a".to_string(),
            model_without_quota(Some("Gemini A"), API_PROVIDER_GEMINI, Some(true)),
        );
        models.insert(
            "gemini-b".to_string(),
            model(
                Some("Gemini B"),
                API_PROVIDER_GEMINI,
                Some(true),
                Some(0.72),
                Some("2999-06-13T00:00:00Z"),
            ),
        );
        models.insert(
            "third-a".to_string(),
            model(
                Some("Third A"),
                "API_PROVIDER_ANTHROPIC",
                Some(false),
                Some(0.25),
                Some("2999-06-14T00:00:00Z"),
            ),
        );
        models.insert(
            "internal".to_string(),
            model(
                Some("Internal"),
                API_PROVIDER_INTERNAL,
                Some(true),
                Some(1.0),
                Some("2999-06-14T00:00:00Z"),
            ),
        );
        models.insert(
            "no-display".to_string(),
            model(
                None,
                "API_PROVIDER_ANTHROPIC",
                Some(true),
                Some(1.0),
                Some("2999-06-14T00:00:00Z"),
            ),
        );

        let snapshot = convert(&models, None, &[], Some("Pro".to_string())).unwrap();

        let five_hour = snapshot.five_hour.unwrap();
        assert_eq!(five_hour.remaining, 72.0);
        assert_eq!(five_hour.used, 28.0);
        assert_eq!(five_hour.resets_at, "2999-06-13T00:00:00Z");

        let seven_day = snapshot.seven_day.unwrap();
        assert_eq!(seven_day.remaining, 25.0);
        assert_eq!(seven_day.used, 75.0);
        assert_eq!(seven_day.resets_at, "2999-06-14T00:00:00Z");

        assert_eq!(snapshot.model.as_deref(), Some("Gemini B"));
        assert_eq!(snapshot.model_tags, Some(vec!["Third A".to_string()]));
        assert_eq!(snapshot.subscription.as_deref(), Some("Pro"));
    }

    #[test]
    fn default_agent_model_id_selects_gemini_representative_before_alphabetical_order() {
        let mut models = BTreeMap::new();
        models.insert(
            "gemini-2.5-pro".to_string(),
            model(
                Some("Gemini 2.5 Pro"),
                API_PROVIDER_GEMINI,
                Some(true),
                Some(0.42),
                Some("2999-06-13T00:00:00Z"),
            ),
        );
        models.insert(
            "gemini-3.5-flash-low".to_string(),
            model(
                Some("Gemini 3.5 Flash (Medium)"),
                API_PROVIDER_GEMINI,
                Some(true),
                Some(0.84),
                Some("2999-06-13T00:00:00Z"),
            ),
        );
        models.insert(
            "gemini-3-flash-agent".to_string(),
            model(
                Some("Gemini 3 Flash"),
                API_PROVIDER_GEMINI,
                Some(true),
                Some(0.63),
                Some("2999-06-13T00:00:00Z"),
            ),
        );

        let priority = vec![
            "gemini-3-flash-agent".to_string(),
            "gemini-2.5-pro".to_string(),
        ];
        let snapshot = convert(&models, Some("gemini-3.5-flash-low"), &priority, None).unwrap();

        assert_eq!(snapshot.model.as_deref(), Some("Gemini 3.5 Flash (Medium)"));
        assert_eq!(snapshot.five_hour.unwrap().remaining, 84.0);
    }

    #[test]
    fn priority_order_selects_third_party_representative_when_default_is_absent() {
        let mut models = BTreeMap::new();
        models.insert(
            "claude-opus-4-6-thinking".to_string(),
            model(
                Some("Claude Opus 4.6 (Thinking)"),
                "API_PROVIDER_ANTHROPIC",
                Some(true),
                Some(0.31),
                Some("2999-06-14T00:00:00Z"),
            ),
        );
        models.insert(
            "claude-sonnet-4-6".to_string(),
            model(
                Some("Claude Sonnet 4.6 (Thinking)"),
                "API_PROVIDER_ANTHROPIC",
                Some(true),
                Some(0.66),
                Some("2999-06-14T00:00:00Z"),
            ),
        );

        let priority = vec![
            "claude-sonnet-4-6".to_string(),
            "claude-opus-4-6-thinking".to_string(),
        ];
        let snapshot = convert(&models, Some("missing-model"), &priority, None).unwrap();

        assert_eq!(
            snapshot.model_tags,
            Some(vec!["Claude Sonnet 4.6 (Thinking)".to_string()])
        );
        assert_eq!(snapshot.seven_day.unwrap().remaining, 66.0);
    }

    #[test]
    fn quota_info_is_preferred_over_higher_priority_without_quota() {
        let mut models = BTreeMap::new();
        models.insert(
            "gemini-3.5-flash-low".to_string(),
            model_without_quota(
                Some("Gemini 3.5 Flash (Medium)"),
                API_PROVIDER_GEMINI,
                Some(true),
            ),
        );
        models.insert(
            "gemini-2.5-pro".to_string(),
            model(
                Some("Gemini 2.5 Pro"),
                API_PROVIDER_GEMINI,
                Some(true),
                Some(0.5),
                Some("2999-06-13T00:00:00Z"),
            ),
        );

        let priority = vec!["gemini-2.5-pro".to_string()];
        let snapshot = convert(&models, Some("gemini-3.5-flash-low"), &priority, None).unwrap();

        assert_eq!(snapshot.model.as_deref(), Some("Gemini 2.5 Pro"));
        assert_eq!(snapshot.five_hour.unwrap().remaining, 50.0);
    }

    #[test]
    fn falls_back_to_sorted_candidate_when_no_recommended_model_exists() {
        let mut models = BTreeMap::new();
        models.insert(
            "gemini-b".to_string(),
            model(
                Some("Gemini B"),
                API_PROVIDER_GEMINI,
                None,
                Some(0.9),
                Some("2999-06-13T00:00:00Z"),
            ),
        );
        models.insert(
            "gemini-a".to_string(),
            model(
                Some("Gemini A"),
                API_PROVIDER_GEMINI,
                None,
                Some(0.8),
                Some("2999-06-13T00:00:00Z"),
            ),
        );

        let snapshot = convert(&models, None, &[], None).unwrap();

        assert_eq!(snapshot.model.as_deref(), Some("Gemini A"));
        assert_eq!(snapshot.subscription.as_deref(), Some("Authorized"));
    }

    #[test]
    fn remaining_fraction_absent_produces_exhausted_window_and_keeps_names() {
        let mut models = BTreeMap::new();
        models.insert(
            "gemini-a".to_string(),
            model(
                Some("Gemini A"),
                API_PROVIDER_GEMINI,
                Some(true),
                None,
                Some("2999-06-13T00:00:00Z"),
            ),
        );

        let snapshot = convert(&models, None, &[], None).unwrap();
        let five_hour = snapshot.five_hour.unwrap();

        assert_eq!(five_hour.remaining, 0.0);
        assert_eq!(five_hour.used, 100.0);
        assert_eq!(five_hour.resets_at, "2999-06-13T00:00:00Z");
        assert_eq!(snapshot.model.as_deref(), Some("Gemini A"));
    }

    #[test]
    fn quota_info_absent_produces_no_window_but_keeps_names() {
        let mut models = BTreeMap::new();
        models.insert(
            "gemini-a".to_string(),
            model_without_quota(Some("Gemini A"), API_PROVIDER_GEMINI, Some(true)),
        );

        let snapshot = convert(&models, None, &[], None).unwrap();

        assert!(snapshot.five_hour.is_none());
        assert_eq!(snapshot.model.as_deref(), Some("Gemini A"));
    }

    #[test]
    fn third_party_recommended_models_with_absent_remaining_fraction_are_exhausted() {
        let mut models = BTreeMap::new();
        models.insert(
            "third-a".to_string(),
            model(
                Some("Third A"),
                "API_PROVIDER_ANTHROPIC",
                Some(true),
                None,
                Some("2999-06-14T00:00:00Z"),
            ),
        );
        models.insert(
            "third-b".to_string(),
            model(
                Some("Third B"),
                "API_PROVIDER_OPENAI",
                Some(true),
                None,
                Some("2999-06-15T00:00:00Z"),
            ),
        );

        let snapshot = convert(&models, None, &[], None).unwrap();
        let seven_day = snapshot.seven_day.unwrap();

        assert_eq!(seven_day.remaining, 0.0);
        assert_eq!(seven_day.used, 100.0);
        assert_eq!(seven_day.resets_at, "2999-06-14T00:00:00Z");
        assert_eq!(snapshot.model_tags, Some(vec!["Third A".to_string()]));
    }

    #[test]
    fn elapsed_reset_time_resets_window() {
        let mut models = BTreeMap::new();
        models.insert(
            "gemini-a".to_string(),
            model(
                Some("Gemini A"),
                API_PROVIDER_GEMINI,
                Some(true),
                Some(0.1),
                Some("2000-01-01T00:00:00Z"),
            ),
        );

        let snapshot = convert(&models, None, &[], None).unwrap();
        let five_hour = snapshot.five_hour.unwrap();

        assert_eq!(five_hour.remaining, 100.0);
        assert_eq!(five_hour.used, 0.0);
        assert_eq!(five_hour.resets_at, "");
    }
}
