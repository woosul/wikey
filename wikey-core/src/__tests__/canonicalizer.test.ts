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

  // §5.3 follow-up #11 — entity/concept '## 출처' wikilink alias 형식 (broken link 방지)
  it('## 출처 — paired pdf source: alias 형식 [[<base>.pdf.md|<base>]]', async () => {
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
    })
    const lotus = result.entities[0].content
    // alias: link target = sidecar md (paired), display = raw basename
    expect(lotus).toContain('## 출처')
    expect(lotus).toContain(
      '[[PMS_제품소개_R10_20220815.pdf.md|PMS_제품소개_R10_20220815]]',
    )
    // 이전 broken 형식이 잔존하지 않아야 (basename only without alias)
    expect(lotus).not.toMatch(/\[\[PMS_제품소개_R10_20220815\]\]/)
  })

  it('## 출처 — 단독 md source: alias 형식 [[note.md|note]] (단독 md 자체)', async () => {
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
    })
    const topic = result.concepts[0].content
    expect(topic).toContain('[[note.md|note]]')
    // 단독 md 는 .md.md 가 되지 않아야 함
    expect(topic).not.toContain('note.md.md')
  })

  it('## 출처 — hwp source: alias 형식 [[doc.hwp.md|doc]]', async () => {
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
    })
    expect(result.concepts[0].content).toContain('[[doc.hwp.md|doc]]')
  })

  it('## 출처 — txt source: alias 형식 [[plain.txt|plain]] (txt 자체, sidecar 미생성 정책 정합)', async () => {
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
    })
    expect(result.concepts[0].content).toContain('[[plain.txt|plain]]')
    expect(result.concepts[0].content).not.toContain('plain.txt.md')
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

