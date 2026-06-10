//! 잔여 사용량 fetch.
//!
//! provider별 use-case를 공유 도메인 모델(`model`)·캐시(`cache`)·메시지(`messages`) 위에 올린다.
//! provider를 추가할 때는 `claude`/`codex` 처럼 하위 모듈을 더하고 커맨드를 노출하면 된다(OCP).

mod cache;
mod claude;
mod codex;
mod messages;
mod model;

pub use model::UsageSnapshot;

#[tauri::command]
pub async fn get_claude_usage(force: Option<bool>) -> Result<UsageSnapshot, String> {
    claude::get_claude_usage(force.unwrap_or(false)).await
}

#[tauri::command]
pub async fn get_codex_usage(force: Option<bool>) -> Result<UsageSnapshot, String> {
    codex::get_codex_usage(force.unwrap_or(false)).await
}
