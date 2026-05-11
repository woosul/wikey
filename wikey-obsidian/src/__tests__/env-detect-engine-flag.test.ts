/**
 * §5.7.5 RED — AC-C6 detectEnvironment(basePath, ollamaUrl, searchEngine) signature.
 *
 * (a) searchEngine='orama' → qmd inline block + ABI scan SKIP. status.qmdPath='',
 *     status.nodePath = process.execPath fallback (또는 동등 default).
 * (b) searchEngine='qmd' (toggle) → 기존 inline detect 정상 호출 (qmdPath resolve attempt).
 *
 * Source-level grep 으로 충분 — process spawn 회피 (test 환경 의존성 0).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SRC = join(__dirname, '..', 'env-detect.ts')

describe('§5.7.5 env-detect engine flag', () => {
  it('AC-C6.a: detectEnvironment signature accepts searchEngine parameter', () => {
    const src = readFileSync(SRC, 'utf-8')
    // signature must declare a third parameter named searchEngine
    expect(
      /export\s+async\s+function\s+detectEnvironment\s*\([^)]*searchEngine[^)]*\)/u.test(src),
      'detectEnvironment must accept searchEngine as 3rd parameter',
    ).toBe(true)
  })

  it('AC-C6.b: searchEngine !== qmd branch skips qmd inline block + findCompatibleNode', () => {
    const src = readFileSync(SRC, 'utf-8')
    // production code must guard the qmd inline block + ABI scan with searchEngine flag
    // We grep for an early-return / conditional branch on searchEngine.
    const qmdSkipPattern = /searchEngine\s*!==\s*['"]qmd['"]|searchEngine\s*===\s*['"]orama['"]/u
    expect(
      qmdSkipPattern.test(src),
      'env-detect.ts must conditionally skip qmd path when searchEngine !== qmd',
    ).toBe(true)
  })

  // §5.16 cycle #3 finding #1 (flaky 5s timeout in full suite, isolated 4.5s PASS):
  // detectEnvironment 가 외부 probe (ollama HTTP + python3 / qmd / pandoc / docling 등) 를
  // 병렬 호출하므로 cold start (특히 first run / CI 환경) 에서 5s 의 default vitest timeout
  // 에 근접. timeout 10s 확장 — 본 test 의 결정성 (deterministic outcome) 은 detectEnvironment
  // 가 어떤 probe 결과를 반환하든 qmdPath="" 로 일정 (engine="orama" 분기). flakiness
  // 의 근본은 detectEnvironment 의 외부 의존도 — 본 §5.16 scope 외, 별 cycle (§5.7.5
  // follow-up 또는 env-detect 안정화 cycle) 에서 mock probe 도입 후보.
  it('AC-C6.runtime: detectEnvironment with searchEngine="orama" returns qmdPath=""', { timeout: 10_000 }, async () => {
    const { detectEnvironment } = await import('../env-detect.js')
    // Pass orama → qmd block must skip → qmdPath stays empty.
    // Pass an unreachable ollama URL to keep the run fast/deterministic.
    const status = await detectEnvironment('/tmp/no-such-base', 'http://127.0.0.1:1', 'orama')
    expect(status.qmdPath).toBe('')
  })
})
