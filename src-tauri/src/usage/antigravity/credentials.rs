//! Antigravity IDE state DB에서 자체 OAuth 자격증명을 읽는다.

use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use base64::Engine;
use rusqlite::{Connection, OpenFlags};
use serde::Deserialize;

use crate::usage::antigravity::messages;

const TOKEN_KEY: &str = "antigravityUnifiedStateSync.oauthToken";
const OAUTH_SENTINEL: &str = "oauthTokenInfoSentinelKey";
const CLIENT_ID: &str = "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com";
const CLIENT_SECRET: &str = "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";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";

#[derive(Debug, PartialEq)]
struct TokenInfo {
    access_token: String,
    token_type: Option<String>,
    refresh_token: String,
    expiry_seconds: Option<u64>,
}

#[derive(Deserialize)]
struct RefreshResponse {
    access_token: String,
}

fn candidate_paths() -> Result<Vec<PathBuf>, String> {
    let home = std::env::var("HOME").map_err(|_| messages::HOME_NOT_FOUND.to_string())?;
    let support = PathBuf::from(home).join("Library/Application Support");
    Ok(vec![
        support.join("Antigravity IDE/User/globalStorage/state.vscdb"),
        support.join("Antigravity/User/globalStorage/state.vscdb"),
    ])
}

fn read_token_from_db(path: &PathBuf) -> Result<TokenInfo, String> {
    let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| format!("Antigravity 로그인 정보 DB 열기 실패: {e}"))?;
    let value: String = conn
        .query_row(
            "SELECT value FROM ItemTable WHERE key = ?1",
            [TOKEN_KEY],
            |row| row.get(0),
        )
        .map_err(|e| format!("Antigravity 로그인 정보 조회 실패: {e}"))?;
    extract_token_info_from_db_value(&value)
}

fn read_credentials() -> Result<TokenInfo, String> {
    for path in candidate_paths()? {
        if !path.is_file() {
            continue;
        }
        if let Ok(token) = read_token_from_db(&path) {
            return Ok(token);
        }
    }

    Err(messages::CREDENTIALS_NOT_FOUND.to_string())
}

/// 만료 검사 후 유효한 access_token을 반환한다.
pub(super) async fn get_valid_token() -> Result<String, String> {
    let token = read_credentials()?;
    if token_has_enough_lifetime(&token) {
        return Ok(token.access_token);
    }

    refresh_access_token(&token.refresh_token).await
}

fn token_has_enough_lifetime(token: &TokenInfo) -> bool {
    let Some(expiry) = token.expiry_seconds else {
        return false;
    };
    expiry > now_seconds().saturating_add(60)
}

fn now_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

async fn refresh_access_token(refresh_token: &str) -> Result<String, String> {
    let params = [
        ("client_id", CLIENT_ID),
        ("client_secret", CLIENT_SECRET),
        ("refresh_token", refresh_token),
        ("grant_type", "refresh_token"),
    ];

    let resp = reqwest::Client::new()
        .post(TOKEN_URL)
        .header(
            reqwest::header::CONTENT_TYPE,
            "application/x-www-form-urlencoded",
        )
        .form(&params)
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(messages::token_refresh_failed)?;

    if !resp.status().is_success() {
        return Err(messages::token_refresh_failed(format!(
            "상태 코드 {}",
            resp.status()
        )));
    }

    let body: RefreshResponse = resp.json().await.map_err(messages::token_refresh_failed)?;
    Ok(body.access_token)
}

fn extract_token_info_from_db_value(value: &str) -> Result<TokenInfo, String> {
    let envelope = base64::engine::general_purpose::STANDARD
        .decode(value)
        .map_err(|e| format!("Antigravity 로그인 정보 디코딩 실패: {e}"))?;

    for outer in fields_with_number(&envelope, 1)? {
        if first_field(outer, 1)? != Some(OAUTH_SENTINEL.as_bytes()) {
            continue;
        }

        for inner_container in fields_with_number(outer, 2)? {
            if let Some(inner_b64) = first_field(inner_container, 1)? {
                let inner_b64 = std::str::from_utf8(inner_b64)
                    .map_err(|e| format!("Antigravity 토큰 정보 UTF-8 파싱 실패: {e}"))?;
                let token_bytes = base64::engine::general_purpose::STANDARD
                    .decode(inner_b64)
                    .map_err(|e| format!("Antigravity 토큰 정보 디코딩 실패: {e}"))?;
                return parse_token_info(&token_bytes);
            }
        }
    }

    Err(messages::CREDENTIALS_NOT_FOUND.to_string())
}

fn parse_token_info(buf: &[u8]) -> Result<TokenInfo, String> {
    let access_token = required_utf8_field(buf, 1, "access_token")?;
    let token_type = optional_utf8_field(buf, 2)?;
    let refresh_token = required_utf8_field(buf, 3, "refresh_token")?;
    let expiry_seconds = first_varint_field(buf, 4)?;

    Ok(TokenInfo {
        access_token,
        token_type,
        refresh_token,
        expiry_seconds,
    })
}

fn required_utf8_field(buf: &[u8], number: u64, name: &str) -> Result<String, String> {
    optional_utf8_field(buf, number)?.ok_or_else(|| format!("Antigravity 토큰에 {name}이 없습니다"))
}

fn optional_utf8_field(buf: &[u8], number: u64) -> Result<Option<String>, String> {
    first_field(buf, number)?
        .map(|field| {
            std::str::from_utf8(field)
                .map(|s| s.to_string())
                .map_err(|e| format!("Antigravity 토큰 UTF-8 파싱 실패: {e}"))
        })
        .transpose()
}

fn read_varint(buf: &[u8]) -> Result<(u64, usize), String> {
    let mut value = 0u64;
    for (i, byte) in buf.iter().enumerate().take(10) {
        value |= u64::from(byte & 0x7f) << (7 * i);
        if byte & 0x80 == 0 {
            return Ok((value, i + 1));
        }
    }
    Err("protobuf varint 파싱 실패".to_string())
}

fn fields_with_number<'a>(buf: &'a [u8], number: u64) -> Result<Vec<&'a [u8]>, String> {
    let mut out = Vec::new();
    scan_fields(buf, |field_number, wire_type, payload| {
        if field_number == number && wire_type == 2 {
            out.push(payload);
        }
    })?;
    Ok(out)
}

fn first_field<'a>(buf: &'a [u8], number: u64) -> Result<Option<&'a [u8]>, String> {
    Ok(fields_with_number(buf, number)?.into_iter().next())
}

fn first_varint_field(buf: &[u8], number: u64) -> Result<Option<u64>, String> {
    let mut found = None;
    scan_fields(buf, |field_number, wire_type, payload| {
        if field_number == number && wire_type == 0 && found.is_none() {
            if let Ok((value, _)) = read_varint(payload) {
                found = Some(value);
            }
        }
    })?;
    Ok(found)
}

fn scan_fields<'a>(buf: &'a [u8], mut visit: impl FnMut(u64, u64, &'a [u8])) -> Result<(), String> {
    let mut offset = 0;
    while offset < buf.len() {
        let (key, key_len) = read_varint(&buf[offset..])?;
        offset += key_len;
        let field_number = key >> 3;
        let wire_type = key & 0x07;

        match wire_type {
            0 => {
                let start = offset;
                let (_, len) = read_varint(&buf[offset..])?;
                offset += len;
                visit(field_number, wire_type, &buf[start..offset]);
            }
            1 => {
                let end = offset
                    .checked_add(8)
                    .filter(|end| *end <= buf.len())
                    .ok_or_else(|| "protobuf fixed64 범위 오류".to_string())?;
                visit(field_number, wire_type, &buf[offset..end]);
                offset = end;
            }
            2 => {
                let (len, len_len) = read_varint(&buf[offset..])?;
                offset += len_len;
                let len = usize::try_from(len).map_err(|_| "protobuf length 범위 오류")?;
                let end = offset
                    .checked_add(len)
                    .filter(|end| *end <= buf.len())
                    .ok_or_else(|| "protobuf length-delimited 범위 오류".to_string())?;
                visit(field_number, wire_type, &buf[offset..end]);
                offset = end;
            }
            5 => {
                let end = offset
                    .checked_add(4)
                    .filter(|end| *end <= buf.len())
                    .ok_or_else(|| "protobuf fixed32 범위 오류".to_string())?;
                visit(field_number, wire_type, &buf[offset..end]);
                offset = end;
            }
            _ => return Err(format!("지원하지 않는 protobuf wire type: {wire_type}")),
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn varint(mut value: u64) -> Vec<u8> {
        let mut out = Vec::new();
        loop {
            let mut byte = (value & 0x7f) as u8;
            value >>= 7;
            if value != 0 {
                byte |= 0x80;
            }
            out.push(byte);
            if value == 0 {
                break;
            }
        }
        out
    }

    fn field_len(number: u64, value: &[u8]) -> Vec<u8> {
        let mut out = varint((number << 3) | 2);
        out.extend(varint(value.len() as u64));
        out.extend(value);
        out
    }

    fn field_varint(number: u64, value: u64) -> Vec<u8> {
        let mut out = varint(number << 3);
        out.extend(varint(value));
        out
    }

    fn token_db_value(sentinel_first: bool) -> String {
        let mut token = Vec::new();
        token.extend(field_len(1, b"access"));
        token.extend(field_len(2, b"Bearer"));
        token.extend(field_len(3, b"refresh"));
        token.extend(field_varint(4, 1_800_000_000));

        let inner_b64 = base64::engine::general_purpose::STANDARD.encode(token);
        let inner_container = field_len(1, inner_b64.as_bytes());

        let mut good_outer = Vec::new();
        good_outer.extend(field_len(1, OAUTH_SENTINEL.as_bytes()));
        good_outer.extend(field_len(2, &inner_container));

        let mut other_outer = Vec::new();
        other_outer.extend(field_len(1, b"authStateWithContextSentinelKey"));
        other_outer.extend(field_len(2, b"ignored"));

        let mut envelope = Vec::new();
        if sentinel_first {
            envelope.extend(field_len(1, &good_outer));
            envelope.extend(field_len(1, &other_outer));
        } else {
            envelope.extend(field_len(1, &other_outer));
            envelope.extend(field_len(1, &good_outer));
        }

        base64::engine::general_purpose::STANDARD.encode(envelope)
    }

    #[test]
    fn extracts_token_from_synthetic_protobuf() {
        let token = extract_token_info_from_db_value(&token_db_value(true)).unwrap();
        assert_eq!(token.access_token, "access");
        assert_eq!(token.token_type.as_deref(), Some("Bearer"));
        assert_eq!(token.refresh_token, "refresh");
        assert_eq!(token.expiry_seconds, Some(1_800_000_000));
    }

    #[test]
    fn selects_oauth_sentinel_when_other_sentinel_precedes_it() {
        let token = extract_token_info_from_db_value(&token_db_value(false)).unwrap();
        assert_eq!(token.access_token, "access");
        assert_eq!(token.refresh_token, "refresh");
    }
}
