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

> 현재 상태(`0.0.1`): 시스템 트레이 아이콘·메뉴(Show/Refresh/Quit)와 사용량 표시 UI의
> 기본 골격이 구현됨. `get_usage_summary` 커맨드는 아직 **더미 문자열**을 반환하며,
> 실제 사용량 수집 로직은 미구현.

## 디렉터리 구조

```
handobar/
├─ src/                  # React 프론트엔드 (UI)
│  ├─ App.tsx            # 메인 컴포넌트 (사용량 표시 UI)
│  ├─ main.tsx          # React 진입점
│  └─ assets/
├─ src-tauri/            # Tauri / Rust 백엔드
│  ├─ src/
│  │  ├─ lib.rs         # 앱 빌더 + 트레이 구성 + 커맨드 등록
│  │  ├─ usage.rs       # Claude Code 잔여 사용량 fetch (키체인 토큰 → /api/oauth/usage)
│  │  └─ main.rs        # 바이너리 진입점 → handobar_lib::run()
│  ├─ tauri.conf.json    # 앱 설정 (identifier: dev.qus0in.handobar)
│  ├─ capabilities/      # 권한(ACL) 정의 (default.json)
│  ├─ icons/            # 앱/트레이 아이콘
│  └─ Cargo.toml        # Rust 의존성
├─ docs/                 # 환경 구성 메모 (brew.md, tauri.md)
├─ public/               # 정적 에셋
└─ vite.config.ts        # 포트 1420 고정, src-tauri watch 제외
```

## 심볼릭 링크

저장소는 같은 내용을 도구별 표준 경로로 노출하기 위해 아래 심볼릭 링크를 사용한다.
모두 **상대 경로** 링크라 클론·다른 머신에서도 그대로 동작하며, Git에는 링크 자체(mode `120000`)로 커밋된다.

| 링크 | 대상 | 목적 |
| --- | --- | --- |
| `CLAUDE.md` | `AGENTS.md` | Claude Code가 자동으로 읽는 `CLAUDE.md` 경로로 동일 가이드 노출 |
| `.claude/skills` | `.agents/skills` | Claude Code 스킬 디렉터리(`.claude/skills`)로 프로젝트 스킬 전체 노출 |

운영 시 주의:

- **단일 출처는 링크 대상**(`AGENTS.md`, `.agents/skills/`). 링크 쪽을 직접 편집하지 말고 대상만 수정한다.
- 새 스킬은 `.agents/skills/<name>/` 에 추가하면 디렉터리 링크를 통해 자동 노출된다 — 개별 링크 불필요.
- 링크가 끊겼다면 다음으로 재생성한다:
  ```sh
  ln -s AGENTS.md CLAUDE.md
  ln -s ../.agents/skills .claude/skills
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

1. **트레이 동작 개선**: 트레이 아이콘·메뉴는 구현됨(`lib.rs`). 메인 윈도우는 닫기 시 숨김 처리되며 트레이에 상주한다.
   - 다음 단계: 일반 윈도우(800x600)를 트레이 앵커 기반 **팝오버 형태**로 전환.
2. **사용량 데이터 수집**: **Claude Code** 는 구현됨 — `usage.rs` 의 `get_claude_usage` 커맨드가
   OS 키체인(`Claude Code-credentials`)의 OAuth 토큰을 읽어 `GET https://api.anthropic.com/api/oauth/usage`
   를 직접 호출하고, `utilization` 에서 **잔여 = 100 - utilization** 를 계산해 5시간·주간 윈도우로 반환한다.
   - 인증: 별도 로그인 없이 이미 로그인된 Claude Code 자격증명을 재사용한다(토큰 갱신은 Claude Code가 담당).
     토큰 없음/만료 시 "로그인 필요" 메시지를 반환한다. 첫 실행 시 macOS 키체인 접근 허용 프롬프트가 뜰 수 있다.
   - 폴링 주기는 프론트에서 1~10분으로 조정(localStorage `handobar.intervalMin`).
   - 남은 작업: **Codex / Antigravity** 의 사용량 소스를 조사해 같은 방식으로 추가.
3. **권한(ACL)**: 파일 시스템·네트워크 접근 등 신규 기능은 `src-tauri/capabilities/default.json` 의
   `permissions` 에 명시해야 동작함. `src-tauri/gen/schemas/` 는 자동 생성물이므로 직접 수정 금지.
4. **자동 생성/빌드 산출물**: `src-tauri/target/`, `dist/`, `node_modules/`, `src-tauri/gen/` 은 커밋 대상 아님.

## 커밋 컨벤션

`<영문 카테고리>: <한국어 설명>` 형식(영문 Conventional-Commits type + 한국어 의도 설명)을 따른다.

```
feat: 시스템 트레이 아이콘과 사용량 팝오버 윈도우 추가
```

> 카테고리 선택 기준·예시·작성 절차의 **단일 출처는 [`commit-message` 스킬](.agents/skills/commit-message/SKILL.md)** 이다.
> 커밋 메시지를 작성할 때는 이 스킬을 따른다.

## 버전 관리

[Semantic Versioning](https://semver.org/lang/ko/) (`MAJOR.MINOR.PATCH`) 을 따른다.

### 버전 단일 출처(Single Source of Truth)

버전 번호는 아래 **세 곳을 항상 동일하게** 유지해야 한다. 한 곳만 올리면 불일치가 발생한다.

| 파일 | 필드 |
| --- | --- |
| `package.json` | `"version"` |
| `src-tauri/tauri.conf.json` | `"version"` |
| `src-tauri/Cargo.toml` | `version` (변경 후 `Cargo.lock` 도 갱신) |

### 릴리스 절차

이 절차는 [`version-bump` 스킬](#스킬skills)로 자동화되어 있다. **버전업 시 스킬을 사용한다.**

1. 네 파일(`package.json`, `tauri.conf.json`, `Cargo.toml`, `Cargo.lock`)의 버전을 동일하게 맞춘다.
   → `python3 .agents/skills/version-bump/scripts/bump_version.py <x.y.z>`
2. [`commit-message` 스킬](#스킬skills)을 따라 `chore: x.y.z 버전업` 으로 커밋한다.
3. 해당 커밋에 동일 버전의 Git 태그를 단다: `git tag -a x.y.z -m "x.y.z"`.

> 태그명은 `v` 접두사 없이 **순수 버전 번호**(예: `0.0.1`)를 사용한다.
> 현재 버전: **`0.0.2`** (스킬 인프라 정비: commit-message·version-bump, 심볼릭 링크 문서화).

## 스킬(Skills)

반복적이고 결정론적인 워크플로는 `.agents/skills/<skill-name>/` 에 **스킬**로 분리해
에이전트가 일관되게 수행하도록 한다. 스킬 작성·개선·평가는 `skill-creator` 스킬을 기준으로 삼는다.

> Claude Code는 [`.claude/skills` → `.agents/skills` 심볼릭 링크](#심볼릭-링크)로 스킬을 인식한다.
> 새 스킬은 `.agents/skills/<name>/` 에 추가하기만 하면 별도 링크 없이 바로 노출된다.

> `skill-creator` 는 `anthropics/skills` 에서 가져온 **서드파티 vendored 스킬**로,
> `skills-lock.json` 으로 버전이 관리되며 **저장소에는 커밋하지 않는다**(`.gitignore`).
> 클론 후 스킬 설치 도구로 재설치하면 `.agents/skills/skill-creator/` 에 복원된다.

### 스킬화 기준

`skill-creator` 가이드에 근거해, 아래에 해당할수록 스킬화한다.

- **반복성**: 같은 절차를 여러 번 수행한다 (릴리스, 정형 커밋 등).
- **결정론성**: 입력이 같으면 출력이 같다 → `scripts/` 로 묶어 실수를 없앤다.
- **다단계·실수 유발**: 여러 파일/단계를 손으로 맞춰야 해 누락이 잦다.
- **명확한 트리거**: "이럴 때 쓴다"를 한 문장으로 기술할 수 있다.

반대로 1회성 작업, 주관적 판단(디자인·문체)이 핵심인 작업은 스킬화하지 않고 문서로 남긴다.

### 스킬 작성 원칙 (요약)

- `SKILL.md` 프런트매터의 `name` 과 `description` 이 트리거의 핵심. `description` 에
  "무엇을 하는지 + 언제 쓰는지"를 모두 담고, 과소 트리거를 막기 위해 다소 적극적으로 기술한다.
- 점진적 공개(Progressive Disclosure): 본문은 간결히, 큰 참고 문서는 `references/`,
  결정론적 작업은 `scripts/` 로 분리한다.
- 자세한 절차·평가 루프는 `skill-creator` 스킬(재설치 후 `.agents/skills/skill-creator/SKILL.md`) 참고.

### 현재 스킬 목록

| 스킬 | 출처(AGENTS.md 섹션) | 용도 | 호출 시점 |
| --- | --- | --- | --- |
| [`commit-message`](.agents/skills/commit-message/SKILL.md) | [커밋 컨벤션](#커밋-컨벤션) | `type: 한국어 설명` 커밋 메시지 작성 | 커밋 메시지를 쓸 때마다 |
| [`version-bump`](.agents/skills/version-bump/SKILL.md) | [버전 관리](#버전-관리) | 네 파일 버전 동기화 + 커밋·태그 (스크립트 번들) | 버전업/릴리스/태그할 때 |

**연관**: `version-bump` 의 커밋 단계는 `commit-message` 스킬을 호출해 메시지를 작성한다.
