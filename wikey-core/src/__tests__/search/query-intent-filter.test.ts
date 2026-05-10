/**
 * §5.7.8 Spec 1 — QueryIntentFilter unit tests.
 *
 * Coverage:
 *  - AC-F1 happy / single token / mixed English / vault hint
 *  - AC-F2 fail-open (LLM throw / timeout / invalid JSON)
 *  - AC-F3 cache hit + persistence + LRU eviction
 *  - AC-F4 grep self-check (no hardcoded wordlist patterns in source files)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  QueryIntentFilter,
  type FilterLLM,
  type TokenDecision,
} from '../../search/query-intent-filter.js'
import { QueryFilterCache } from '../../search/query-filter-cache.js'
import type { LLMCallOptions } from '../../types.js'

const PROMPT_TEMPLATE = readFileSync(
  join(__dirname, '..', '..', 'prompts', 'query-intent-filter.prompt.md'),
  'utf-8',
)

function whitespaceTokenize(query: string): string[] {
  return query.split(/\s+/u).filter((t) => t.length > 0)
}

function makeMockLLM(responder: (prompt: string) => string | Promise<string>): {
  llm: FilterLLM
  callCount: () => number
} {
  let calls = 0
  const llm: FilterLLM = {
    async call(prompt: string, _opts?: LLMCallOptions): Promise<string> {
      calls += 1
      return await responder(prompt)
    },
  }
  return { llm, callCount: () => calls }
}

function jsonResponse(tokens: TokenDecision[]): string {
  return JSON.stringify({ tokens })
}

let tmpRoot = ''
beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'wikey-query-filter-cache-'))
})
afterEach(() => {
  if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true })
})

describe('QueryIntentFilter — AC-F1 happy paths', () => {
  it('PMBOK query keeps domain-marker + intent-core tokens', async () => {
    const { llm } = makeMockLLM(() =>
      jsonResponse([
        { token: '프로젝트', role: 'domain-marker', keep: true },
        { token: '비용', role: 'intent-core', keep: true },
        { token: '관리', role: 'intent-core', keep: true },
      ]),
    )
    const filter = new QueryIntentFilter({
      llm, promptTemplate: PROMPT_TEMPLATE, tokenize: whitespaceTokenize,
    })
    const decision = await filter.filter('프로젝트 비용 관리')
    expect(decision.filtered).toEqual(['프로젝트', '비용', '관리'])
    expect(decision.fallback).toBe('none')
  })

  it('Medical query drops generic-noise "가이드"', async () => {
    const { llm } = makeMockLLM(() =>
      jsonResponse([
        { token: '당뇨', role: 'domain-marker', keep: true },
        { token: '합병증', role: 'intent-core', keep: true },
        { token: '예방', role: 'intent-core', keep: true },
        { token: '가이드', role: 'generic-noise', keep: false },
      ]),
    )
    const filter = new QueryIntentFilter({
      llm, promptTemplate: PROMPT_TEMPLATE, tokenize: whitespaceTokenize,
    })
    const decision = await filter.filter('당뇨 합병증 예방 가이드')
    expect(decision.filtered).toEqual(['당뇨', '합병증', '예방'])
    expect(decision.tokens.find((t) => t.token === '가이드')?.keep).toBe(false)
  })

  it('Legal query keeps domain-marker + drops "사례"', async () => {
    const { llm } = makeMockLLM(() =>
      jsonResponse([
        { token: '민법', role: 'domain-marker', keep: true },
        { token: '제3조', role: 'intent-core', keep: true },
        { token: '적용', role: 'intent-core', keep: true },
        { token: '사례', role: 'generic-noise', keep: false },
      ]),
    )
    const filter = new QueryIntentFilter({
      llm, promptTemplate: PROMPT_TEMPLATE, tokenize: whitespaceTokenize,
    })
    const decision = await filter.filter('민법 제3조 적용 사례')
    expect(decision.filtered).toEqual(['민법', '제3조', '적용'])
  })

  it('Single-token query keeps the lone domain-marker', async () => {
    const { llm } = makeMockLLM(() =>
      jsonResponse([{ token: 'PMBOK', role: 'domain-marker', keep: true }]),
    )
    const filter = new QueryIntentFilter({
      llm, promptTemplate: PROMPT_TEMPLATE, tokenize: whitespaceTokenize,
    })
    const decision = await filter.filter('PMBOK')
    expect(decision.filtered).toEqual(['PMBOK'])
  })

  it('English mixed query keeps both tokens', async () => {
    const { llm } = makeMockLLM(() =>
      jsonResponse([
        { token: 'BM25', role: 'intent-core', keep: true },
        { token: '알고리즘', role: 'intent-core', keep: true },
      ]),
    )
    const filter = new QueryIntentFilter({
      llm, promptTemplate: PROMPT_TEMPLATE, tokenize: whitespaceTokenize,
    })
    const decision = await filter.filter('BM25 알고리즘')
    expect(decision.filtered).toEqual(['BM25', '알고리즘'])
  })

  it('Vault hint forces keep on tokens the LLM would otherwise drop', async () => {
    const { llm } = makeMockLLM(() =>
      jsonResponse([
        { token: '프로젝트', role: 'generic-noise', keep: false },
        { token: '동향', role: 'intent-core', keep: true },
      ]),
    )
    const filter = new QueryIntentFilter({
      llm, promptTemplate: PROMPT_TEMPLATE, tokenize: whitespaceTokenize,
    })
    const decision = await filter.filter('프로젝트 동향', {
      domainMarkers: [],
      priorityKeep: ['프로젝트'],
    })
    expect(decision.filtered).toContain('프로젝트')
    expect(decision.tokens.find((t) => t.token === '프로젝트')?.role).toBe('domain-marker')
  })
})

describe('QueryIntentFilter — AC-F2 fail-open', () => {
  it('LLM throws → fallback "llm-fail" + original tokens kept', async () => {
    const llm: FilterLLM = {
      async call() { throw new Error('network down') },
    }
    const filter = new QueryIntentFilter({
      llm, promptTemplate: PROMPT_TEMPLATE, tokenize: whitespaceTokenize,
    })
    const decision = await filter.filter('프로젝트 비용 관리')
    expect(decision.fallback).toBe('llm-fail')
    expect(decision.filtered).toEqual(['프로젝트', '비용', '관리'])
  })

  it('LLM timeout → fallback "timeout" + original tokens kept', async () => {
    const llm: FilterLLM = {
      async call(): Promise<string> {
        return await new Promise((resolve) => setTimeout(() => resolve('{}'), 200))
      },
    }
    const filter = new QueryIntentFilter({
      llm, promptTemplate: PROMPT_TEMPLATE, tokenize: whitespaceTokenize, timeoutMs: 50,
    })
    const decision = await filter.filter('프로젝트 비용 관리')
    expect(decision.fallback).toBe('timeout')
    expect(decision.filtered).toEqual(['프로젝트', '비용', '관리'])
  })

  it('Invalid JSON → fallback "llm-fail" + original tokens kept', async () => {
    const { llm } = makeMockLLM(() => 'not json at all')
    const filter = new QueryIntentFilter({
      llm, promptTemplate: PROMPT_TEMPLATE, tokenize: whitespaceTokenize,
    })
    const decision = await filter.filter('프로젝트 비용 관리')
    expect(decision.fallback).toBe('llm-fail')
    expect(decision.filtered).toEqual(['프로젝트', '비용', '관리'])
  })

  it('All-drop guard: LLM marks every token as drop → original tokens kept', async () => {
    const { llm } = makeMockLLM(() =>
      jsonResponse([
        { token: 'PMBOK', role: 'generic-noise', keep: false },
      ]),
    )
    const filter = new QueryIntentFilter({
      llm, promptTemplate: PROMPT_TEMPLATE, tokenize: whitespaceTokenize,
    })
    const decision = await filter.filter('PMBOK')
    expect(decision.fallback).toBe('all-drop-guard')
    expect(decision.filtered).toEqual(['PMBOK'])
  })
})

describe('QueryIntentFilter — AC-F3 cache hit + persistence + LRU', () => {
  it('Second invocation hits cache (LLM call counter stays at 1)', async () => {
    const { llm, callCount } = makeMockLLM(() =>
      jsonResponse([
        { token: '프로젝트', role: 'domain-marker', keep: true },
        { token: '비용', role: 'intent-core', keep: true },
      ]),
    )
    const cache = new QueryFilterCache({ root: tmpRoot })
    const filter = new QueryIntentFilter({
      llm, promptTemplate: PROMPT_TEMPLATE, tokenize: whitespaceTokenize, cache,
    })
    await filter.filter('프로젝트 비용')
    const second = await filter.filter('프로젝트 비용')
    expect(callCount()).toBe(1)
    expect(second.cacheHit).toBe(true)
    expect(second.filtered).toEqual(['프로젝트', '비용'])
  })

  it('Cache persists to disk (atomic JSON) and a fresh cache reload reuses entries', async () => {
    const { llm: llm1, callCount: count1 } = makeMockLLM(() =>
      jsonResponse([
        { token: '프로젝트', role: 'domain-marker', keep: true },
      ]),
    )
    const cache1 = new QueryFilterCache({ root: tmpRoot })
    const filter1 = new QueryIntentFilter({
      llm: llm1, promptTemplate: PROMPT_TEMPLATE, tokenize: whitespaceTokenize, cache: cache1,
    })
    await filter1.filter('프로젝트')
    expect(count1()).toBe(1)

    // Reload — fresh cache instance over the same disk root.
    const { llm: llm2, callCount: count2 } = makeMockLLM(() => jsonResponse([]))
    const cache2 = new QueryFilterCache({ root: tmpRoot })
    const filter2 = new QueryIntentFilter({
      llm: llm2, promptTemplate: PROMPT_TEMPLATE, tokenize: whitespaceTokenize, cache: cache2,
    })
    const reloaded = await filter2.filter('프로젝트')
    expect(reloaded.cacheHit).toBe(true)
    expect(count2()).toBe(0)
  })

  it('LRU eviction enforces capacity', async () => {
    const cache = new QueryFilterCache({ root: tmpRoot, capacity: 2 })
    const { llm } = makeMockLLM(() =>
      jsonResponse([{ token: 'X', role: 'intent-core', keep: true }]),
    )
    const filter = new QueryIntentFilter({
      llm, promptTemplate: PROMPT_TEMPLATE,
      tokenize: () => ['X'],
      cache,
    })
    // Stuff 3 distinct keys by varying vault hints.
    await filter.filter('a', { domainMarkers: ['marker-a'], priorityKeep: [] })
    await filter.filter('b', { domainMarkers: ['marker-b'], priorityKeep: [] })
    await filter.filter('c', { domainMarkers: ['marker-c'], priorityKeep: [] })
    expect(cache.size('filter')).toBeLessThanOrEqual(2)
  })
})

describe('QueryIntentFilter — AC-F4 source grep self-check (no hardcoded wordlists)', () => {
  it('source files contain no Set([...]) / KOREAN_STOPWORDS / KEEP_LIST patterns', () => {
    const files = [
      'wikey-core/src/search/query-intent-filter.ts',
      'wikey-core/src/search/query-rewriter.ts',
      'wikey-core/src/search/query-expander.ts',
      'wikey-core/src/search/query-analyzer.ts',
      'wikey-core/src/config/vault-query-config.ts',
      'wikey-core/src/prompts/query-analyzer.prompt.md',
    ]
    const repoRoot = join(__dirname, '..', '..', '..', '..')
    const banned = /KOREAN_STOPWORDS|STOPWORDS\s*[=:]|KEEP_LIST|KNOWN_GENERIC|new\s+Set\s*\(\s*\[/u
    for (const rel of files) {
      const full = join(repoRoot, rel)
      const text = readFileSync(full, 'utf-8')
      expect(text, `pattern hit in ${rel}`).not.toMatch(banned)
    }
  })
})
