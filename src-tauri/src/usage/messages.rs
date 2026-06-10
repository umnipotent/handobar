//! Provider 공통 사용자 메시지(한국어). Provider 고유 문구는 각 provider의 `messages.rs` 에 둔다.

pub(super) fn rate_limited(retry_after: u64) -> String {
    format!("요청이 제한되었습니다(429). {retry_after}초 후 자동으로 다시 시도합니다.")
}

pub(super) fn response_parse_failed(error: impl std::fmt::Display) -> String {
    format!("응답 파싱 실패: {error}")
}
