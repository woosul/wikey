import { describe, it, expect } from 'vitest'
import {
  ENTITY_TYPES,
  CONCEPT_TYPES,
  isValidEntityType,
  isValidConceptType,
  validateMention,
  detectAntiPattern,
  buildSchemaPromptBlock,
} from '../schema.js'
import type { Mention } from '../types.js'

describe('ENTITY_TYPES / CONCEPT_TYPES', () => {
  it('exposes exactly 4 entity types', () => {
    expect(ENTITY_TYPES).toHaveLength(4)
    expect(new Set(ENTITY_TYPES)).toEqual(new Set(['organization', 'person', 'product', 'tool']))
  })

  it('exposes exactly 3 concept types', () => {
    expect(CONCEPT_TYPES).toHaveLength(3)
    expect(new Set(CONCEPT_TYPES)).toEqual(new Set(['standard', 'methodology', 'document_type']))
  })
})

describe('isValidEntityType / isValidConceptType', () => {
  it('accepts each allowed entity type', () => {
    for (const t of ENTITY_TYPES) expect(isValidEntityType(t)).toBe(true)
  })
  it('rejects non-entity strings', () => {
    expect(isValidEntityType('standard')).toBe(false)
    expect(isValidEntityType('business_object')).toBe(false)
    expect(isValidEntityType('')).toBe(false)
  })
  it('accepts each allowed concept type', () => {
    for (const t of CONCEPT_TYPES) expect(isValidConceptType(t)).toBe(true)
  })
  it('rejects non-concept strings', () => {
    expect(isValidConceptType('product')).toBe(false)
    expect(isValidConceptType('ui_label')).toBe(false)
  })
})

describe('validateMention', () => {
  const mention = (overrides: Partial<Mention>): Mention => ({
    name: 'test',
    evidence: 'evidence text',
    ...overrides,
  })

  it('returns valid+entity for organization type_hint', () => {
    const r = validateMention(mention({ name: 'goodstream-co-ltd', type_hint: 'organization' }))
    expect(r.valid).toBe(true)
    expect(r.category).toBe('entity')
    expect(r.type).toBe('organization')
  })

  it('returns valid+concept for standard type_hint', () => {
    const r = validateMention(mention({ name: 'pmbok', type_hint: 'standard' }))
    expect(r.valid).toBe(true)
    expect(r.category).toBe('concept')
    expect(r.type).toBe('standard')
  })

  it('returns invalid when type_hint is missing', () => {
    const r = validateMention(mention({ name: 'unknown-thing' }))
    expect(r.valid).toBe(false)
    expect(r.reason).toContain('no type_hint')
  })

  it('returns invalid when type_hint is "unknown"', () => {
    const r = validateMention(mention({ name: 'unsure', type_hint: 'unknown' as any }))
    expect(r.valid).toBe(false)
  })

  it('returns invalid for off-schema type', () => {
    const r = validateMention(mention({ name: 'x', type_hint: 'business_object' as any }))
    expect(r.valid).toBe(false)
    expect(r.reason).toContain('not in schema')
  })
})

describe('detectAntiPattern', () => {
  it('flags Korean labels (v5 anti-pattern)', () => {
    expect(detectAntiPattern('회의실')).toContain('Korean label')
    expect(detectAntiPattern('결재시스템')).toContain('Korean label')
    expect(detectAntiPattern('표준-템플릿')).toContain('Korean label')  // mixed Korean + dash
  })

  it('flags X-management functional suffix (v3.2~v4 anti-pattern)', () => {
    expect(detectAntiPattern('user-management')).toContain('-management')
    expect(detectAntiPattern('license-management')).toContain('-management')
  })

  it('flags X-service / X-support / X-printing / X-viewer suffixes', () => {
    expect(detectAntiPattern('mobile-app-service')).toContain('-service')
    expect(detectAntiPattern('multilingual-support')).toContain('-support')
    expect(detectAntiPattern('barcode-printing')).toContain('-printing')
    expect(detectAntiPattern('web-viewer')).toContain('-viewer')
  })

  it('does NOT flag industry-standard "*-management-system" (whitelisted)', () => {
    expect(detectAntiPattern('electronic-approval-system')).toBeNull()
    expect(detectAntiPattern('supply-chain-management-system')).toBeNull()
    expect(detectAntiPattern('enterprise-resource-planning')).toBeNull()
    expect(detectAntiPattern('project-integration-management')).toBeNull()  // PMBOK 9 areas
  })

  it('flags business object names (v4 anti-pattern)', () => {
    expect(detectAntiPattern('quotation')).toContain('business object')
    expect(detectAntiPattern('purchase-order')).toContain('business object')
    expect(detectAntiPattern('tax-invoice')).toContain('business object')
  })

  it('flags operational artifacts (v6 residual noise)', () => {
    expect(detectAntiPattern('issue-log')).toContain('operational')
    expect(detectAntiPattern('meeting-minutes')).toContain('operational')
    expect(detectAntiPattern('incoming-inspection')).toContain('operational')
    expect(detectAntiPattern('turnkey-contract')).toContain('operational')
    expect(detectAntiPattern('delivery-specification')).toContain('operational')
    expect(detectAntiPattern('capacity-analysis')).toContain('operational')
    expect(detectAntiPattern('barcode')).toContain('operational')
    expect(detectAntiPattern('product-introduction-document')).toContain('operational')
    expect(detectAntiPattern('weekly-report')).toContain('operational')
    expect(detectAntiPattern('business-registration-number')).toContain('operational')
  })

  it('catches hyphen-position variants of operational items (C boost)', () => {
    expect(detectAntiPattern('turn-key-contract')).toContain('operational')  // anti-pattern: turnkey-contract
    expect(detectAntiPattern('turnkey-contract')).toContain('operational')
    expect(detectAntiPattern('Tax-Invoice')).toContain('business object')  // case-insensitive
  })

  it('catches *-list / *-report / *-form suffixes (C boost)', () => {
    expect(detectAntiPattern('delivery-confirmation-list')).toContain('-list')
    expect(detectAntiPattern('purchase-list')).toContain('-list')
    expect(detectAntiPattern('status-report')).toContain('-report')
    expect(detectAntiPattern('monthly-report')).toContain('-report')
    expect(detectAntiPattern('standard-deliverable-form')).toContain('-form')
  })

  it('catches new operational variants from v6+D+C run', () => {
    expect(detectAntiPattern('delivery-confirmation')).toContain('operational')
    expect(detectAntiPattern('product-introduction')).toContain('operational')
    expect(detectAntiPattern('3d-workspace')).toContain('operational')
  })

  it('returns null for clean names', () => {
    expect(detectAntiPattern('pmbok')).toBeNull()
    expect(detectAntiPattern('work-breakdown-structure')).toBeNull()
    expect(detectAntiPattern('mariadb')).toBeNull()
    expect(detectAntiPattern('apache-tomcat')).toBeNull()
    expect(detectAntiPattern('lotus-pms')).toBeNull()
  })
})

describe('buildSchemaPromptBlock', () => {
  it('includes all 4 entity types', () => {
    const block = buildSchemaPromptBlock()
    for (const t of ENTITY_TYPES) {
      expect(block).toContain(`\`${t}\``)
    }
  })

  it('includes all 3 concept types', () => {
    const block = buildSchemaPromptBlock()
    for (const t of CONCEPT_TYPES) {
      expect(block).toContain(`\`${t}\``)
    }
  })

  it('includes rejection pattern guidance', () => {
    const block = buildSchemaPromptBlock()
    expect(block).toContain('거부 패턴')
    expect(block).toContain('한국어')
  })
})
