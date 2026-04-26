#!/usr/bin/env node
/**
 * §5.4.4 — convergence pass entry-point (run from reindex.sh hook).
 *
 * 호출: scripts/reindex.sh 가 WIKEY_CONVERGENCE_ENABLED=true 일 때만.
 * spec: plan/phase-5-todox-5.4-integration.md §3.4.3 (line 919-935)
 *
 * Args (createConvergencePass 가 parse):
 *   --history       <path>   .wikey/mention-history.json
 *   --qmd-db        <path>   ~/.cache/qmd/index.sqlite
 *   --output        <path>   .wikey/converged-decompositions.json
 *   --arbitration   union|llm
 *   --token-budget  <num>
 *
 * Behavior:
 *   - history JSON load → runConvergencePass (precondition check 포함, AC20)
 *   - 결과를 output JSON 으로 atomic write (tmp + rename)
 *   - precondition 미달 / 결과 0 → output 미작성 + warn 로깅 (exit 0)
 *
 * v1 한계: qmd 벡터 인덱스 fetch 는 stub (빈 embeddings map). 실 통합은
 * §5.4.5 라이브 cycle 에서 plug-in 한다 — 본 wrapper 는 entry-point 만
 * 검증하면 된다 (단위 test 는 createConvergencePass / runConvergencePass
 * TS 함수에서 직접 검증).
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

  // v1 stub — qmd vector index fetch 는 §5.4.5 라이브 cycle 에서 plug-in.
  // 빈 embeddings map → cluster 가 형성 안 됨 → 결과 [] (silent skip).
  const embeddings = new Map()

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
