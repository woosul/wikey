#!/usr/bin/env node
/**
 * §5.4.4 — convergence pass entry-point. **§5.10.4 D-wide 폐기 (2026-05-05)**.
 *
 * 본 script 는 historical reference 로만 보존 — scripts/reindex.sh 의 자동 호출 hook
 * 도 cycle #3 에서 제거됨. 사용자가 direct CLI invoke 하면 still 동작 (mention-history.json
 * 이 vault 에 잔존하는 한정 환경) 하지만, ingest pipeline 은 더 이상 mention-history.json
 * 을 자동 갱신하지 않으므로 stale snapshot 기반 결과만 산출.
 *
 * spec: plan/phase-5-todox-5.4-integration.md §3.4.3 (line 919-935) — historical
 *
 * Args (createConvergencePass 가 parse):
 *   --history       <path>   .wikey/mention-history.json
 *   --qmd-db        <path>   ~/.cache/qmd/index.sqlite (advisory in v1)
 *   --output        <path>   .wikey/converged-decompositions.json
 *   --arbitration   union|llm
 *   --token-budget  <num>
 *   --embeddings    <path>   (optional) JSON `{ "<slug>": [vec...], ... }`
 *
 * Behavior:
 *   - history JSON load → runConvergencePass (precondition check 포함, AC20)
 *   - --embeddings 인자가 있으면 JSON load → Map<slug, vec> 으로 inject
 *     (post-impl Cycle #2 F4 fix — alpha v1 wire 명시: 외부 도구가
 *      embeddings 를 미리 dump 후 inject. 추후 v2 에서 qmd-db 직접 query
 *      통합 — 본 v1 은 advisory 인자로만 보존하고 embeddings 는 외부 inject)
 *   - 결과를 output JSON 으로 atomic write (tmp + rename)
 *   - precondition 미달 / 결과 0 → output 미작성 + warn 로깅 (exit 0)
 *   - --embeddings 미지정 또는 load 실패 → 빈 Map → cluster 0 → graceful skip + warn
 */

// §5.10.4 D-wide deprecated — short-circuit on direct invocation.
// 본 script 는 cycle #3 에서 reindex.sh 자동 hook 제거됨 + cycle #2 에서 index.ts
// public export (createConvergencePass / runConvergencePass) 모두 제거됨. dynamic
// import 를 통해 직접 module file (`../convergence.js`) 에서 가져오면 동작 가능하지만
// 본 entry 는 사용자에게 deprecation 명시 후 종료.
console.error('[run-convergence-pass] §5.10.4 D-wide 폐기 (2026-05-05). 본 script 는 historical reference 입니다.')
console.error('  Stage 4 convergence 자동 path: scripts/reindex.sh 의 hook 제거됨.')
console.error('  Stage 4 convergence public API: wikey-core/src/index.ts 에서 export 제거됨.')
console.error('  사용자가 본 logic 을 다시 활용하려면 ../convergence.js 의 함수를 직접 import 해야 합니다.')
process.exit(2)

// (legacy entry point preserved below for historical reference — unreachable)
/* eslint-disable */
import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'

import {
  createConvergencePass,
  runConvergencePass,
} from '../convergence.js'

async function main() {
  const config = createConvergencePass(process.argv.slice(2))

  let history = []
  try {
    const raw = await fs.readFile(config.history, 'utf-8')
    const parsed = JSON.parse(raw)
    // mention-history.json 의 표준 schema 는 { version, ingests: [...] }.
    // legacy bare array 도 지원 (post-impl Cycle #2 F4 alpha v1 wire 후속 fix).
    if (Array.isArray(parsed)) {
      history = parsed
    } else if (parsed && Array.isArray(parsed.ingests)) {
      history = parsed.ingests
    } else {
      console.warn(`mention-history empty or invalid schema, treating as []: ${config.history}`)
      history = []
    }
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      console.warn(`mention-history not found, skipping convergence: ${config.history}`)
      return
    }
    throw err
  }

  // post-impl Cycle #2 F4 fix — alpha v1 wire: --embeddings JSON 파일이 지정되면
  // load 후 Map<slug, vec> 으로 inject. 미지정 또는 load 실패 시 빈 Map →
  // cluster 0 → graceful skip + warn.
  const embeddings = new Map()
  if (config.embeddings) {
    try {
      const raw = await fs.readFile(config.embeddings, 'utf-8')
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        for (const [slug, vec] of Object.entries(parsed)) {
          if (Array.isArray(vec) && vec.every((n) => typeof n === 'number')) {
            embeddings.set(slug, vec)
          }
        }
      }
      console.log(`convergence pass: loaded ${embeddings.size} embeddings from ${config.embeddings}`)
    } catch (err) {
      console.warn(`embeddings load failed (${config.embeddings}): ${err && err.message ? err.message : err}`)
    }
  } else {
    console.warn('convergence pass: no --embeddings provided, cluster will be empty (alpha v1 — external dump required)')
  }

  const converged = await runConvergencePass(history, {
    arbitration: config.arbitration,
    tokenBudget: config.tokenBudget,
    embeddings,
  })

  if (converged.length === 0) {
    console.warn('convergence pass produced 0 results (precondition or empty cluster)')
    return
  }

  const outDir = dirname(config.output)
  await fs.mkdir(outDir, { recursive: true })
  const tmp = `${config.output}.tmp`
  await fs.writeFile(tmp, JSON.stringify(converged, null, 2), 'utf-8')
  await fs.rename(tmp, config.output)
  console.log(`convergence pass: wrote ${converged.length} ConvergedDecomposition(s) → ${config.output}`)
}

main().catch((err) => {
  console.error(`convergence pass failed: ${err && err.stack ? err.stack : err}`)
  process.exit(1)
})
