#!/usr/bin/env bash
# Run the TLA+ machine-checked-correctness specs through TLC.
#
# Spec B — Delivery / retention (invariants I3 + I4),
# docs/machine-checked-correctness-design.md §3. This is the fast CI gate:
# TLC exhaustively checks the small config in seconds.
#
# Usage:
#   scripts/tlc-check.sh            # check the sound spec (must PASS)
#   scripts/tlc-check.sh --broken   # check the teeth config (must FAIL)
#
# Requirements: a JRE (java on PATH, or JAVA_HOME set) and tla2tools.jar. If the
# jar is absent it is downloaded to $TLA_TOOLS_DIR (default: this script's dir).
# Pin: TLA2TOOLS_VERSION (default v1.8.0).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SPEC_DIR="$(cd "$SCRIPT_DIR/../specs/tla" && pwd)"
TLA_TOOLS_DIR="${TLA_TOOLS_DIR:-$SCRIPT_DIR}"
TLA2TOOLS_VERSION="${TLA2TOOLS_VERSION:-v1.8.0}"
JAR="$TLA_TOOLS_DIR/tla2tools.jar"

JAVA_BIN="java"
if [[ -n "${JAVA_HOME:-}" ]]; then
  JAVA_BIN="$JAVA_HOME/bin/java"
fi
if ! "$JAVA_BIN" -version >/dev/null 2>&1; then
  echo "error: no JRE found (need java on PATH or JAVA_HOME set)" >&2
  exit 127
fi

if [[ ! -f "$JAR" ]]; then
  echo "tla2tools.jar not found; downloading $TLA2TOOLS_VERSION ..."
  curl -fsSL -o "$JAR" \
    "https://github.com/tlaplus/tlaplus/releases/download/${TLA2TOOLS_VERSION}/tla2tools.jar"
fi

run_tlc() {
  local cfg="$1"
  "$JAVA_BIN" -XX:+UseParallelGC -cp "$JAR" tlc2.TLC \
    -config "$cfg" -cleanup Delivery.tla
}

cd "$SPEC_DIR"

if [[ "${1:-}" == "--broken" ]]; then
  # Teeth check: the broken (fastest-member) retention guard MUST produce a
  # NoLossForCurrentMember counterexample. We invert the exit code: a TLC
  # failure here is SUCCESS for us, and a clean pass is a regression.
  echo "== TLC teeth check (DeliveryBroken.cfg) — expecting a violation =="
  if run_tlc DeliveryBroken.cfg; then
    echo "ERROR: broken config unexpectedly PASSED — the invariant has no teeth." >&2
    exit 1
  else
    echo "OK: broken config produced the expected counterexample."
    exit 0
  fi
fi

echo "== TLC check (Delivery.cfg) — all invariants must pass =="
run_tlc Delivery.cfg
echo "OK: Delivery spec passed (NoLossForCurrentMember, CursorMonotone, AcceptedLossesOnly)."
