# AGENTS.md

> 한도바(Hando-Bar) 프로젝트에서 작업하는 AI 에이전트 및 기여자를 위한 가이드.

## 프로젝트 개요

**한도바(Hando-Bar)** 는 본인이 자주 사용하는 **Codex, Claude Code, Antigravity** 의 사용량(한도)을 직관적으로 파악할 수 있는 **macOS 메뉴바 / 시스템 트레이 앱**이다.
- 핵심 가치: 백그라운드에 상주하며 한눈에 사용량을 확인할 수 있는 가벼운 트레이 유틸리티.

## 기술 스택

Vite + React 기반의 프론트엔드와 Tauri 2(Rust) 기반의 백엔드 셸로 빌드 및 실행된다.
자세한 개발 환경 및 실행 가이드는 [`hb-tauri` 스킬](.agents/skills/hb-tauri/SKILL.md)을 참고한다.

## 디렉터리 구조 및 심볼릭 링크

Claude Code 등의 에이전트 연동 인프라 및 프로젝트 디렉터리 레이아웃 구조, 심볼릭 링크 재생성 스크립트 지침은 [`hb-agent` 스킬](.agents/skills/hb-agent/SKILL.md)을 참고한다.

## 에이전트 작업 방식 (Claude × Codex MCP)

작업 흐름, 도구 위임 규칙, Git 정책 및 안전 지침의 **단일 출처는 [`hb-agent` 스킬](.agents/skills/hb-agent/SKILL.md)** 이다. 에이전트는 작업을 시작하거나 위임할 때 이 스킬을 필히 참고한다.
- **Claude × Codex MCP 위임 구조**: 실제 구현(파일 수정 등)은 codex MCP에 위임하고 분석·계획은 Claude가 직접 담당한다.
- **Codex 사용량 기반 모델 선택**: 5시간 세션 잔여 40% 초과 시 GPT-5.5 high를 사용하고, 40% 이하면 GPT-5.4-mini를 사용한다.
- **Worktree 변경 금지 지침**: codex 호출 프롬프트에는 기존 worktree 변경 사항을 건드리지 않도록 하는 지침을 상시 포함한다.
- **Git 작업 정책**: 모든 Git 형상 관리 작업(커밋·태그·브랜칭)은 유저가 직접 결정하고 실행한다. 에이전트는 이를 대행하거나 제안하지 않는다.

## 개발 환경 및 실행

```sh
brew install node pnpm rust          # 사전 요구 (node 26.x/pnpm 11.x/rustc 1.96.x)
pnpm install && pnpm tauri dev       # 개발 모드 (Vite + Tauri 동시 실행)
```
Tauri 백엔드 연동, invoke 통신, 커맨드 추가 및 macOS 코드 서명 절차의 단일 출처는 [`hb-tauri` 스킬](.agents/skills/hb-tauri/SKILL.md)이다.

## 유닛 테스트

한도바는 백엔드(Rust)와 프론트엔드(Vitest) 양쪽에서 유닛 테스트 체계를 운영한다.
테스트 작성 전략, 시간 Mocking, localStorage 및 Mutex 격리 정책의 단일 출처는 [`hb-testing` 스킬](.agents/skills/hb-testing/SKILL.md)이다.
- **실행**: 백엔드 `cargo test`, 프론트엔드 `pnpm test`

## 사용량 추적

Claude Code, Codex, Antigravity의 잔여 사용량을 가져와 동적으로 화면에 렌더링한다.
엔드포인트, 인증, 429 Retry-After 백off 처리 및 윈도우-불가지(window-agnostic) 모델 변환 정책의 단일 출처는 [`hb-usage` 스킬](.agents/skills/hb-usage/SKILL.md)이다.

## 향후 개발 시 유의 사항

1. **트레이 팝오버**: 일반 윈도우(800x600)를 트레이 앵커 기반의 팝오버 형태로 전환하는 로직 개선이 예정되어 있다.
2. **권한(ACL)**: 신규 Tauri 권한 정의는 `src-tauri/capabilities/default.json`에 명시해야 작동한다.
3. **트레이 상주 생명주기**: 창 닫기·Cmd+Q·Dock 종료는 모두 차단되고, 완전 종료는 트레이 메뉴 "종료"(`app.exit(0)`)로만 가능하다. 동작 변경 시 깨지지 않도록 [`hb-tauri` 스킬](.agents/skills/hb-tauri/SKILL.md)의 생명주기 섹션을 따른다.

## 커밋 컨벤션

Conventional Commits 양식을 변형한 `<영문 카테고리>: <한국어 설명>` 형식을 따른다.
자세한 카테고리 선택 기준 및 작성 예시는 [`hb-commit` 스킬](.agents/skills/hb-commit/SKILL.md)을 참고한다.

## 버전 관리 및 배포

SemVer 규칙을 따르며 package.json 등 5개 파일의 버전을 동기화하여 관리한다.
버전 범프 및 GitHub Actions를 활용한 macOS 빌드·배포 파이프라인의 단일 출처는 [`hb-version` 스킬](.agents/skills/hb-version/SKILL.md)이다.
- 현재 버전: **`0.2.4`** (릴리스 완료 마일스톤)

## 스킬(Skills)

반복적이고 결정론적인 워크플로는 `.agents/skills/<skill-name>/` 에 **스킬**로 분리해 에이전트가 일관되게 수행하도록 한다. 스킬 작성·개선·평가는 `skill-creator` 스킬을 기준으로 삼는다.

### 현재 스킬 목록

| 스킬 | 출처 | 용도 | 호출 시점 |
| --- | --- | --- | --- |
| [`hb-agent`](.agents/skills/hb-agent/SKILL.md) | [에이전트 작업 방식](#에이전트-작업-방식-claude--codex-mcp) | 에이전트 인프라(TOC, 링크, 구조) 및 작업 흐름, Git 정책 | 프로젝트 작업 시작, codex 위임, 환경 셋업 시 |
| [`hb-tauri`](.agents/skills/hb-tauri/SKILL.md) | [개발 환경 및 실행](#개발-환경-및-실행) | Tauri 백엔드: 빌드/실행, invoke 통신, macOS 코드 서명 | Tauri/Rust 백엔드를 만질 때 |
| [`hb-usage`](.agents/skills/hb-usage/SKILL.md) | [사용량 추적](#사용량-추적) | provider별 잔여 사용량 fetch 및 윈도우-불가지 아키텍처 | 사용량 추적 기능 개발 및 provider 추가 시 |
| [`hb-testing`](.agents/skills/hb-testing/SKILL.md) | [유닛 테스트](#유닛-테스트) | Rust/Vitest 테스트 작성, fake timer, 캐시 격리 | 테스트를 추가·수정하거나 flaky 테스트를 다룰 때 |
| [`hb-commit`](.agents/skills/hb-commit/SKILL.md) | [커밋 컨벤션](#커밋-컨벤션) | `type: 한국어 설명` 커밋 메시지 컨벤션 지침 | 커밋 관련 작업 진행 시 |
| [`hb-version`](.agents/skills/hb-version/SKILL.md) | [버전 관리 및 배포](#버전-관리-및-배포) | 5개 파일 버전 범프 및 GitHub Actions 배포 절차 | 버전업/릴리스/태그할 때 |
