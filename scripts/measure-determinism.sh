#!/usr/bin/env bash
# measure-determinism.sh — v6 인제스트 결정성 자동 측정 (5회 std dev → CV)
#
# 사용법:
#   ./scripts/measure-determinism.sh <source-path> [-n 5] [-o activity/<file>.md]
#
# 전제:
#   - Obsidian이 --remote-debugging-port=9222 --remote-allow-origins=* 로 기동되어 있을 것
#     (memory: reference_obsidian_cdp_e2e.md 참고)
#   - source-path는 raw/ 하위 (wiki/ 가드로 차단됨)
#   - 인제스트는 audit panel을 통해 구동 (briefSetting 자동 우회)
#
# 출력:
#   - 콘솔: 각 run의 entities/concepts/total + 통계 (mean/std/CV)
#   - 파일: activity/determinism-<source-name>-<date>.md (Markdown 표)
#
# 종료 코드:
#   0  성공
#   1  CDP 연결 실패 / Obsidian 미기동
#   2  source 파일 미존재
#   3  인제스트 1회 이상 실패

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

usage() {
  cat <<EOF
사용법: ./scripts/measure-determinism.sh <source-path> [-n N] [-o output.md] [-f] [-d]

옵션:
  -n N                반복 횟수 (기본 5)
  -o PATH             출력 Markdown 경로 (기본 activity/determinism-<name>-<date>.md)
  -f, --force         크기 가드 우회 (15KB 미만/chunk<3 예상 소스)
  -d, --determinism   §4.5.1.6.1 — plugin.settings.extractionDeterminism=true 강제
                      (runs 동안 temperature=0 + seed=42 주입, 종료 시 원복)
  -h, --help          도움말
EOF
  exit 0
}

N_RUNS=5
OUTPUT_PATH=""
SOURCE_PATH=""
FORCE=0
DETERMINISM=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    -n) N_RUNS="$2"; shift 2 ;;
    -o) OUTPUT_PATH="$2"; shift 2 ;;
    -f|--force) FORCE=1; shift ;;
    -d|--determinism) DETERMINISM=1; shift ;;
    -h|--help) usage ;;
    *) SOURCE_PATH="$1"; shift ;;
  esac
done

if [[ -z "$SOURCE_PATH" ]]; then
  echo "ERROR: source-path 미지정" >&2
  usage
fi

# Path 정규화
SOURCE_PATH="${SOURCE_PATH#./}"
if [[ "$SOURCE_PATH" == wiki/* ]]; then
  echo "ERROR: wiki/ 경로는 인제스트 가드로 차단됨" >&2
  exit 2
fi

if [[ ! -f "${PROJECT_DIR}/${SOURCE_PATH}" ]]; then
  echo "ERROR: source 파일 없음: ${PROJECT_DIR}/${SOURCE_PATH}" >&2
  exit 2
fi

# 최소 크기 가드 (15KB) — 작은 소스는 chunk 1개로 rollup되어 CV 측정 의미 없음
SRC_SIZE=$(stat -f%z "${PROJECT_DIR}/${SOURCE_PATH}" 2>/dev/null || stat -c%s "${PROJECT_DIR}/${SOURCE_PATH}" 2>/dev/null || echo 0)
MIN_SIZE=15360  # 15KB
if [[ "$SRC_SIZE" -lt "$MIN_SIZE" && "$FORCE" -ne 1 ]]; then
  echo "ERROR: 소스 크기 ${SRC_SIZE}B < ${MIN_SIZE}B (15KB)." >&2
  echo "       chunk 수 <3 예상 — CV 측정 의미 없음. 우회하려면 -f 추가." >&2
  exit 2
fi

# CDP 헬퍼 확인
if [[ ! -f /tmp/wikey-cdp.py ]]; then
  echo "ERROR: /tmp/wikey-cdp.py 없음 (memory: reference_obsidian_cdp_e2e.md 참고하여 생성)" >&2
  exit 1
fi

# Obsidian CDP 연결 확인
if ! curl -fsS http://localhost:9222/json -o /dev/null 2>&1; then
  echo "ERROR: Obsidian CDP (port 9222) 연결 실패" >&2
  echo "Obsidian을 다음 옵션으로 재기동:" >&2
  echo "  /Applications/Obsidian.app/Contents/MacOS/Obsidian --remote-debugging-port=9222 '--remote-allow-origins=*' &" >&2
  exit 1
fi

# 출력 경로 결정
if [[ -z "$OUTPUT_PATH" ]]; then
  src_basename=$(basename "$SOURCE_PATH")
  src_slug=$(echo "${src_basename%.*}" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g')
  date_str=$(date '+%Y-%m-%d')
  OUTPUT_PATH="activity/determinism-${src_slug}-${date_str}.md"
fi
ABS_OUTPUT="${PROJECT_DIR}/${OUTPUT_PATH}"

echo "[measure-determinism] source: ${SOURCE_PATH}"
echo "[measure-determinism] runs: ${N_RUNS}"
echo "[measure-determinism] output: ${OUTPUT_PATH}"
if [[ "$DETERMINISM" -eq 1 ]]; then
  echo "[measure-determinism] determinism: ON (temperature=0, seed=42)"
else
  echo "[measure-determinism] determinism: off (baseline sampling)"
fi
echo

# 측정 JS를 임시 파일로 작성 (parameterized)
TMPJS=$(mktemp /tmp/wikey-determinism-XXXXX.js)
trap "rm -f $TMPJS" EXIT

cat > "$TMPJS" <<'JSEOF'
const N_RUNS = __N_RUNS__
const SOURCE_PATH = '__SOURCE_PATH__'
const DETERMINISM = __DETERMINISM__ === 1
const SOURCE_NAME = SOURCE_PATH.split('/').pop()

const plugin = window.app.plugins.plugins.wikey
const adapter = window.app.vault.adapter
const basePath = adapter.basePath
const fs = require('node:fs')
const path = require('node:path')

if (!plugin) return [{ run: 0, error: 'plugin not loaded' }]

// Brief prompt off for this session (no user modal interrupts)
const prevBrief = plugin.settings.ingestBriefs
plugin.settings.ingestBriefs = 'never'
plugin.skipIngestBriefsThisSession = true

// §4.5.1.6.1 — determinism toggle applied for this measurement session only.
const prevDeterminism = plugin.settings.extractionDeterminism
if (DETERMINISM) {
  plugin.settings = { ...plugin.settings, extractionDeterminism: true }
}
await plugin.saveSettings?.()

// Snapshot directory state — for diff-based cleanup/collection (replaces content-match)
function snapshotDirs() {
  const rd = d => {
    try { return new Set(fs.readdirSync(path.join(basePath, d)).filter(f => f.endsWith('.md'))) }
    catch (_e) { return new Set() }
  }
  return { e: rd('wiki/entities'), c: rd('wiki/concepts'), s: rd('wiki/sources') }
}

function listDiff(baseline) {
  const cur = snapshotDirs()
  const diff = kind => [...cur[kind]].filter(f => !baseline[kind].has(f))
  return { e: diff('e'), c: diff('c'), s: diff('s') }
}

// Class-agnostic button finder: class swaps apply ↔ cancel during ingest
function getActionBtn() {
  const panel = document.querySelector('.wikey-audit-panel')
  if (!panel) return null
  return [...panel.querySelectorAll('button')].filter(b => /apply|cancel/.test(b.className))[0] || null
}

function btnText() {
  const b = getActionBtn()
  return (b?.textContent || '').trim()
}

async function restoreSourceFile() {
  if (await adapter.exists(SOURCE_PATH)) return
  // File was auto-moved after ingest — walk raw/ to find and restore
  function walk(dir) {
    try {
      for (const e of fs.readdirSync(path.join(basePath, dir), { withFileTypes: true })) {
        if (e.isDirectory()) {
          const found = walk(`${dir}/${e.name}`)
          if (found) return found
        } else if (e.name === SOURCE_NAME) {
          return `${dir}/${e.name}`
        }
      }
    } catch (_e) {}
    return null
  }
  const found = walk('raw')
  if (found && found !== SOURCE_PATH) {
    try {
      fs.renameSync(path.join(basePath, found), path.join(basePath, SOURCE_PATH))
    } catch (_e) {}
  }
}

async function cleanupForRerun(newFiles) {
  // newFiles from previous run's diff — delete exactly those, no guessing
  if (newFiles) {
    for (const f of newFiles.e) try { fs.unlinkSync(path.join(basePath, 'wiki/entities', f)) } catch (_e) {}
    for (const f of newFiles.c) try { fs.unlinkSync(path.join(basePath, 'wiki/concepts', f)) } catch (_e) {}
    for (const f of newFiles.s) try { fs.unlinkSync(path.join(basePath, 'wiki/sources', f)) } catch (_e) {}
  }
  // ingest-map: remove this source's entry (keyed by path, which may drift after move)
  try {
    const m = JSON.parse(await adapter.read('wiki/.ingest-map.json'))
    let changed = false
    for (const k of Object.keys(m)) {
      if (k === SOURCE_PATH || k.endsWith('/' + SOURCE_NAME)) { delete m[k]; changed = true }
    }
    if (changed) await adapter.write('wiki/.ingest-map.json', JSON.stringify(m, null, 2))
  } catch (_e) {}
  await restoreSourceFile()
}

const results = []
let prevNewFiles = null

for (let run = 1; run <= N_RUNS; run++) {
  await cleanupForRerun(prevNewFiles)
  await new Promise(r => setTimeout(r, 800))

  const baseline = snapshotDirs()

  const auditBtn = [...document.querySelectorAll('.wikey-header-btn')].find(b => b.getAttribute('aria-label') === 'Audit')
  if (!auditBtn) { results.push({ run, error: 'no audit button' }); continue }
  // Force panel destroy+recreate by routing through another panel first.
  // selectPanel() has a re-click guard (if activePanel === name, no-op), so
  // clicking Audit twice keeps the same stale DOM. Switch to another panel
  // (Chat) then back to Audit to trigger renderAuditSection() → audit-ingest.py
  // re-exec and fresh missing-list.
  if (document.querySelector('.wikey-audit-panel')) {
    const chatBtn = [...document.querySelectorAll('.wikey-header-btn')].find(b => b.getAttribute('aria-label') === 'Chat')
    const dashBtn = [...document.querySelectorAll('.wikey-header-btn')].find(b => b.getAttribute('aria-label') === 'Dashboard')
    const other = chatBtn || dashBtn
    if (other) { other.click(); await new Promise(r => setTimeout(r, 600)) }
  }
  auditBtn.click(); await new Promise(r => setTimeout(r, 2500))

  // Retry finding the row (audit-ingest.py JSON may take a moment to be parsed/rendered)
  let target = null
  let rows = []
  for (let attempt = 0; attempt < 5; attempt++) {
    rows = [...document.querySelectorAll('.wikey-audit-panel .wikey-audit-row')]
    target = rows.find(r => r.textContent?.includes(SOURCE_NAME))
    if (target) break
    await new Promise(r => setTimeout(r, 1500))
  }
  if (!target) { results.push({ run, error: 'row not found after 5 retries', rowCount: rows.length }); continue }

  for (const r of rows) {
    const c = r.querySelector('input[type=checkbox], .wikey-audit-cb')
    if (c?.checked && r !== target) c.click()
  }
  const cb = target.querySelector('input[type=checkbox], .wikey-audit-cb')
  if (cb && !cb.checked) { cb.click(); await new Promise(r => setTimeout(r, 200)) }

  // Defensive: if stale "Cancel" from a previous ingest is visible, click it away first
  {
    const b = getActionBtn()
    const t = (b?.textContent || '').trim()
    if (b && /cancel/i.test(t)) {
      b.click()
      await new Promise(r => setTimeout(r, 1000))
    }
  }

  const applyBtn = getActionBtn()
  if (!applyBtn) { results.push({ run, error: 'no apply/cancel btn found' }); continue }
  if (applyBtn.hasAttribute('disabled')) {
    results.push({ run, error: 'apply btn disabled (target unselected?)', cbChecked: cb?.checked }); continue
  }
  if (!/^ingest$/i.test((applyBtn.textContent || '').trim())) {
    results.push({ run, error: 'button not Ingest at click', buttonText: applyBtn.textContent }); continue
  }

  const startTs = Date.now()
  applyBtn.click()

  // Phase 1: wait for button text to transition AWAY from "Ingest" (30s × 500ms probes)
  // v7 fix: class-agnostic selector via getActionBtn() — class swaps to cancel-btn.
  let started = false
  let lastTxt = ''
  for (let probe = 0; probe < 60; probe++) {
    await new Promise(r => setTimeout(r, 500))
    lastTxt = btnText()
    if (lastTxt && !/^ingest$/i.test(lastTxt)) { started = true; break }
  }
  if (!started) {
    results.push({ run, error: 'ingest did not start', elapsedMs: Date.now() - startTs, lastTxt }); continue
  }

  // Phase 2: wait for button text to return to "Ingest" (done) — 10min timeout
  let elapsedMs = 0
  let timedOut = false
  while (true) {
    await new Promise(r => setTimeout(r, 1500))
    const txt = btnText()
    if (/^ingest$/i.test(txt)) { elapsedMs = Date.now() - startTs; break }
    if (Date.now() - startTs > 10 * 60 * 1000) {
      elapsedMs = Date.now() - startTs; timedOut = true; break
    }
  }

  await new Promise(r => setTimeout(r, 2000))  // filesystem flush settle
  const diff = listDiff(baseline)
  prevNewFiles = diff  // for next run's cleanup

  if (timedOut) {
    results.push({ run, error: 'timeout 10min', elapsedMs,
      e: diff.e.length, c: diff.c.length, s: diff.s.length })
    continue
  }

  results.push({
    run, elapsedMs,
    e: diff.e.length, c: diff.c.length, s: diff.s.length,
    total: diff.e.length + diff.c.length + diff.s.length,
    entityNames: diff.e.map(f => f.replace('.md', '')),
    conceptNames: diff.c.map(f => f.replace('.md', '')),
    sourceNames: diff.s.map(f => f.replace('.md', '')),
  })
}

// Final cleanup: remove last run's files + restore source
await cleanupForRerun(prevNewFiles)

plugin.settings = {
  ...plugin.settings,
  ingestBriefs: prevBrief,
  extractionDeterminism: prevDeterminism,
}
plugin.skipIngestBriefsThisSession = false
await plugin.saveSettings?.()
return results
JSEOF

# Substitute parameters
sed -i.bak "s|__N_RUNS__|${N_RUNS}|g; s|__SOURCE_PATH__|${SOURCE_PATH}|g; s|__DETERMINISM__|${DETERMINISM}|g" "$TMPJS"
rm -f "${TMPJS}.bak"

# Run via CDP
echo "[measure-determinism] CDP 호출 중 (최대 ${N_RUNS} × 10분 = $((N_RUNS * 10))분 타임아웃)..."
timeout_sec=$((N_RUNS * 600))
RAW_RESULTS=$(python3 /tmp/wikey-cdp.py file "$TMPJS" await "$timeout_sec")

# Parse results JSON — CDP Runtime.evaluate returnByValue wraps as {result: {result: {type, value}}}
echo "$RAW_RESULTS" > /tmp/wikey-determinism-raw.json
RESULTS_JSON=$(echo "$RAW_RESULTS" | python3 -c "
import json,sys
d=json.load(sys.stdin)
# CDP response: {id, result: {result: {type, value}}} — returnByValue nests twice
inner = d.get('result', {}).get('result', {})
if 'value' in inner:
    print(json.dumps(inner['value']))
else:
    # surface error details if evaluation threw
    print(json.dumps({'cdp_error': d}))
")

# Compute stats and write Markdown
python3 - "$RESULTS_JSON" "$SOURCE_PATH" "$ABS_OUTPUT" "$N_RUNS" "$DETERMINISM" <<'PYEOF'
import json, sys, os, statistics, datetime
payload = json.loads(sys.argv[1])
source_path = sys.argv[2]
output_path = sys.argv[3]
n_runs = int(sys.argv[4])
determinism = int(sys.argv[5]) == 1

if isinstance(payload, dict) and 'cdp_error' in payload:
    print(f'CDP evaluate failed:\n{json.dumps(payload["cdp_error"], indent=2)}', file=sys.stderr)
    sys.exit(1)
if not isinstance(payload, list):
    print(f'Unexpected payload (not list): {payload!r}', file=sys.stderr)
    sys.exit(1)
results = payload

ok = [r for r in results if 'error' not in r]
err = [r for r in results if 'error' in r]

print(f'\nResults: {len(ok)} ok / {len(err)} errors')
for r in err: print(f'  ERR run {r["run"]}: {r["error"]}')
if not ok:
    print('NO valid runs', file=sys.stderr); sys.exit(3)

print(f'\n{"Run":<5}{"Entities":>10}{"Concepts":>10}{"Total":>8}{"Time(s)":>10}')
for r in ok: print(f'{r["run"]:<5}{r["e"]:>10}{r["c"]:>10}{r["total"]:>8}{r["elapsedMs"]/1000:>10.1f}')

def stats(xs):
    if len(xs) < 2: return statistics.mean(xs), 0.0, 0.0
    m = statistics.mean(xs); s = statistics.stdev(xs)
    return m, s, (s/m*100) if m else 0.0

es = [r['e'] for r in ok]; cs = [r['c'] for r in ok]; ts = [r['total'] for r in ok]
times = [r['elapsedMs']/1000 for r in ok]
me, se, cve = stats(es); mc, sc, cvc = stats(cs); mt, st, cvt = stats(ts); mtm, stm, cvtm = stats(times)

print(f'\nStatistics ({len(ok)} runs):')
print(f'  Entities: mean={me:.2f}, std={se:.2f}, CV={cve:.1f}%, range=[{min(es)}-{max(es)}]')
print(f'  Concepts: mean={mc:.2f}, std={sc:.2f}, CV={cvc:.1f}%, range=[{min(cs)}-{max(cs)}]')
print(f'  Total:    mean={mt:.2f}, std={st:.2f}, CV={cvt:.1f}%, range=[{min(ts)}-{max(ts)}]')
print(f'  Time:     mean={mtm:.1f}s, std={stm:.1f}s, range=[{min(times):.1f}-{max(times):.1f}]')

# Core/variable analysis
ent_sets = [set(r['entityNames']) for r in ok]
con_sets = [set(r['conceptNames']) for r in ok]
ent_core = set.intersection(*ent_sets) if ent_sets else set()
ent_all = set.union(*ent_sets) if ent_sets else set()
con_core = set.intersection(*con_sets) if con_sets else set()
con_all = set.union(*con_sets) if con_sets else set()

print(f'\nCore (always present):')
print(f'  Entities: {len(ent_core)}/{len(ent_all)} ({len(ent_core)/max(len(ent_all),1)*100:.0f}%)')
print(f'  Concepts: {len(con_core)}/{len(con_all)} ({len(con_core)/max(len(con_all),1)*100:.0f}%)')

# Markdown output
os.makedirs(os.path.dirname(output_path), exist_ok=True)
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(f'# 결정성 측정 — {os.path.basename(source_path)}\n\n')
    f.write(f'> 일시: {datetime.date.today().isoformat()}\n')
    f.write(f'> Source: `{source_path}`\n')
    f.write(f'> Runs: {len(ok)} ({len(err)} failed)\n')
    f.write(f'> Determinism: {"ON (temperature=0, seed=42)" if determinism else "off (baseline sampling)"}\n')
    f.write(f'> 도구: `scripts/measure-determinism.sh`\n\n')
    f.write('## 결과\n\n')
    f.write('| Run | Entities | Concepts | Total | Time(s) |\n')
    f.write('|----:|---------:|---------:|------:|--------:|\n')
    for r in ok:
        f.write(f'| {r["run"]} | {r["e"]} | {r["c"]} | {r["total"]} | {r["elapsedMs"]/1000:.1f} |\n')
    if err:
        f.write('\n실패 run:\n')
        for r in err: f.write(f'- run {r["run"]}: {r["error"]}\n')
    f.write('\n## 통계\n\n')
    f.write('| 지표 | Mean | Std | **CV %** | Range |\n')
    f.write('|------|-----:|----:|---------:|------:|\n')
    f.write(f'| Entities | {me:.2f} | {se:.2f} | **{cve:.1f}%** | {min(es)}–{max(es)} |\n')
    f.write(f'| Concepts | {mc:.2f} | {sc:.2f} | **{cvc:.1f}%** | {min(cs)}–{max(cs)} |\n')
    f.write(f'| Total | {mt:.2f} | {st:.2f} | **{cvt:.1f}%** | {min(ts)}–{max(ts)} |\n')
    f.write(f'| Time | {mtm:.1f}s | {stm:.1f}s | {cvtm:.1f}% | {min(times):.1f}–{max(times):.1f} |\n')
    f.write('\n## Core / Variable\n\n')
    f.write(f'### Entities — {len(ent_core)}/{len(ent_all)} core ({len(ent_core)/max(len(ent_all),1)*100:.0f}%)\n\n')
    f.write(f'**Always present** ({len(ent_core)}): {", ".join(sorted(ent_core)) or "(none)"}\n\n')
    var = sorted(ent_all - ent_core)
    if var: f.write(f'**Sometimes**: {", ".join(var)}\n\n')
    f.write(f'### Concepts — {len(con_core)}/{len(con_all)} core ({len(con_core)/max(len(con_all),1)*100:.0f}%)\n\n')
    f.write(f'**Always present** ({len(con_core)}): {", ".join(sorted(con_core)) or "(none)"}\n\n')
    var = sorted(con_all - con_core)
    if var: f.write(f'**Sometimes**: {", ".join(var)}\n\n')

print(f'\nWritten: {output_path}')
PYEOF
