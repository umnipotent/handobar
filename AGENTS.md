# AGENTS.md

> 한도바(Hando-Bar) 프로젝트에서 작업하는 AI 에이전트 및 기여자를 위한 가이드.

## 프로젝트 개요

**한도바(Hando-Bar)** 는 본인이 자주 사용하는 **Codex, Claude Code, Antigravity** 의 사용량(한도)을
직관적으로 파악할 수 있는 **macOS 메뉴바 / 시스템 트레이 앱**이다.

- "한도" + "바(menu bar)" 의 합성어가 이름의 유래.
- 핵심 가치: 백그라운드에 상주하며 한눈에 사용량을 확인할 수 있는 가벼운 트레이 유틸리티.

## 기술 스택

| 영역 | 사용 기술 | 비고 |
| --- | --- | --- |
| 셸/런타임 | **Tauri 2** (Rust) | 네이티브 트레이, 윈도우, 시스템 연동 담당 |
| 프론트엔드 | **React 19** + **TypeScript 5.8** | UI 렌더링 |
| 번들러 | **Vite 7** | 개발 서버(포트 `1420` 고정) 및 빌드 |
| 패키지 매니저 | **pnpm** | `pnpm-workspace.yaml` 사용 |

> 현재 상태: `pnpm create tauri-app` 로 생성된 **초기 스캐폴드**. `greet` 예제 커맨드와
> 기본 React 데모 화면(`src/App.tsx`)만 존재하며, 실제 사용량 추적 로직은 아직 미구현.

## 디렉터리 구조

```
handobar/
├─ src/                  # React 프론트엔드 (UI)
│  ├─ App.tsx            # 메인 컴포넌트 (현재 Tauri 데모 화면)
│  ├─ main.tsx          # React 진입점
│  └─ assets/
├─ src-tauri/            # Tauri / Rust 백엔드
│  ├─ src/
│  │  ├─ lib.rs         # 앱 빌더 + #[tauri::command] 정의 (greet 등)
│  │  └─ main.rs        # 바이너리 진입점 → handobar_lib::run()
│  ├─ tauri.conf.json    # 앱 설정 (identifier: dev.qus0in.handobar)
│  ├─ capabilities/      # 권한(ACL) 정의 (default.json)
│  ├─ icons/            # 앱/트레이 아이콘
│  └─ Cargo.toml        # Rust 의존성
├─ docs/                 # 환경 구성 메모 (brew.md, tauri.md)
├─ public/               # 정적 에셋
└─ vite.config.ts        # 포트 1420 고정, src-tauri watch 제외
```

## 개발 환경 및 실행

사전 요구 사항 (`docs/brew.md` 참고):

```sh
brew install node pnpm rust
# node v26.x, pnpm 11.x, rustc 1.96.x 기준으로 검증됨
```

명령어:

```sh
pnpm install          # 의존성 설치 (최초 1회 pnpm approve-builds 필요할 수 있음)
pnpm tauri dev        # 개발 모드 (Vite + Tauri 동시 실행)
pnpm tauri build      # 프로덕션 빌드 (.app / 설치 파일 생성)
pnpm build            # 프론트엔드만 빌드 (tsc + vite build)
```

- 프론트–백엔드 통신: `@tauri-apps/api` 의 `invoke("커맨드명", { 인자 })` 로 Rust `#[tauri::command]` 호출.
- 새 네이티브 기능 추가 시: `src-tauri/src/lib.rs` 에 커맨드 정의 → `invoke_handler` 에 등록 → 프론트에서 `invoke` 호출.

## 향후 개발 시 유의 사항

1. **트레이 구현**: 메뉴바 앱이 목표이므로 `tauri::tray::TrayIconBuilder` 기반 트레이 아이콘/메뉴 구성이 핵심 작업.
   - 메인 윈도우는 트레이에서 토글하는 팝오버 형태로 전환 필요 (현재는 800x600 일반 윈도우).
2. **사용량 데이터 수집**: Codex / Claude Code / Antigravity 각각의 사용량 소스(설정 파일, API, 로그 등)를
   조사한 뒤 Rust 백엔드에서 읽어와 프론트로 전달하는 구조 권장.
3. **권한(ACL)**: 파일 시스템·네트워크 접근 등 신규 기능은 `src-tauri/capabilities/default.json` 의
   `permissions` 에 명시해야 동작함. `src-tauri/gen/schemas/` 는 자동 생성물이므로 직접 수정 금지.
4. **자동 생성/빌드 산출물**: `src-tauri/target/`, `dist/`, `node_modules/`, `src-tauri/gen/` 은 커밋 대상 아님.
5. **데모 코드 정리**: 실제 기능 구현을 시작할 때 `greet` 커맨드와 `App.tsx` 의 React/Vite/Tauri 로고 데모를 제거할 것.

## 커밋 컨벤션

일반적인 Conventional Commits 규칙을 따르되, **영문 카테고리(type)** 와 **한국어 설명**을 조합한다.

### 형식

```
<영문 카테고리>: <한국어로 작성한 커밋의 의도·목적·구성 설명>
```

- **영문 카테고리**: 변경의 성격을 나타내는 표준 타입(소문자).
- **한국어 설명**: 무엇을, 왜, 어떻게 변경했는지를 한국어로 명료하게 기술.
- 제목은 50자 내외로 간결하게. 필요 시 본문(body)에 상세 배경·구성 변경 내역을 한국어로 추가.

### 카테고리 목록

| 카테고리 | 의미 |
| --- | --- |
| `feat` | 새로운 기능 추가 |
| `fix` | 버그 수정 |
| `docs` | 문서 변경 (README, AGENTS.md, docs/ 등) |
| `style` | 코드 포맷·세미콜론 등 동작에 영향 없는 변경 |
| `refactor` | 기능 변화 없는 코드 구조 개선 |
| `perf` | 성능 개선 |
| `test` | 테스트 추가·수정 |
| `build` | 빌드 시스템·의존성 변경 (Cargo, pnpm, vite 등) |
| `chore` | 그 외 잡무 (설정, 스캐폴드, 자동 생성물 등) |
| `ci` | CI 설정 변경 |

### 예시

```
feat: 시스템 트레이 아이콘과 사용량 팝오버 윈도우 추가
fix: 개발 서버 포트 충돌 시 앱이 멈추던 문제 해결
docs: AGENTS.md에 프로젝트 구조와 커밋 컨벤션 정리
build: Tauri 2 + React 19 초기 스캐폴드 구성
refactor: 사용량 수집 로직을 lib.rs에서 별도 모듈로 분리
chore: 빌드 산출물 .gitignore 처리
```
