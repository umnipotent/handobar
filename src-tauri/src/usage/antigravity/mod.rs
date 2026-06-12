//! Antigravity 잔여 사용량 use-case (orchestration).
//!
//! 캐시 → Antigravity OAuth → 자체 모델/쿼터 API → 도메인 스냅샷.

mod api;
mod credentials;
mod messages;
mod source;

use crate::usage::cache::{self, FetchDecision, ANTIGRAVITY_CACHE};
use crate::usage::model::UsageSnapshot;

pub(super) async fn get_antigravity_usage(force: bool) -> Result<UsageSnapshot, String> {
    if !force {
        if let FetchDecision::UseCached(usage) = cache::before_fetch(&ANTIGRAVITY_CACHE)? {
            return Ok(usage);
        }
    }

    let access_token = credentials::get_valid_token().await?;

    let eligibility = match api::load_code_assist(&access_token).await {
        Ok(eligibility) => eligibility,
        Err(err) => return cache::remember_fallback_stale(&ANTIGRAVITY_CACHE, err),
    };

    let project = eligibility.cloudaicompanion_project.as_deref();
    let tier_name = eligibility
        .paid_tier
        .and_then(|tier| tier.name)
        .or(eligibility.current_tier.and_then(|tier| tier.name));
    let (models, default_agent_model_id, model_priority) =
        match api::fetch_available_models(&access_token, project).await {
            Ok(response) => {
                let model_priority = response
                    .agent_model_sorts
                    .unwrap_or_default()
                    .into_iter()
                    .flat_map(|sort| sort.groups.unwrap_or_default())
                    .flat_map(|group| group.model_ids.unwrap_or_default())
                    .collect::<Vec<_>>();

                (
                    response.models.unwrap_or_default(),
                    response.default_agent_model_id,
                    model_priority,
                )
            }
            Err(err) => return cache::remember_fallback_stale(&ANTIGRAVITY_CACHE, err),
        };

    let usage = source::convert(
        &models,
        default_agent_model_id.as_deref(),
        &model_priority,
        tier_name,
    )?;

    cache::remember_success(&ANTIGRAVITY_CACHE, &usage);
    Ok(usage)
}
