#!/usr/bin/env bash
# §5.6.5 옵션 A v2 (paradigm B) — Claude Code statusline command.
#
# Why a CLI script (not the Obsidian chip): the user wanted statusline
# data "당장 확인" without depending on Obsidian being open. This script
# runs whenever Claude Code refreshes its status line (typically every
# few seconds), reads the cached __Secure-session cookie from
# ~/.config/wikey/credentials.json, fetches https://ollama.com/settings,
# and emits a single-line status string.
#
# Setup (one-time):
#   ~/.claude/settings.json:
#     {
#       "statusLine": {
#         "type": "command",
#         "command": "bash /Users/denny/Project/wikey/scripts/ollama-statusline.sh",
#         "padding": 0
#       }
#     }
#
# Output format (single line, stdout):
#   ● ollama|5h:42%|7d:18%        ← normal
#   ● ollama|no cookie            ← cookie not pasted in Settings yet
#   ● ollama|auth expired         ← 302→/login or 401/403
#   ● ollama|fetch fail           ← curl error / network
#   ● ollama|parse fail           ← ollama.com layout drift
#
# CodexBar paradigm mirror (https://github.com/steipete/CodexBar issue #534).

set -uo pipefail

CRED_PATH="${WIKEY_CREDENTIALS_PATH:-$HOME/.config/wikey/credentials.json}"
SETTINGS_URL="https://ollama.com/settings"
DOT='●'

emit() {
  printf '%s ollama|%s\n' "$DOT" "$1"
  exit 0
}

# 1. Cookie read — never logged; only used as Cookie header.
if [ ! -f "$CRED_PATH" ]; then
  emit "no credentials.json"
fi

# Use python3 to parse the JSON safely (jq may not be installed).
COOKIE=$(python3 -c "
import json, sys
try:
    with open('$CRED_PATH', 'r') as f:
        data = json.load(f)
    sys.stdout.write(data.get('ollamaCloudSessionCookie', '') or '')
except Exception:
    pass
" 2>/dev/null)

if [ -z "$COOKIE" ]; then
  emit "no cookie"
fi

# 2. Fetch ollama.com/settings with the cookie.
TMP=$(mktemp)
HTTP_CODE=$(curl -sS -o "$TMP" -w '%{http_code}' \
  -L --max-redirs 0 --max-time 5 \
  -H "Cookie: $COOKIE" \
  "$SETTINGS_URL" 2>/dev/null) || {
  rm -f "$TMP"
  emit "fetch fail"
}

# 3. Auth expiry handling (302 → /login, 401, 403).
case "$HTTP_CODE" in
  302)
    LOC=$(curl -sS -o /dev/null -D - --max-redirs 0 --max-time 5 \
      -H "Cookie: $COOKIE" "$SETTINGS_URL" 2>/dev/null \
      | awk '/^[Ll]ocation:/ {print $2}' | tr -d '\r')
    rm -f "$TMP"
    if echo "$LOC" | grep -qi login; then
      emit "auth expired"
    fi
    emit "redirect $LOC"
    ;;
  401|403)
    rm -f "$TMP"
    emit "auth expired"
    ;;
  2*)
    : # fall through to parse
    ;;
  *)
    rm -f "$TMP"
    emit "http $HTTP_CODE"
    ;;
esac

# 4. Parse session/weekly percent from HTML.
HTML=$(cat "$TMP")
rm -f "$TMP"

# Defensive grep — matches both CodexBar's documented shape and the wikey
# fetcher's `data-period="..."` selector. Update both this regex and
# `ollama-cloud-usage-fetcher.ts` together when ollama.com drifts.
SESSION=$(echo "$HTML" \
  | tr -d '\n' \
  | grep -oE 'data-period="session"[^@]{0,500}?class="usage-percent"[^>]*>[[:space:]]*[0-9]+%' \
  | grep -oE '[0-9]+%' \
  | head -1)
WEEKLY=$(echo "$HTML" \
  | tr -d '\n' \
  | grep -oE 'data-period="weekly"[^@]{0,500}?class="usage-percent"[^>]*>[[:space:]]*[0-9]+%' \
  | grep -oE '[0-9]+%' \
  | head -1)

if [ -z "$SESSION" ] || [ -z "$WEEKLY" ]; then
  emit "parse fail"
fi

emit "5h:$SESSION|7d:$WEEKLY"
