#!/usr/bin/env bash
# rebuild-qmd-deps.sh — Phase 5 §5.2.9
#
# tools/qmd 의 native module (better-sqlite3, sqlite-vec) 를 plugin 이 쓰는 node
# 버전에 맞춰 재빌드한다. plugin's execEnv = login shell PATH 이므로 homebrew node
# (system) 가 우선되는 것이 일반적. 그러나 nvm-managed node (예: v22) 로 처음 설치된
# 경우 ABI mismatch 발생 → `ERR_DLOPEN_FAILED` (NODE_MODULE_VERSION 불일치) → plugin
# 의 `reindex --quick` exit=1 silent fail.
#
# 본 스크립트는 login shell 의 node (= plugin 이 실제 쓸 node) 를 명시적으로 사용해
# rebuild 를 강제한다. 사용자 환경 (interactive shell node 버전) 무관.
#
# 사용:
#   ./scripts/rebuild-qmd-deps.sh                # auto-detect login node
#   NODE=/opt/homebrew/bin/node ./scripts/rebuild-qmd-deps.sh   # 명시 override

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
QMD_DIR="${PROJECT_DIR}/tools/qmd"

if [ ! -d "$QMD_DIR" ]; then
  echo "ERROR: tools/qmd not found at $QMD_DIR" >&2
  exit 1
fi

# Resolve node path that plugin will actually use (login shell PATH).
LOGIN_NODE="${NODE:-}"
if [ -z "$LOGIN_NODE" ]; then
  SHELL_BIN="${SHELL:-/bin/zsh}"
  LOGIN_PATH="$("$SHELL_BIN" -l -c 'echo $PATH' 2>/dev/null)"
  LOGIN_NODE="$(PATH="$LOGIN_PATH" command -v node 2>/dev/null || true)"
fi

if [ -z "$LOGIN_NODE" ] || [ ! -x "$LOGIN_NODE" ]; then
  echo "ERROR: cannot resolve node from login shell PATH" >&2
  exit 1
fi

LOGIN_NODE_DIR="$(dirname "$LOGIN_NODE")"
NODE_VER="$("$LOGIN_NODE" --version)"

echo "Login node: $LOGIN_NODE ($NODE_VER)"
echo "Rebuilding tools/qmd native modules against this node..."

cd "$QMD_DIR"
PATH="$LOGIN_NODE_DIR:$PATH" npm rebuild better-sqlite3 2>&1 | tail -5

echo ""
echo "✓ rebuild complete. Verify with:"
echo "  bash ./scripts/reindex.sh --quick"
