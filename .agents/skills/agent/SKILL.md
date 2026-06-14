---
name: hb-agent
description: Guidelines for AI agents (Claude, Codex, etc.) working on the handobar project — includes model selection for codex MCP, worktree preservation policy, and Git workflow boundaries. Consult this skill whenever you are planning tasks, delegating to Codex, performing git operations (commits/tags/branches), or managing the codebase environment.
---

# 에이전트 작업 방식 (hb-agent)

이 가이드는 한도바(Hando-Bar) 프로젝트에 참여하는 AI 에이전트(Claude Code, Codex, Antigravity 등)가 준수해야 하는 작업 흐름, 도구 위임 규칙, Git 정책 및 안전 지침을 명시한다.

## 1. Claude × Codex MCP 위임 구조

Claude(Claude Code)로 작업을 수행할 때, **실제 코드 구현(파일 작성 및 수정)은 Claude가 직접 수행하지 않는다.** 대신 **codex MCP**(`mcp__codex-cli__codex`)를 활용해 구현 작업을 하위 모델에 위임한다.

- **Claude의 역할**: 요구사항 분석, 코드베이스 탐색/조사(파일 읽기, grep 등), 작업 계획 수립, codex MCP 호출(구현 지시), 결과 검토 및 검증.
- **Codex의 역할**: 지시받은 범위 내에서 실제 코드 작성 및 수정 수행 (`workspace-write`/fullAuto 샌드박스로 호출).
- **분석 및 계획 단계**: 분석·탐색은 Claude가 직접 수행하여 컨텍스트를 아껴야 한다.

## 2. Codex 사용량 기반 모델 선택

codex MCP로 구현을 위임하기 전, 반드시 **Codex 잔여 사용량**을 사전 조회하여 모델을 결정한다.
사용량은 `~/.codex/sessions` 최신 rollout (JSONL)의 마지막 `rate_limits` 스냅샷 기준으로 판단한다 (잔여 = 100 − `used_percent`, primary 5시간 세션 기준).

- **5시간 세션(primary) 잔여 40% 초과**: 기본 모델인 **GPT-5.5 medium fast**를 사용한다.
- **5시간 세션(primary) 잔여 40% 이하**: 한도를 절약하기 위해 GPT-5.5 대신 **GPT-5.4-mini** 모델로 전환하여 호출한다.

## 3. Worktree 변경 금지 지침 (안전 장치)

Codex를 호출할 때 전달하는 프롬프트에는 다음 지침을 **상시 포함**하여 전달해야 한다.

> **[CRITICAL] Worktree 변경 금지 지침**
> 지시한 대상 파일 외의 기존 worktree 변경 사항(커밋되지 않은 수정분)은 절대 건드리지 마십시오. 임의로 되돌리기(`git checkout`, `git restore`, `git stash` 등)를 수행해서는 안 됩니다. 범위 외의 변경 사항을 발견하더라도 그대로 두고 보고만 해야 합니다.

*배경: Codex가 범위 외의 변경 사항을 "불필요한 실수"로 오인하여 임의로 revert함으로써 이전 작업분이 유실된 심각한 사례가 존재한다.*

## 4. Git 작업 정책

- **수행 주체**: 커밋 생성, 브랜치 생성, Git 태그 생성 등 모든 형상 관리 작업은 **Antigravity CLI가 직접 결정하고 실행한다.**
- **도구 위임**: Claude Code 및 Codex 등 하위/외부 도구들은 Git 형상 관리 명령을 직접 실행할 수 없으며, 커밋 메시지, 태그명, 브랜치명을 스스로 제안해서도 안 된다. 이들은 모든 Git 작업을 Antigravity CLI에 일임해야 한다.
- **참고 기준**: Antigravity CLI가 커밋을 수행할 때는 [`hb-commit`](../commit-message/SKILL.md) 스킬의 컨벤션을 준수한다.

## 5. 윈도우-불가지(Window-Agnostic) 아키텍처 규칙

새로운 사용량 프로바이더를 연동하거나, 기존 카드의 노출 정책을 수정할 때는 다음 설계 원칙을 반드시 고수해야 한다.

- **백엔드 중심 의미 결정**: 각 프로바이더의 윈도우 한도 계산 규칙이나 미사용/고갈 상태의 도메인 해석 책임을 프론트엔드가 갖지 않도록 한다. 백엔드에서 `windows: Vec<UsageWindow>` 모델 내에 고유 `id`와 `role`, `resets_at`, `remaining` 등을 완전하게 매핑하여 방출한다.
- **결합도 차단 및 OCP**: 프론트엔드(`UsagePanel`, `WindowCard` 등)는 `windows` 배열을 단순히 순회하여 카드를 동적으로 그리는 일반화(Generalization)된 구조를 유지한다. 프로바이더 고유의 표기법이나 레이아웃 옵션은 `UsageProvider` 디스크립터 구조의 얇은 렌더링 주입 플래그/함수(`showModelBadges` 등)를 통해서만 삽입한다.
- **스토리지 키 격리**: 윈도우 접힘 상태(`collapsed`)나 트레이 활성 타깃 등의 데이터를 저장할 때, 특정 식별자에 의존하여 하드코딩하지 않고 각 윈도우의 동적 `id`를 조합한 고유 스토리지 키 구조를 활용해 오염을 차단한다.

