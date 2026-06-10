//! Claude Code 잔여 사용량 fetch.
//!
//! Claude Code의 OAuth 사용량 엔드포인트를 호출하고, 프론트에는 잔여 사용량 스냅샷을 반환한다.

mod api;
mod cache;
mod command;
mod credentials;
mod messages;
mod models;

#[tauri::command]
pub async fn get_claude_usage() -> Result<models::ClaudeUsage, String> {
    command::get_claude_usage().await
}
