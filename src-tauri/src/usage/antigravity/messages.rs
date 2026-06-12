//! Antigravity provider 고유 메시지(한국어).

pub(super) const HOME_NOT_FOUND: &str = "홈 디렉터리를 확인할 수 없습니다";
pub(super) const CREDENTIALS_NOT_FOUND: &str =
    "Antigravity 로그인 정보를 찾을 수 없습니다. Antigravity에서 먼저 로그인을 진행해 주세요.";
pub(super) const UNAUTHORIZED: &str =
    "Antigravity API 인증에 실패했습니다. 다시 로그인해 주세요.";

pub(super) fn api_request_failed(error: impl std::fmt::Display) -> String {
    format!("Antigravity API 호출 실패: {error}")
}

pub(super) fn api_error(status: reqwest::StatusCode) -> String {
    format!("Antigravity API 응답 오류: 상태 코드 {status}")
}

