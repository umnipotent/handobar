---
name: claude-usage
description: How handobar fetches Claude Code remaining usage — the src-tauri/src/usage.rs get_claude_usage command that reads the OAuth token from the OS keychain and calls Anthropic's /api/oauth/usage endpoint, computes remaining = 100 − utilization for the 5-hour and weekly windows, and survives the endpoint's rate limit via backend cache + frontend backoff. Use this skill whenever you work on Claude Code usage tracking, the usage endpoint/auth/keychain token, the polling interval, or 429/Retry-After handling in usage.rs or App.tsx. Single source of truth for the Claude Code usage feature (Codex/Antigravity are out of scope).
---

# Claude Code 사용량 추적 (handobar)

`src-tauri/src/usage.rs` 의 `get_claude_usage` 커맨드가 **Claude Code 잔여 사용량**을 직접 fetch한다.
Claude Code만 대상이며 **Codex·Antigravity는 포함하지 않는다**(같은 구조로 추후 추가 예정).
커맨드 등록·invoke·ACL의 일반 패턴은 [`tauri`](../tauri/SKILL.md) 스킬을 따른다.

## 데이터 소스 & 인증

| 항목 | 값 |
| --- | --- |
| 엔드포인트 | `GET https://api.anthropic.com/api/oauth/usage` |
| 필수 헤더 | `Authorization: Bearer <token>`, `anthropic-beta: oauth-2025-04-20` |
| 토큰 출처 | OS 키체인 `Claude Code-credentials` (account = OS 사용자명)의 `claudeAiOauth.accessToken` |
| 응답 | `five_hour` / `seven_day` 각각 `utilization`(0~100, 사용률) + `resets_at`(RFC3339) |

- **잔여 = 100 − utilization** 로 계산해 5시간·주간 윈도우로 반환한다.
- 인증은 **이미 로그인된 Claude Code 자격증명을 재사용**한다(별도 로그인·토큰 갱신 없음 — 갱신은 Claude Code 담당).
  토큰 없음/만료(또는 `401`)면 한국어 로그인 안내 메시지를 반환한다.
- 첫 실행 시 macOS가 **키체인 접근 허용 프롬프트**를 띄울 수 있다("항상 허용" 선택).

## 폴링 & rate limit

- 폴링 주기는 프론트에서 **1~10분**으로 조정한다(localStorage `handobar.intervalMin`, 기본 5분).
- 이 엔드포인트는 자체 rate limit이 있어 과도 호출 시 `429 (Retry-After)` 를 준다. 이를 견디기 위해:
  - **백엔드**(`usage.rs`): 프로세스 전역 캐시로 짧은 간격(10초) 중복 호출을 합치고,
    `429` 의 `Retry-After` 동안 네트워크 호출을 멈추고 마지막 값을 stale(`retry_after_secs` 포함)로 반환한다.
  - **프론트**(`App.tsx`): 고정 `setInterval` 대신 자기-스케줄 타이머로 `Retry-After` 만큼 backoff 후
    자동 재시도하며, 쿨다운 동안 수동 새로고침을 막고 카운트다운을 표시한다.
- 새 호출 경로(예: 다른 윈도우·단축키)를 추가하더라도 위 캐시를 거치도록 해 호출 빈도를 낮게 유지할 것.

## ACL

이 엔드포인트는 네트워크/키체인 접근이 필요하므로 권한이 `src-tauri/capabilities/default.json` 에
선언돼 있어야 한다([`tauri`](../tauri/SKILL.md) 스킬의 권한 절 참고).

## 연관 스킬

- [`tauri`](../tauri/SKILL.md): 이 기능이 올라가는 커맨드 등록 / invoke / ACL 일반 패턴.
