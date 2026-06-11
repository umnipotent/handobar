---
name: hb-version
description: Bump the handobar app version across all source-of-truth files (package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml, Cargo.lock, AGENTS.md), then commit and tag the release. Use this skill whenever the user wants to release a new version, bump/raise the version number, cut a release, tag a version, or mentions a version number like "0.0.2"/"v1.0" in the context of shipping handobar — even if they don't explicitly say "use the version skill". Keeping the five files in sync by hand is error-prone, so always route version changes through here.
---

# Version Bump (handobar 릴리스)

handobar의 버전 번호는 **다섯 곳**에 흩어져 있어 손으로 고치면 한 곳을 빠뜨리기 쉽다.
이 스킬은 다섯 파일을 한 번에 일치시키고, 커밋·태그까지 프로젝트의 [버전 관리 규칙](../../../AGENTS.md)에 맞춰 처리한다.

버전 단일 출처(Single Source of Truth):

| 파일 | 필드 |
| --- | --- |
| `package.json` | `"version"` |
| `src-tauri/tauri.conf.json` | `"version"` |
| `src-tauri/Cargo.toml` | `[package]` 의 `version` |
| `src-tauri/Cargo.lock` | `handobar` 패키지 항목의 `version` |
| `AGENTS.md` | `현재 버전: **`x.y.z`**` |

## 사용 방법

### 1. 버전 번호 결정

[SemVer](https://semver.org/lang/ko/) `MAJOR.MINOR.PATCH` 를 따른다. 사용자가 명시하지 않았다면
변경 성격(버그 수정→PATCH, 기능 추가→MINOR, 호환성 깨짐→MAJOR)을 근거로 제안하고 확인받는다.

### 2. 다섯 파일 동기화

번들 스크립트로 다섯 파일(`package.json`, `tauri.conf.json`, `Cargo.toml`, `Cargo.lock`, `AGENTS.md`)을 한 번에 수정한다. 정규식 in-place 치환이라 cargo/네트워크가 필요 없다.

```bash
python3 .agents/skills/version-bump/scripts/bump_version.py <x.y.z>
```

스크립트는 각 파일에서 정확히 한 곳만 치환하며, 대상을 못 찾으면 즉시 실패한다(부분 적용 방지).
실행 후 `git diff` 로 다섯 파일이 모두 같은 버전으로 바뀌었는지 확인한다.

### 3. 커밋

[`hb-commit` 스킬](../commit-message/SKILL.md)을 따라 작성한다.

```
chore: x.y.z 버전업
```

본문이 필요하면 주요 변경 요약을 한국어로 덧붙인다.

### 4. 태그

커밋에 **`v` 접두사 없는 순수 버전 번호** 태그를 단다.

```bash
git tag -a x.y.z -m "x.y.z"
```

> 이미 같은 이름의 태그가 다른 커밋을 가리키면(예: 버전 정리 전 커밋), `git tag -d x.y.z` 후
> 올바른 커밋에 다시 단다. 푸시까지 원하면 `git push && git push origin x.y.z`.

## 검증 체크리스트

- [ ] 다섯 파일의 버전 문자열이 모두 동일한가 (`git diff` 로 확인)
- [ ] 커밋 메시지가 `chore: x.y.z 버전업` 형식인가
- [ ] 태그가 `v` 없는 순수 버전이고 버전업 커밋을 가리키는가
