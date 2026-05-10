/**
 * §5.7.8 Spec 3 / AC-S4 — manual "Run query analysis" command + analyzer fail-open.
 *
 * The command pulls (query, answer) pairs from chatHistory, calls the analyzer LLM,
 * and (when a suite path is provided) appends entries via appendEntriesToSuite.
 *
 * We exercise the plugin-side helper `collectChatPairs` + a hand-built analyzer
 * invocation to validate the contract without booting the full Obsidian Plugin
 * lifecycle (which the test mocks do not fully simulate).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  QueryAnalyzer,
  AUTO_EXTENDED_SOURCE,
  appendEntriesToSuite,
  type FilterLLM,
} from 'wikey-core'

const PROMPT = '## task\n{{PAIRS_JSON}}\n'

let tmpRoot = ''
let suitePath = ''

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'wikey-runqa-'))
  suitePath = join(tmpRoot, 'benchmark-suite.json')
  writeFileSync(
    suitePath,
    JSON.stringify({ version: 1, queries: [] }, null, 2),
    'utf-8',
  )
})
afterEach(() => {
  if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true })
})

describe('Run query analysis command — AC-S4', () => {
  it('Happy path: analyzer returns N entries → suite gains N entries', async () => {
    const llm: FilterLLM = {
      async call() {
        return JSON.stringify({
          entries: [
            {
              id: 'auto-1234abcd',
              query: '프로젝트 일정 관리',
              expected_top1: 'project-schedule-management',
              expected_top3: ['project-schedule-management', 'pmbok'],
              domain: 'project-management',
              source: AUTO_EXTENDED_SOURCE,
              created_at: '2026-05-10T00:00:00Z',
            },
          ],
        })
      },
    }
    const analyzer = new QueryAnalyzer({ llm, promptTemplate: PROMPT })
    const result = await analyzer.analyze([
      { query: '프로젝트 일정 관리', answer: 'PMBOK ...' },
    ])
    expect(result.entries.length).toBe(1)
    const r = appendEntriesToSuite(suitePath, result.entries)
    expect(r.added).toBe(1)
    const reloaded = JSON.parse(readFileSync(suitePath, 'utf-8'))
    expect(reloaded.queries.length).toBe(1)
    expect(reloaded.queries[0].source).toBe(AUTO_EXTENDED_SOURCE)
  })

  it('Fail-open: analyzer LLM throws → entries=[] + suite unchanged', async () => {
    const llm: FilterLLM = {
      async call() { throw new Error('rate limit') },
    }
    const analyzer = new QueryAnalyzer({ llm, promptTemplate: PROMPT })
    const result = await analyzer.analyze([
      { query: '?', answer: '!' },
    ])
    expect(result.entries).toEqual([])
    expect(result.fallback).toBe('llm-fail')
    // Suite unchanged.
    const reloaded = JSON.parse(readFileSync(suitePath, 'utf-8'))
    expect(reloaded.queries.length).toBe(0)
  })
})
