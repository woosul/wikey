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
사용법: ./scripts/measure-determinism.sh <source-path> [-n N] [-o output.md]

옵션:
  -n N         반복 횟수 (기본 5)
  -o PATH      출력 Markdown 경로 (기본 activity/determinism-<name>-<date>.md)
  -h, --help   도움말
EOF
  exit 0
}

N_RUNS=5
OUTPUT_PATH=""
SOURCE_PATH=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -n) N_RUNS="$2"; shift 2 ;;
    -o) OUTPUT_PATH="$2"; shift 2 ;;
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
echo

# 측정 JS를 임시 파일로 작성 (parameterized)
TMPJS=$(mktemp /tmp/wikey-determinism-XXXXX.js)
trap "rm -f $TMPJS" EXIT

cat > "$TMPJS" <<'JSEOF'
const N_RUNS = __N_RUNS__
const SOURCE_PATH = '__SOURCE_PATH__'
const SOURCE_NAME = SOURCE_PATH.split('/').pop()

const plugin = window.app.plugins.plugins.wikey
const adapter = window.app.vault.adapter
const basePath = adapter.basePath
const fs = require('node:fs')
const path = require('node:path')

const prevBrief = plugin.settings.ingestBriefs
plugin.settings.ingestBriefs = 'never'
await plugin.saveSettings?.()

function readSourceTagsOf(source) {
  const ents = fs.readdirSync(path.join(basePath, 'wiki/entities'))
    .filter(f => f.endsWith('.md'))
    .filter(f => { try { return fs.readFileSync(path.join(basePath, 'wiki/entities', f), 'utf-8').includes(source) } catch { return false } })
  const cons = fs.readdirSync(path.join(basePath, 'wiki/concepts'))
    .filter(f => f.endsWith('.md'))
    .filter(f => { try { return fs.readFileSync(path.join(basePath, 'wiki/concepts', f), 'utf-8').includes(source) } catch { return false } })
  return { entities: ents, concepts: cons }
}

async function cleanupForRerun() {
  const { entities, concepts } = readSourceTagsOf(SOURCE_NAME)
  for (const f of entities) try { fs.unlinkSync(path.join(basePath, 'wiki/entities', f)) } catch (_e) {}
  for (const f of concepts) try { fs.unlinkSync(path.join(basePath, 'wiki/concepts', f)) } catch (_e) {}
  // Delete source pages mentioning this source (by content OR by filename match)
  // The audit-ingest fuzzy match uses normalized filename, so we delete any source whose
  // normalized stem contains/is contained by the source-name stem (sans extension).
  function normalize(s) { return s.toLowerCase().replace(/[^a-z0-9가-힣]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') }
  const srcStem = SOURCE_NAME.replace(/\.[^.]+$/, '')
  const srcStemNorm = normalize(srcStem)
  for (const f of fs.readdirSync(path.join(basePath, 'wiki/sources'))) {
    if (!f.endsWith('.md')) continue
    const stem = f.replace(/\.md$/, '').replace(/^source-/, '')
    const stemNorm = normalize(stem)
    let shouldDelete = false
    // 1) Content references
    try {
      const c = fs.readFileSync(path.join(basePath, 'wiki/sources', f), 'utf-8')
      if (c.includes(SOURCE_NAME) || c.includes(srcStem)) shouldDelete = true
    } catch (_e) {}
    // 2) Filename fuzzy match (matches audit-ingest.match logic)
    if (!shouldDelete && srcStemNorm.length > 3 && stemNorm.length > 3) {
      if (stemNorm.includes(srcStemNorm) || srcStemNorm.includes(stemNorm)) shouldDelete = true
    }
    if (shouldDelete) {
      try { fs.unlinkSync(path.join(basePath, 'wiki/sources', f)) } catch (_e) {}
    }
  }
  // Move file back to inbox if auto-moved
  if (!await adapter.exists(SOURCE_PATH)) {
    const allDirs = []
    function walk(dir) {
      try {
        for (const e of fs.readdirSync(path.join(basePath, dir), { withFileTypes: true })) {
          if (e.isDirectory()) { allDirs.push(`${dir}/${e.name}`); walk(`${dir}/${e.name}`) }
        }
      } catch (_e) {}
    }
    walk('raw')
    for (const d of allDirs) {
      const try1 = `${d}/${SOURCE_NAME}`
      if (await adapter.exists(try1)) {
        await adapter.copy(try1, SOURCE_PATH)
        await adapter.remove(try1)
        break
      }
    }
  }
  // Clean ingest-map
  try {
    const m = JSON.parse(await adapter.read('wiki/.ingest-map.json'))
    let changed = false
    for (const k of Object.keys(m)) if (k.includes(SOURCE_NAME)) { delete m[k]; changed = true }
    if (changed) await adapter.write('wiki/.ingest-map.json', JSON.stringify(m, null, 2))
  } catch (_e) {}
  // Clean log.md test entries (best-effort)
  try {
    const log = await adapter.read('wiki/log.md')
    const re = new RegExp(`## \\[\\d{4}-\\d{2}-\\d{2}\\] ingest \\| ${SOURCE_NAME.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}.*?(?=^## |\\\\Z)`, 'sm')
    const newLog = log.replace(re, '')
    if (newLog !== log) await adapter.write('wiki/log.md', newLog)
  } catch (_e) {}
}

const results = []
for (let run = 1; run <= N_RUNS; run++) {
  await cleanupForRerun()
  await new Promise(r => setTimeout(r, 800))

  const auditBtn = [...document.querySelectorAll('.wikey-header-btn')].find(b => b.getAttribute('aria-label') === 'Audit')
  // Always close+reopen for fresh data
  if (document.querySelector('.wikey-audit-panel')) {
    auditBtn.click(); await new Promise(r => setTimeout(r, 1000))
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

  const applyBtn = [...document.querySelectorAll('.wikey-audit-panel button')].find(b => /^ingest/i.test(b.textContent?.trim() || ''))
  if (!applyBtn) { results.push({ run, error: 'no apply btn' }); continue }

  const startTs = Date.now()
  applyBtn.click()
  // Race-condition guard (v7 post-fix): wait for the apply button to transition
  // AWAY from "Ingest" before entering the completion loop. Without this, the first
  // probe inside the loop (1.5s after click) can catch the button still in its
  // initial "Ingest" state — the loop then exits instantly with 0 entities/concepts.
  let started = false
  for (let probe = 0; probe < 20; probe++) {
    await new Promise(r => setTimeout(r, 500))
    const btnProbe = document.querySelector('.wikey-audit-panel .wikey-audit-apply-btn')?.textContent?.trim() || ''
    if (btnProbe && !/^ingest$/i.test(btnProbe)) { started = true; break }
  }
  if (!started) {
    results.push({ run, error: 'ingest did not start (button never transitioned)', elapsedMs: Date.now() - startTs }); continue
  }
  let elapsedMs = 0
  while (true) {
    await new Promise(r => setTimeout(r, 1500))
    const btnNow = document.querySelector('.wikey-audit-panel .wikey-audit-apply-btn')?.textContent?.trim() || ''
    if (/^ingest$/i.test(btnNow)) { elapsedMs = Date.now() - startTs; break }
    if (Date.now() - startTs > 10 * 60 * 1000) {
      results.push({ run, error: 'timeout 10min', elapsedMs: Date.now() - startTs }); break
    }
  }

  await new Promise(r => setTimeout(r, 2000))
  const { entities, concepts } = readSourceTagsOf(SOURCE_NAME)
  results.push({
    run, elapsedMs,
    e: entities.length, c: concepts.length, total: entities.length + concepts.length + 1,
    entityNames: entities.map(f => f.replace('.md', '')),
    conceptNames: concepts.map(f => f.replace('.md', '')),
  })
}

plugin.settings.ingestBriefs = prevBrief
await plugin.saveSettings?.()
return results
JSEOF

# Substitute parameters
sed -i.bak "s|__N_RUNS__|${N_RUNS}|g; s|__SOURCE_PATH__|${SOURCE_PATH}|g" "$TMPJS"
rm -f "${TMPJS}.bak"

# Run via CDP
echo "[measure-determinism] CDP 호출 중 (최대 ${N_RUNS} × 10분 = $((N_RUNS * 10))분 타임아웃)..."
timeout_sec=$((N_RUNS * 600))
RAW_RESULTS=$(python3 /tmp/wikey-cdp.py file "$TMPJS" await "$timeout_sec")

# Parse results JSON
echo "$RAW_RESULTS" > /tmp/wikey-determinism-raw.json
RESULTS_JSON=$(echo "$RAW_RESULTS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(json.dumps(d.get('result',{}).get('value',[])))")

# Compute stats and write Markdown
python3 - "$RESULTS_JSON" "$SOURCE_PATH" "$ABS_OUTPUT" "$N_RUNS" <<'PYEOF'
import json, sys, os, statistics, datetime
results = json.loads(sys.argv[1])
source_path = sys.argv[2]
output_path = sys.argv[3]
n_runs = int(sys.argv[4])

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
    f.write(f'# v6 결정성 측정 — {os.path.basename(source_path)}\n\n')
    f.write(f'> 일시: {datetime.date.today().isoformat()}\n')
    f.write(f'> Source: `{source_path}`\n')
    f.write(f'> Runs: {len(ok)} ({len(err)} failed)\n')
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
