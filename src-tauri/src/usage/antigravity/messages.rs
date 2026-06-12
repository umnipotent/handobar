//! Antigravity provider 고유 메시지(한국어).

pub(super) const HOME_NOT_FOUND: &str = "홈 디렉터리를 확인할 수 없습니다";
pub(super) const QUOTA_CACHE_NOT_FOUND: &str =
    "Antigravity 사용량 캐시를 찾을 수 없습니다. Antigravity에서 사용량을 한 번 확인한 뒤 다시 시도하세요.";
pub(super) const QUOTA_NOT_FOUND: &str =
    "Antigravity 사용량 정보를 찾을 수 없습니다. Antigravity에서 사용량을 한 번 확인한 뒤 다시 시도하세요.";

pub(super) fn read_failed(error: impl std::fmt::Display) -> String {
    format!("Antigravity 캐시 읽기 실패: {error}")
}
