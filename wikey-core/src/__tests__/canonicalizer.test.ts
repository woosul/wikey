import { describe, it, expect, vi } from 'vitest'
import {
  canonicalize, buildCanonicalizerPrompt,
  canonicalizeSlug, SLUG_ALIASES, FORCED_CATEGORIES,
} from '../canonicalizer.js'
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

describe('canonicalize — drops anti-pattern names', () => {
  it('drops Korean labels even with valid type', async () => {
    const mentions: Mention[] = [
      { name: '회의실', type_hint: 'product', evidence: '회의실 예약 기능' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [{ name: '회의실', type: 'product', description: '회의실 관리 기능' }],
      concepts: [],
    }))
    const result = await canonicalize({ ...baseArgs, llm, mentions })
    expect(result.entities).toHaveLength(0)  // dropped
    expect(result.dropped.length).toBeGreaterThan(0)
    expect(result.dropped[0].reason).toContain('Korean label')
  })

  it('drops X-management functional suffix names', async () => {
    const mentions: Mention[] = [
      { name: 'license-management', type_hint: 'standard', evidence: '라이선스 관리 화면' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [],
      concepts: [{ name: 'license-management', type: 'standard', description: '라이선스 관리' }],
    }))
    const result = await canonicalize({ ...baseArgs, llm, mentions })
    expect(result.concepts).toHaveLength(0)  // dropped by anti-pattern check
    expect(result.dropped[0].reason).toContain('-management')
  })

  it('drops business object names', async () => {
    const mentions: Mention[] = [
      { name: 'tax-invoice', type_hint: 'document_type', evidence: '거래명세서' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [],
      concepts: [{ name: 'tax-invoice', type: 'document_type', description: '세금계산서' }],
    }))
    const result = await canonicalize({ ...baseArgs, llm, mentions })
    expect(result.concepts).toHaveLength(0)
    expect(result.dropped[0].reason).toContain('business object')
  })
})

describe('canonicalize — drops invalid schema types', () => {
  it('drops entity with invalid type', async () => {
    const mentions: Mention[] = [
      { name: 'gantt-chart', type_hint: 'standard', evidence: '간트 차트 기반 일정 관리' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [{ name: 'gantt-chart', type: 'business_object', description: '간트차트' }],  // invalid type
      concepts: [],
    }))
    const result = await canonicalize({ ...baseArgs, llm, mentions })
    expect(result.entities).toHaveLength(0)
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

  it('includes PMBOK 10 knowledge areas hint (§4.5.1.7.2)', () => {
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

  it('includes schema override custom types in prompt (v7-5)', () => {
    const prompt = buildCanonicalizerPrompt({
      mentions: [{ name: 'x', evidence: 'y' }],
      existingEntityBases: [],
      existingConceptBases: [],
      sourceFilename: 'test.pdf',
      schemaOverride: {
        entityTypes: [{ name: 'dataset', description: '공개된 데이터 모음' }],
        conceptTypes: [{ name: 'regulation', description: '규제·법령' }],
      },
    })
    expect(prompt).toContain('dataset')
    expect(prompt).toContain('공개된 데이터 모음')
    expect(prompt).toContain('regulation')
    expect(prompt).toContain('Entity 타입 (5개)')  // 4 built-in + 1 custom
    expect(prompt).toContain('Concept 타입 (4개)')
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

describe('canonicalize — schema override (v7-5)', () => {
  it('accepts custom entity type from override and builds page with entityType set', async () => {
    const mentions: Mention[] = [
      { name: 'imagenet', type_hint: 'dataset' as any, evidence: '이미지 분류 벤치마크' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [{
        name: 'imagenet', type: 'dataset',
        description: 'Stanford ImageNet 이미지 분류 벤치마크.',
      }],
      concepts: [],
    }))
    const result = await canonicalize({
      ...baseArgs, llm, mentions,
      schemaOverride: {
        entityTypes: [{ name: 'dataset', description: 'X' }],
        conceptTypes: [],
      },
    })
    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].filename).toBe('imagenet.md')
    expect(result.entities[0].entityType as any).toBe('dataset')
    expect(result.entities[0].content).toContain('entity_type: dataset')
  })

  it('drops same custom type without override', async () => {
    const mentions: Mention[] = [
      { name: 'imagenet', type_hint: 'dataset' as any, evidence: '벤치마크' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [{ name: 'imagenet', type: 'dataset', description: 'X' }],
      concepts: [],
    }))
    const result = await canonicalize({ ...baseArgs, llm, mentions })
    expect(result.entities).toHaveLength(0)
    expect(result.dropped).toHaveLength(1)
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

describe('canonicalize — v7 §4.5.1.4 E/C boundary pins', () => {
  it('FORCED_CATEGORIES pins mqtt to entity/tool', () => {
    expect(FORCED_CATEGORIES['mqtt']).toEqual({ category: 'entity', type: 'tool' })
  })

  it('FORCED_CATEGORIES pins restful-api to concept/standard', () => {
    expect(FORCED_CATEGORIES['restful-api']).toEqual({ category: 'concept', type: 'standard' })
  })

  it('moves pinned entity out of concept pool (mqtt)', async () => {
    const mentions: Mention[] = [
      { name: 'MQTT', type_hint: 'methodology', evidence: '경량 pub/sub 프로토콜' },
    ]
    // LLM mistakenly classifies mqtt as concept/methodology
    const llm = makeMockLLM(JSON.stringify({
      entities: [],
      concepts: [{
        name: 'mqtt', type: 'methodology',
        description: '경량 메시지 pub/sub 프로토콜.',
      }],
    }))
    const result = await canonicalize({ ...baseArgs, llm, mentions })
    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].filename).toBe('mqtt.md')
    expect(result.entities[0].entityType).toBe('tool')
    expect(result.entities[0].content).toContain('entity_type: tool')
    expect(result.concepts).toHaveLength(0)
  })

  it('moves pinned concept out of entity pool (restful-api)', async () => {
    const mentions: Mention[] = [
      { name: 'RESTful API', type_hint: 'tool', evidence: 'HTTP 기반 웹 서비스' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [{
        name: 'restful-api', type: 'tool',
        description: 'HTTP 기반 자원 지향 웹 서비스 아키텍처.',
      }],
      concepts: [],
    }))
    const result = await canonicalize({ ...baseArgs, llm, mentions })
    expect(result.entities).toHaveLength(0)
    expect(result.concepts).toHaveLength(1)
    expect(result.concepts[0].filename).toBe('restful-api.md')
    expect(result.concepts[0].conceptType).toBe('standard')
    expect(result.concepts[0].content).toContain('concept_type: standard')
  })

  it('keeps pinned entity in entity pool (mqtt classified correctly)', async () => {
    const mentions: Mention[] = [
      { name: 'MQTT', type_hint: 'tool', evidence: '프로토콜' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [{
        name: 'mqtt', type: 'tool',
        description: '경량 pub/sub 프로토콜.',
      }],
      concepts: [],
    }))
    const result = await canonicalize({ ...baseArgs, llm, mentions })
    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].filename).toBe('mqtt.md')
    expect(result.entities[0].entityType).toBe('tool')
  })

  it('dedupes when same pinned slug appears in both pools (entity wins)', async () => {
    // Edge case: LLM emits mqtt in both pools. Entity pool runs first; second
    // occurrence must be dropped, not double-counted.
    const mentions: Mention[] = [
      { name: 'mqtt', type_hint: 'tool', evidence: 'x' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [{ name: 'mqtt', type: 'tool', description: 'A' }],
      concepts: [{ name: 'mqtt', type: 'methodology', description: 'B' }],
    }))
    const result = await canonicalize({ ...baseArgs, llm, mentions })
    expect(result.entities).toHaveLength(1)
    expect(result.concepts).toHaveLength(0)
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

describe('canonicalize — §4.5.1.6.4 FORCED_CATEGORIES canonical resolution', () => {
  it('pins enterprise-resource-planning to concept/standard', () => {
    expect(FORCED_CATEGORIES['enterprise-resource-planning']).toEqual(
      { category: 'concept', type: 'standard' }
    )
  })

  it('pins supply-chain-management to concept/methodology', () => {
    expect(FORCED_CATEGORIES['supply-chain-management']).toEqual(
      { category: 'concept', type: 'methodology' }
    )
  })

  it('pins tcp-ip and virtual-private-network to concept/standard', () => {
    expect(FORCED_CATEGORIES['tcp-ip']).toEqual({ category: 'concept', type: 'standard' })
    expect(FORCED_CATEGORIES['virtual-private-network']).toEqual({ category: 'concept', type: 'standard' })
  })

  it('moves aliased entity (erp-system) out of entity pool via pin (ERP is concept)', async () => {
    // LLM emits `erp-system` classified as entity/product.
    // Alias maps to `enterprise-resource-planning`; pin forces concept/standard.
    const mentions: Mention[] = [
      { name: 'ERP', type_hint: 'product', evidence: 'ERP 시스템' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [{ name: 'erp-system', type: 'product', description: 'ERP' }],
      concepts: [],
    }))
    const result = await canonicalize({ ...baseArgs, llm, mentions })
    expect(result.entities).toHaveLength(0)
    expect(result.concepts).toHaveLength(1)
    expect(result.concepts[0].filename).toBe('enterprise-resource-planning.md')
    expect(result.concepts[0].conceptType).toBe('standard')
  })

  it('preserves pin when slug appears in both pools after alias (enterprise-resource-planning)', async () => {
    // LLM emits same canonical in both pools via different aliases.
    const mentions: Mention[] = [
      { name: 'ERP', type_hint: 'standard', evidence: 'x' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [{ name: 'enterprise-resource-planning-system', type: 'product', description: 'A' }],
      concepts: [{ name: 'enterprise-resource-planning', type: 'standard', description: 'B' }],
    }))
    const result = await canonicalize({ ...baseArgs, llm, mentions })
    expect(result.entities).toHaveLength(0)
    expect(result.concepts).toHaveLength(1)
    expect(result.concepts[0].filename).toBe('enterprise-resource-planning.md')
  })

  it('collapses BOM variants to single concept via alias + pin', async () => {
    const mentions: Mention[] = [
      { name: 'BOM', type_hint: 'standard', evidence: '자재명세서' },
    ]
    // Simulate LLM emitting two BOM variants that would both alias to bill-of-materials.
    const llm = makeMockLLM(JSON.stringify({
      entities: [],
      concepts: [
        { name: 'engineering-bill-of-materials', type: 'standard', description: 'eBOM' },
        { name: 'bill-of-materials', type: 'standard', description: 'BOM 표준' },
      ],
    }))
    const result = await canonicalize({ ...baseArgs, llm, mentions })
    expect(result.concepts).toHaveLength(1)
    expect(result.concepts[0].filename).toBe('bill-of-materials.md')
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

  it('regression: cross-link is computed AFTER FORCED_CATEGORIES pin (restful-api → concept)', async () => {
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
