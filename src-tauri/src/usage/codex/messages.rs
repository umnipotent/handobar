//! Codex provider 고유 메시지(한국어).

pub(super) const HOME_NOT_FOUND: &str = "홈 디렉터리를 확인할 수 없습니다";
pub(super) const SESSIONS_NOT_FOUND: &str =
    "Codex 세션 기록을 찾을 수 없습니다. 터미널에서 `codex` 로 요청을 한 번 보낸 뒤 다시 시도하세요.";
pub(super) const RATE_LIMITS_NOT_FOUND: &str =
    "Codex 사용량 정보가 아직 없습니다. `codex` 로 요청을 한 번 보내면 사용량이 기록됩니다.";

pub(super) fn read_failed(error: impl std::fmt::Display) -> String {
    format!("Codex 세션 읽기 실패: {error}")
}
