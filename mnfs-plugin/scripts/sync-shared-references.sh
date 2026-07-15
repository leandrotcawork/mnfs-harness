#!/usr/bin/env bash
# Keep MNFS shared reference cards byte-identical across skills.
#
# Plugins have no shared-include for skill references, so cards reused verbatim are
# physically copied per skill. This guard prevents silent drift between those copies.
#
#   ./sync-shared-references.sh            # check parity (default); exit 1 on drift
#   ./sync-shared-references.sh --check    # same as default
#   ./sync-shared-references.sh --sync     # copy canonical -> consumers, then check
#
# Groups are declared in shared-references.manifest (first path = canonical source).
# Run from anywhere; paths resolve relative to mnfs-plugin/.

set -euo pipefail

mode="--check"
[ "${1:-}" != "" ] && mode="$1"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
plugin_root="$(cd "$script_dir/.." && pwd)"
manifest="$script_dir/shared-references.manifest"

[ -f "$manifest" ] || { echo "FAIL: manifest not found: $manifest" >&2; exit 2; }

drift=0
synced=0

while read -r line; do
  # skip comments and blank lines
  case "$line" in ''|\#*) continue ;; esac

  # shellcheck disable=SC2206
  paths=($line)
  canonical="$plugin_root/${paths[0]}"

  [ -f "$canonical" ] || { echo "FAIL: canonical missing: ${paths[0]}" >&2; drift=1; continue; }

  for rel in "${paths[@]:1}"; do
    consumer="$plugin_root/$rel"
    if [ ! -f "$consumer" ]; then
      echo "FAIL: consumer missing: $rel" >&2; drift=1; continue
    fi
    if diff -q "$canonical" "$consumer" >/dev/null 2>&1; then
      continue
    fi
    if [ "$mode" = "--sync" ]; then
      cp "$canonical" "$consumer"
      echo "synced: $rel  <-  ${paths[0]}"
      synced=$((synced+1))
    else
      echo "DRIFT: $rel differs from ${paths[0]}" >&2
      drift=1
    fi
  done
done < "$manifest"

if [ "$mode" = "--sync" ]; then
  echo "sync complete ($synced file(s) updated)"
fi

if [ "$drift" -ne 0 ]; then
  echo "SHARED-REF PARITY: DRIFT DETECTED" >&2
  exit 1
fi

echo "SHARED-REF PARITY OK"
