---
name: hb-testing
description: How to write and run handobar's backend Rust and frontend Vitest unit tests. Use this skill whenever you add, change, or debug tests, touch cache/stateful test code, need fake timers or localStorage mocks, investigate flaky/racy tests, or run cargo test / pnpm test. This is the single source of truth for handobar testing policy, including per-test cache isolation with local Mutex<Cache>.
---

# 테스트 (handobar)

handobar는 백엔드(Rust)와 프론트엔드(React/TypeScript) 양쪽에 작고 결정적인 유닛 테스트를 둔다.
테스트는 실제 네트워크, 키체인, 사용자 홈 디렉터리 같은 외부 상태에 기대지 않고, 변환 로직과 경계 조건을
반복 가능하게 검증한다.

## 실행 명령

```sh
cargo test --manifest-path src-tauri/Cargo.toml
pnpm test
```

- Rust 백엔드만 확인할 때는 `cargo test --manifest-path src-tauri/Cargo.toml` 을 우선 사용한다.
- 프론트엔드 포맷/스토리지 테스트는 `pnpm test` 로 실행한다.
- Tauri 실행/빌드 자체가 필요한 검증은 [`hb-tauri`](../hb-tauri/SKILL.md) 스킬을 따른다.

## 백엔드 Rust 테스트

### 주요 대상

- `src-tauri/src/usage/model.rs`: `from_used_percent` 의 `100 - used` 계산과 `0~100` clamp.
- `src-tauri/src/usage/cache.rs`: `before_fetch`, `remember_success`, `remember_retry`, `remember_fallback_stale`.
- `src-tauri/src/usage/claude/api.rs`: `Retry-After` 파싱과 `utilization` -> 잔여 사용량 매핑.
- `src-tauri/src/usage/codex/source.rs`: rollout JSONL의 `rate_limits` 추출, epoch reset 시각 변환, null 윈도우 무시.

### 상태 격리 원칙

`cache.rs` 처럼 내부 상태를 가진 코드는 테스트 간 상태 공유를 피한다. 전역 테스트 캐시와 리셋 함수 조합은
병렬 테스트에서 레이스 컨디션을 만들 수 있으므로 사용하지 않는다.

권장 패턴:

```rust
#[test]
fn test_cache_flow() {
    let cache = &Mutex::new(Cache::new());

    assert!(matches!(before_fetch(cache).unwrap(), FetchDecision::Fetch));
}
```

- 각 테스트는 필요한 캐시를 로컬 `Mutex<Cache>` 로 만든다.
- 한 테스트 안에서 서로 독립된 시나리오가 필요하면 `cache2`, `cache3` 처럼 새 로컬 캐시를 만든다.
- `static TEST_CACHE`, `reset_cache_for_test`, 공유 전역 상태 초기화에 의존하지 않는다.
- 외부 API 호출, OS 키체인, 실제 Codex 세션 디렉터리는 테스트에서 직접 건드리지 않고 파싱/매핑 로직을 분리해 검증한다.

## 프론트엔드 Vitest 테스트

### 주요 대상

- `src/features/usage/format.test.ts`: `formatReset`, `formatKstIsoWithoutTimezone`.
- `src/features/usage/storage.test.ts`: localStorage 입출력, polling interval clamp, provider별 저장 키 격리.

### 시간과 브라우저 API

- 날짜/시간 포맷은 `vi.useFakeTimers()` 와 `vi.setSystemTime()` 으로 기준 시간을 고정한다.
- 테스트가 끝나면 fake timer를 복구해 다른 테스트로 시간이 새지 않게 한다.
- Node.js 환경에서 `localStorage` 를 직접 쓰는 코드는 작은 `LocalStorageMock` 을 `global.localStorage` 에 바인딩해 검증한다.
- provider별 저장 키는 서로 오염되지 않는지 같이 확인한다.

## 새 테스트를 추가할 때

1. 변경한 동작의 가장 작은 순수 단위를 먼저 찾는다.
2. 외부 상태가 필요하면 그 경계를 함수 인자, mock, 임시 fixture로 분리한다.
3. 상태를 가진 객체는 테스트별로 새 인스턴스를 만든다.
4. 실패/경계 케이스를 포함한다: 빈 캐시, 429, Retry-After 0, null 윈도우, 잘못된 저장값.
5. 관련 기능을 건드린 뒤 최소한 해당 영역 테스트를 실행하고, 가능하면 전체 `cargo test` 또는 `pnpm test` 를 실행한다.

## 연관 스킬

- [`hb-usage`](../hb-usage/SKILL.md): 사용량 provider, 캐시, rate limit, stale 응답 정책.
- [`hb-tauri`](../hb-tauri/SKILL.md): Tauri 커맨드, invoke, ACL, 코드 서명, 앱 실행/빌드.
