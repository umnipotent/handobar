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

## 실행 / 빌드 명령

```sh
pnpm install          # 의존성 설치 (최초 1회 pnpm approve-builds 필요할 수 있음)
pnpm tauri dev        # 개발 모드 (Vite + Tauri 동시 실행)
pnpm tauri build      # 프로덕션 빌드 (.app / 설치 파일 생성)
pnpm build            # 프론트엔드만 빌드 (tsc + vite build)
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

- [`claude-usage`](../claude-usage/SKILL.md): `usage.rs` 의 `get_claude_usage` 커맨드가 이 invoke/ACL 패턴 위에 올라간다.
- [`version-bump`](../version-bump/SKILL.md): `tauri.conf.json` · `Cargo.toml` 의 `version` 동기화.
