---
name: hb-tauri
description: How to develop the handobar app's Tauri 2 (Rust) native shell — running the app (pnpm tauri dev/build), wiring the React frontend to Rust via invoke ↔ #[tauri::command], adding new native commands, and declaring filesystem/network permissions in capabilities (ACL). Use this skill whenever you add or change a Tauri command, call invoke from the frontend, hit a permission/ACL error, edit src-tauri/, or need the dev/build commands and prerequisites. This is the single source of truth for handobar's Tauri workflow.
---

# Tauri (handobar 네이티브 셸)

handobar의 셸/런타임은 **Tauri 2 (Rust)** 가 담당한다 — 네이티브 트레이, 윈도우, 시스템 연동.
프론트엔드는 **React 19 + TypeScript**, 번들러는 **Vite 7**(개발 서버 포트 `1420` 고정)이다.
이 문서는 Tauri 백엔드를 만지는 작업(커맨드 추가, invoke 연결, 권한 선언, 실행/빌드)의 단일 출처다.

## 사전 요구 사항

```sh
brew install node pnpm rust
# node v26.x, pnpm 11.x, rustc 1.96.x 기준으로 검증됨
```

프로젝트 전반의 개발 환경 및 실행 기준은 [`AGENTS.md`](../../../AGENTS.md) 와 이 스킬을 단일 출처로 둔다.

## 실행 / 빌드 / 테스트 명령

```sh
pnpm install          # 의존성 설치 (최초 1회 pnpm approve-builds 필요할 수 있음)
pnpm tauri dev        # 개발 모드 (Vite + Tauri 동시 실행)
pnpm tauri build      # 프로덕션 빌드 (.app / 설치 파일 생성)
pnpm build            # 프론트엔드만 빌드 (tsc + vite build)
cargo test --manifest-path src-tauri/Cargo.toml # 백엔드 Rust 유닛 테스트 실행
pnpm test             # 프론트엔드 React/TS 유닛 테스트 실행 (Vitest)
```

테스트 작성 원칙과 flaky/racy 테스트 대응은 [`hb-testing`](../hb-testing/SKILL.md) 스킬을 따른다.

## 프론트 ↔ 백엔드 통신

- 프론트는 `@tauri-apps/api` 의 `invoke("커맨드명", { 인자 })` 로 Rust `#[tauri::command]` 를 호출한다.
- 응답은 커맨드의 반환 타입이 그대로 직렬화되어 프론트로 온다.

### 새 네이티브 커맨드 추가 절차

1. `src-tauri/src/lib.rs`(또는 모듈 파일, 예: `usage.rs`)에 `#[tauri::command]` 함수를 정의한다.
2. `lib.rs` 의 `invoke_handler(tauri::generate_handler![...])` 에 함수를 **등록**한다.
3. 프론트에서 `invoke("함수명", { ... })` 로 호출한다.

> 등록을 빠뜨리면 런타임에 "command not found" 가 난다. 새 커맨드는 항상 2번 단계를 확인한다.

## 윈도우 / 트레이 생명주기 (백그라운드 상주)

handobar는 **트레이 상주** 유틸리티이므로, 윈도우를 닫거나 Cmd+Q를 눌러도 앱이 죽지 않고
우측 상단 트레이 아이콘으로 상주해야 한다. 이 동작은 `lib.rs`에서 두 단계로 보장한다.

1. **윈도우 닫기(빨간 버튼) → 숨김**: `on_window_event`의 `CloseRequested`에서 `window.hide()` +
   `api.prevent_close()`로 윈도우만 숨기고 프로세스는 유지한다.
2. **앱 종료(Cmd+Q / Dock 종료) → 차단, 트레이 유지**: 빌더를 `.run(...)`이 아니라 `.build(...)`로
   만든 뒤 `app.run(|_, event| ...)`에서 `RunEvent::ExitRequested`를 가로채 `api.prevent_exit()`로
   막는다. 이때 **`code`로 의도된 종료와 그렇지 않은 종료를 구분**한다.
   - `code.is_none()` (Cmd+Q, Dock "종료", 마지막 윈도우 닫힘 등 시스템 발 종료) → `prevent_exit()`로 차단.
   - `code.is_some()` (트레이 메뉴 "종료"가 호출한 `app.exit(0)`) → 그대로 통과시켜 **실제 종료**.

> 즉, 앱을 완전히 끄는 **유일한 경로는 트레이 컨텍스트 메뉴의 "종료"**(`app.exit(0)`)다. 다른 모든
> 종료 시도는 트레이 상주를 위해 무시된다. 트레이 생명주기 동작을 바꿀 때는 이 구분을 깨지 않도록 주의한다.

## 권한 (ACL / capabilities)

파일 시스템·네트워크 접근 등 신규 기능은 `src-tauri/capabilities/default.json` 의 `permissions` 에
**명시해야 동작**한다. 빠지면 호출이 권한 에러로 막힌다.

- `src-tauri/gen/schemas/` 는 자동 생성물 → **직접 수정 금지**.

## 디렉터리 (백엔드)

```
src-tauri/
├─ src/
│  ├─ lib.rs          # 앱 빌더 + 트레이 구성 + 커맨드 등록(invoke_handler)
│  ├─ usage/          # provider별 잔여 사용량(claude/codex) + 공유 코어  → [hb-usage] 스킬
│  └─ main.rs         # 바이너리 진입점 → handobar_lib::run()
├─ tauri.conf.json    # 앱 설정 (identifier: dev.qus0in.handobar, version)
├─ capabilities/      # 권한(ACL) 정의 (default.json)
├─ icons/             # 앱/트레이 아이콘
└─ Cargo.toml         # Rust 의존성 (version)
```

## 커밋 대상 아님 (빌드 산출물)

`src-tauri/target/`, `dist/`, `node_modules/`, `src-tauri/gen/` 은 자동 생성/빌드 산출물이므로
커밋하지 않는다.

## 아이콘 변경이 반영되지 않을 때 (강제 재빌드)

앱/트레이 아이콘(`src-tauri/icons/*`)은 컴파일 시점에 바이너리에 바이트로 임베드된다. 다만 Tauri codegen이
아이콘 파일 변경을 재빌드 의존성으로 추적하지 않아, 아이콘만 바꾸면 Rust 재빌드가 일어나지 않을 수 있다.

해결 방법:

```sh
touch src-tauri/tauri.conf.json   # codegen 입력이라 변경 추적됨
# 또는
cargo clean -p handobar           # 해당 패키지 빌드 산출물 제거 후 재빌드
```

- `pnpm tauri dev` 실행 중이면 `touch src-tauri/tauri.conf.json` 만으로 자동 재빌드·재실행된다.
- 배포용 `.app` 은 `pnpm tauri build` 를 다시 실행해야 새 아이콘이 반영된다.
- 재빌드 후에도 Finder/Dock에 옛 아이콘이 보이면 macOS 아이콘 캐시 문제이므로 `killall Dock Finder` 로 해소한다.

아이콘 세트를 다시 생성할 때는 루트의 `app-icon.png` 또는 `assets/app-icon.svg` 를 소스로 사용한다:

```sh
pnpm tauri icon app-icon.png
```

handobar는 macOS 전용 앱이므로 생성된 `src-tauri/icons/android`, `src-tauri/icons/ios` 폴더는 삭제한다.

## macOS 코드 서명 (키체인 접근 영속화)

handobar는 사용량 토큰을 **OS 키체인**(`Claude Code-credentials`)에서 읽으므로, 앱이 그 항목에 접근할 때
macOS가 허용 프롬프트를 띄운다. 사용자가 **"항상 허용"** 을 눌러도, 그 권한은 앱의 **고정 서명 신원
(Designated Requirement, DR)** 에 묶인다는 점이 핵심이다.

### 왜 매번 다시 묻나 (근본 원인)

- 기본 빌드는 **adhoc 서명**(`Signature=adhoc`, `TeamIdentifier=not set`)이다.
- adhoc는 안정된 신원이 없어 DR이 바이너리 **CDHash**가 된다. `cargo build`/`tauri dev`로 **재빌드할 때마다
  CDHash가 바뀌므로**, 저장된 "항상 허용"(이전 CDHash 기준)이 더 이상 매칭되지 않아 다시 묻는다.
- 게다가 우리가 읽는 항목은 **Claude Code가 소유**한 교차-앱 항목이라 ACL 매칭이 더 엄격하다.

### 해결: 고정 self-signed 신원으로 서명

고정 인증서로 서명하면 DR이 CDHash가 아니라 **식별자 + 인증서**에 묶여 재빌드에도 동일하게 유지된다:

```
designated => identifier "dev.qus0in.handobar" and certificate leaf = H"<cert-sha1>"
```

1. **1회 셋업** (멱등): `pnpm setup:signing` → `scripts/setup-macos-signing.sh` 가 `handobar-dev`
   self-signed **코드서명** 인증서를 로그인 키체인에 생성하고 코드서명용으로 신뢰 설정한다.
   (내부적으로 openssl로 `extendedKeyUsage=codeSigning` 인증서를 만들고, macOS `security` 호환을 위해
   legacy(SHA1 MAC/3DES) p12로 임포트한 뒤 `security add-trusted-cert -p codeSign` 으로 신뢰한다.)
2. **설정 연결**: `tauri.conf.json` 의 `bundle.macOS.signingIdentity: "handobar-dev"` 가 이 신원을 가리킨다.
   → `pnpm tauri build` 가 `.app` 을 이 신원으로 서명한다.
3. **권장 사용**: 서명된 `.app` 을 설치해 실행 → 키체인에서 한 번 "항상 허용" 하면 이후 재빌드(같은 인증서)에도 유지.

### `tauri dev` 한계

`tauri dev` 는 cargo가 바이너리를 **adhoc로 (재)서명**하므로 `signingIdentity` 가 적용되지 않는다. 따라서
Rust 재빌드마다 프롬프트가 다시 뜰 수 있다. 빌드된 dev 바이너리를 고정 신원으로 직접 서명하려면:

```sh
pnpm sign:dev   # codesign --force --identifier dev.qus0in.handobar --sign handobar-dev <debug binary>
```

지속적인 무프롬프트 경험이 필요하면 dev 대신 **서명된 release 빌드**를 사용한다.

### 검증 / 트러블슈팅

```sh
security find-identity -v -p codesigning            # 'handobar-dev' 신원 존재 확인
codesign -dvvv <바이너리>                            # Authority=handobar-dev, Signature!=adhoc 확인
codesign -d --requirements - <바이너리>              # designated => ... certificate leaf = H"..." (고정 DR) 확인
```

- `signingIdentity` 는 **로컬 신원 이름**을 가리킨다. 신원이 없는 머신에서 `tauri build` 는 실패하므로
  먼저 `pnpm setup:signing` 을 실행한다.
- 인증서를 새로 만들면(인증서 해시 변경) DR이 바뀌어 키체인 "항상 허용"이 1회 다시 뜬다 — 정상이다.

## 연관 스킬

- [`hb-usage`](../hb-usage/SKILL.md): provider별 잔여 사용량 추적이 이 커맨드 등록 / invoke / ACL 패턴 위에 올라간다.
  키체인에서 읽는 Claude 토큰이 코드 서명 프롬프트의 대상이다.
- [`hb-testing`](../hb-testing/SKILL.md): Rust/Vitest 테스트 작성·실행, cache/fake timer/localStorage 상태 격리.
- [`hb-version`](../hb-version/SKILL.md): `tauri.conf.json` · `Cargo.toml` 의 `version` 동기화.

## 유닛 테스트

Rust/Vitest 테스트 작성·실행, cache/fake timer/localStorage 상태 격리, flaky/racy 테스트 대응은
[`hb-testing`](../hb-testing/SKILL.md) 스킬을 단일 출처로 따른다.
