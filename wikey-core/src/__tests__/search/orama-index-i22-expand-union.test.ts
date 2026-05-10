/**
 * §5.7.8 Finding 7 fix / Spec invariant I22 — when the expand layer is active, the raw
 * user question must remain in the BM25 union (expand augments, never replaces).
 *
 * The test instruments the expander with multiQueries that share *no* tokens with the
 * effective filter output, then asserts that a hit only retrievable by the original
 * query still appears in the search result. When expand is inactive, the raw question
 * is intentionally not re-injected (the legacy single-query path).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  createOramaIndex,
  type KoreanTokenizerHandle,
} from '../../search/orama-index.js'
import { QueryIntentFilter } from '../../search/query-intent-filter.js'
import { QueryExpander } from '../../search/query-expander.js'

const FILTER_PROMPT = '## stub\n{{QUERY}}\n{{TOKENS_JSON}}\n{{VAULT_HINT_BLOCK}}\n'
const EXPANDER_PROMPT = '## stub\n{{QUERY}}\n{{TOKENS_JSON}}\n'

function makeTokenizer(): KoreanTokenizerHandle {
  return {
    tokenize: (text: string) =>
      (text || '').toLowerCase().split(/[\s,.!?()/:;'"`　]+/u).filter((s) => s.length > 0),
    close: () => undefined,
  }
}

let tmpRoot = ''
let cachePath = ''
let wikiDir = ''

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'wikey-i22-'))
  cachePath = join(tmpRoot, 'cache.json')
  wikiDir = join(tmpRoot, 'wiki', 'concepts')
  mkdirSync(wikiDir, { recursive: true })
  // Two pages — one matches only the raw question's noun, the other matches the
  // filter-kept token. With expand active, both should be retrievable.
  writeFileSync(
    join(wikiDir, 'pmbok-overview.md'),
    '---\ntitle: PMBOK Overview\n---\nThe pmbok-overview body.',
    'utf-8',
  )
  writeFileSync(
    join(wikiDir, 'cost.md'),
    '---\ntitle: Cost\n---\nCost management body.',
    'utf-8',
  )
})
afterEach(() => {
  if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true })
})

describe('orama-index — Finding 7 / I22 raw question preservation', () => {
  it('Expand active → raw question merged into BM25 union (cost-only hit retrieved)', async () => {
    const handle = await createOramaIndex({ cachePath, tokenizer: makeTokenizer() })
    await handle.ingestAll(join(tmpRoot, 'wiki'))

    const filter = new QueryIntentFilter({
      // Filter keeps only "pmbok" — drops "cost" so the legacy effectiveQuery would
      // miss the cost.md page entirely.
      llm: { async call() {
        return JSON.stringify({
          tokens: [
            { token: 'pmbok', role: 'domain-marker', keep: true },
            { token: 'cost', role: 'generic-noise', keep: false },
          ],
        })
      } },
      promptTemplate: FILTER_PROMPT,
      tokenize: (q: string) => q.split(/\s+/u).filter((t) => t.length > 0),
    })
    const expander = new QueryExpander({
      llm: { async call() {
        return JSON.stringify({ multiQueries: ['pmbok'] })
      } },
      promptTemplate: EXPANDER_PROMPT,
    })

    const results = await handle.search('pmbok cost', {
      topN: 5,
      filter,
      expander,
    })
    // The cost.md hit is *only* retrievable via the raw "pmbok cost" question because
    // both filter and expand stripped "cost". I22 fix preserves it.
    const paths = results.map((r) => r.path)
    expect(paths.some((p) => p.endsWith('cost.md'))).toBe(true)
  })

  it('Expand inactive → legacy effectiveQuery only (raw question not re-injected)', async () => {
    const handle = await createOramaIndex({ cachePath, tokenizer: makeTokenizer() })
    await handle.ingestAll(join(tmpRoot, 'wiki'))

    const filter = new QueryIntentFilter({
      llm: { async call() {
        return JSON.stringify({
          tokens: [
            { token: 'pmbok', role: 'domain-marker', keep: true },
            { token: 'cost', role: 'generic-noise', keep: false },
          ],
        })
      } },
      promptTemplate: FILTER_PROMPT,
      tokenize: (q: string) => q.split(/\s+/u).filter((t) => t.length > 0),
    })

    const results = await handle.search('pmbok cost', { topN: 5, filter })
    // Without expander, only "pmbok" was queried — the cost.md page (no "pmbok" in
    // body or title) should not appear.
    const paths = results.map((r) => r.path)
    expect(paths.some((p) => p.endsWith('cost.md'))).toBe(false)
  })
})
