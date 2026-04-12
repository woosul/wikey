#!/usr/bin/env bash
# cost-tracker.sh — LLM 비용 기록 + 집계 CLI
#
# 사용법:
#   ./scripts/cost-tracker.sh add <provider> <task> "<desc>" [options]
#   ./scripts/cost-tracker.sh summary [--month YYYY-MM]
#   ./scripts/cost-tracker.sh providers
#
# 예시:
#   ./scripts/cost-tracker.sh add claude-code ingest "Karpathy 원문 3건" --input 50000 --output 30000
#   ./scripts/cost-tracker.sh add gemini summarize "파워디바이스 37p" --input 60000 --output 2500
#   ./scripts/cost-tracker.sh add ollama-local query "로컬 쿼리 5건" --duration 45
#   ./scripts/cost-tracker.sh summary
#   ./scripts/cost-tracker.sh summary --month 2026-04

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COST_LOG="${PROJECT_DIR}/activity/cost-log.md"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[cost]${NC} $*" >&2; }
log_ok()    { echo -e "${GREEN}[cost]${NC} $*" >&2; }
log_warn()  { echo -e "${YELLOW}[cost]${NC} $*" >&2; }
log_error() { echo -e "${RED}[cost]${NC} $*" >&2; }

# --- 요금표 ($/1M tokens, 2026-04 기준) ---
# macOS bash 3.2 호환 — associative array 대신 함수 사용

get_input_rate() {
  case "$1" in
    claude-code) echo "15.00" ;;
    gemini)      echo "0.15" ;;
    codex)       echo "2.00" ;;
    ollama-local) echo "0.00" ;;
    *)           echo "15.00" ;;
  esac
}

get_output_rate() {
  case "$1" in
    claude-code) echo "75.00" ;;
    gemini)      echo "0.60" ;;
    codex)       echo "8.00" ;;
    ollama-local) echo "0.00" ;;
    *)           echo "75.00" ;;
  esac
}

# 비용 계산
calc_cost() {
  local provider="$1"
  local input_tokens="${2:-0}"
  local output_tokens="${3:-0}"
  local input_rate
  local output_rate
  input_rate=$(get_input_rate "$provider")
  output_rate=$(get_output_rate "$provider")

  python3 -c "
input_rate = ${input_rate}
output_rate = ${output_rate}
input_tokens = ${input_tokens}
output_tokens = ${output_tokens}
cost = (input_tokens / 1_000_000) * input_rate + (output_tokens / 1_000_000) * output_rate
print(f'{cost:.2f}')
"
}

# --- add 서브커맨드 ---
cmd_add() {
  local provider="${1:-}"
  local task="${2:-}"
  local desc="${3:-}"
  shift 3 2>/dev/null || true

  if [ -z "$provider" ] || [ -z "$task" ] || [ -z "$desc" ]; then
    log_error "사용법: cost-tracker.sh add <provider> <task> \"<desc>\" [--input N] [--output N] [--duration N] [--pages N] [--notes \"...\"]"
    log_error "provider: claude-code | gemini | ollama-local | codex"
    log_error "task: ingest | query | lint | summarize | infra"
    exit 1
  fi

  local input_tokens=0
  local output_tokens=0
  local duration_min=""
  local pages_created=""
  local notes=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --input)  input_tokens="$2"; shift 2 ;;
      --output) output_tokens="$2"; shift 2 ;;
      --duration) duration_min="$2"; shift 2 ;;
      --pages)  pages_created="$2"; shift 2 ;;
      --notes)  notes="$2"; shift 2 ;;
      *) shift ;;
    esac
  done

  local today
  today=$(date '+%Y-%m-%d')
  local cost
  cost=$(calc_cost "$provider" "$input_tokens" "$output_tokens")

  local entry=""
  entry+="\n## [${today}] ${provider} | ${task} | ${desc}\n"
  entry+="\n- task: ${desc}"
  [ "$input_tokens" -gt 0 ] 2>/dev/null && entry+="\n- est_input_tokens: ~${input_tokens}"
  [ "$output_tokens" -gt 0 ] 2>/dev/null && entry+="\n- est_output_tokens: ~${output_tokens}"
  entry+="\n- est_cost_usd: \$${cost}"
  [ -n "$duration_min" ] && entry+="\n- duration_min: ${duration_min}"
  [ -n "$pages_created" ] && entry+="\n- pages_created: ${pages_created}"
  [ -n "$notes" ] && entry+="\n- notes: ${notes}"

  echo -e "$entry" >> "$COST_LOG"
  log_ok "비용 기록 추가: ${provider} | ${task} | ${desc} — \$${cost}"
}

# --- summary 서브커맨드 ---
cmd_summary() {
  local month_filter=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --month) month_filter="$2"; shift 2 ;;
      *) shift ;;
    esac
  done

  if [ ! -f "$COST_LOG" ]; then
    log_error "비용 로그 없음: ${COST_LOG}"
    exit 1
  fi

  python3 -c "
import re, sys

month_filter = '${month_filter}'
log_path = '${COST_LOG}'

with open(log_path, 'r') as f:
    content = f.read()

# 헤더 블록 패턴
entry_pattern = re.compile(
    r'## \[(\d{4}-\d{2}-\d{2})\] (\S+) \| (\S+) \| (.+?)$'
    r'(.*?)(?=\n## \[|\Z)',
    re.MULTILINE | re.DOTALL
)

providers = {}
tasks = {}
total_cost = 0.0
total_input = 0
total_output = 0
entry_count = 0

for m in entry_pattern.finditer(content):
    date, provider, task, desc, body = m.groups()

    if month_filter and not date.startswith(month_filter):
        continue

    cost_m = re.search(r'est_cost_usd: \\\$?([\d.]+)', body)
    input_m = re.search(r'est_input_tokens: ~?(\d+)', body)
    output_m = re.search(r'est_output_tokens: ~?(\d+)', body)

    cost = float(cost_m.group(1)) if cost_m else 0.0
    inp = int(input_m.group(1)) if input_m else 0
    out = int(output_m.group(1)) if output_m else 0

    providers[provider] = providers.get(provider, 0.0) + cost
    tasks[task] = tasks.get(task, 0.0) + cost
    total_cost += cost
    total_input += inp
    total_output += out
    entry_count += 1

period = f'월: {month_filter}' if month_filter else '전체'
print(f'\\n===== LLM 비용 요약 ({period}) =====\\n')
print(f'기록 수: {entry_count}건')
print(f'총 비용: \${total_cost:.2f} (월 목표 \$50.00)')
print(f'입력 토큰: ~{total_input:,}')
print(f'출력 토큰: ~{total_output:,}')
print(f'\\n--- 프로바이더별 ---')
for p in sorted(providers, key=providers.get, reverse=True):
    pct = (providers[p] / total_cost * 100) if total_cost > 0 else 0
    print(f'  {p:20s}  \${providers[p]:7.2f}  ({pct:5.1f}%)')
print(f'\\n--- 작업 유형별 ---')
for t in sorted(tasks, key=tasks.get, reverse=True):
    pct = (tasks[t] / total_cost * 100) if total_cost > 0 else 0
    print(f'  {t:20s}  \${tasks[t]:7.2f}  ({pct:5.1f}%)')

budget_pct = (total_cost / 50.0) * 100 if total_cost > 0 else 0
remaining = 50.0 - total_cost
print(f'\\n--- 예산 상태 ---')
print(f'  사용: \${total_cost:.2f} / \$50.00 ({budget_pct:.1f}%)')
print(f'  잔여: \${remaining:.2f}')
if total_cost > 50:
    print(f'  ⚠️  월간 예산 초과!')
elif total_cost > 40:
    print(f'  ⚠️  예산 80% 이상 사용')
else:
    print(f'  ✓ 예산 범위 내')
"
}

# --- providers 서브커맨드 ---
cmd_providers() {
  echo -e "${BOLD}프로바이더별 요금 (2026-04 기준)${NC}"
  echo ""
  printf "  %-20s  %12s  %12s  %s\n" "프로바이더" "Input \$/1M" "Output \$/1M" "비고"
  printf "  %-20s  %12s  %12s  %s\n" "──────────" "──────────" "───────────" "────"
  printf "  %-20s  %12s  %12s  %s\n" "claude-code (Opus)" "\$15.00" "\$75.00" "주력 인제스트/린트"
  printf "  %-20s  %12s  %12s  %s\n" "claude-code (Sonnet)" "\$3.00" "\$15.00" "경량 작업"
  printf "  %-20s  %12s  %12s  %s\n" "gemini (Flash)" "\$0.15" "\$0.60" "대용량 요약"
  printf "  %-20s  %12s  %12s  %s\n" "codex (GPT-4.1)" "\$2.00" "\$8.00" "교차 검증"
  printf "  %-20s  %12s  %12s  %s\n" "ollama-local" "\$0.00" "\$0.00" "로컬 (전기세만)"
}

# --- 메인 ---
case "${1:-}" in
  add)       shift; cmd_add "$@" ;;
  summary)   shift; cmd_summary "$@" ;;
  providers) cmd_providers ;;
  *)
    echo "사용법:"
    echo "  cost-tracker.sh add <provider> <task> \"<desc>\" [--input N] [--output N]"
    echo "  cost-tracker.sh summary [--month YYYY-MM]"
    echo "  cost-tracker.sh providers"
    exit 1
    ;;
esac
