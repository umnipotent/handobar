#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ICON_PATH="${DMG_ICON_PATH:-"$ROOT_DIR/src-tauri/icons/icon.icns"}"
TARGET_DIR="$ROOT_DIR/src-tauri/target"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "DMG icon application requires macOS." >&2
  exit 1
fi

for command in hdiutil SetFile; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required command not found: $command" >&2
    exit 1
  fi
done

if [[ ! -f "$ICON_PATH" ]]; then
  echo "DMG icon not found: $ICON_PATH" >&2
  exit 1
fi

dmg_paths=()
if [[ "$#" -gt 0 ]]; then
  dmg_paths=("$@")
else
  while IFS= read -r -d '' dmg_path; do
    dmg_paths+=("$dmg_path")
  done < <(find "$TARGET_DIR" -path '*/release/bundle/dmg/*.dmg' -type f -print0)
fi

if [[ "${#dmg_paths[@]}" -eq 0 ]]; then
  echo "No DMG files found under $TARGET_DIR." >&2
  exit 1
fi

apply_icon() {
  local dmg_path="$1"
  local work_dir mount_dir rw_base rw_dmg iconed_base iconed_dmg

  if [[ ! -f "$dmg_path" ]]; then
    echo "DMG file not found: $dmg_path" >&2
    exit 1
  fi

  work_dir="$(mktemp -d "${TMPDIR:-/tmp}/handobar-dmg-icon.XXXXXX")"
  mount_dir="$work_dir/mount"
  rw_base="$work_dir/readwrite"
  rw_dmg="$rw_base.dmg"
  iconed_base="$work_dir/iconed"
  iconed_dmg="$iconed_base.dmg"

  cleanup() {
    hdiutil detach "$mount_dir" -quiet >/dev/null 2>&1 || true
    rm -rf "$work_dir"
  }
  trap cleanup RETURN

  mkdir -p "$mount_dir"

  hdiutil convert "$dmg_path" -format UDRW -o "$rw_base" -quiet
  hdiutil attach "$rw_dmg" -nobrowse -noautoopen -mountpoint "$mount_dir" -quiet

  cp "$ICON_PATH" "$mount_dir/.VolumeIcon.icns"
  SetFile -a C "$mount_dir"
  sync

  hdiutil detach "$mount_dir" -quiet
  hdiutil convert "$rw_dmg" -format UDZO -imagekey zlib-level=9 -o "$iconed_base" -quiet
  mv -f "$iconed_dmg" "$dmg_path"

  echo "Applied DMG icon: $dmg_path"
}

for dmg_path in "${dmg_paths[@]}"; do
  apply_icon "$dmg_path"
done
