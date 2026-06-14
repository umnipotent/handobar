#!/usr/bin/env python3
"""handobar 버전을 네 개의 단일 출처 파일에서 한 번에 갱신한다.

usage: bump_version.py <x.y.z>

정규식 in-place 치환만 사용하므로 cargo 실행이나 네트워크가 필요 없다.
각 파일에서 정확히 한 곳만 바꾸며, 대상을 찾지 못하면 즉시 실패하여
일부 파일만 갱신되는 상태를 방지한다.
"""
import pathlib
import re
import subprocess
import sys

SEMVER = r"\d+\.\d+\.\d+"


def replace_once(path: pathlib.Path, pattern: str, version: str) -> None:
    text = path.read_text()
    new_text, n = re.subn(pattern, rf"\g<1>{version}\g<2>", text, count=1)
    if n != 1:
        sys.exit(f"error: '{path}' 에서 버전 항목을 찾지 못했습니다 (matched {n})")
    path.write_text(new_text)


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("usage: bump_version.py <x.y.z>")
    version = sys.argv[1].lstrip("v")
    if not re.fullmatch(SEMVER, version):
        sys.exit(f"error: 올바른 SemVer가 아닙니다: {version!r} (예: 0.0.2)")

    root = pathlib.Path(
        subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"], text=True
        ).strip()
    )

    # package.json / tauri.conf.json: 첫 "version": "x.y.z"
    json_pat = rf'("version"\s*:\s*"){SEMVER}(")'
    replace_once(root / "package.json", json_pat, version)
    replace_once(root / "src-tauri/tauri.conf.json", json_pat, version)

    # Cargo.toml: [package] 의 줄 시작 version = "x.y.z"
    replace_once(
        root / "src-tauri/Cargo.toml",
        rf'(?m)^(version\s*=\s*"){SEMVER}(")',
        version,
    )

    # Cargo.lock: handobar 패키지 항목
    replace_once(
        root / "src-tauri/Cargo.lock",
        rf'(name = "handobar"\nversion = "){SEMVER}(")',
        version,
    )

    # AGENTS.md: 현재 버전: **`x.y.z`**
    replace_once(
        root / "AGENTS.md",
        rf'(현재 버전:\s*\*\*`){SEMVER}(`\*\*)',
        version,
    )

    print(
        f"bumped to {version} → package.json, tauri.conf.json, Cargo.toml, Cargo.lock, AGENTS.md"
    )


if __name__ == "__main__":
    main()
