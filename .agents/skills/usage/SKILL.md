---
name: hb-usage
description: How handobar fetches AI tool remaining usage (잔여 사용량) for each provider — the src-tauri/src/usage/ subsystem with shared domain model + cache and per-provider modules (claude, codex, antigravity), plus the src/features/usage/ shared frontend (hook/panel/gateway) with provider descriptors. Claude Code reads an OAuth token from the OS keychain and calls Anthropic's /api/oauth/usage (remaining = 100 − utilization) with 429/Retry-After backoff; Codex reads the latest ~/.codex/sessions rollout's rate_limits snapshot (no network/auth); Antigravity reads its own state.vscdb OAuth token and calls Google's daily-cloudcode-pa loadCodeAssist/fetchAvailableModels. Use this skill whenever you work on usage tracking, add a usage provider, or touch usage endpoints/auth/keychain, the polling interval, 429 handling, or the usage UI. Single source of truth for the usage feature.
---

# 잔여 사용량 추적 (handobar)

여러 AI 도구의 **잔여 사용량**을 같은 도메인 모델로 보여준다. provider별로 출처가 다르지만,
공유 코어(도메인 모델·캐시) 위에 provider 모듈을 올려 **provider 추가 시 기존 코드를 수정하지 않는다**(OCP).
커맨드 등록·invoke·ACL의 일반 패턴은 [`hb-tauri`](../tauri/SKILL.md) 스킬을 따른다.

## 구조

```
src-tauri/src/usage/
├─ mod.rs        # provider 모듈 선언 + Tauri 커맨드(get_claude_usage, get_codex_usage, get_antigravity_usage)
├─ model.rs      # 공유 도메인: UsageWindow(잔여), UsageSnapshot. from_used_percent()로 잔여=100-used
├─ cache.rs      # 공유 캐시: provider별 static(CLAUDE_CACHE, CODEX_CACHE, ANTIGRAVITY_CACHE), 10초 중복 합치기 + 429 backoff
├─ messages.rs   # 공유 메시지(rate_limited, response_parse_failed)
├─ claude/       # 네트워크 provider (키체인 + OAuth 엔드포인트 + 429)
│  ├─ mod.rs · api.rs · credentials.rs · messages.rs
├─ codex/        # 로컬 파일 provider (rollout rate_limits, 네트워크·인증 없음)
│  ├─ mod.rs · source.rs · messages.rs
└─ antigravity/  # 네트워크 provider (Antigravity 자체 OAuth + Google daily-cloudcode-pa)
   ├─ mod.rs · api.rs · credentials.rs · source.rs · messages.rs

src/features/usage/   # 공유 프론트: types, config, copy, format, storage, gateway(DIP), useUsage, WindowCard, UsagePanel
src/features/claudeUsage/provider.ts · codexUsage/provider.ts · antigravityUsage/provider.ts   # 얇은 provider 디스크립터(제목·커맨드·저장키)
```

각 provider use-case 흐름은 동일하다: **캐시 검사 → 소스(네트워크/파일) → `UsageSnapshot` 매핑 → 캐시 저장**.

### 도메인 모델: 윈도우-불가지(window-agnostic)

`UsageSnapshot` 은 고정 `five_hour`/`seven_day` 필드가 **아니라** `windows: Vec<UsageWindow>` 를 가진다(순서=표시
우선순위). 각 `UsageWindow { id, role, remaining, used, resets_at, chips? }`:

- `id`: 안정 식별자(`five_hour`,`seven_day`,`gemini`,`non_gemini` …). 프론트가 id로 라벨/힌트를 매핑한다.
- `role`: `Session`/`Long`/`Other`(serde `snake_case`). **`session` 윈도우가 트레이 표시값과
  fast-mode/세션 경고의 기준**이다(없으면 `windows[0]`).
- 라벨 텍스트는 백엔드에 두지 않는다(하드코딩 금지 정책). 프론트 `copy.ts` 의 `USAGE_COPY.windows[id]` 기본값 +
  provider descriptor 의 `windowLabel?(id,usage)`/`windowHint?(id,usage)` 오버라이드로 결정.
- **null-window 의미는 백엔드 각 provider 가 결정**한다(옛 프론트 `windowPolicy.ts` 는 제거): 미사용→100% 윈도우
  emit, 소진→0% emit, 데이터 없음→해당 윈도우 omit.
- `UsageWindow::new(id, role, used, resets_at, chips)` 로 만들고, 계산(`from_used_percent`)·리셋 경과
  (`reset_if_elapsed`, id/role/chips 보존) 로직은 공유.

프론트는 `windows` 를 순회해 **모든 카드를 항상 렌더**한다(가시성 선택 UI 없음): 카드별 접기/펼치기
(`…​.window.<id>.collapsed`), 칩이 있는 카드는 카드 내부 토글로 **칩 목록 전체 보이기/숨기기**
(`…​.window.<id>.chipsCollapsed`), 경고/에러/고갈 배너는 카드 다음·메모 위 `.panel-messages` 한 영역에 모은다.
**트레이 표시는 윈도우 선택**이다: `role: session` 윈도우가 있으면(Claude/Codex) 그 윈도우 on/off, 없으면
(Antigravity) `off → 첫 윈도우 → 둘째 윈도우 → off` 순환(저장 `…​.trayWindow`, App 이 `traySelection: id|null` 소유,
패널이 선택 윈도우 잔여를 `onTrayRemainingChange` 로 보고). provider descriptor 는 `windowLabel`/`windowHint`/
`defaultCollapsed`/`showModelBadges` 만 주입한다.

## Provider별 데이터 소스

### Claude Code (`usage/claude/`)

| 항목 | 값 |
| --- | --- |
| 엔드포인트 | `GET https://api.anthropic.com/api/oauth/usage` |
| 헤더 | `Authorization: Bearer <token>`, `anthropic-beta: oauth-2025-04-20` |
| 토큰 | OS 키체인 `Claude Code-credentials`(account = OS 사용자명)의 `claudeAiOauth.accessToken` |
| 응답 | `five_hour`/`seven_day` 의 `utilization`(0~100) + `resets_at`. (모델별 주간 키 등 나머지는 현재 전부 null) |
| 윈도우 | `five_hour`(role=Session), `seven_day`(role=Long) **항상 emit**. API 가 null 이면 미사용=잔여 100% 로 백엔드가 채움 |

- **잔여 = 100 − utilization**. 이미 로그인된 Claude Code 자격증명을 재사용(별도 로그인·갱신 없음).
- 토큰 없음/만료/`401` → 한국어 로그인 안내. 첫 실행 시 macOS 키체인 프롬프트(서명은 [`hb-tauri`](../tauri/SKILL.md) 코드 서명 절).

### Codex (`usage/codex/`)

| 항목 | 값 |
| --- | --- |
| 소스 | `~/.codex/sessions/<날짜>/rollout-*.jsonl` 중 **가장 최근 수정** 파일의 **마지막** `rate_limits` |
| 매핑 | `primary`(window_minutes≈300) → 윈도우 id `five_hour`(role=Session), `secondary`(≈10080) → `seven_day`(role=Long) |
| 값 | **잔여 = 100 − used_percent**, `resets_at`(epoch secs) → RFC3339. present 한 윈도우만 emit(없으면 omit) |

- Codex는 요청 응답의 rate_limits를 rollout 파일에 기록하므로 **네트워크·인증·rate limit이 없다**.
  세션 기록/사용량이 없으면 "codex로 요청을 한 번 보내라"는 안내를 반환한다.

### Antigravity (`usage/antigravity/`)

> **중요**: Antigravity의 잔여 사용량은 ❌ `~/.gemini/oauth_creds.json` + Gemini CLI의
> `retrieveUserQuota`(Gemini Code Assist 쿼터)도 아니고, ❌ 콕핏 확장(`jlcodes.antigravity-cockpit`)의
> 캐시 파일도 아니다. **Antigravity IDE 자체의 OAuth 토큰으로 직접 호출한 쿼터만 정확하다.**

| 항목 | 값 |
| --- | --- |
| 토큰 위치 | `~/Library/Application Support/Antigravity IDE/User/globalStorage/state.vscdb`(SQLite, fallback `Antigravity/...`)의 `ItemTable` 키 `antigravityUnifiedStateSync.oauthToken` |
| 토큰 형식 | base64 + protobuf. 외곽 메시지의 field 1 반복 항목 중 field 1 == `"oauthTokenInfoSentinelKey"` 인 것을 선택(다른 sentinel, 예: `authStateWithContextSentinelKey` 가 섞여 있을 수 있음) → field 2 → base64 → 내부 protobuf(`access_token`=1, `token_type`=2, `refresh_token`=3, `expiry_seconds`=4) |
| 토큰 갱신 | `expiry_seconds` 가 60초 이내면 `https://oauth2.googleapis.com/token` 에 `grant_type=refresh_token` (client_id `1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com`, client_secret은 콕핏 확장에 내장된 공개 OAuth 클라이언트 시크릿) |
| 엔드포인트 | `POST https://daily-cloudcode-pa.googleapis.com/v1internal:loadCodeAssist` → `cloudaicompanionProject`, `currentTier`, `paidTier` 획득 → `POST .../v1internal:fetchAvailableModels` → `models`, `defaultAgentModelId`, `agentModelSorts` |
| 헤더 | `Authorization: Bearer <token>`, `Content-Type: application/json`, **`User-Agent: antigravity/<ver> <os>/<arch>`** — `fetchAvailableModels`는 이 UA가 없으면 **403** |
| platform 매핑 | `loadCodeAssist`의 `metadata.platform`은 enum: `DARWIN_ARM64`/`DARWIN_AMD64`/`LINUX_AMD64`/`PLATFORM_UNSPECIFIED` |

**모델 그룹핑 및 매핑** (`source.rs`):

- `models{}` 를 `apiProvider` 로 그룹핑: `API_PROVIDER_GOOGLE_GEMINI` → 윈도우 id `gemini`(role=Other), 그 외(`API_PROVIDER_ANTHROPIC_VERTEX`/`API_PROVIDER_OPENAI_VERTEX` 등, `API_PROVIDER_INTERNAL` 제외) → 윈도우 id `non_gemini`(role=Other). 그룹에 대표 모델이 없으면 그 윈도우는 omit.
- **대표 모델 선정**: 각 그룹에서 `(quotaInfo 존재 여부, 우선순위 rank, modelKey)` 순으로 최소값을 고른다. 우선순위 rank는 `fetchAvailableModels`의 `defaultAgentModelId`(rank 0)와 `agentModelSorts[].groups[].modelIds`(순서대로 rank 1, 2, ...)로 만든다 — 단순 알파벳순으로 고르면 사용자의 실제 기본 모델(예: "Gemini 3.5 Flash (Medium)")이 아닌 임의 모델이 대표로 잡힌다.
- **잔여율(`remainingFraction`)**: `quotaInfo` 자체가 없으면 윈도우 `None`(데이터 없음). `quotaInfo`는 있는데 `remainingFraction`이 없으면 **쿼터 소진(0%)** — `resetTime`만 있는 케이스이며 `unwrap_or(0.0)`으로 처리해야 한다(생략 ≠ unknown).
- **카드 내 모델 칩**(각 윈도우의 `chips`): 각 그룹에서 `recommended == true && displayName 존재`인 모델을 우선순위 rank순으로 정렬·dedup해 해당 윈도우 카드 안에 칩으로 표시(`gemini` 윈도우 → Gemini 3.x 시리즈, `non_gemini` 윈도우 → Claude/OSS 등). 헤더의 기존 `model`/`model_tags` 배지는 Antigravity에서만 `showModelBadges: false` 로 숨김(요금제 배지는 유지).
- **요금제(`subscription`)**: `loadCodeAssist`의 `paidTier.name`(실제 결제 플랜, 예: "Google AI Pro")을 우선 사용하고, 없으면 `currentTier.name`(예: "Antigravity" — 무료 티어 제품명일 뿐 플랜 등급이 아님)으로 폴백, 둘 다 없으면 "Authorized".
- 프로토콜은 `rusqlite`(bundled SQLite) + 손으로 작성한 protobuf wire-format 파서(`read_varint`/`scan_fields`, wire type 0/1/2/5 지원)로 구현되어 있다. `prost` 등 protobuf 코드젠 의존성은 추가하지 않았다.

## 폴링 & rate limit

- 폴링 주기는 프론트에서 **1~10분**(기본 5분). 저장 키는 provider별로 분리
  (`handobar.claude.intervalMin`, `handobar.codex.intervalMin`, `handobar.antigravity.intervalMin`).
- Claude 엔드포인트는 자체 rate limit이 있어 `429 (Retry-After)` 를 준다:
  - **백엔드**: 전역 캐시로 10초 내 중복 호출을 합치고, `Retry-After` 동안 호출을 멈추고 마지막 값을
    stale(`retry_after_secs` 포함)로 반환한다. Codex·Antigravity는 자체 rate limit이 없어 `remember_retry` 를 호출하지 않을 뿐 같은 캐시를 쓴다(Antigravity는 `loadCodeAssist`/`fetchAvailableModels` 실패 시 `remember_fallback_stale` 로 마지막 값을 stale 반환).
  - **프론트**(`useUsage`): 자기-스케줄 타이머로 `Retry-After` 만큼 backoff 후 자동 재시도, 쿨다운 동안 수동 새로고침 차단·카운트다운.

## 새 provider 추가 절차 (참고: claude/codex/antigravity)

1. `usage/<provider>/` 모듈 추가: 소스(`source.rs`/`api.rs`)에서 `UsageSnapshot` 을 만들고 `mod.rs` 에서 캐시와 조립.
2. 필요하면 `cache.rs` 에 provider 전용 `static` 캐시를 추가.
3. `usage/mod.rs` 에 `get_<provider>_usage` 커맨드를 추가하고 `lib.rs` 의 `generate_handler!` 에 등록.
4. 프론트: `features/<provider>Usage/provider.ts` 에 디스크립터(제목·커맨드·저장키)만 만들어 `App` 에 패널 추가.
5. 공유 모델/캐시/훅/카드는 수정하지 않는다(OCP). provider 가 내려줄 윈도우는 `windows` 벡터에 원하는 만큼
   `UsageWindow{ id, role, chips? }` 로 담는다(라벨은 `copy.ts` 의 id 맵 + descriptor 오버라이드). 카드 안 모델 칩은
   윈도우의 `chips` 로, 헤더 배지 가시성은 `showModelBadges` 로 제어한다(Antigravity 구현 참고).

## UI 및 비주얼 경고 정책

한도바는 사용자가 한도 도달 전에 대처할 수 있도록 두 단계의 시각적 경고(주의/경고)와 팝업 메시지를 제공한다. 각 임계 퍼센트는 `src/features/usage/config.ts`에, 메시지 텍스트는 `src/features/usage/copy.ts`에 정의되어 중앙에서 관리되며 하드코딩은 엄격히 금지된다.

### 1. 비주얼 진행도 (주의 / 경고)
잔여 사용량(`remaining`)에 따라 카드 및 프로그레스 바의 테두리와 수치 색상이 변화한다:
- **경고 (Danger, 40% 이하)**: 빨간색 계열(`.remaining.danger`, `.bar-fill.danger`, `#c0392b`).
- **주의 (Warning, 60% 이하 40% 초과)**: 주황색 계열(`.remaining.warning`, `.bar-fill.warning`, `#d35400`/`#e67e22`).
- **정상 (Normal, 60% 초과)**: 기본 보라색 계열(`#6b4eff`).

### 2. 세션별 경고 배너
- **비활성화 권고 경고**: 5시간 세션 잔여 사용량이 40% 이하 20% 초과 구간으로 떨어지면 패널 상단에 **"fast mode 비활성화를 추천합니다"** 경고 배너를 노출한다.
- **세션 동기화 권고 경고**: 5시간 세션 잔여 사용량이 20% 이하로 떨어지면 패널 상단에 **"복잡한 작업 지시를 지양하고 세션 상황을 계속 동기화하세요"** 경고 배너를 노출한다.
- **닫기 기능**: 배너 우측의 `×` 버튼을 눌러 개별 배너를 닫을(dismiss) 수 있다.
- **상태 복원**: 사용량이 임계값을 초과하게 갱신되면 각 닫힘(dismissed) 상태가 초기화되어, 나중에 다시 임계값 이하로 진입 시 배너가 정상적으로 다시 표시된다.


## 유닛 테스트

### 백엔드 (Rust) — `cargo test`

- **`model::tests` ([model.rs](file:///Users/morgan/Development/handobar/src-tauri/src/usage/model.rs))**: `from_used_percent` 의 `100 - used` 계산과 `0~100` clamp.
- **`cache::tests` ([cache.rs](file:///Users/morgan/Development/handobar/src-tauri/src/usage/cache.rs))**: 테스트별 로컬 `Mutex<Cache>` 로 격리해 `before_fetch`/`remember_success`/`remember_retry`(stale + `retry_after_secs`, 빈 캐시 에러) 흐름. 전역 `TEST_CACHE` 와 리셋 함수는 병렬 테스트 레이스를 만들 수 있어 사용하지 않는다.
- **`claude::api::tests` ([api.rs](file:///Users/morgan/Development/handobar/src-tauri/src/usage/claude/api.rs))**: `Retry-After` 파싱(양수 필터), `utilization`→잔여 매핑.
- **`codex::source::tests` ([source.rs](file:///Users/morgan/Development/handobar/src-tauri/src/usage/codex/source.rs))**: rollout 라인에서 `rate_limits` 추출·매핑(epoch→RFC3339), null 윈도우 무시.
- **`antigravity::credentials::tests` ([credentials.rs](file:///Users/morgan/Development/handobar/src-tauri/src/usage/antigravity/credentials.rs))**: 합성 protobuf로 sentinel 선택(`oauthTokenInfoSentinelKey`)·토큰 필드 추출 검증(실제 토큰 사용 금지, 네트워크 없음).
- **`antigravity::source::tests` ([source.rs](file:///Users/morgan/Development/handobar/src-tauri/src/usage/antigravity/source.rs))**: apiProvider 그룹핑·대표 모델 선정(quotaInfo 존재/우선순위 rank), `quotaInfo` 있고 `remainingFraction` 없을 때 0%(소진) 처리, 모델 칩 생성(recommended 필터·우선순위 정렬·dedup·INTERNAL 제외).

### 프론트엔드 (Vitest) — `pnpm test`

- **[format.test.ts](file:///Users/morgan/Development/handobar/src/features/usage/format.test.ts)**: `formatReset`(가상 타이머)·`formatKstIsoWithoutTimezone`(KST 보정).
- **[storage.test.ts](file:///Users/morgan/Development/handobar/src/features/usage/storage.test.ts)**: `clampIntervalMin` 범위 보정, provider별 키 격리(`LocalStorageMock`).

## 개발 시 깨달은 내용 (Lessons Learned)

Antigravity 사용량 연동 기능을 개발하며 얻은 기술적 경험과 교훈을 다음과 같이 정리한다.

1. **User-Agent 헤더 필수 요구 (403 Forbidden)**
   - Google `fetchAvailableModels` API는 유효한 OAuth 토큰을 제공하더라도 헤더에 `User-Agent: antigravity/<ver> <os>/<arch>`와 같이 플랫폼 지정 포맷이 유효하게 들어있지 않으면 **403 Forbidden** 응답을 리턴한다. API 호출 시 필수적으로 User-Agent 헤더 구조를 검사하고 탑재해야 한다.
2. **SQLite 및 Protobuf 바이너리 직접 파싱**
   - OS에 로컬로 깔려있는 VSCode globalState 데이터베이스(`state.vscdb`)에서 OAuth 토큰을 추출하기 위해 SQL 쿼리를 수행한다.
   - 이때 저장된 토큰 정보는 Protobuf로 인코딩되어 저장되며, 다중 상태 정보(`oauthTokenInfoSentinelKey` 등)가 필드로 포함된다.
   - 무거운 외부 Protobuf 라이브러리(`prost` 등)를 의존성에 올리기보단 SQLite DB 추출 후 direct byte parsing(varint + scan_fields) 형태로 수동 파서를 구현하는 것이 빌드 크기와 이식성 측면에서 우수했다.
3. **잔여 쿼터의 부재와 0% 매핑 규칙**
   - Google PA API 응답의 `quotaInfo`에는 `remainingFraction` 필드가 생략되어 있는 경우가 존재한다.
   - 이 때 `remainingFraction`이 없다고 해서 `unknown`으로 처리하면 안 되며, 이는 **해당 쿼터가 이미 소진(0%)된 상태**를 의미한다. `unwrap_or(0.0)` 처리를 빠뜨리지 않도록 유의해야 한다.
4. **대표 모델 선정의 중요성**
   - 단순 알파벳 정렬로 모델을 나열하고 그 중 첫 번째를 사용량 카드 제목(예: 대표 모델)으로 고르면, 실제 사용자가 주력으로 쓰고 있는 "Gemini 3.5 Flash" 대신 엉뚱한 레거시 모델 등이 나타나는 UX 결함이 발생한다.
   - 반드시 API 응답 내 `defaultAgentModelId` 및 `agentModelSorts`의 우선순위 rank 점수를 계산해 대표 모델을 매핑해주어야 한다.
5. **OCP(개방-폐쇄 원칙) 유지와 확장성**
   - 새로운 프로바이더가 추가되거나 기존의 UI에 추가적인 스펙(예: 대체 모델 추천 칩 등)을 보여줘야 할 때, 공유 패널이나 카드 구현 전체를 매번 뜯어고치면 회귀 오류(Regression)가 유발된다.
   - `UsageSnapshot`에는 `Option` 필드로만 고유 정보(예: `five_hour_chips`)를 싣고, 렌더링에 필요한 속성은 `UsageProvider` 디스크립터 인터페이스를 통해 필요할 때만 선택적 함수(`fiveHourChips()`, `showModelBadges` 등)로 꽂아서 사용하도록 설계하는 방식이 유지보수에 유리하다.
6. **윈도우-불가지(Window-Agnostic) 아키텍처**
   - 고정 필드(`five_hour`/`seven_day`) 대신 dynamic vector인 `windows` 모델을 도입하여 프론트의 `windowPolicy` (결합도 유발)를 완전히 제거했다.
   - 백엔드가 각 윈도우의 id, role, 상태를 직접 제어하고 방출하게 함으로써, 프론트-백 간의 결합도를 극적으로 낮추고 데이터 생성 주체가 해석 책임을 지는 단일 책임 원칙(SRP)을 극대화했다.

## 연관 스킬

- [`hb-testing`](../testing/SKILL.md): Rust/Vitest 테스트 작성·실행, 캐시 상태 격리, fake timer/localStorage mock.
- [`hb-tauri`](../tauri/SKILL.md): 커맨드 등록 / invoke / ACL / macOS 코드 서명(키체인 접근).
