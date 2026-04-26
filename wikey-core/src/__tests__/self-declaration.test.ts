/**
 * §5.4 Stage 3 — in-source self-declaration.
 *
 * AC9  SelfDeclaration 타입 + persist 결정 (mergeRuntimeIntoOverride)
 * AC10 section-index "표준 개요" detector
 * AC11 structured decomposition extractor
 * AC12 runtime-scope vs persist 결정 트리
 * AC13 Stage 2 suggestion 충돌 처리
 * AC14 false positive guard
 *
 * spec: plan/phase-5-todox-5.4-integration.md §3.3 (line 560-776) + §5 AC9~AC14
 */
import { describe, expect, it } from 'vitest'

import type {
  SchemaOverride,
  SelfDeclaration,
  StandardDecomposition,
  Suggestion,
  SuggestionStore,
} from '../types.js'
import {
  elevateToReview,
  extractSelfDeclaration,
  mergeRuntimeIntoOverride,
  persistDeclaration,
  shouldStage3ProposeRuntime,
} from '../self-declaration.js'
import { parseSections } from '../section-index.js'
import { emptyStore } from '../suggestion-storage.js'

// ── helpers ──────────────────────────────────────────────────────────────────

function makeRuntime(slug: string, name: string, components: string[]): SelfDeclaration {
  return {
    umbrella_slug: slug,
    umbrella_name: name,
    components: components.map((c) => ({ slug: c, type: 'methodology' })),
    rule: 'decompose',
    require_explicit_mention: true,
    source: 'wiki/sources/test.md',
    section_idx: 0,
    section_title: 'X 개요',
    extractor: 'pattern-matching',
    extractedAt: '2026-04-26T00:00:00.000Z',
    persistChoice: { kind: 'runtime-only' },
  }
}

function makeUserDecomposition(slug: string): StandardDecomposition {
  return {
    name: slug.toUpperCase(),
    aliases: [],
    umbrella_slug: slug,
    components: [{ slug: `${slug}-c1`, type: 'methodology' }],
    rule: 'decompose',
    require_explicit_mention: true,
    origin: 'user-yaml',
  }
}

function makeSuggestion(slug: string, kind: 'pending' | 'accepted' | 'rejected' | 'edited'): Suggestion {
  const base = {
    id: `sig-${slug}`,
    umbrella_slug: slug,
    umbrella_name: slug.toUpperCase(),
    candidate_components: [],
    support_count: 1,
    suffix_score: 0.5,
    mention_count: 1,
    confidence: 0.5,
    evidence: [],
    createdAt: '2026-04-26T00:00:00.000Z',
    updatedAt: '2026-04-26T00:00:00.000Z',
  }
  if (kind === 'pending') return { ...base, state: { kind: 'pending' } }
  if (kind === 'accepted') return { ...base, state: { kind: 'accepted', acceptedAt: '2026-04-26T00:00:00.000Z' } }
  if (kind === 'rejected') return { ...base, state: { kind: 'rejected', rejectedAt: '2026-04-26T00:00:00.000Z' } }
  return { ...base, state: { kind: 'edited', userEdits: {} } }
}

// ── AC9 — mergeRuntimeIntoOverride ───────────────────────────────────────────

describe('AC9 — mergeRuntimeIntoOverride (4 시나리오)', () => {
  it('runtime 비어있으면 override 그대로 반환 (early return)', () => {
    const override: SchemaOverride = {
      entityTypes: [],
      conceptTypes: [],
      standardDecompositions: { kind: 'present', items: [makeUserDecomposition('iso-9001')] },
    }
    const out = mergeRuntimeIntoOverride(override, [])
    expect(out).toBe(override)
  })

  it('empty-explicit 시 runtime 무시 (사용자 의도 보존)', () => {
    const override: SchemaOverride = {
      entityTypes: [],
      conceptTypes: [],
      standardDecompositions: { kind: 'empty-explicit' },
    }
    const out = mergeRuntimeIntoOverride(override, [makeRuntime('iso-27001', 'ISO 27001', ['c1', 'c2'])])
    expect(out).toBe(override)
    // standardDecompositions kind 그대로
    expect(out?.standardDecompositions?.kind).toBe('empty-explicit')
  })

  it('empty-all-skipped 시 runtime 만 present', () => {
    const override: SchemaOverride = {
      entityTypes: [],
      conceptTypes: [],
      standardDecompositions: { kind: 'empty-all-skipped', skippedCount: 2 },
    }
    const out = mergeRuntimeIntoOverride(
      override,
      [makeRuntime('iso-27001', 'ISO 27001', ['c1', 'c2', 'c3', 'c4', 'c5'])],
    )
    expect(out?.standardDecompositions?.kind).toBe('present')
    if (out?.standardDecompositions?.kind === 'present') {
      expect(out.standardDecompositions.items.length).toBe(1)
      expect(out.standardDecompositions.items[0].umbrella_slug).toBe('iso-27001')
      expect(out.standardDecompositions.items[0].origin).toBe('self-declared')
    }
  })

  it('present 시 user yaml + runtime append', () => {
    const override: SchemaOverride = {
      entityTypes: [],
      conceptTypes: [],
      standardDecompositions: { kind: 'present', items: [makeUserDecomposition('iso-9001')] },
    }
    const out = mergeRuntimeIntoOverride(
      override,
      [makeRuntime('iso-27001', 'ISO 27001', ['c1', 'c2', 'c3', 'c4', 'c5'])],
    )
    expect(out?.standardDecompositions?.kind).toBe('present')
    if (out?.standardDecompositions?.kind === 'present') {
      expect(out.standardDecompositions.items.length).toBe(2)
      expect(out.standardDecompositions.items[0].umbrella_slug).toBe('iso-9001')
      expect(out.standardDecompositions.items[1].umbrella_slug).toBe('iso-27001')
      expect(out.standardDecompositions.items[1].origin).toBe('self-declared')
    }
  })

  it('override undefined 시 runtime 만으로 새 override 생성', () => {
    const out = mergeRuntimeIntoOverride(
      undefined,
      [makeRuntime('iso-27001', 'ISO 27001', ['c1', 'c2', 'c3', 'c4', 'c5'])],
    )
    expect(out?.standardDecompositions?.kind).toBe('present')
    if (out?.standardDecompositions?.kind === 'present') {
      expect(out.standardDecompositions.items.length).toBe(1)
    }
  })
})

// ── AC10 — section-index "표준 개요" detector ────────────────────────────────

describe('AC10 — section-index headingPattern standard-overview', () => {
  it('한국어 표준 keyword ("PMBOK 개요", "ISO 27001 영역") → standard-overview', () => {
    const md = `# Document\n\n## PMBOK 개요\n\nbody1\n\n## ISO 27001 영역\n\nbody2\n`
    const sections = parseSections(md)
    const pmbok = sections.find((s) => s.title === 'PMBOK 개요')
    const iso = sections.find((s) => s.title === 'ISO 27001 영역')
    expect(pmbok?.headingPattern).toBe('standard-overview')
    expect(iso?.headingPattern).toBe('standard-overview')
  })

  it('영어 표준 keyword ("Body of Knowledge", "Knowledge Areas") → standard-overview', () => {
    const md = `## Body of Knowledge\n\nbody1\n\n## Knowledge Areas\n\nbody2\n`
    const sections = parseSections(md)
    const bok = sections.find((s) => s.title === 'Body of Knowledge')
    const ka = sections.find((s) => s.title === 'Knowledge Areas')
    expect(bok?.headingPattern).toBe('standard-overview')
    expect(ka?.headingPattern).toBe('standard-overview')
  })

  it('미매치 ("Project Plan", "Implementation Notes") → normal', () => {
    const md = `## Project Plan\n\nbody1\n\n## Implementation Notes\n\nbody2\n`
    const sections = parseSections(md)
    const pp = sections.find((s) => s.title === 'Project Plan')
    const impl = sections.find((s) => s.title === 'Implementation Notes')
    expect(pp?.headingPattern).toBe('normal')
    expect(impl?.headingPattern).toBe('normal')
  })
})

// ── AC11 — structured decomposition extractor ────────────────────────────────

describe('AC11 — extractSelfDeclaration (deterministic)', () => {
  it('numbered list 5+ items + standard-overview → SelfDeclaration', () => {
    const md = `## ISO 27001 개요\n\n표준은 다음을 포함한다:\n\n1. Information Security Policies\n2. Asset Management\n3. Access Control\n4. Cryptography\n5. Physical Security\n6. Operations Security\n`
    const sections = parseSections(md)
    const sec = sections.find((s) => s.title === 'ISO 27001 개요')
    expect(sec).toBeDefined()
    const sd = extractSelfDeclaration(sec!, 'wiki/sources/iso27001.md')
    expect(sd).not.toBeNull()
    expect(sd!.umbrella_slug).toBe('iso-27001')
    expect(sd!.components.length).toBe(6)
    expect(sd!.extractor).toBe('pattern-matching')
    expect(sd!.persistChoice.kind).toBe('runtime-only')
    expect(sd!.source).toBe('wiki/sources/iso27001.md')
    expect(sd!.section_idx).toBe(sec!.idx)
    expect(sd!.section_title).toBe('ISO 27001 개요')
  })

  it('bullet list 5+ items 정상', () => {
    const md = `## PMBOK 영역\n\n- Integration Management\n- Scope Management\n- Schedule Management\n- Cost Management\n- Quality Management\n`
    const sections = parseSections(md)
    const sec = sections.find((s) => s.title === 'PMBOK 영역')
    expect(sec).toBeDefined()
    const sd = extractSelfDeclaration(sec!, 'wiki/sources/pmbok.md')
    expect(sd).not.toBeNull()
    expect(sd!.umbrella_slug).toBe('pmbok')
    expect(sd!.components.length).toBe(5)
  })

  it('listItems < 5 → null', () => {
    const md = `## ISO 27001 개요\n\n1. A\n2. B\n3. C\n4. D\n`
    const sections = parseSections(md)
    const sec = sections.find((s) => s.title === 'ISO 27001 개요')
    expect(sec).toBeDefined()
    const sd = extractSelfDeclaration(sec!, 'wiki/sources/iso27001.md')
    expect(sd).toBeNull()
  })

  it('standard-overview 가 아니면 null', () => {
    const md = `## Project Plan\n\n1. one\n2. two\n3. three\n4. four\n5. five\n6. six\n`
    const sections = parseSections(md)
    const sec = sections.find((s) => s.title === 'Project Plan')
    expect(sec).toBeDefined()
    const sd = extractSelfDeclaration(sec!, 'wiki/sources/x.md')
    expect(sd).toBeNull()
  })
})

// ── AC12 — runtime-scope vs persist ──────────────────────────────────────────

describe('AC12 — persistChoice transitions', () => {
  it('elevateToReview → kind pending-user-review', () => {
    const sd = makeRuntime('iso-27001', 'ISO 27001', ['c1', 'c2', 'c3', 'c4', 'c5'])
    const elevated = elevateToReview(sd)
    expect(elevated.persistChoice.kind).toBe('pending-user-review')
    // 원본 immutable
    expect(sd.persistChoice.kind).toBe('runtime-only')
  })

  it('persistDeclaration → kind persisted + persistedAt 보존', () => {
    const sd = makeRuntime('iso-27001', 'ISO 27001', ['c1', 'c2', 'c3', 'c4', 'c5'])
    const persisted = persistDeclaration(sd, '2026-05-01T12:00:00.000Z')
    expect(persisted.persistChoice.kind).toBe('persisted')
    if (persisted.persistChoice.kind === 'persisted') {
      expect(persisted.persistChoice.persistedAt).toBe('2026-05-01T12:00:00.000Z')
    }
    // 원본 immutable
    expect(sd.persistChoice.kind).toBe('runtime-only')
  })
})

// ── AC13 — Stage 2 suggestion 충돌 처리 ──────────────────────────────────────

describe('AC13 — shouldStage3ProposeRuntime', () => {
  it('matching 없음 (신규) → true', () => {
    const store: SuggestionStore = emptyStore()
    expect(shouldStage3ProposeRuntime(store, 'iso-27001')).toBe(true)
  })

  it('pending → true (Stage 3 evidence 추가 가능)', () => {
    const store: SuggestionStore = {
      version: 1,
      suggestions: [makeSuggestion('iso-27001', 'pending')],
      negativeCache: [],
    }
    expect(shouldStage3ProposeRuntime(store, 'iso-27001')).toBe(true)
  })

  it('accepted → false (이미 schema.yaml 에 반영됨)', () => {
    const store: SuggestionStore = {
      version: 1,
      suggestions: [makeSuggestion('iso-27001', 'accepted')],
      negativeCache: [],
    }
    expect(shouldStage3ProposeRuntime(store, 'iso-27001')).toBe(false)
  })

  it('rejected → false (negativeCache)', () => {
    const store: SuggestionStore = {
      version: 1,
      suggestions: [makeSuggestion('iso-27001', 'rejected')],
      negativeCache: ['sig-iso-27001'],
    }
    expect(shouldStage3ProposeRuntime(store, 'iso-27001')).toBe(false)
  })

  it('edited → true (사용자가 수정 중)', () => {
    const store: SuggestionStore = {
      version: 1,
      suggestions: [makeSuggestion('iso-27001', 'edited')],
      negativeCache: [],
    }
    expect(shouldStage3ProposeRuntime(store, 'iso-27001')).toBe(true)
  })
})

// ── AC14 — false positive guard ──────────────────────────────────────────────

describe('AC14 — false positive guard (marketing keyword)', () => {
  it('marketing keyword 본문 (핵심 기능) → silent drop (null)', () => {
    // section title 은 standard-overview 매치되지만 본문에 marketing 패턴
    const md = `## 제품 개요\n\n핵심 기능 5가지:\n\n1. 빠른 속도\n2. 쉬운 사용\n3. 강력한 성능\n4. 우수한 보안\n5. 합리적 가격\n6. 무료 지원\n`
    const sections = parseSections(md)
    const sec = sections.find((s) => s.title === '제품 개요')
    expect(sec).toBeDefined()
    expect(sec!.headingPattern).toBe('standard-overview')
    const sd = extractSelfDeclaration(sec!, 'wiki/sources/marketing.md')
    expect(sd).toBeNull()
  })

  it('component slug 너무 짧음 (< 5 chars) → null', () => {
    const md = `## ISO 27001 개요\n\n1. AB\n2. CD\n3. EF\n4. GH\n5. IJ\n6. KL\n`
    const sections = parseSections(md)
    const sec = sections.find((s) => s.title === 'ISO 27001 개요')
    expect(sec).toBeDefined()
    const sd = extractSelfDeclaration(sec!, 'wiki/sources/iso27001.md')
    expect(sd).toBeNull()
  })
})
