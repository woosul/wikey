/**
 * §5.7.4 RED — reindex Orama integration tests.
 *
 * AC-R1: cmdReindex({ searchEngine: 'orama' }) → Step 1+2 = runOramaIngest 단일 호출 + validate PASS.
 * AC-R2: stamp file (~/.cache/qmd/.last-reindex) 갱신 — engine 무관 동일 path.
 * AC-R3: quick reindex 가 engine='orama' 에서 동작.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, existsSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cmdReindex } from '../../scripts/reindex.js'

let tmpRoot = ''
let basePath = ''
let stampFile = ''
let cachePath = ''

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'wikey-reindex-orama-'))
  basePath = tmpRoot
  stampFile = join(tmpRoot, 'cache', '.last-reindex')
  cachePath = join(tmpRoot, 'cache', 'orama-wikey.json')
  // wiki/ fixture
  mkdirSync(join(basePath, 'wiki', 'concepts'), { recursive: true })
  writeFileSync(
    join(basePath, 'wiki', 'concepts', 'bm25.md'),
    '---\ntitle: BM25\ntype: concept\ncreated: 2026-05-09\nupdated: 2026-05-09\nsources: []\n---\n# BM25\nBM25 algorithm.',
    'utf-8',
  )
  writeFileSync(
    join(basePath, 'wiki', 'concepts', 'orama.md'),
    '---\ntitle: Orama\ntype: concept\ncreated: 2026-05-09\nupdated: 2026-05-09\nsources: []\n---\n# Orama\nIn-process search engine.',
    'utf-8',
  )
  // Minimal index.md to keep validate-wiki happy.
  writeFileSync(
    join(basePath, 'wiki', 'index.md'),
    '# Wiki Index\n\n## 개념\n- [[bm25]] — BM25.\n- [[orama]] — Orama.\n',
    'utf-8',
  )
})

afterEach(() => {
  if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true })
})

describe('cmdReindex with searchEngine=orama', () => {
  it('AC-R1: full reindex with engine=orama → exit 0 + Orama ingest path used', async () => {
    const lines: string[] = []
    const result = await cmdReindex(
      {
        basePath,
        searchEngine: 'orama',
        oramaCachePath: cachePath,
        stampFile,
        write: (s) => lines.push(s),
        writeErr: () => undefined,
      },
      'full',
    )
    expect(result.exitCode).toBe(0)
    // Stamp file갱신 확증
    expect(existsSync(stampFile)).toBe(true)
    // Orama cache file 생성 확증 (persist call)
    expect(existsSync(cachePath)).toBe(true)
    // 출력에 'Orama' 키워드 포함 확증 (qmd 가 아닌 orama 경로 사용)
    const outputText = lines.join('\n')
    expect(outputText).toMatch(/Orama|orama/)
  })

  it('AC-R2: stamp file path is ~/.cache/qmd/.last-reindex shape (engine 무관)', async () => {
    const result = await cmdReindex(
      {
        basePath,
        searchEngine: 'orama',
        oramaCachePath: cachePath,
        stampFile,
        write: () => undefined,
        writeErr: () => undefined,
      },
      'full',
    )
    expect(result.exitCode).toBe(0)
    expect(existsSync(stampFile)).toBe(true)
    const m = statSync(stampFile).mtimeMs
    expect(m).toBeGreaterThan(0)
  })

  it('AC-R3: quick reindex with engine=orama → exit 0', async () => {
    const result = await cmdReindex(
      {
        basePath,
        searchEngine: 'orama',
        oramaCachePath: cachePath,
        stampFile,
        write: () => undefined,
        writeErr: () => undefined,
      },
      'quick',
    )
    expect(result.exitCode).toBe(0)
    expect(existsSync(stampFile)).toBe(true)
  })
})
