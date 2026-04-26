/**
 * §5.4.5 — Stage 1+2+3+4 통합 시나리오 integration tests.
 *
 * 5 시나리오 (plan/phase-5-todox-5.4-integration.md §4 line 985-1170):
 *  4.1 Fresh ingest flow — 시점 0 (vault 처음) → 시점 1 (ISO-27001 추가, Stage 3 runtime)
 *  4.2 Incremental flow — vault 누적 후 Stage 2 suggestion accept → schema.yaml round-trip
 *  4.3 사용자 vault 수동 편집 흐름 — empty-explicit 가 runtime 무시
 *  4.4 Stage 간 fallback — convergence precondition 미충족 + reindex hook 조건문 자체
 *  4.5 사용자 거부 (reject) 흐름 — negativeCache → Stage 3 silent drop
 *
 * 본 파일은 모듈 boundary 통합만 검증한다 (각 모듈 단독 단위 테스트는 별 파일 보유).
 * LLM·실제 FS·shell 호출 없이 in-memory mock 만 사용 → 각 case < 100ms.
 */

import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type {
  IngestRecord,
  SchemaOverride,
  SelfDeclaration,
  Suggestion,
  SuggestionStore,
  WikiFS,
} from '../types.js'
import { buildStandardDecompositionBlock, loadSchemaOverride } from '../schema.js'
import {
  extractSelfDeclaration,
  mergeRuntimeIntoOverride,
  shouldStage3ProposeRuntime,
} from '../self-declaration.js'
import { parseSections } from '../section-index.js'
import { runSuggestionDetection } from '../suggestion-pipeline.js'
import {
  addSuggestion,
  emptyStore,
  rejectSuggestion,
  updateSuggestionState,
} from '../suggestion-storage.js'
import { appendStandardDecomposition } from '../schema-yaml-writer.js'
import { runConvergencePass } from '../convergence.js'

// ── In-memory WikiFS (mock) ────────────────────────────────────────────────

function makeFS(initial: Record<string, string> = {}): WikiFS & { _files: Record<string, string> } {
  const files: Record<string, string> = { ...initial }
  return {
    _files: files,
    async exists(p: string) { return p in files },
    async read(p: string) {
      if (!(p in files)) throw new Error(`ENOENT: ${p}`)
      return files[p]
    },
    async write(p: string, content: string) { files[p] = content },
    async list() { return Object.keys(files) },
  }
}

// ── Helpers — record / suggestion factories ────────────────────────────────

function record(
  source: string,
  ingestedAt: string,
  conceptSlugs: readonly string[],
): IngestRecord {
  return {
    source,
    ingestedAt,
    concepts: conceptSlugs.map((slug) => ({ slug, type: 'methodology' as const })),
    entities: [],
  }
}

function pendingSuggestion(
  id: string,
  umbrellaSlug: string,
  componentSlugs: readonly string[],
): Suggestion {
  return {
    id,
    umbrella_slug: umbrellaSlug,
    umbrella_name: umbrellaSlug.toUpperCase(),
    candidate_components: componentSlugs.map((s) => ({ slug: s, type: 'methodology' })),
    support_count: 3,
    suffix_score: 1.0,
    mention_count: 9,
    confidence: 0.75,
    evidence: [],
    state: { kind: 'pending' },
    createdAt: '2026-04-26T00:00:00.000Z',
    updatedAt: '2026-04-26T00:00:00.000Z',
  }
}

// ── 4.1 Fresh ingest flow ──────────────────────────────────────────────────

describe('Scenario 4.1 — Fresh ingest flow (vault 처음)', () => {
  it(
    '시점 0: schema.yaml 미존재 → loadSchemaOverride null → buildBlock = BUILTIN PMBOK only',
    async () => {
      const fs = makeFS({}) // 빈 vault — .wikey/schema.yaml 미존재

      const override = await loadSchemaOverride(fs)
      expect(override).toBeNull()

      // schemaOverride = undefined → BUILTIN PMBOK 만 prompt 출력 (Stage 1 분기 1)
      const block = buildStandardDecompositionBlock(undefined)
      expect(block).toContain('PMBOK')
      expect(block).toContain('project-integration-management')

      // Stage 2 finalize: PMBOK 10 components 만 검출. BUILTIN overlap → confidence drop.
      // Empty history + 단일 ingest 한 번 → suffix-cluster detector 가 minSources=2 충족 못 함.
      const result = runSuggestionDetection({
        history: [],
        sourcePath: 'wiki/sources/source-pmbok.md',
        ingestedAt: '2026-04-26T10:00:00.000Z',
        canon: {
          entities: [],
          concepts: [
            { filename: 'project-integration-management', content: '', category: 'concepts', conceptType: 'methodology' },
            { filename: 'project-scope-management', content: '', category: 'concepts', conceptType: 'methodology' },
            { filename: 'project-cost-management', content: '', category: 'concepts', conceptType: 'methodology' },
          ],
          dropped: [],
        },
        negativeCache: [],
      })
      // BUILTIN overlap 으로 confidence 0.7 (0.4*0.2 + 0.3*1 + 0.2*0.15 + 0.1*0 = 0.41).
      // co-occurrence prefix `project-` 는 minPrefixLen=5 충족 (8자) 이지만 confidence < 0.6 cutoff.
      // suffix `-management` 도 single source 라 minSources=2 미충족.
      expect(result.suggestions).toHaveLength(0)
      expect(result.updatedHistory).toHaveLength(1)
    },
  )

  it(
    '시점 1: ISO-27001 corpus 추가 → Stage 3 SelfDeclaration → mergeRuntime → buildBlock 에 둘 다 등장',
    async () => {
      const fs = makeFS({}) // 시점 0 상태

      // (a) Stage 3 — ISO-27001 source 의 "표준 개요" section 분석
      const isoMd = [
        '# ISO 27001',
        '',
        '## ISO 27001 개요',
        '',
        '표준은 다음 영역을 포함한다:',
        '',
        '1. Information Security Policies',
        '2. Asset Management',
        '3. Access Control',
        '4. Cryptography',
        '5. Physical Security',
        '6. Operations Security',
        '',
      ].join('\n')
      const sections = parseSections(isoMd)
      const overview = sections.find((s) => s.title === 'ISO 27001 개요')
      expect(overview).toBeDefined()
      expect(overview!.headingPattern).toBe('standard-overview')

      const sd = extractSelfDeclaration(overview!, 'wiki/sources/iso-27001.md')
      expect(sd).not.toBeNull()
      expect(sd!.umbrella_slug).toBe('iso-27001')
      expect(sd!.components.length).toBe(6)
      expect(sd!.persistChoice.kind).toBe('runtime-only')

      // (b) Stage 1 — schema.yaml 여전히 없음 → loadSchemaOverride null
      const baseOverride = await loadSchemaOverride(fs)
      expect(baseOverride).toBeNull()

      // (c) Stage 2 충돌 체크 — empty store → propose 가능
      const store = emptyStore()
      expect(shouldStage3ProposeRuntime(store, 'iso-27001')).toBe(true)

      // (d) Stage 1 ↔ Stage 3 cascade — mergeRuntimeIntoOverride
      const merged = mergeRuntimeIntoOverride(baseOverride ?? undefined, [sd!])
      expect(merged).toBeDefined()
      expect(merged!.standardDecompositions?.kind).toBe('present')
      if (merged!.standardDecompositions?.kind === 'present') {
        expect(merged!.standardDecompositions.items).toHaveLength(1)
        expect(merged!.standardDecompositions.items[0].umbrella_slug).toBe('iso-27001')
        expect(merged!.standardDecompositions.items[0].origin).toBe('self-declared')
      }

      // (e) buildStandardDecompositionBlock — BUILTIN PMBOK + runtime ISO-27001 둘 다 (F1 append)
      const block = buildStandardDecompositionBlock(merged)
      expect(block).toContain('PMBOK')                          // BUILTIN 보존
      expect(block).toContain('project-integration-management') // BUILTIN component
      expect(block).toContain('iso-27001')                      // runtime entry
      expect(block.toLowerCase()).toContain('information-security-policies')
    },
  )
})

// ── 4.2 Incremental flow ───────────────────────────────────────────────────

describe('Scenario 4.2 — Incremental flow (Stage 2 suggestion accept → schema.yaml 영속화)', () => {
  it(
    'mention history 누적 → suggestion pending → user accept → appendStandardDecomposition → 다음 ingest loadSchemaOverride 가 인식',
    async () => {
      // (a) ≥ 2 source 에 같은 suffix `-management` 누적 → suffix cluster 트리거
      const earlier: IngestRecord[] = [
        record('wiki/sources/iso-a.md', '2026-04-25T10:00:00.000Z', [
          'iso-27001-a-5-management',
          'iso-27001-a-6-management',
          'iso-27001-a-7-management',
        ]),
        record('wiki/sources/iso-b.md', '2026-04-25T11:00:00.000Z', [
          'iso-27001-a-12-management',
          'iso-27001-a-13-management',
        ]),
      ]

      // 새 ingest (3rd source) — `-management` suffix 가 이제 3 sources × 7 mentions
      const result = runSuggestionDetection({
        history: earlier,
        sourcePath: 'wiki/sources/iso-c.md',
        ingestedAt: '2026-04-26T12:00:00.000Z',
        canon: {
          entities: [],
          concepts: [
            { filename: 'iso-27001-a-5-management', content: '', category: 'concepts', conceptType: 'methodology' },
            { filename: 'iso-27001-a-8-management', content: '', category: 'concepts', conceptType: 'methodology' },
          ],
          dropped: [],
        },
        negativeCache: [],
      })
      expect(result.updatedHistory).toHaveLength(3)

      // suffix-cluster detector 가 `cluster-management` umbrella 로 1+ 후보 emit (post-impl
      // review HIGH fix — schema.ts:435 parser regex 와 round-trip 보장)
      const suffixSugg = result.suggestions.find((s) => s.umbrella_slug === 'cluster-management')
      expect(suffixSugg).toBeDefined()
      expect(suffixSugg!.support_count).toBeGreaterThanOrEqual(3)
      expect(suffixSugg!.state.kind).toBe('pending')

      // (b) 사용자 accept → SuggestionStore state 전이 + schema.yaml append
      let store: SuggestionStore = emptyStore()
      store = addSuggestion(store, suffixSugg!)
      // accept = updateSuggestionState({kind:'accepted'})
      const acceptedAt = '2026-04-26T13:00:00.000Z'
      store = updateSuggestionState(store, suffixSugg!.id, { kind: 'accepted', acceptedAt })
      const accepted = store.suggestions.find((s) => s.id === suffixSugg!.id)
      expect(accepted?.state.kind).toBe('accepted')

      // (c) Stage 2 writer — appendStandardDecomposition → .wikey/schema.yaml 신규 생성
      const fs = makeFS({})
      const append = await appendStandardDecomposition(fs, suffixSugg!)
      expect(append.appended).toBe(true)
      expect(fs._files['.wikey/schema.yaml']).toBeDefined()
      expect(fs._files['.wikey/schema.yaml']).toContain('standard_decompositions:')
      expect(fs._files['.wikey/schema.yaml']).toContain('umbrella_slug: cluster-management')

      // (d) round-trip — schema parser regex /^[a-z][a-z0-9-]*$/ 와 일치 확인. 다음 ingest
      // 의 loadSchemaOverride 가 user yaml 을 정상 인식 (post-impl review HIGH fix).
      expect(/^[a-z][a-z0-9-]*$/.test(suffixSugg!.umbrella_slug)).toBe(true)
      const append2 = await appendStandardDecomposition(fs, suffixSugg!)
      expect(append2.appended).toBe(false)
      expect(append2.reason).toBe('already-exists')
    },
  )
})

// ── 4.3 사용자 vault 수동 편집 흐름 ────────────────────────────────────────

describe('Scenario 4.3 — 사용자 vault 수동 편집 (empty-explicit 가 runtime 무시)', () => {
  it(
    'standard_decompositions: [] (PMBOK disable) → buildBlock 빈 string + runtime 도 무시',
    async () => {
      // (a) 사용자가 schema.yaml 직접 편집 — PMBOK disable
      const fs = makeFS({
        '.wikey/schema.yaml': 'standard_decompositions: []\n',
      })
      const override = await loadSchemaOverride(fs)
      expect(override).not.toBeNull()
      expect(override!.standardDecompositions?.kind).toBe('empty-explicit')

      // (b) Stage 1 builder — 빈 string (분기 c)
      const block = buildStandardDecompositionBlock(override!)
      expect(block).toBe('')

      // (c) Stage 3 runtime SelfDeclaration 가 등장해도 empty-explicit 보존 (runtime 무시)
      const runtime: SelfDeclaration = {
        umbrella_slug: 'iso-27001',
        umbrella_name: 'ISO 27001',
        components: [
          { slug: 'iso-27001-a-5', type: 'methodology' },
          { slug: 'iso-27001-a-6', type: 'methodology' },
          { slug: 'iso-27001-a-7', type: 'methodology' },
          { slug: 'iso-27001-a-8', type: 'methodology' },
          { slug: 'iso-27001-a-9', type: 'methodology' },
        ],
        rule: 'decompose',
        require_explicit_mention: true,
        source: 'wiki/sources/iso.md',
        section_idx: 0,
        section_title: 'ISO 27001 개요',
        extractor: 'pattern-matching',
        extractedAt: '2026-04-26T00:00:00.000Z',
        persistChoice: { kind: 'runtime-only' },
      }

      const merged = mergeRuntimeIntoOverride(override!, [runtime])
      expect(merged).toBe(override!) // identity — runtime 무시
      expect(merged!.standardDecompositions?.kind).toBe('empty-explicit')

      // (d) buildBlock 후에도 여전히 빈 string
      const blockAfter = buildStandardDecompositionBlock(merged!)
      expect(blockAfter).toBe('')
    },
  )
})

// ── 4.4 Stage 간 fallback (precondition 미충족 + reindex hook 조건문) ─────

describe('Scenario 4.4 — Stage 간 fallback (insufficient mention diversity + reindex hook 조건문)', () => {
  it(
    'runConvergencePass: history < 3 standards × 2 sources → 빈 배열 + warn (Stage 4 graceful)',
    async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      // 1 source × 2 standards — 임계 미충족
      const history: IngestRecord[] = [
        record('wiki/sources/only.md', '2026-04-26T10:00:00.000Z', [
          'pmbok-scope', 'iso-27001-a-5',
        ]),
      ]
      const result = await runConvergencePass(history, {
        arbitration: 'union',
        tokenBudget: 50000,
        embeddings: new Map(),
      })
      expect(result).toEqual([])
      expect(warnSpy).toHaveBeenCalled()
      const msg = String(warnSpy.mock.calls[0]?.[0])
      expect(msg).toContain('insufficient mention diversity')
      warnSpy.mockRestore()
    },
  )

  it(
    'reindex.sh §5.4.4 convergence hook block: WIKEY_CONVERGENCE_ENABLED unset → skip (default off)',
    () => {
      // 본 시나리오는 shell 직접 실행 X — script 안의 hook block 자체를 source 검사로 검증
      // (env unset 시 entire block 이 skip 되는 conditional 의 존재 확증).
      const reindexPath = join(__dirname, '..', '..', '..', 'scripts', 'reindex.sh')
      const content = readFileSync(reindexPath, 'utf-8')

      // (a) hook block 존재 — convergence pass 실행 분기
      expect(content).toContain('WIKEY_CONVERGENCE_ENABLED')
      // (b) default off — `:-false` fallback 으로 unset 시 분기 skip
      expect(content).toMatch(/WIKEY_CONVERGENCE_ENABLED:-false/)
      // (c) dist/scripts/run-convergence-pass.mjs 부재 시 log_skip 분기
      expect(content).toContain('run-convergence-pass.mjs')
      expect(content).toMatch(/log_skip.*convergence pass/)
    },
  )
})

// ── 4.5 사용자 거부 (reject) 흐름 ──────────────────────────────────────────

describe('Scenario 4.5 — reject → negativeCache → Stage 2 silent drop + Stage 3 propose=false', () => {
  it(
    'rejectSuggestion → negativeCache → 같은 signature suggestion 재생성 시 silent drop + Stage 3 propose=false',
    () => {
      // (a) 1차 ingest — suggestion 생성
      const earlier: IngestRecord[] = [
        record('wiki/sources/safe-a.md', '2026-04-25T10:00:00.000Z', [
          'safe-4-portfolio',
          'safe-4-large-solution',
          'safe-4-essential',
        ]),
      ]
      const result1 = runSuggestionDetection({
        history: earlier,
        sourcePath: 'wiki/sources/safe-b.md',
        ingestedAt: '2026-04-26T10:00:00.000Z',
        canon: {
          entities: [],
          concepts: [
            { filename: 'safe-4-portfolio', content: '', category: 'concepts', conceptType: 'methodology' },
            { filename: 'safe-4-large-solution', content: '', category: 'concepts', conceptType: 'methodology' },
            { filename: 'safe-4-essential', content: '', category: 'concepts', conceptType: 'methodology' },
          ],
          dropped: [],
        },
        negativeCache: [],
        confidenceCutoff: 0,
      })
      expect(result1.suggestions.length).toBeGreaterThanOrEqual(1)
      const safeSugg = result1.suggestions[0]
      expect(safeSugg.id).toMatch(/^[a-f0-9]{40}$/)

      // (b) 사용자 reject — store 에 저장 후 reject
      let store: SuggestionStore = emptyStore()
      store = addSuggestion(store, safeSugg)
      store = rejectSuggestion(store, safeSugg.id, 'not a standard')
      expect(store.negativeCache).toContain(safeSugg.id)
      const rejected = store.suggestions.find((s) => s.id === safeSugg.id)
      expect(rejected?.state.kind).toBe('rejected')

      // (c) 다음 ingest — 동일 signature → silent drop (negativeCache 차단)
      const result2 = runSuggestionDetection({
        history: result1.updatedHistory,
        sourcePath: 'wiki/sources/safe-c.md',
        ingestedAt: '2026-04-27T10:00:00.000Z',
        canon: {
          entities: [],
          concepts: [
            { filename: 'safe-4-portfolio', content: '', category: 'concepts', conceptType: 'methodology' },
            { filename: 'safe-4-large-solution', content: '', category: 'concepts', conceptType: 'methodology' },
            { filename: 'safe-4-essential', content: '', category: 'concepts', conceptType: 'methodology' },
          ],
          dropped: [],
        },
        negativeCache: [...store.negativeCache],
        confidenceCutoff: 0,
      })
      // 동일 signature 가 negativeCache 에 있으므로 silent drop
      const reAppeared = result2.suggestions.find((s) => s.id === safeSugg.id)
      expect(reAppeared).toBeUndefined()

      // (d) Stage 3 SelfDeclaration 같은 umbrella_slug 로 등장 시 → propose=false
      // 이를 위해 store 에 같은 umbrella_slug rejected suggestion 이 존재해야 함.
      // (참고: Stage 2 rejected → Stage 3 도 propose 안 함. spec §3.3.4)
      // store 의 rejected suggestion 은 (b) 에서 이미 등록됨.
      const safeUmbrellaSlug = safeSugg.umbrella_slug
      expect(shouldStage3ProposeRuntime(store, safeUmbrellaSlug)).toBe(false)
    },
  )
})
