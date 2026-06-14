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

> 현재 상태: 시스템 트레이 아이콘·메뉴(Show/Refresh/Quit)와 **Claude Code·Codex·Antigravity 잔여 사용량**
> 표시 UI(마지막 갱신 시각 포함)가 구현됨([사용량 추적](#사용량-추적) 참고).
> 사용량 기능은 `feature-agy` 브랜치에서 개발 중(미릴리스).

## 디렉터리 구조

```
handobar/
├─ src/                  # React 프론트엔드 (UI)
│  ├─ App.tsx            # 앱 조립 컴포넌트
│  ├─ features/
│  │  ├─ usage/         # 공유 사용량 UI/상태/gateway/포맷 (훅·패널·카드)
│  │  ├─ claudeUsage/   # Claude provider 디스크립터(provider.ts)
│  │  └─ codexUsage/    # Codex provider 디스크립터(provider.ts)
│  ├─ main.tsx          # React 진입점
│  └─ assets/
├─ src-tauri/            # Tauri / Rust 백엔드
│  ├─ src/
│  │  ├─ lib.rs         # 앱 빌더 + 트레이 구성 + 커맨드 등록
│  │  ├─ usage/         # 잔여 사용량: 공유 model/cache + provider 모듈(claude/codex)
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

## 에이전트 작업 방식 (Claude × Codex MCP)

작업 흐름, 도구 위임 규칙, Git 정책 및 안전 지침의 **단일 출처는 [`hb-agent` 스킬](.agents/skills/agent/SKILL.md)** 이다. 에이전트는 작업을 시작하거나 위임할 때 이 스킬을 필히 참고한다.

- **Claude × Codex MCP 위임 구조**: 실제 구현(파일 수정 등)은 codex MCP에 위임하고 분석·계획은 Claude가 직접 담당한다.
- **Codex 사용량 기반 모델 선택**: 5시간 세션 잔여 40% 초과 시 GPT-5.5 medium fast를 사용하고, 40% 이하면 GPT-5.4-mini를 사용한다.
- **Worktree 변경 금지 지침**: codex 호출 프롬프트에는 기존 worktree 변경 사항을 건드리지 않도록 하는 지침을 상시 포함한다.
- **Git 작업 정책**: 커밋·태그·브랜칭은 사용자가 직접 터미널에서 진행한다. 에이전트는 이 명령을 실행하거나 제안하지 않는다.


## 개발 환경 및 실행

```sh
brew install node pnpm rust          # 사전 요구 (docs/brew.md, node 26.x/pnpm 11.x/rustc 1.96.x)
pnpm install                         # 의존성 설치
pnpm tauri dev                       # 개발 모드 (Vite + Tauri 동시 실행)
pnpm tauri build                     # 프로덕션 빌드 (.app / 설치 파일)
```

> 실행/빌드, 프론트–백엔드 `invoke` 통신, 새 커맨드 추가 절차, 권한(ACL)의 **단일 출처는
> [`hb-tauri` 스킬](.agents/skills/tauri/SKILL.md)** 이다. Tauri 백엔드를 만질 때는 이 스킬을 따른다.

## 유닛 테스트

한도바는 코드 안정성을 유지하기 위해 백엔드와 프론트엔드 양쪽에서 합리적인 유닛 테스트 체계를 작성 및 실행한다.

- **실행 명령**:
  - **백엔드 (Rust)**: `cargo test` (또는 `cargo test --manifest-path src-tauri/Cargo.toml`)
  - **프론트엔드 (Vitest)**: `pnpm test` (또는 `npx vitest run`)

주요 테스트 영역은 usage 모델/캐시/provider 파싱, 프론트엔드 포맷·localStorage 격리다. 특히 상태를 가진
백엔드 캐시 테스트는 전역 테스트 캐시를 공유하지 않고 테스트별 로컬 `Mutex<Cache>` 로 격리한다.

> 테스트 작성 전략, 시간 Mocking, localStorage Mocking, 상태 격리 및 레이스 컨디션 방지 가이드의
> **단일 출처는 [`hb-testing` 스킬](.agents/skills/testing/SKILL.md)** 이다.

## 사용량 추적

provider별 **잔여 사용량**을 같은 도메인 모델로 보여준다. 공유 코어 위에 provider 모듈을 올려
provider 추가 시 기존 코드를 수정하지 않는다(OCP).

- **Claude Code** (`get_claude_usage`): 키체인 토큰 → `GET /api/oauth/usage`, 잔여 = 100 − utilization. 429 backoff 있음.
- **Codex** (`get_codex_usage`): `~/.codex/sessions` 최신 rollout의 `rate_limits` 스냅샷(primary=5h, secondary=주간),
  잔여 = 100 − used_percent. 네트워크·인증 없음.
- **Antigravity** (`get_antigravity_usage`): Antigravity IDE 자체 `state.vscdb`(SQLite)의 OAuth 토큰 → 필요 시
  Google OAuth 갱신 → `daily-cloudcode-pa.googleapis.com`의 `loadCodeAssist`/`fetchAvailableModels`(`User-Agent` 헤더
  필수, 없으면 403). 콕핏 확장 캐시나 Gemini CLI 쿼터가 아닌 **Antigravity 자체 쿼터**다. Gemini/타사(Claude·OSS 등)
  모델을 `apiProvider`로 그룹핑해 각 윈도우의 대표 모델(잔여율, `defaultAgentModelId`/`agentModelSorts` 우선순위 기반
  선정)과 추천 모델 칩(윈도우의 `chips`)을 표시한다. `quotaInfo`는 있는데 `remainingFraction`이
  없으면 소진(0%)이다. 요금제 배지는 `paidTier.name`(없으면 `currentTier.name`) 기준.

**도메인 모델은 윈도우-불가지(window-agnostic)다.** `UsageSnapshot` 은 고정 `five_hour`/`seven_day` 필드가 아니라
**`windows: Vec<UsageWindow>`** 를 가지며, 각 `UsageWindow` 는 안정 `id`(예: `five_hour`,`seven_day`,`gemini`,`non_gemini`)·
`role`(`session`/`long`/`other`)·`remaining`/`used`/`resets_at`·선택적 `chips` 를 담는다. 사용자에게 보이는 라벨은
백엔드에 두지 않고(프론트 `copy.ts` 의 id→라벨 맵 + provider descriptor 의 `windowLabel`/`windowHint` 오버라이드)
백엔드는 id+role+수치만 내려준다. `role: session` 윈도우가 트레이 표시값·fast-mode/세션 경고의 기준이며,
null-window 의미(미사용→100%/소진→0%/omit)는 각 provider 백엔드가 직접 결정한다(프론트의 옛 `windowPolicy` 제거).
프론트는 windows 를 순회해 **모든 카드를 항상 렌더**하며 각 카드는 사용자가 접기/펼치기 가능하다(`…​.window.<id>.collapsed`).
칩이 있는 카드는 카드 내부 토글로 **모델 칩 목록 전체를 보이기/숨기기**(`…​.window.<id>.chipsCollapsed`). 트레이 표시는
provider별 **윈도우 선택**으로 동작한다: `role: session` 윈도우가 있으면(Claude/Codex) 그 윈도우 on/off, 없으면
(Antigravity) `off → 첫 윈도우 → 둘째 윈도우 → off` 순환(선택 저장 `…​.trayWindow`). 경고/에러/고갈 메시지는 카드
묶음 다음·메모 카드 바로 위의 단일 영역(`.panel-messages`)에 모아 표시한다.

구조는 과한 계층화를 피하면서 기능 단위로 분리한다. 백엔드는 `src-tauri/src/usage/` 아래에서 공유
도메인(`model.rs`)·캐시(`cache.rs`) 위에 `claude/`·`codex/`·`antigravity/` provider 모듈을 둔다. 프론트엔드는
`src/features/usage/` 에 공유 타입·포맷·localStorage·gateway(DIP)·상태 훅(`useUsage`)·카드·패널을 두고,
`src/features/{claudeUsage,codexUsage}/provider.ts` 가 제목·커맨드·저장 키만 주입한다. 폴링 주기는
프론트에서 1~10분(저장 키 provider별 분리). 응답의 `fetched_at` 은 KST `YYYY-MM-DDThh:mm:ss`(타임존 표기 제외)로
표시하고, 리셋 시각은 상대 시간과 정확한 KST 시각을 함께 보여준다. 트레이 라벨은 `src-tauri/src/labels.rs`.

비주얼 경고 정책으로, 60% 이하 40% 초과 잔여 사용량 시 주황색(`.warning`), 40% 이하일 때 빨간색(`.danger`)으로 표시하여 직관적인 피드백을 준다. 또한, 5시간 세션 잔여 사용량이 40% 이하 20% 초과일 때 "fast mode 비활성화를 추천합니다" 경고 배너를 띄우고, 20% 이하일 때 "복잡한 작업 지시를 지양하고 세션 상황을 계속 동기화하세요" 경고 배너를 띄우며 닫을 수 있게 지원한다.

**메시지 및 상수 하드코딩 방지 지침**:
- 사용자에게 노출되는 경고 문구, 버튼 라벨 등 모든 한국어/영어 텍스트는 UI 컴포넌트 내부나 백엔드 호출부에 하드코딩하지 않고, `src/features/usage/copy.ts` 내 `USAGE_COPY`에 정의하여 중앙 집중식으로 관리해야 한다.
- 임계값 수치(예: 60%, 40%, 20%) 또한 하드코딩하지 않으며 `src/features/usage/config.ts`에 상수(`THRESHOLD_WARNING`, `THRESHOLD_DANGER`, `THRESHOLD_CRITICAL`)로 선언하여 참조해야 한다.

> 엔드포인트·인증·소스·폴링/rate limit·경고 정책·provider 추가 절차의 **단일 출처는
> [`hb-usage` 스킬](.agents/skills/usage/SKILL.md)** 이다.

### 개발 시 깨달은 내용 (Lessons Learned)

Antigravity 사용량 연동(feature-agy 브랜치 작업) 과정에서 도출된 핵심 경험적 교훈은 다음과 같다:

1. **User-Agent 기반 403 인증 차단**: Google API(`fetchAvailableModels`) 호출 시, Bearer 토큰이 올바르더라도 `User-Agent` 헤더 규격을 지키지 않으면 `403 Forbidden`을 반환한다. 적절한 플랫폼 UA 값을 반드시 전송해야 한다.
2. **Protobuf 바이트 파싱 최적화**: SQLite에서 읽은 2진 데이터를 직접 파싱(varint 및 wire-type 루프)해 sentinel 매칭 및 access_token을 추출함으로써, 대형 의존성인 `prost`를 도입하지 않고 바이너리 경량화를 달성했다.
3. **잔여 Fraction 생략 = 0%**: `remainingFraction` 필드가 누락되어 있는 모델은 쿼터가 소진(0%)된 상태이므로, 이를 `unwrap_or(0.0)` 처리해 실시간 고갈 경고가 작동하도록 보정해야 한다.
4. **대표 모델 랭킹 산출**: 단순 정렬 시 잘못된 모델이 대표로 표시된다. API의 `defaultAgentModelId` 및 `agentModelSorts` 우선순위 구조를 해석하여 대표 모델을 선정함으로써 UX의 정확성을 확보했다.
5. **OCP 디자인 패턴**: 신규 모델 칩 등 개별 프로바이더만의 데이터를 UI에 표현할 때, 전역 컴포넌트를 직접 오염시키는 대신 `UsageSnapshot` 및 `UsageProvider` 인터페이스의 옵션 옵션들(`chips`, `showModelBadges` 등)을 추가하여 사이드 이펙트 없이 확장했다.
6. **윈도우-불가지(Window-Agnostic) 아키텍처**: 고정 필드(`five_hour`/`seven_day`) 대신 dynamic vector인 `windows` 모델을 도입하여 프론트의 `windowPolicy` (결합도 유발)를 완전히 제거했다. 백엔드가 각 윈도우의 id, role, 상태를 직접 제어하고 방출하게 함으로써, 프론트-백 간의 결합도를 극적으로 낮추고 데이터 생성 주체가 해석 책임을 지는 단일 책임 원칙(SRP)을 극대화했다.

### macOS 코드 서명 (키체인 "항상 허용" 유지)

사용량 토큰을 키체인에서 읽을 때 macOS가 허용 프롬프트를 띄운다. **"항상 허용"은 앱의 고정 서명 신원에
묶이는데**, 기본 adhoc 서명은 빌드마다 CDHash가 바뀌어 매번 다시 묻는다. 고정 self-signed 인증서로
서명하면 신원이 안정되어 허용이 유지된다.

- **1회 셋업**: `pnpm setup:signing` → `handobar-dev` 코드서명 인증서 생성·신뢰
  (`tauri.conf.json` 의 `bundle.macOS.signingIdentity` 가 이를 사용).
- **권장**: `pnpm tauri build` 의 서명된 `.app` 사용 → 한 번 "항상 허용" 후 유지. dev는 `pnpm sign:dev`.

> 원인·셋업·검증·트러블슈팅의 **단일 출처는 [`hb-tauri` 스킬](.agents/skills/tauri/SKILL.md)** 의
> "macOS 코드 서명" 절이다.

## 향후 개발 시 유의 사항

1. **트레이 동작 개선**: 트레이 아이콘·메뉴는 구현됨(`lib.rs`). 메인 윈도우는 닫기 시 숨김 처리되며 트레이에 상주한다.
   - 다음 단계: 일반 윈도우(800x600)를 트레이 앵커 기반 **팝오버 형태**로 전환.
2. **다른 도구 사용량 연동**: **Claude Code·Codex·Antigravity** 는 구현 완료([사용량 추적](#사용량-추적)).
   새 provider 추가 시에는 같은 provider 구조를 따른다([`hb-usage` 스킬](.agents/skills/usage/SKILL.md)의 추가 절차 참고).
3. **권한(ACL)**: 파일 시스템·네트워크 접근 등 신규 기능은 `src-tauri/capabilities/default.json` 의
   `permissions` 에 명시해야 동작함(자세한 절차는 [`hb-tauri` 스킬](.agents/skills/tauri/SKILL.md)).
   `src-tauri/gen/schemas/` 는 자동 생성물이므로 직접 수정 금지.
4. **자동 생성/빌드 산출물**: `src-tauri/target/`, `dist/`, `node_modules/`, `src-tauri/gen/` 은 커밋 대상 아님.

## 커밋 컨벤션

`<영문 카테고리>: <한국어 설명>` 형식(영문 Conventional-Commits type + 한국어 의도 설명)을 따른다.

```
feat: 시스템 트레이 아이콘과 사용량 팝오버 윈도우 추가
```

> 카테고리 선택 기준·예시·작성 절차의 **단일 출처는 [`hb-commit` 스킬](.agents/skills/commit-message/SKILL.md)** 이다.
> 커밋은 유저가 직접 antigravity CLI에 요청하며, Claude·Codex는 실행은 물론 **메시지 제안조차 하지
> 않는다**([Git 작업 정책](#git-작업-정책) 참고).

## 버전 관리

[Semantic Versioning](https://semver.org/lang/ko/) (`MAJOR.MINOR.PATCH`) 을 따른다.

### Git 운영 규칙

- **Force Push 금지**: 원격 저장소의 커밋 히스토리를 파괴하는 강제 푸시(`--force`, `-f`)는 어떠한 경우에도 허용하지 않는다. 원격 브랜치와 로컬 브랜치가 갈라진 경우 강제로 덮어쓰는 대신, 원격의 변경 사항을 병합(`git pull`)하거나 재정렬(`git rebase`)하여 해결한다.

### 버전 단일 출처(Single Source of Truth)

버전 번호는 아래 **다섯 곳을 항상 동일하게** 유지해야 한다. 한 곳만 올리면 불일치가 발생한다.

| 파일 | 필드 |
| --- | --- |
| `package.json` | `"version"` |
| `src-tauri/tauri.conf.json` | `"version"` |
| `src-tauri/Cargo.toml` | `version` (변경 후 `Cargo.lock` 도 갱신) |
| `AGENTS.md` | `현재 버전: **`x.y.z`**` |

### 릴리스 절차

이 절차는 [`hb-version` 스킬](#스킬skills)로 자동화되어 있다. **버전업 시 스킬을 사용한다.**

1. 다섯 파일(`package.json`, `tauri.conf.json`, `Cargo.toml`, `Cargo.lock`, `AGENTS.md`)의 버전을 동일하게 맞춘다.
   → `python3 .agents/skills/version-bump/scripts/bump_version.py <x.y.z>`
2. `chore: x.y.z 버전업` 커밋은 **유저가 직접 antigravity CLI에 요청**한다
   (메시지 컨벤션은 [`hb-commit` 스킬](#스킬skills), [Git 작업 정책](#git-작업-정책) 참고).
3. 해당 커밋에 동일 버전의 Git 태그(`git tag -a x.y.z -m "x.y.z"`)를 다는 것도
   유저가 직접 antigravity CLI에 요청한다.

> 태그명은 `v` 접두사 없이 **순수 버전 번호**(예: `0.0.1`)를 사용한다.
> 현재 버전: **`0.2.0`** (스킬 인프라 정비: hb-commit·hb-version, 심볼릭 링크 문서화).

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
| [`hb-agent`](.agents/skills/agent/SKILL.md) | [에이전트 작업 방식](#에이전트-작업-방식-claude--codex-mcp) | 에이전트 작업 흐름, 도구 위임 규칙, Git 정책 및 안전 지침 | 프로젝트 작업을 시작하거나 codex에 위임할 때 |
| [`hb-tauri`](.agents/skills/tauri/SKILL.md) | [개발 환경 및 실행](#개발-환경-및-실행) | Tauri 백엔드: 실행/빌드, invoke 통신, 커맨드 추가, 권한(ACL) | Tauri/Rust 백엔드를 만질 때 |
| [`hb-usage`](.agents/skills/usage/SKILL.md) | [사용량 추적](#사용량-추적) | provider별 잔여 사용량 fetch(소스·인증·폴링/rate limit·provider 추가) | 사용량 추적 기능을 만지거나 provider를 추가할 때 |
| [`hb-testing`](.agents/skills/testing/SKILL.md) | [유닛 테스트](#유닛-테스트) | Rust/Vitest 테스트 작성·실행, 캐시 상태 격리, fake timer/localStorage mock | 테스트를 추가·수정하거나 flaky/racy 테스트를 다룰 때 |
| [`hb-commit`](.agents/skills/commit-message/SKILL.md) | [커밋 컨벤션](#커밋-컨벤션) | `type: 한국어 설명` 커밋 메시지 컨벤션 (antigravity 수행 기준) | 커밋 관련 요청 시 정책·컨벤션 확인용 (Claude·Codex는 메시지 제안 금지) |
| [`hb-version`](.agents/skills/version-bump/SKILL.md) | [버전 관리](#버전-관리) | 다섯 파일 버전 동기화 (스크립트 번들; 커밋·태그는 유저가 antigravity CLI에 요청) | 버전업/릴리스/태그할 때 |


**연관**: `hb-usage` 는 `hb-tauri` 의 커맨드·invoke·ACL·코드 서명 패턴 위에 올라간다.
`hb-testing` 은 `hb-usage` 의 캐시·provider 테스트 정책을 구체화한다.
`hb-version` 의 커밋·태그 단계는 유저가 antigravity CLI에 직접 요청하며, 그 메시지 컨벤션은 `hb-commit` 을 따른다.
