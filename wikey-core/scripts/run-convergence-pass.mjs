#!/usr/bin/env node
/**
 * §5.4.4 — convergence pass entry-point (run from reindex.sh hook).
 *
 * 호출: scripts/reindex.sh 가 WIKEY_CONVERGENCE_ENABLED=true 일 때만.
 * spec: plan/phase-5-todox-5.4-integration.md §3.4.3 (line 919-935)
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

import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'

// Resolved against the *runtime* location: this file is copied to
// `wikey-core/dist/scripts/run-convergence-pass.mjs` by the build, so
// `../index.js` points at `wikey-core/dist/index.js`. (Running directly from
// `wikey-core/scripts/run-convergence-pass.mjs` is unsupported — reindex.sh
// only invokes the dist copy.)
import {
  createConvergencePass,
  runConvergencePass,
} from '../index.js'

async function main() {
  const config = createConvergencePass(process.argv.slice(2))

  let history = []
  try {
    const raw = await fs.readFile(config.history, 'utf-8')
    history = JSON.parse(raw)
    if (!Array.isArray(history)) {
      console.warn(`mention-history not an array, treating as empty: ${config.history}`)
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
