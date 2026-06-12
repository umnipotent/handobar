//! Claude Code provider 고유 메시지(한국어).

pub(super) fn usage_request_failed(error: impl std::fmt::Display) -> String {
    format!("사용량 요청 실패: {error}")
}

pub(super) fn api_error(status: reqwest::StatusCode) -> String {
    format!("API 오류: {status}")
}

pub(super) fn credentials_parse_failed(error: impl std::fmt::Display) -> String {
    format!("자격증명 파싱 실패: {error}")
}

pub(super) const UNAUTHORIZED: &str =
    "인증에 실패했습니다(토큰 만료/무효). Claude Code에서 다시 로그인하세요.";
pub(super) const CREDENTIALS_NOT_FOUND: &str =
    "Claude Code 로그인 정보를 찾을 수 없습니다. 터미널에서 `claude` 로 로그인하세요.";
pub(super) const LOGIN_EXPIRED: &str =
    "로그인이 만료되었습니다. Claude Code에서 다시 로그인하세요.";
pub(super) const CURRENT_USER_NOT_FOUND: &str = "현재 사용자 이름을 확인할 수 없습니다";
