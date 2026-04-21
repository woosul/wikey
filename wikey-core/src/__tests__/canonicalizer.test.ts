import { describe, it, expect, vi } from 'vitest'
import {
  canonicalize, buildCanonicalizerPrompt,
  canonicalizeSlug, SLUG_ALIASES, FORCED_CATEGORIES,
} from '../canonicalizer.js'
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
      { name: 'goodstream-co-ltd', type_hint: 'organization', evidence: '사업자등록증 발급 대상' },
    ]
    const llm = makeMockLLM(JSON.stringify({
      entities: [{
        name: 'goodstream-co-ltd', type: 'organization',
        description: '주식회사 굿스트림. 소프트웨어 개발 회사.',
      }],
      concepts: [],
    }))
    const result = await canonicalize({ ...baseArgs, llm, mentions })
    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].filename).toBe('goodstream-co-ltd.md')
    expect(result.entities[0].category).toBe('entities')
    expect(result.entities[0].entityType).toBe('organization')
    expect(result.entities[0].content).toContain('entity_type: organization')
    expect(result.entities[0].content).toContain('주식회사 굿스트림')
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

  it('includes existing pages block', () => {
    const prompt = buildCanonicalizerPrompt({
      mentions: [{ name: 'pms', evidence: 'X' }],
      existingEntityBases: ['goodstream-co-ltd'],
      existingConceptBases: ['pmbok'],
      sourceFilename: 'test.pdf',
    })
    expect(prompt).toContain('goodstream-co-ltd')
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
