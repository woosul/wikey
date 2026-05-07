import { describe, it, expect, vi } from 'vitest'
import {
  canonicalize, buildCanonicalizerPrompt,
  canonicalizeSlug, SLUG_ALIASES,
} from '../canonicalizer.js'
import { BUNDLED_STAGE2_MENTION_PROMPT } from '../ingest-pipeline.js'
import { EXAMPLE_ORG_BASE } from '../example-placeholders.js'
import type { Mention } from '../types.js'
import type { LLMClient } from '../llm-client.js'

/**
 * Mock LLMClient that returns a canned JSON response.
 * Tests Stage 2 canonicalizer: schema validation + anti-pattern filtering + page assembly.
 */
function makeMockLLM(jsonResponse: string): LLMClient {
  return {
    call: vi.fn().mockResolvedValue('```json\n' + jsonResponse + '\n```'),
  } as unknown as LLMClient
}

const baseArgs = {
  existingEntityBases: [],
  existingConceptBases: [],
  sourceFilename: 'PMS_test.pdf',
  // §5.13.A1: rawSourceFilename = mask 안 된 원본 raw basename. PII guard ON 시 sourceFilename 이
  // mask 적용된 형식이라 raw wikilink target 으로 부적합 → 별도 인자.
  rawSourceFilename: 'PMS_test.pdf',
  // §5.12 — wiki/sources/<sourcePageBase>.md 단일 진실 소스. canonicalize 호출 ~10곳에서 default 사용,
  // source-link 검증 case 만 override.
  sourcePageBase: 'source-PMS_test',
  today: '2026-04-19',
  provider: 'gemini',
  model: 'gemini-2.5-flash',
}

describe('canonicalize — empty input', () => {
  it('returns empty result for zero mentions without calling LLM', async () => {
    const llm = makeMockLLM('{"entities":[],"concepts":[]}')
    const result = await canonicalize({ ...baseArgs, llm, mentions: [] })
    expect(result.entities).toHaveLength(0)
    expect(result.concepts).toHaveLength(0)
    expect(result.dropped).toHaveLength(0)
    expect(llm.call).not.toHaveBeenCalled()
  })
})

describe('canonicalize — valid responses build pages with schema types', () => {
  it('builds entity WikiPage with entityType set', async () => {
    const mentions: Mention[] = [
      { name: EXAMPLE_ORG_BASE, type_hint: 'organization', evidence: '사업자등록증 발급 대상' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [{
        name: EXAMPLE_ORG_BASE, type: 'organization',
        description: '주식회사 예제. 소프트웨어 개발 회사.',
      }],
      concepts: [],
    }))
    const result = await canonicalize({ ...baseArgs, llm, mentions })
    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].filename).toBe(`${EXAMPLE_ORG_BASE}.md`)
    expect(result.entities[0].category).toBe('entities')
    expect(result.entities[0].entityType).toBe('organization')
    expect(result.entities[0].content).toContain('entity_type: organization')
    expect(result.entities[0].content).toContain('주식회사 예제')
  })

  it('builds concept WikiPage with conceptType set', async () => {
    const mentions: Mention[] = [
      { name: 'pmbok', type_hint: 'standard', evidence: '프로젝트 관리 표준' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [],
      concepts: [{
        name: 'project-management-body-of-knowledge', type: 'standard',
        description: 'PMI 제정 프로젝트 관리 표준 지식체계.',
        aliases: ['pmbok'],
      }],
    }))
    const result = await canonicalize({ ...baseArgs, llm, mentions })
    expect(result.concepts).toHaveLength(1)
    expect(result.concepts[0].conceptType).toBe('standard')
    expect(result.concepts[0].filename).toBe('project-management-body-of-knowledge.md')
    expect(result.concepts[0].content).toContain('concept_type: standard')
  })
})

describe('canonicalize — cross-pool dedup', () => {
  it('keeps only entity copy when same base appears in both pools', async () => {
    const mentions: Mention[] = [
      { name: 'mariadb', type_hint: 'tool', evidence: 'DB 시스템' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [{ name: 'mariadb', type: 'tool', description: 'MySQL 호환 RDBMS.' }],
      concepts: [{ name: 'mariadb', type: 'standard', description: 'duplicate (should be dropped)' }],
    }))
    const result = await canonicalize({ ...baseArgs, llm, mentions })
    expect(result.entities).toHaveLength(1)
    expect(result.concepts).toHaveLength(0)  // dropped due to cross-pool collision
  })
})

describe('buildCanonicalizerPrompt', () => {
  it('includes schema block with all 7 types', () => {
    const prompt = buildCanonicalizerPrompt({
      mentions: [{ name: 'pms', evidence: 'PMS 제품' }],
      existingEntityBases: ['existing-entity'],
      existingConceptBases: ['existing-concept'],
      sourceFilename: 'test.pdf',
    })
    expect(prompt).toContain('organization')
    expect(prompt).toContain('person')
    expect(prompt).toContain('product')
    expect(prompt).toContain('tool')
    expect(prompt).toContain('standard')
    expect(prompt).toContain('methodology')
    expect(prompt).toContain('document_type')
  })

  it('includes example org placeholder + reuse rule', () => {
    // Note: bundled prompt template 은 existingEntityBases 를 직접 echo 하지 않고
    // example placeholder (EXAMPLE_ORG_BASE) 와 "재사용" 규칙 텍스트만 노출한다.
    // override path 만 {{EXISTING_BLOCK}} substitute 가 동작 (별도 테스트에서 검증).
    const prompt = buildCanonicalizerPrompt({
      mentions: [{ name: 'pms', evidence: 'X' }],
      existingEntityBases: ['some-existing-corp'],
      existingConceptBases: ['pmbok'],
      sourceFilename: 'test.pdf',
    })
    expect(prompt).toContain(EXAMPLE_ORG_BASE)
    expect(prompt).toContain('pmbok')
    expect(prompt).toContain('재사용')
  })

  it('includes mention list', () => {
    const prompt = buildCanonicalizerPrompt({
      mentions: [
        { name: 'mention-a', type_hint: 'organization', evidence: 'evidence A' },
        { name: 'mention-b', type_hint: 'standard', evidence: 'evidence B' },
      ],
      existingEntityBases: [],
      existingConceptBases: [],
      sourceFilename: 'test.pdf',
    })
    expect(prompt).toContain('mention-a')
    expect(prompt).toContain('mention-b')
    expect(prompt).toContain('evidence A')
  })

  it('includes guideHint when provided', () => {
    const prompt = buildCanonicalizerPrompt({
      mentions: [{ name: 'x', evidence: 'y' }],
      existingEntityBases: [],
      existingConceptBases: [],
      sourceFilename: 'test.pdf',
      guideHint: 'PMBOK 표준 위주로 추출',
    })
    expect(prompt).toContain('PMBOK 표준 위주로 추출')
    expect(prompt).toContain('사용자 강조 지시')
  })

  it.skip('includes PMBOK 10 knowledge areas hint (§4.5.1.7.2) [§5.10.4 D-wide deprecated]', () => {
    const prompt = buildCanonicalizerPrompt({
      mentions: [{ name: 'x', evidence: 'y' }],
      existingEntityBases: [],
      existingConceptBases: [],
      sourceFilename: 'test.pdf',
    })
    // Rule marker — anchors the PMBOK section so later prompt edits can't silently drop it
    expect(prompt).toContain('PMBOK 10 knowledge areas 개별 추출')
    // All 10 PMBOK knowledge areas must be individually listed (N=30 showed the
    // 9-area bundle ↔ split oscillation was the main Concepts CV driver)
    expect(prompt).toContain('project-integration-management')
    expect(prompt).toContain('project-scope-management')
    expect(prompt).toContain('project-cost-management')
    expect(prompt).toContain('project-quality-management')
    expect(prompt).toContain('project-communications-management')
    expect(prompt).toContain('project-risk-management')
    expect(prompt).toContain('project-procurement-management')
    expect(prompt).toContain('project-stakeholder-management')
    // Anti-bundle instruction (do NOT collapse into the umbrella slug)
    expect(prompt).toContain('묶지 말 것')
    // Hallucination guard (only extract when mentioned)
    expect(prompt).toContain('직접 언급되지 않으면 추출하지 않는다')
  })

  // Phase 5 §5.10.3.7 R8.1: 폐기 — D-wide (schemaOverride entityTypes/conceptTypes 폐기).
  it.skip('includes schema override custom types in prompt (v7-5)', () => {
    // (deprecated test body retained for history)
  })

  // §4.3.1: Stage 3 overridePrompt replaces bundled prompt entirely,
  // substituting the documented template variables.
  it('overridePrompt fully replaces bundled template with variable substitution', () => {
    const override = `TEST-OVERRIDE
Source: {{SOURCE_FILENAME}}
Guide:{{GUIDE_BLOCK}}
Schema:{{SCHEMA_BLOCK}}
Existing:{{EXISTING_BLOCK}}
Mentions ({{MENTIONS_COUNT}}):
{{MENTIONS_BLOCK}}
`
    const prompt = buildCanonicalizerPrompt({
      mentions: [
        { name: 'pmbok', type_hint: 'standard', evidence: 'appears twice' },
        { name: 'mes', type_hint: 'tool', evidence: 'manufacturing execution' },
      ],
      existingEntityBases: [EXAMPLE_ORG_BASE],
      existingConceptBases: ['pmbok'],
      sourceFilename: 'pms.pdf',
      guideHint: '정밀 추출',
      overridePrompt: override,
    })
    // Override body is present, bundled wording is NOT leaked.
    expect(prompt.startsWith('TEST-OVERRIDE\n')).toBe(true)
    expect(prompt).not.toContain('당신은 wikey LLM Wiki의 canonicalizer')
    // Variable substitution landed.
    expect(prompt).toContain('Source: pms.pdf')
    expect(prompt).toContain('Mentions (2):')
    expect(prompt).toContain('`pmbok` (hint: standard)')
    expect(prompt).toContain('`mes` (hint: tool)')
    expect(prompt).toContain('정밀 추출') // guide block inline
    expect(prompt).toContain(EXAMPLE_ORG_BASE) // existing block rendered
  })

  it('empty overridePrompt (all whitespace) is ignored — bundled default wins', () => {
    const prompt = buildCanonicalizerPrompt({
      mentions: [{ name: 'x', evidence: 'y' }],
      existingEntityBases: [],
      existingConceptBases: [],
      sourceFilename: 'test.pdf',
      overridePrompt: '   \n  \t  ',
    })
    expect(prompt).toContain('당신은 wikey LLM Wiki의 canonicalizer')
  })
})

describe('canonicalize — v7 §4.5.1.4 slug aliases', () => {
  it('canonicalizeSlug() maps known aliases to canonical form', () => {
    expect(canonicalizeSlug('allimtok')).toBe('alimtalk')
    expect(canonicalizeSlug('alrimtok')).toBe('alimtalk')
    expect(canonicalizeSlug('sso-api')).toBe('single-sign-on-api')
    expect(canonicalizeSlug('single-sign-on')).toBe('single-sign-on-api')
    expect(canonicalizeSlug('integrated-member-db')).toBe('integrated-member-database')
  })

  it('canonicalizeSlug() is identity for unknown slugs', () => {
    expect(canonicalizeSlug('mariadb')).toBe('mariadb')
    expect(canonicalizeSlug('some-new-thing')).toBe('some-new-thing')
  })

  it('SLUG_ALIASES canonical targets do not chain (flat lookup)', () => {
    // Every target must NOT itself be a key — otherwise variants would resolve
    // through two lookups, which the single-read `canonicalizeSlug` doesn't do.
    for (const target of Object.values(SLUG_ALIASES)) {
      expect(SLUG_ALIASES).not.toHaveProperty(target)
    }
  })

  it('applies alias remap to LLM output filename', async () => {
    const mentions: Mention[] = [
      { name: '알림톡', type_hint: 'product', evidence: '카카오 서비스' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [{
        name: 'allimtok', type: 'product',
        description: '카카오톡 비즈니스 알림 서비스.',
      }],
      concepts: [],
    }))
    const result = await canonicalize({ ...baseArgs, llm, mentions })
    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].filename).toBe('alimtalk.md')
  })

  it('collapses abbreviation to fullname slug', async () => {
    const mentions: Mention[] = [
      { name: 'SSO', type_hint: 'tool', evidence: '단일 로그인' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [{
        name: 'sso-api', type: 'tool',
        description: 'Single Sign-On API.',
      }],
      concepts: [],
    }))
    const result = await canonicalize({ ...baseArgs, llm, mentions })
    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].filename).toBe('single-sign-on-api.md')
  })
})

describe('canonicalize — §4.5.1.6.1 determinism flag', () => {
  function makeCapturingLLM(jsonResponse: string): { llm: LLMClient; capturedOpts: any[] } {
    const capturedOpts: any[] = []
    const llm = {
      call: vi.fn().mockImplementation(async (_prompt: string, opts: any) => {
        capturedOpts.push(opts)
        return '```json\n' + jsonResponse + '\n```'
      }),
    } as unknown as LLMClient
    return { llm, capturedOpts }
  }

  it('omits temperature/seed when deterministic is not set', async () => {
    const { llm, capturedOpts } = makeCapturingLLM('{"entities":[],"concepts":[]}')
    await canonicalize({
      ...baseArgs, llm,
      mentions: [{ name: 'x', type_hint: 'organization', evidence: 'y' }],
    })
    expect(capturedOpts).toHaveLength(1)
    expect(capturedOpts[0].temperature).toBeUndefined()
    expect(capturedOpts[0].seed).toBeUndefined()
  })

  it('injects temperature=0 and seed=42 when deterministic=true', async () => {
    const { llm, capturedOpts } = makeCapturingLLM('{"entities":[],"concepts":[]}')
    await canonicalize({
      ...baseArgs, llm, deterministic: true,
      mentions: [{ name: 'x', type_hint: 'organization', evidence: 'y' }],
    })
    expect(capturedOpts[0].temperature).toBe(0)
    expect(capturedOpts[0].seed).toBe(42)
    expect(capturedOpts[0].jsonMode).toBe(true)
  })
})

describe('canonicalize — §4.5.1.6.3 SLUG_ALIASES 3rd expansion', () => {
  it('collapses alimtalk 4-variant (allim-talk/allimtalk/kakao-alimtalk/allimtok → alimtalk)', () => {
    expect(canonicalizeSlug('allim-talk')).toBe('alimtalk')
    expect(canonicalizeSlug('allimtalk')).toBe('alimtalk')
    expect(canonicalizeSlug('kakao-alimtalk')).toBe('alimtalk')
    expect(canonicalizeSlug('allimtok')).toBe('alimtalk')
  })

  it('drops -system suffix for ERP/SCM (→ methodology slug)', () => {
    expect(canonicalizeSlug('erp-system')).toBe('enterprise-resource-planning')
    expect(canonicalizeSlug('enterprise-resource-planning-system')).toBe('enterprise-resource-planning')
    expect(canonicalizeSlug('supply-chain-management-system')).toBe('supply-chain-management')
  })

  it('collapses point-of-production (system) → manufacturing-execution-system', () => {
    expect(canonicalizeSlug('point-of-production-system')).toBe('manufacturing-execution-system')
    expect(canonicalizeSlug('point-of-production')).toBe('manufacturing-execution-system')
  })

  it('collapses BOM 4-variant → bill-of-materials', () => {
    expect(canonicalizeSlug('e-bom')).toBe('bill-of-materials')
    expect(canonicalizeSlug('e-bill-of-materials')).toBe('bill-of-materials')
    expect(canonicalizeSlug('electronic-bill-of-materials')).toBe('bill-of-materials')
    expect(canonicalizeSlug('engineering-bill-of-materials')).toBe('bill-of-materials')
  })

  it('drops -system suffix for electronic-approval', () => {
    expect(canonicalizeSlug('electronic-approval-system')).toBe('electronic-approval')
  })

  it('maps spelled-out standards to their short industry-canonical form', () => {
    expect(canonicalizeSlug('representational-state-transfer-api')).toBe('restful-api')
    expect(canonicalizeSlug('transmission-control-protocol-internet-protocol')).toBe('tcp-ip')
    expect(canonicalizeSlug('message-queuing-telemetry-transport')).toBe('mqtt')
  })

  it('applies alias remap to LLM output filenames (end-to-end for new entries)', async () => {
    const mentions: Mention[] = [
      { name: 'allim-talk', type_hint: 'product', evidence: 'x' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [{ name: 'allim-talk', type: 'product', description: '카카오 알림톡' }],
      concepts: [],
    }))
    const result = await canonicalize({ ...baseArgs, llm, mentions })
    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].filename).toBe('alimtalk.md')
  })

  it('SLUG_ALIASES canonical targets remain flat (no chain)', () => {
    for (const target of Object.values(SLUG_ALIASES)) {
      expect(SLUG_ALIASES).not.toHaveProperty(target)
    }
  })
})

// §5.2.1 — entity ↔ concept cross-link 자동 생성 (deterministic, plan: phase-5-todox-5.2.1-crosslink.md)
describe('canonicalize — cross-link insertion (§5.2.1)', () => {
  it('happy: entity gets ## 관련 with concept wikilinks (alphabetical), concepts get back-link', async () => {
    const mentions: Mention[] = [
      { name: 'nanovna-v2', type_hint: 'tool', evidence: 'NanoVNA-V2 vector network analyzer' },
      { name: 'smith-chart', type_hint: 'standard', evidence: 'Smith chart for impedance' },
      { name: 'swr', type_hint: 'standard', evidence: 'standing wave ratio' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [{ name: 'nanovna-v2', type: 'tool', description: 'Vector network analyzer.' }],
      concepts: [
        { name: 'smith-chart', type: 'standard', description: 'Impedance plot.' },
        { name: 'swr', type: 'standard', description: 'Standing wave ratio.' },
      ],
    }))
    const result = await canonicalize({ ...baseArgs, llm, mentions })

    expect(result.entities).toHaveLength(1)
    expect(result.concepts).toHaveLength(2)

    const nanovna = result.entities[0].content
    expect(nanovna).toContain('## 관련')
    expect(nanovna).toMatch(/## 관련[\s\S]*\[\[smith-chart\]\][\s\S]*\[\[swr\]\]/)

    const smith = result.concepts.find((c) => c.filename === 'smith-chart.md')!.content
    const swr = result.concepts.find((c) => c.filename === 'swr.md')!.content
    expect(smith).toContain('## 관련')
    expect(smith).toContain('[[nanovna-v2]]')
    expect(swr).toContain('## 관련')
    expect(swr).toContain('[[nanovna-v2]]')

    // §5.2.1 plan §5.1 — `## 관련` placed before `## 출처`
    const idxRelated = nanovna.indexOf('## 관련')
    const idxSource = nanovna.indexOf('## 출처')
    expect(idxRelated).toBeGreaterThan(0)
    expect(idxRelated).toBeLessThan(idxSource)
  })

  it('edge: empty concept pool → entity has no ## 관련 H2 (no empty section)', async () => {
    const mentions: Mention[] = [
      { name: 'nanovna-v2', type_hint: 'tool', evidence: 'tool' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [{ name: 'nanovna-v2', type: 'tool', description: 'VNA.' }],
      concepts: [],
    }))
    const result = await canonicalize({ ...baseArgs, llm, mentions })
    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].content).not.toContain('## 관련')
  })

  it('edge: concept-only (no entity) → concepts have no ## 관련 H2', async () => {
    const mentions: Mention[] = [
      { name: 'smith-chart', type_hint: 'standard', evidence: 's' },
      { name: 'swr', type_hint: 'standard', evidence: 's' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [],
      concepts: [
        { name: 'smith-chart', type: 'standard', description: 'Impedance.' },
        { name: 'swr', type: 'standard', description: 'SWR.' },
      ],
    }))
    const result = await canonicalize({ ...baseArgs, llm, mentions })
    expect(result.concepts).toHaveLength(2)
    for (const c of result.concepts) {
      expect(c.content).not.toContain('## 관련')
    }
  })

  // §5.12 — entity/concept '## 출처' wikilink 가 wiki/sources/<sourcePageBase>.md 단일 진실 소스 매칭.
  // §5.3 follow-up #11 의 raw sidecar `<base>.<ext>.md` 매칭은 validate-wiki.sh resolver 와 mismatch 였음 — 폐기.
  it('## 출처 — paired pdf source: [[source-<base>|<base>]]', async () => {
    const mentions: Mention[] = [{ name: 'lotus-pms', type_hint: 'product', evidence: 'p' }]
    const llm = makeMockLLM(
      JSON.stringify({
        entities: [{ name: 'lotus-pms', type: 'product', description: 'PMS product.' }],
        concepts: [],
      }),
    )
    const result = await canonicalize({
      ...baseArgs,
      llm,
      mentions,
      sourceFilename: 'PMS_제품소개_R10_20220815.pdf',
      sourcePageBase: 'source-PMS_제품소개_R10_20220815',
    })
    const lotus = result.entities[0].content
    expect(lotus).toContain('## 출처')
    expect(lotus).toContain(
      '[[source-PMS_제품소개_R10_20220815|PMS_제품소개_R10_20220815]]',
    )
    // 이전 §5.3 raw sidecar 형식이 잔존하지 않아야
    expect(lotus).not.toMatch(/\[\[PMS_제품소개_R10_20220815\.pdf/)
  })

  it('## 출처 — 단독 md source: [[source-note|note]]', async () => {
    const mentions: Mention[] = [{ name: 'topic', type_hint: 'standard', evidence: 't' }]
    const llm = makeMockLLM(
      JSON.stringify({
        entities: [],
        concepts: [{ name: 'topic', type: 'standard', description: 'A topic.' }],
      }),
    )
    const result = await canonicalize({
      ...baseArgs,
      llm,
      mentions,
      sourceFilename: 'note.md',
      sourcePageBase: 'source-note',
    })
    const topic = result.concepts[0].content
    expect(topic).toContain('[[source-note|note]]')
    // 이전 §5.3 형식 (`[[note.md|note]]`) 0건
    expect(topic).not.toContain('[[note.md|')
  })

  it('## 출처 — hwp source: [[source-doc|doc]]', async () => {
    const mentions: Mention[] = [{ name: 'foo', type_hint: 'standard', evidence: 'e' }]
    const llm = makeMockLLM(
      JSON.stringify({
        entities: [],
        concepts: [{ name: 'foo', type: 'standard', description: 'Foo.' }],
      }),
    )
    const result = await canonicalize({
      ...baseArgs,
      llm,
      mentions,
      sourceFilename: 'doc.hwp',
      sourcePageBase: 'source-doc',
    })
    expect(result.concepts[0].content).toContain('[[source-doc|doc]]')
    expect(result.concepts[0].content).not.toContain('[[doc.hwp')
  })

  it('## 출처 — txt source: [[source-plain|plain]]', async () => {
    const mentions: Mention[] = [{ name: 'bar', type_hint: 'standard', evidence: 'e' }]
    const llm = makeMockLLM(
      JSON.stringify({
        entities: [],
        concepts: [{ name: 'bar', type: 'standard', description: 'Bar.' }],
      }),
    )
    const result = await canonicalize({
      ...baseArgs,
      llm,
      mentions,
      sourceFilename: 'plain.txt',
      sourcePageBase: 'source-plain',
    })
    expect(result.concepts[0].content).toContain('[[source-plain|plain]]')
    expect(result.concepts[0].content).not.toContain('[[plain.txt')
  })

  // §5.12 신규 — sourcePageBase invariant + LLM emit drift 방어
  it('§5.12 AC-5a: sourcePageBase 그대로 사용 (raw sourceFilename 무관)', async () => {
    const mentions: Mention[] = [{ name: 'pmi', type_hint: 'organization', evidence: 'PMI' }]
    const llm = makeMockLLM(
      JSON.stringify({
        entities: [{ name: 'pmi', type: 'organization', description: 'PMI.' }],
        concepts: [],
      }),
    )
    const result = await canonicalize({
      ...baseArgs,
      llm,
      mentions,
      sourceFilename: 'pmbok-overview.md',
      sourcePageBase: 'source-pmbok-overview',
    })
    const pmi = result.entities[0].content
    expect(pmi).toMatch(/- \[\[source-pmbok-overview\|pmbok-overview\]\]/)
    expect(pmi).not.toMatch(/\[\[pmbok-overview\.md/)
  })

  it('§5.12 AC-5b: LLM emit drift 방어 — sourcePageBase prefix 없는 case 도 그대로 사용', async () => {
    const mentions: Mention[] = [{ name: 'topic-x', type_hint: 'standard', evidence: 'e' }]
    const llm = makeMockLLM(
      JSON.stringify({
        entities: [],
        concepts: [{ name: 'topic-x', type: 'standard', description: 'X.' }],
      }),
    )
    const result = await canonicalize({
      ...baseArgs,
      llm,
      mentions,
      sourceFilename: 'pmbok-overview.md',
      // LLM 이 source_page.filename = 'pmbok-overview.md' (no prefix) emit 한 시나리오
      sourcePageBase: 'pmbok-overview',
    })
    const topic = result.concepts[0].content
    expect(topic).toMatch(/- \[\[pmbok-overview\|pmbok-overview\]\]/)
  })

  // §5.13.A1 — `## 출처` 에 source 요약 wikilink + raw 원문 wikilink 병기.
  // raw wikilink target = rawSourceFilename (PII guard 적용 안 된 원본 raw basename).
  // PII guard ON 시 sourceFilename 이 mask 적용된 형식이라 별도 인자.
  it('§5.13 AC-A1-1: ## 출처 — entity raw wikilink 병기 (rawSourceFilename .md)', async () => {
    const mentions: Mention[] = [{ name: 'pmi', type_hint: 'organization', evidence: 'PMI' }]
    const llm = makeMockLLM(
      JSON.stringify({
        entities: [{ name: 'pmi', type: 'organization', description: 'PMI.' }],
        concepts: [],
      }),
    )
    const result = await canonicalize({
      ...baseArgs,
      llm,
      mentions,
      sourceFilename: 'pmbok-overview.md',
      rawSourceFilename: 'pmbok-overview.md',
      sourcePageBase: 'source-pmbok-overview',
    })
    const pmi = result.entities[0].content
    expect(pmi).toContain('## 출처')
    expect(pmi).toContain('- [[source-pmbok-overview|pmbok-overview]]')
    expect(pmi).toContain('- [[pmbok-overview.md|원문]]')
  })

  it('§5.13 AC-A1-2: ## 출처 — concept raw wikilink 병기 (rawSourceFilename .md)', async () => {
    const mentions: Mention[] = [{ name: 'project-management', type_hint: 'standard', evidence: 'std' }]
    const llm = makeMockLLM(
      JSON.stringify({
        entities: [],
        concepts: [{ name: 'project-management', type: 'methodology', description: 'PM.' }],
      }),
    )
    const result = await canonicalize({
      ...baseArgs,
      llm,
      mentions,
      sourceFilename: 'pmbok-overview.md',
      rawSourceFilename: 'pmbok-overview.md',
      sourcePageBase: 'source-pmbok-overview',
    })
    const concept = result.concepts[0].content
    expect(concept).toContain('## 출처')
    expect(concept).toContain('- [[source-pmbok-overview|pmbok-overview]]')
    expect(concept).toContain('- [[pmbok-overview.md|원문]]')
  })

  it('§5.13 AC-A1-3: ## 출처 — rawSourceFilename 다양한 확장자 (.pdf/.hwp/.hwpx/.txt)', async () => {
    const cases = [
      { ext: 'pdf', raw: 'sample.pdf', base: 'source-sample' },
      { ext: 'hwp', raw: 'doc.hwp', base: 'source-doc' },
      { ext: 'hwpx', raw: 'document.hwpx', base: 'source-document' },
      { ext: 'txt', raw: 'plain.txt', base: 'source-plain' },
    ]
    for (const c of cases) {
      const mentions: Mention[] = [{ name: 'foo', type_hint: 'standard', evidence: 'e' }]
      const llm = makeMockLLM(
        JSON.stringify({
          entities: [],
          concepts: [{ name: 'foo', type: 'standard', description: 'Foo.' }],
        }),
      )
      const result = await canonicalize({
        ...baseArgs,
        llm,
        mentions,
        sourceFilename: c.raw,
        rawSourceFilename: c.raw,
        sourcePageBase: c.base,
      })
      const concept = result.concepts[0].content
      expect(concept, `ext=${c.ext}`).toContain(`- [[${c.raw}|원문]]`)
    }
  })

  it('§5.13 AC-A1-4: ## 출처 — 첫 줄 source wikilink 회귀 없음 (§5.12 paradigm)', async () => {
    const mentions: Mention[] = [{ name: 'topic', type_hint: 'standard', evidence: 't' }]
    const llm = makeMockLLM(
      JSON.stringify({
        entities: [],
        concepts: [{ name: 'topic', type: 'standard', description: 'A topic.' }],
      }),
    )
    const result = await canonicalize({
      ...baseArgs,
      llm,
      mentions,
      sourceFilename: 'note.md',
      rawSourceFilename: 'note.md',
      sourcePageBase: 'source-note',
    })
    const concept = result.concepts[0].content
    // §5.12: 첫 줄 source wikilink 위치 보존
    const lines = concept.split('\n')
    const sourceIdx = lines.findIndex((l) => l.startsWith('## 출처'))
    expect(sourceIdx).toBeGreaterThanOrEqual(0)
    expect(lines[sourceIdx + 2]).toBe('- [[source-note|note]]')
    expect(lines[sourceIdx + 3]).toBe('- [[note.md|원문]]')
  })

  it('§5.13 AC-A1-5: rebuildPageWithCrossLinks — raw wikilink 줄 보존', async () => {
    // applyCrossLinks 가 rebuildPageWithCrossLinks 호출 시 raw wikilink 줄도 보존.
    // entity + concept 둘 다 만들어 cross-link 트리거 (§5.2.1 H2 `## 관련` 추가).
    const mentions: Mention[] = [
      { name: 'pmi', type_hint: 'organization', evidence: 'PMI' },
      { name: 'pmbok', type_hint: 'standard', evidence: 'PMBOK' },
    ]
    const llm = makeMockLLM(
      JSON.stringify({
        entities: [{ name: 'pmi', type: 'organization', description: 'PMI.' }],
        concepts: [{ name: 'pmbok', type: 'standard', description: 'PMBOK.' }],
      }),
    )
    const result = await canonicalize({
      ...baseArgs,
      llm,
      mentions,
      sourceFilename: 'pmbok-overview.md',
      rawSourceFilename: 'pmbok-overview.md',
      sourcePageBase: 'source-pmbok-overview',
    })
    // entity 와 concept 모두 cross-link 후에도 raw wikilink 줄 보존
    expect(result.entities[0].content).toContain('- [[pmbok-overview.md|원문]]')
    expect(result.concepts[0].content).toContain('- [[pmbok-overview.md|원문]]')
    // cross-link 도 함께 추가됐는지 확증 (§5.2.1 회귀)
    expect(result.entities[0].content).toContain('## 관련')
    expect(result.concepts[0].content).toContain('## 관련')
  })

  it('§5.13 AC-A1-7: ## 출처 — PII guard ON 시 raw wikilink target = unmasked rawSourceFilename', async () => {
    // PII guard ON 시 sourceFilename 은 sanitizeForLlmPrompt 로 mask 처리될 수 있음.
    // 그러나 raw wikilink target 은 rawSourceFilename (mask 안 된 원본) 사용해야 raw 매칭 가능.
    const mentions: Mention[] = [{ name: 'foo', type_hint: 'standard', evidence: 'e' }]
    const llm = makeMockLLM(
      JSON.stringify({
        entities: [],
        concepts: [{ name: 'foo', type: 'standard', description: 'Foo.' }],
      }),
    )
    const result = await canonicalize({
      ...baseArgs,
      llm,
      mentions,
      // sourceFilename 은 PII-mask 적용된 형식 (예: 회원번호 등 PII 가 포함된 raw 파일)
      sourceFilename: '___-test-mask.pdf',
      // rawSourceFilename 은 mask 전 원본
      rawSourceFilename: '사업자등록증_홍길동_123456.pdf',
      sourcePageBase: 'source-test-mask',
    })
    const concept = result.concepts[0].content
    // raw wikilink target 은 rawSourceFilename (mask 안 된 원본)
    expect(concept).toContain('- [[사업자등록증_홍길동_123456.pdf|원문]]')
    // sourceFilename (masked) 은 frontmatter sources: 배열 + 첫 줄 wikilink display 에 사용 (§5.12).
    // raw wikilink target 으로는 등장 X — A1 paradigm 분리 (raw 매칭 방어).
    expect(concept).not.toContain('___-test-mask.pdf|원문')
    // 첫 줄 source wikilink display = sourceFilename 의 ext 제외 형식 (§5.12 paradigm 보존).
    expect(concept).toContain('- [[source-test-mask|___-test-mask]]')
  })

  // Phase 5 §5.10.3.7 R8.1: 폐기 — D-wide (FORCED_CATEGORIES 폐기).
  it.skip('regression: cross-link is computed AFTER FORCED_CATEGORIES pin (restful-api → concept)', async () => {
    // restful-api is pinned to concept/standard via FORCED_CATEGORIES.
    // LLM mistakenly puts it in entities → pin moves to concept → cross-link must
    // see it in the concept pool when computing nanovna's related list.
    const mentions: Mention[] = [
      { name: 'nanovna-v2', type_hint: 'tool', evidence: 'tool' },
      { name: 'restful-api', type_hint: 'standard', evidence: 'API spec' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [
        { name: 'nanovna-v2', type: 'tool', description: 'VNA.' },
        { name: 'restful-api', type: 'tool', description: 'REST API.' }, // wrong pool — pin moves
      ],
      concepts: [],
    }))
    const result = await canonicalize({ ...baseArgs, llm, mentions })
    expect(result.entities.map((e) => e.filename)).toEqual(['nanovna-v2.md'])
    expect(result.concepts.map((c) => c.filename)).toEqual(['restful-api.md'])
    expect(result.entities[0].content).toContain('[[restful-api]]')
    expect(result.concepts[0].content).toContain('[[nanovna-v2]]')
  })

  it('regression: deterministic — same input twice → byte-for-byte identical entity content', async () => {
    const mentions: Mention[] = [
      { name: 'nanovna-v2', type_hint: 'tool', evidence: 't' },
      { name: 'smith-chart', type_hint: 'standard', evidence: 's' },
    ]
    const json = JSON.stringify({
      entities: [{ name: 'nanovna-v2', type: 'tool', description: 'VNA.' }],
      concepts: [{ name: 'smith-chart', type: 'standard', description: 'Impedance.' }],
    })
    const a = await canonicalize({ ...baseArgs, llm: makeMockLLM(json), mentions })
    const b = await canonicalize({ ...baseArgs, llm: makeMockLLM(json), mentions })
    expect(a.entities[0].content).toBe(b.entities[0].content)
    expect(a.concepts[0].content).toBe(b.concepts[0].content)
  })

  it('edge (codex P1-2): SLUG_ALIASES collapse — no self-link to own base', async () => {
    // pmbok → project-management-body-of-knowledge (alias). If LLM puts pmbok in
    // entities + the canonical in concepts, after canonicalizeSlug they merge into
    // one base. The surviving page must NOT cross-link to itself.
    const mentions: Mention[] = [
      { name: 'pmbok', type_hint: 'standard', evidence: 'std' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [{ name: 'pmbok', type: 'tool', description: 'PM std.' }],
      concepts: [{ name: 'project-management-body-of-knowledge', type: 'standard', description: 'PM std canonical.' }],
    }))
    const result = await canonicalize({ ...baseArgs, llm, mentions })
    const allPages = [...result.entities, ...result.concepts]
    for (const p of allPages) {
      const ownBase = p.filename.replace(/\.md$/, '')
      expect(p.content).not.toContain(`[[${ownBase}]]`)
    }
  })

  it('edge (codex P1-2): dual-pool — same base in both pools resolves to one, no self-link', async () => {
    // Cross-pool dedup keeps base in entity pool, concept duplicate is dropped.
    // Cross-link must not surface a self-reference for the surviving page.
    const mentions: Mention[] = [
      { name: 'mqtt', type_hint: 'tool', evidence: 'protocol' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [{ name: 'mqtt', type: 'tool', description: 'MQTT broker.' }],
      concepts: [{ name: 'mqtt', type: 'standard', description: 'MQTT spec.' }],
    }))
    const result = await canonicalize({ ...baseArgs, llm, mentions })
    // mqtt is FORCED_CATEGORIES[entity/tool] — survives in entity pool only.
    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].filename).toBe('mqtt.md')
    expect(result.concepts).toHaveLength(0)
    expect(result.entities[0].content).not.toContain('[[mqtt]]')
  })

  it('edge (codex P1-2): rebuild idempotent — exactly one ## 관련 section, no duplicate bullets', async () => {
    const mentions: Mention[] = [
      { name: 'nanovna-v2', type_hint: 'tool', evidence: 't' },
      { name: 'smith-chart', type_hint: 'standard', evidence: 's' },
      { name: 'swr', type_hint: 'standard', evidence: 's' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [{ name: 'nanovna-v2', type: 'tool', description: 'VNA.' }],
      concepts: [
        { name: 'smith-chart', type: 'standard', description: 'Impedance.' },
        { name: 'swr', type: 'standard', description: 'SWR.' },
      ],
    }))
    const result = await canonicalize({ ...baseArgs, llm, mentions })
    const nanovna = result.entities[0].content
    const occurrences = (nanovna.match(/^## 관련$/gm) ?? []).length
    expect(occurrences).toBe(1)
    const smithBullets = (nanovna.match(/\[\[smith-chart\]\]/g) ?? []).length
    expect(smithBullets).toBe(1)
  })

  // §5.16 follow-up (whitelist 정책): rawSourceFilename 의 wikilink-unsafe character 가
  // 자동 sanitize → ` - ` 또는 `-` 정규화. caller 가 vault rename 까지 적용하면 disk 와
  // wikilink target 일관 유지 (§commands.ts::runIngest §5.16-rename). 본 함수는 fallback
  // sanitize 로 wikilink syntax 안전 보장.
  it('§5.16 raw wikilink — rawSourceFilename 의 `|` → sanitized target 으로 emit', async () => {
    const mentions: Mention[] = [
      { name: 'finetree-ocr', type_hint: 'product', evidence: 'finetree-OCR is OCR system' },
    ]
    const llm = makeMockLLM(
      JSON.stringify({
        entities: [{ name: 'finetree-ocr', type: 'product', description: 'OCR system.' }],
        concepts: [],
      }),
    )
    const result = await canonicalize({
      ...baseArgs,
      llm,
      mentions,
      sourceFilename: 'AI 기반 다채널 비정형 문서의 데이터화  |  finetree-OCR.md',
      rawSourceFilename: 'AI 기반 다채널 비정형 문서의 데이터화  |  finetree-OCR.md',
      sourcePageBase: 'source-finetree-ocr',
    })
    const ocr = result.entities[0].content
    expect(ocr).toContain('## 출처')
    // 첫 줄 source wikilink 보존
    expect(ocr).toContain('- [[source-finetree-ocr|')
    // 둘째 줄 raw wikilink — sanitized target ( `|` → ` - `, multi-space 압축)
    expect(ocr).toContain(
      '- [[AI 기반 다채널 비정형 문서의 데이터화 - finetree-OCR.md|원문]]',
    )
  })

  it('§5.16 raw wikilink — rawSourceFilename 에 `|` 없으면 기존 동작 (회귀 0)', async () => {
    const mentions: Mention[] = [{ name: 'pmi', type_hint: 'organization', evidence: 'PMI' }]
    const llm = makeMockLLM(
      JSON.stringify({
        entities: [{ name: 'pmi', type: 'organization', description: 'PMI.' }],
        concepts: [],
      }),
    )
    const result = await canonicalize({
      ...baseArgs,
      llm,
      mentions,
      sourceFilename: 'pmbok-overview.md',
      rawSourceFilename: 'pmbok-overview.md',
      sourcePageBase: 'source-pmbok-overview',
    })
    const pmi = result.entities[0].content
    // 기존 §5.13.A1 동작 보존 — raw wikilink 라인 emit
    expect(pmi).toContain('- [[pmbok-overview.md|원문]]')
  })
})

// §5.11 Page Promotion Threshold (Issue B) — Layer 2 deterministic gate
describe('canonicalize — §5.11 promotion threshold', () => {
  it('AC2: single-mention entity with sourceBody → dropped', async () => {
    const mentions: Mention[] = [
      { name: 'jeonnam-technopark', type_hint: 'organization', evidence: '개최 장소: 전라남도 테크노파크' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [{
        name: 'jeonnam-technopark', display_name: '전라남도 테크노파크', type: 'organization',
        description: '행사 개최 장소.', aliases: ['전라남도 테크노파크'],
      }],
      concepts: [],
    }))
    // 본문에 한국어 'jeonnam-technopark' 0회 + alias '전라남도 테크노파크' 1회 = 1 회 → drop
    const sourceBody = '스마트공장 보급확산 합동설명회 개최. 일시: 11월 1일. 개최 장소: 전라남도 테크노파크 본관 1층 강당. 주관: 중소벤처기업부.'
    const result = await canonicalize({ ...baseArgs, llm, mentions, sourceBody })
    expect(result.entities).toHaveLength(0)
    expect(result.dropped).toHaveLength(1)
    expect(result.dropped[0].reason).toContain('single-mention')
  })

  it('AC3: multi-occurrence entity with sourceBody → promoted', async () => {
    const mentions: Mention[] = [
      { name: 'lotus-pms', type_hint: 'product', evidence: 'PMS 제품 소개' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [{
        name: 'lotus-pms', display_name: 'LOTUS PMS', type: 'product',
        description: '프로젝트 관리 시스템.', aliases: ['PMS'],
      }],
      concepts: [],
    }))
    const sourceBody = 'LOTUS PMS 제품 소개. PMS 의 핵심 기능은 일정 관리. PMS 의 license 관리도 포함.'
    const result = await canonicalize({ ...baseArgs, llm, mentions, sourceBody })
    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].filename).toBe('lotus-pms.md')
    expect(result.dropped).toHaveLength(0)
  })

  it('AC4: alias 합산 occurrence → promoted', async () => {
    const mentions: Mention[] = [
      { name: 'enterprise-resource-planning', type_hint: 'standard', evidence: 'ERP 시스템' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [],
      concepts: [{
        name: 'enterprise-resource-planning', display_name: 'ERP', type: 'standard',
        description: 'Enterprise resource planning.', aliases: ['ERP'],
      }],
    }))
    // 본문에 'enterprise-resource-planning' 0회 + 'ERP' 1회 = 1회 → dropped
    // → alias 가 본문에 ≥ 2회 등장하면 promoted
    const sourceBody = 'ERP 시스템 도입. ERP 의 도입 효과는 큼. enterprise-resource-planning 표준 채택.'
    const result = await canonicalize({ ...baseArgs, llm, mentions, sourceBody })
    expect(result.concepts).toHaveLength(1)
    expect(result.concepts[0].filename).toBe('enterprise-resource-planning.md')
  })

  it('AC1 backward: sourceBody 미전달 → gate 미적용 (모든 entity 통과)', async () => {
    const mentions: Mention[] = [
      { name: '단일-mention', type_hint: 'organization', evidence: '한 번만 언급된 조직' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [{
        name: 'single-mention-org', type: 'organization',
        description: 'Only mentioned once.',
      }],
      concepts: [],
    }))
    // sourceBody 미전달 → gate skip → entity 통과
    const result = await canonicalize({ ...baseArgs, llm, mentions })
    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].filename).toBe('single-mention-org.md')
  })
})

// §5.15.B — promotionThreshold override (Mid-sized, 2026-05-07 session 24)
describe('canonicalize — §5.15.B promotionThreshold override', () => {
  it('AC-B2: promotionThreshold=1 → 1회 mention 도 promote', async () => {
    const mentions: Mention[] = [
      { name: 'jeonnam-technopark', type_hint: 'organization', evidence: '개최 장소: 전라남도 테크노파크' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [{
        name: 'jeonnam-technopark', display_name: '전라남도 테크노파크', type: 'organization',
        description: '행사 개최 장소.', aliases: ['전라남도 테크노파크'],
      }],
      concepts: [],
    }))
    const sourceBody = '스마트공장 보급확산 합동설명회 개최. 일시: 11월 1일. 개최 장소: 전라남도 테크노파크 본관 1층 강당. 주관: 중소벤처기업부.'
    const result = await canonicalize({ ...baseArgs, llm, mentions, sourceBody, promotionThreshold: 1 })
    // threshold=1 → 1회 mention 통과
    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].filename).toBe('jeonnam-technopark.md')
    expect(result.dropped).toHaveLength(0)
  })

  it('AC-B3: promotionThreshold=3 → 2회 mention 도 drop', async () => {
    const mentions: Mention[] = [
      { name: 'lotus-pms', type_hint: 'product', evidence: 'PMS 제품 소개' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [{
        name: 'lotus-pms', display_name: 'LOTUS PMS', type: 'product',
        description: '프로젝트 관리 시스템.', aliases: ['PMS'],
      }],
      concepts: [],
    }))
    // 본문에 PMS 가 2 sentence 등장 (default=2 면 promote, threshold=3 이면 drop)
    const sourceBody = 'LOTUS PMS 제품 소개. PMS 핵심 기능은 일정 관리.'
    const result = await canonicalize({ ...baseArgs, llm, mentions, sourceBody, promotionThreshold: 3 })
    expect(result.entities).toHaveLength(0)
    expect(result.dropped).toHaveLength(1)
    expect(result.dropped[0].reason).toContain('single-mention')
  })

  it('AC-B1 backward: promotionThreshold 미전달 → default=2 보존', async () => {
    const mentions: Mention[] = [
      { name: 'jeonnam-technopark', type_hint: 'organization', evidence: '개최 장소: 전라남도 테크노파크' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [{
        name: 'jeonnam-technopark', display_name: '전라남도 테크노파크', type: 'organization',
        description: '행사 개최 장소.', aliases: ['전라남도 테크노파크'],
      }],
      concepts: [],
    }))
    // 1회 mention. promotionThreshold 미전달 → default=2 적용 → drop (기존 AC2 와 동일 동작)
    const sourceBody = '스마트공장 보급확산 합동설명회 개최. 일시: 11월 1일. 개최 장소: 전라남도 테크노파크 본관 1층 강당. 주관: 중소벤처기업부.'
    const result = await canonicalize({ ...baseArgs, llm, mentions, sourceBody })
    expect(result.entities).toHaveLength(0)
    expect(result.dropped).toHaveLength(1)
  })
})

// §5.11 v3 — paradigm 회귀 fix: alias 카운트 inflation 차단 (sentence-unique 카운트)
describe('canonicalize — §5.11 v3 sentence-unique 카운트 (alias inflation 방어)', () => {
  it('AC-v3.1 EDA case — parenthetical 1 sentence 등장 (acronym + 한국어 풀네임 같은 문장) → drop', async () => {
    const sourceBody = '점진적 분석 심화를 위한 탐색적 데이터 분석(EDA) 지원. 다른 본문.'
    const mentions: Mention[] = [{ name: 'eda', type_hint: 'standard', evidence: 'EDA' }]
    const llm = makeMockLLM(
      JSON.stringify({
        entities: [],
        concepts: [{
          name: 'eda', type: 'standard', description: 'Exploratory Data Analysis.',
          aliases: ['exploratory-data-analysis', '탐색적 데이터 분석'],
        }],
      }),
    )
    const result = await canonicalize({ ...baseArgs, llm, mentions, sourceBody })
    // v3: 한 sentence 안 acronym + 한국어 풀네임 둘 다 매칭되어도 1 카운트 → < threshold(2) → drop
    expect(result.concepts).toHaveLength(0)
    const droppedReasons = result.dropped.map((d) => d.reason)
    expect(droppedReasons.some((r) => r.includes('single-mention') || r.includes('1 occurrence'))).toBe(true)
  })

  it('AC-v3.2 TSDB case — 두 sentence 등장 (list element 2회) → ≥ 2 카운트 → promote (Layer 2 통과, Layer 1 prompt 가 거부 책임)', async () => {
    const sourceBody =
      'Data Lake(RDB, TSDB)는 물론 Peak9 Edge를 통한 실시간 제조 데이터까지 질의 가능합니다.\n\n다중 DB 지원 — RDB, TSDB 등 이기종 데이터 소스의 통합 매핑.'
    const mentions: Mention[] = [{ name: 'tsdb', type_hint: 'product', evidence: 'TSDB' }]
    const llm = makeMockLLM(
      JSON.stringify({
        entities: [],
        concepts: [{
          name: 'tsdb', type: 'product', description: 'Time-Series Database.',
          aliases: ['time-series-database'],
        }],
      }),
    )
    const result = await canonicalize({ ...baseArgs, llm, mentions, sourceBody })
    // v3: 2 sentence 에 각 1회 = 2 카운트 → promote (Layer 2 통과). Layer 1 prompt 가 list-element 거부.
    expect(result.concepts).toHaveLength(1)
  })

  it('AC-v3.3 RBAC case — paradigm 부합 보존 (action 서술 2 sentence)', async () => {
    const sourceBody =
      '역할 기반 접근 제어(RBAC)와 컬럼 마스킹으로 데이터 거버넌스 보장.\n\nRBAC — 부서별, 직급별 접근 가능한 테이블과 컬럼을 세밀하게 관리.'
    const mentions: Mention[] = [{ name: 'rbac', type_hint: 'standard', evidence: 'RBAC' }]
    const llm = makeMockLLM(
      JSON.stringify({
        entities: [],
        concepts: [{
          name: 'rbac', type: 'standard', description: 'Role-Based Access Control.',
          aliases: ['role-based-access-control', '역할 기반 접근 제어'],
        }],
      }),
    )
    const result = await canonicalize({ ...baseArgs, llm, mentions, sourceBody })
    expect(result.concepts).toHaveLength(1)
  })

  it('AC-v3.4 RLHF case — 메커니즘 핵심 2 sentence 등장 → promote', async () => {
    const sourceBody =
      'NL-to-SQL 변환 정확도를 지속적으로 개선하는 RLHF 메커니즘을 제공합니다.\n\nRLHF 학습 — 사용자가 수정한 SQL을 학습 데이터로 활용.'
    const mentions: Mention[] = [{ name: 'rlhf', type_hint: 'methodology', evidence: 'RLHF' }]
    const llm = makeMockLLM(
      JSON.stringify({
        entities: [],
        concepts: [{ name: 'rlhf', type: 'methodology', description: 'Reinforcement Learning from Human Feedback.' }],
      }),
    )
    const result = await canonicalize({ ...baseArgs, llm, mentions, sourceBody })
    expect(result.concepts).toHaveLength(1)
  })

  it('AC-v3.5 v2 PMBOK 회귀 0 — 한국어 alias 단순 본문에서 promote 보존', async () => {
    // PMBOK 본문에 자주 등장 (한국어 + 영어 alias 둘 다 self-mentioning)
    const sourceBody =
      'PMBOK은 PMI가 발행하는 프로젝트 관리 표준입니다.\n\n프로젝트 관리 지식체계(PMBOK)는 다양한 영역을 다룹니다.\n\nPMBOK 7판은 원칙 기반 접근을 채택합니다.'
    const mentions: Mention[] = [{ name: 'pmbok', type_hint: 'standard', evidence: 'PMBOK' }]
    const llm = makeMockLLM(
      JSON.stringify({
        entities: [],
        concepts: [{
          name: 'pmbok', type: 'standard', description: 'PMI 의 프로젝트 관리 표준.',
          aliases: ['프로젝트 관리 지식체계', 'project-management-body-of-knowledge'],
        }],
      }),
    )
    const result = await canonicalize({ ...baseArgs, llm, mentions, sourceBody })
    // 3 sentence 등장 → ≥ 2 → promote 보존
    expect(result.concepts).toHaveLength(1)
  })

  it('AC-v3.6 single sentence 안 multiple alias 매칭 → 여전히 1 카운트', async () => {
    // 한 sentence 안 acronym + 영문 풀네임 + 한국어 풀네임 모두 등장 → 1 카운트
    const sourceBody = '시스템은 EDA (Exploratory Data Analysis, 탐색적 데이터 분석) 기능을 지원합니다.'
    const mentions: Mention[] = [{ name: 'eda', type_hint: 'standard', evidence: 'EDA' }]
    const llm = makeMockLLM(
      JSON.stringify({
        entities: [],
        concepts: [{
          name: 'eda', type: 'standard', description: 'Exploratory Data Analysis.',
          aliases: ['exploratory-data-analysis', '탐색적 데이터 분석'],
        }],
      }),
    )
    const result = await canonicalize({ ...baseArgs, llm, mentions, sourceBody })
    // v3: 한 sentence 안 3 alias 매칭 → 1 카운트 → < 2 → drop
    expect(result.concepts).toHaveLength(0)
  })
})

// §5.11 v2 — relevance/intent + 원문 언어 alias (5 신규 case AC-V1~V5)
describe('canonicalize — §5.11 v2 relevance/intent + 원문 언어 alias', () => {
  const promptArgs = {
    mentions: [{ name: 'pms', evidence: 'PMS 제품' }],
    existingEntityBases: [],
    existingConceptBases: [],
    sourceFilename: 'PMS_test.pdf',
  }

  it('AC-V1: canonicalizer prompt 에 "수가 적어도" 문구 (1~3개 OK)', () => {
    const p = buildCanonicalizerPrompt(promptArgs)
    expect(p).toMatch(/수가 적어도|1~3개만 출력해도/)
  })

  it('AC-V2: canonicalizer prompt 에 rule 9 "한국어 source" + "영어 source" alias 룰', () => {
    const p = buildCanonicalizerPrompt(promptArgs)
    expect(p).toContain('한국어 source')
    expect(p).toContain('영어 source')
  })

  it('AC-V3: canonicalizer prompt 에 단순 출처/개최 장소 ❌ 명시', () => {
    const p = buildCanonicalizerPrompt(promptArgs)
    expect(p).toMatch(/단순 출처|발급기관|개최 장소/)
  })

  it('AC-V4: BUNDLED_STAGE2_MENTION_PROMPT 의 "0~15개" cap 제거 + "수가 적어도" 명시', () => {
    expect(BUNDLED_STAGE2_MENTION_PROMPT).not.toMatch(/0~15개 정도/)
    expect(BUNDLED_STAGE2_MENTION_PROMPT).toMatch(/수가 적어도/)
  })

  it('AC-V5: 한국어 source LLM 출력 통과 — Korean filename + English alias frontmatter', async () => {
    const mentions: Mention[] = [
      { name: '전라남도-테크노파크', type_hint: 'organization', evidence: '전라남도 테크노파크 본관에서 회의' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [{
        name: '전라남도-테크노파크', type: 'organization',
        description: '전남 지역 R&D 지원 공공기관.',
        aliases: ['jeonnam-technopark', 'JTP'],
      }],
      concepts: [],
    }))
    // sourceBody 충분히 등장 (≥ 2 회) → §5.11 v1 occurrence gate 통과
    const sourceBody = '전라남도 테크노파크 소개. 전라남도 테크노파크 본관에서 회의 진행. JTP 산하 연구소.'
    const result = await canonicalize({ ...baseArgs, llm, mentions, sourceBody })
    expect(result.entities).toHaveLength(1)
    // WikiPage 시그니처: filename + content + category (codex cycle #1 P1-#2 fix)
    expect(result.entities[0].filename).toBe('전라남도-테크노파크.md')
    // alias 는 content frontmatter 의 aliases yaml 리스트로 검증
    expect(result.entities[0].content).toMatch(/aliases:\s*\n\s*-\s*jeonnam-technopark|aliases:\s*\[.*jeonnam-technopark/)
  })
})

