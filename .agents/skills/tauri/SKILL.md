---
name: tauri
description: How to develop the handobar app's Tauri 2 (Rust) native shell — running the app (pnpm tauri dev/build), wiring the React frontend to Rust via invoke ↔ #[tauri::command], adding new native commands, and declaring filesystem/network permissions in capabilities (ACL). Use this skill whenever you add or change a Tauri command, call invoke from the frontend, hit a permission/ACL error, edit src-tauri/, or need the dev/build commands and prerequisites. This is the single source of truth for handobar's Tauri workflow.
---

# Tauri (handobar 네이티브 셸)

handobar의 셸/런타임은 **Tauri 2 (Rust)** 가 담당한다 — 네이티브 트레이, 윈도우, 시스템 연동.
프론트엔드는 **React 19 + TypeScript**, 번들러는 **Vite 7**(개발 서버 포트 `1420` 고정)이다.
이 문서는 Tauri 백엔드를 만지는 작업(커맨드 추가, invoke 연결, 권한 선언, 실행/빌드)의 단일 출처다.

## 사전 요구 사항

```sh
brew install node pnpm rust
# node v26.x, pnpm 11.x, rustc 1.96.x 기준으로 검증됨 (docs/brew.md)
```

최초 스캐폴드 메모는 [`docs/tauri.md`](../../../docs/tauri.md), brew 버전은 [`docs/brew.md`](../../../docs/brew.md) 참고.

## 실행 / 빌드 / 테스트 명령

```sh
pnpm install          # 의존성 설치 (최초 1회 pnpm approve-builds 필요할 수 있음)
pnpm tauri dev        # 개발 모드 (Vite + Tauri 동시 실행)
pnpm tauri build      # 프로덕션 빌드 (.app / 설치 파일 생성)
pnpm build            # 프론트엔드만 빌드 (tsc + vite build)
cargo test --manifest-path src-tauri/Cargo.toml # 백엔드 Rust 유닛 테스트 실행
pnpm test             # 프론트엔드 React/TS 유닛 테스트 실행 (Vitest)
```

## 프론트 ↔ 백엔드 통신

- 프론트는 `@tauri-apps/api` 의 `invoke("커맨드명", { 인자 })` 로 Rust `#[tauri::command]` 를 호출한다.
- 응답은 커맨드의 반환 타입이 그대로 직렬화되어 프론트로 온다.

### 새 네이티브 커맨드 추가 절차

1. `src-tauri/src/lib.rs`(또는 모듈 파일, 예: `usage.rs`)에 `#[tauri::command]` 함수를 정의한다.
2. `lib.rs` 의 `invoke_handler(tauri::generate_handler![...])` 에 함수를 **등록**한다.
3. 프론트에서 `invoke("함수명", { ... })` 로 호출한다.

> 등록을 빠뜨리면 런타임에 "command not found" 가 난다. 새 커맨드는 항상 2번 단계를 확인한다.

## 권한 (ACL / capabilities)

파일 시스템·네트워크 접근 등 신규 기능은 `src-tauri/capabilities/default.json` 의 `permissions` 에
**명시해야 동작**한다. 빠지면 호출이 권한 에러로 막힌다.

- `src-tauri/gen/schemas/` 는 자동 생성물 → **직접 수정 금지**.

## 디렉터리 (백엔드)

```
src-tauri/
├─ src/
│  ├─ lib.rs          # 앱 빌더 + 트레이 구성 + 커맨드 등록(invoke_handler)
│  ├─ usage.rs        # Claude Code 잔여 사용량 fetch  → [claude-usage] 스킬
│  └─ main.rs         # 바이너리 진입점 → handobar_lib::run()
├─ tauri.conf.json    # 앱 설정 (identifier: dev.qus0in.handobar, version)
├─ capabilities/      # 권한(ACL) 정의 (default.json)
├─ icons/             # 앱/트레이 아이콘
└─ Cargo.toml         # Rust 의존성 (version)
```

## 커밋 대상 아님 (빌드 산출물)

`src-tauri/target/`, `dist/`, `node_modules/`, `src-tauri/gen/` 은 자동 생성/빌드 산출물이므로
커밋하지 않는다.

## 연관 스킬

- [`claude-usage`](../claude-usage/SKILL.md): 이 기능이 올라가는 커맨드 등록 / invoke / ACL 일반 패턴.
- [`version-bump`](../version-bump/SKILL.md): `tauri.conf.json` · `Cargo.toml` 의 `version` 동기화.

## 유닛 테스트 (Unit Testing)

handobar 프로젝트는 백엔드(Rust)와 프론트엔드(React/TS) 모두에 대해 합리적이고 신뢰할 수 있는 유닛 테스트를 지향한다.

### 1. 백엔드 테스트 (Rust)
- **테스트 대상**: 상태 비저장 변환 로직([models.rs](file:///Users/morgan/Development/handobar/src-tauri/src/usage/models.rs)) 및 글로벌 뮤텍스를 활용하는 내부 캐시 흐름([cache.rs](file:///Users/morgan/Development/handobar/src-tauri/src/usage/cache.rs)).
- **실행 방법**: `cargo test` (또는 `cargo test --manifest-path src-tauri/Cargo.toml`)
- **가이드라인**:
  - 파일 하단에 `#[cfg(test)] mod tests` 모듈을 정의하여 유닛 테스트를 작성한다.
  - 글로벌 `static CACHE` 처럼 상태를 공유하는 컴포넌트를 테스트할 때는 각 테스트가 독립적으로 실행될 수 있도록 테스트 전용 초기화 함수(예: `reset_cache_for_test`)를 호출하여 이전 상태의 오염을 방지한다.
  - 외부 API 호출이나 암호화 키체인 등 네이티브 시스템 자원은 테스트 대상에서 격리하고 순수 가공 로직 위주로 검증한다.

### 2. 프론트엔드 테스트 (Vitest)
- **테스트 대상**: 날짜 및 시간 포맷팅 변환 로직([format.ts](file:///Users/morgan/Development/handobar/src/features/claudeUsage/format.ts)), localStorage 제어 및 범위 보정([storage.ts](file:///Users/morgan/Development/handobar/src/features/claudeUsage/storage.ts)).
- **실행 방법**: `pnpm test` (또는 `npx vitest run`)
- **가이드라인**:
  - 각 기능 폴더에 `<파일명>.test.ts` 형식의 테스트 파일을 작성한다.
  - 시간/날짜처럼 동적으로 변하는 연산을 검증할 때는 `vi.useFakeTimers()`와 `vi.setSystemTime()`을 활용하여 시간을 고정한 후 단언문(Assert)을 확인한다.
  - Node.js 환경에서 브라우저 전용 API인 `localStorage`를 직접 사용하는 로직을 유닛 테스트할 때는 간단한 `LocalStorageMock` 등의 클래스를 생성해 `global.localStorage`에 수동 바인딩하여 무의미한 외부 의존성을 최소화한다.
