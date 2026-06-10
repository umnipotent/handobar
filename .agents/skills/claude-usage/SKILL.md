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

## 유닛 테스트 구성

Claude Code 사용량 추적 기능은 다음 모듈들에 대해 유닛 테스트를 통해 검증되고 있다.

### 1. 백엔드 (Rust)
- **`models::tests` ([models.rs](file:///Users/morgan/Development/handobar/src-tauri/src/usage/models.rs))**:
  - `ApiWindow` 데이터를 `UsageWindow` 형태로 매핑 및 가공할 때, `100.0 - utilization` 공식이 올바르게 적용되는지 테스트한다.
  - 비정상적인 값(0% 미만 혹은 100% 초과 사용량)이 주어졌을 때 `clamp`를 통해 안전하게 `0.0 ~ 100.0` 범위 내로 조정되는지 검증한다.
- **`cache::tests` ([cache.rs](file:///Users/morgan/Development/handobar/src-tauri/src/usage/cache.rs))**:
  - `before_fetch`가 캐시 부재 시 `Fetch` 결정을 올바르게 반환하는지 테스트한다.
  - `remember_success`를 통해 데이터가 정상 저장되었을 때 동일 스냅샷이 캐시로부터 즉시 재사용되는지 테스트한다.
  - `429 Too Many Requests`로 인해 `remember_retry(retry_after)` 가 기록되었을 때, 쿨다운 기간 동안 캐시된 예전 데이터(`stale`)와 남은 `retry_after_secs` 값이 온전하게 제공되는지(그리고 캐시가 없을 때는 429 안내 에러를 정상 리턴하는지) 확인한다.
  - 각각의 테스트 격리를 위해 `reset_cache_for_test`를 활용한다.

### 2. 프론트엔드 (React / TypeScript)
- **`format.test.ts` ([format.test.ts](file:///Users/morgan/Development/handobar/src/features/claudeUsage/format.test.ts))**:
  - `formatReset`: ISO 시간 문자열을 읽어 현재 시점으로부터 남은 리셋 시간("곧 리셋", "X분 후 리셋", "X시간 X분 후 리셋", "X일 X시간 후 리셋")을 정확히 계산하는지 확인한다. 가상 타이머(`vi.setSystemTime`)를 이용하여 가상의 고정 시간대에서 테스트한다.
  - `formatKstIsoWithoutTimezone`: UTC 기준 날짜 문자열을 KST(UTC+9)로 보정하고 타임존 정보가 배제된 `YYYY-MM-DDThh:mm:ss` 형식으로 올바르게 절삭하여 가공하는지 테스트한다.
- **`storage.test.ts` ([storage.test.ts](file:///Users/morgan/Development/handobar/src/features/claudeUsage/storage.test.ts))**:
  - `clampIntervalMin`: 지정된 분 단위 폴링 주기 값이 유효 범위(`1~10`)를 벗어날 때 상하한선 범위로 조정되거나 `NaN`일 때 기본값(`5`)으로 복원되는지 검증한다.
  - `loadIntervalMin` 및 `saveIntervalMin`: `localStorage`에 접근 시 키가 유효하지 않거나 비어있을 때 `DEFAULT_INTERVAL`을 리턴하고, 범위 조정을 한 후 기록/보존하는지 테스트한다. Node.js 테스트 환경을 위해 모의 `LocalStorageMock`을 글로벌 객체에 연결하여 구동한다.

