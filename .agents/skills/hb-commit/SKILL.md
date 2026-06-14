---
name: hb-commit
description: Commit message convention for the handobar project — an English Conventional-Commits category followed by a Korean description (`<type>: <한국어 설명>`), decided and applied directly by the user in their terminal. Consult this skill whenever commits, tags, or branches come up, you are asked to "커밋"/"commit"/"커밋 메시지 작성" — AI agents must NOT execute git commits/tags/branches nor even propose messages or names; redirect the user to do so directly.
---

# Commit Message (handobar 커밋 컨벤션)

handobar는 일반적인 [Conventional Commits](https://www.conventionalcommits.org/ko/)를 따르되,
**영문 카테고리(type)** 와 **한국어 설명**을 조합한다. 영문 type은 도구·기계가 분류하기 좋고,
한국어 설명은 의도를 가장 정확히 전달하기 때문이다.

> **적용 주체**: 커밋·태그·브랜치 작업(메시지 작성 포함)은 **유저가 직접 터미널에서 결정하고 실행**한다.
> **AI 에이전트(Antigravity, Claude, Codex 등 모든 AI)는 해당 명령을 실행하지 않을 뿐 아니라 커밋 메시지 제안조차 하지 않으며**, 관련 요청을 받으면 유저가 직접 처리하도록 안내한다.
> 아래 절차는 유저가 커밋을 작성할 때 참고하는 컨벤션의 단일 출처다.

## 형식

```
<영문 카테고리>: <한국어로 작성한 커밋의 의도·목적·구성 설명>

[선택] 본문 — 배경·구성 변경 내역을 한국어 불릿으로
```

- **제목(subject)**: `type: 설명`, 50자 내외로 간결하게. 마침표로 끝내지 않는다.
- **한국어 설명**: *무엇을·왜·어떻게* 바꿨는지 명료하게. 파일명 나열이 아니라 의도를 쓴다.
- **본문(body)**: 단순 변경이면 생략. 여러 갈래의 변경이면 한국어 불릿으로 핵심을 요약한다.

## 카테고리 선택

변경의 **성격**으로 고른다. 한 커밋이 여러 type에 걸치면 가장 핵심이 되는 의도를 고르되,
성격이 다른 변경은 애초에 커밋을 나누는 것이 좋다(최소 단위 커밋).

| 카테고리 | 의미 / 선택 기준 |
| --- | --- |
| `feat` | 사용자가 체감하는 **새 기능** 추가 |
| `fix` | **버그 수정** (동작이 잘못되던 것을 바로잡음) |
| `docs` | **문서**만 변경 (README, AGENTS.md, docs/, 스킬 문서) |
| `style` | 포맷·세미콜론·공백 등 **동작에 영향 없는** 변경 |
| `refactor` | 외부 동작 변화 없는 **내부 구조 개선** |
| `perf` | **성능** 개선 |
| `test` | **테스트** 추가·수정 |
| `build` | **빌드 시스템·의존성** 변경 (Cargo, pnpm, vite, tauri 등) |
| `release` | **버전 범프 및 릴리스 배포** (버전 번호 동기화 및 태깅) |
| `chore` | 그 외 잡무 (설정, 스캐폴드, 자동 생성물 등) |
| `ci` | **CI** 설정 변경 |

## 예시

```
feat: 시스템 트레이 아이콘과 사용량 팝오버 윈도우 추가
fix: 개발 서버 포트 충돌 시 앱이 멈추던 문제 해결
docs: AGENTS.md에 프로젝트 구조와 커밋 컨벤션 정리
build: Tauri 2 + React 19 초기 스캐폴드 구성
refactor: 사용량 수집 로직을 lib.rs에서 별도 모듈로 분리
chore: 빌드 산출물 .gitignore 처리
```

본문이 있는 예시:

```
feat: 버전 범프 워크플로를 hb-version 스킬로 분리

- 다섯 파일 버전 동기화 스크립트(bump_version.py) 번들
- AGENTS.md에 스킬화 기준·작성 원칙·현재 스킬 목록 기술
```

## 작성 절차 (antigravity 수행 기준)

1. `git status` / `git diff --staged` 로 **무엇이 바뀌었는지** 확인한다.
2. 변경의 성격으로 **카테고리**를 고른다(위 표). 성격이 섞였으면 커밋 분리를 권한다.
3. 한국어로 **의도 중심**의 제목을 쓴다(파일명 나열 금지).
4. 변경이 여러 갈래면 본문에 한국어 불릿을 덧붙인다.
5. 커밋한다. 저장소 정책상 메시지 끝에 `Co-Authored-By` 트레일러를 붙인다면 빈 줄 뒤에 둔다.

## 연관 스킬

- [`hb-version`](../hb-version/SKILL.md): 버전업 시 `release: x.y.z 버전업 및 릴리스` 커밋을 만드는데,
  그 메시지도 이 컨벤션을 따른다.
