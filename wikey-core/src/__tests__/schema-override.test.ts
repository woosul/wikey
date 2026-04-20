import { describe, it, expect } from 'vitest'
import {
  parseSchemaOverrideYaml,
  loadSchemaOverride,
  isValidEntityType,
  isValidConceptType,
  validateMention,
  buildSchemaPromptBlock,
  getEntityTypes,
  getConceptTypes,
} from '../schema.js'
import type { SchemaOverride, Mention, WikiFS } from '../types.js'

// ── YAML parser ──

describe('parseSchemaOverrideYaml', () => {
  it('returns null for empty input', () => {
    expect(parseSchemaOverrideYaml('')).toBeNull()
    expect(parseSchemaOverrideYaml('   ')).toBeNull()
  })

  it('parses entity_types only', () => {
    const yaml = `
entity_types:
  - name: dataset
    description: "공개된 데이터 모음 (예: imagenet)"
  - name: location
    description: 지리적 지명 (예: seoul)
`
    const r = parseSchemaOverrideYaml(yaml)
    expect(r).not.toBeNull()
    expect(r!.entityTypes).toHaveLength(2)
    expect(r!.entityTypes[0].name).toBe('dataset')
    expect(r!.entityTypes[0].description).toBe('공개된 데이터 모음 (예: imagenet)')
    expect(r!.entityTypes[1].name).toBe('location')
    expect(r!.entityTypes[1].description).toBe('지리적 지명 (예: seoul)')
    expect(r!.conceptTypes).toHaveLength(0)
  })

  it('parses concept_types only', () => {
    const yaml = `
concept_types:
  - name: regulation
    description: "특정 국가·기관 규제 (예: gdpr)"
`
    const r = parseSchemaOverrideYaml(yaml)
    expect(r!.conceptTypes).toHaveLength(1)
    expect(r!.conceptTypes[0].name).toBe('regulation')
    expect(r!.entityTypes).toHaveLength(0)
  })

  it('parses both sections with comments and blanks', () => {
    const yaml = `
# wikey schema override
# Adds new types for ML/research domain

entity_types:
  - name: dataset
    description: 공개된 데이터 모음

  - name: algorithm
    description: 구체적으로 명명된 알고리즘

concept_types:
  - name: regulation
    description: 규제·법령

`
    const r = parseSchemaOverrideYaml(yaml)
    expect(r!.entityTypes).toHaveLength(2)
    expect(r!.conceptTypes).toHaveLength(1)
    expect(r!.entityTypes[1].name).toBe('algorithm')
  })

  it('skips entries without name or description', () => {
    const yaml = `
entity_types:
  - name: valid
    description: ok
  - description: missing name
  - name: missing-desc
`
    const r = parseSchemaOverrideYaml(yaml)
    expect(r!.entityTypes).toHaveLength(1)
    expect(r!.entityTypes[0].name).toBe('valid')
  })

  it('normalizes type names (lowercase, snake_case)', () => {
    const yaml = `
entity_types:
  - name: Data_Set
    description: foo
`
    const r = parseSchemaOverrideYaml(yaml)
    expect(r!.entityTypes[0].name).toBe('data_set')
  })

  it('rejects duplicate names against built-in types (silent drop)', () => {
    const yaml = `
entity_types:
  - name: organization
    description: tries to override built-in
  - name: dataset
    description: new type
concept_types:
  - name: standard
    description: tries to override built-in
`
    const r = parseSchemaOverrideYaml(yaml)
    // duplicates with built-ins are dropped to avoid conflict
    expect(r!.entityTypes.map((x) => x.name)).toEqual(['dataset'])
    expect(r!.conceptTypes).toHaveLength(0)
  })

  it('returns null when no valid types parsed', () => {
    expect(parseSchemaOverrideYaml('# only a comment')).toBeNull()
    expect(parseSchemaOverrideYaml('entity_types:\nconcept_types:\n')).toBeNull()
  })
})

// ── Validation with override ──

describe('isValidEntityType / isValidConceptType with override', () => {
  const override: SchemaOverride = {
    entityTypes: [{ name: 'dataset', description: 'x' }],
    conceptTypes: [{ name: 'regulation', description: 'y' }],
  }

  it('accepts built-in types without override', () => {
    expect(isValidEntityType('organization')).toBe(true)
    expect(isValidConceptType('standard')).toBe(true)
  })

  it('rejects custom types without override', () => {
    expect(isValidEntityType('dataset')).toBe(false)
    expect(isValidConceptType('regulation')).toBe(false)
  })

  it('accepts custom types with override', () => {
    expect(isValidEntityType('dataset', override)).toBe(true)
    expect(isValidConceptType('regulation', override)).toBe(true)
  })

  it('still accepts built-in types with override', () => {
    expect(isValidEntityType('organization', override)).toBe(true)
    expect(isValidConceptType('standard', override)).toBe(true)
  })

  it('rejects unknown types even with override', () => {
    expect(isValidEntityType('foo', override)).toBe(false)
    expect(isValidConceptType('bar', override)).toBe(false)
  })
})

// ── validateMention with override ──

describe('validateMention with override', () => {
  const mention = (overrides: Partial<Mention>): Mention => ({
    name: 'test',
    evidence: 'evidence',
    ...overrides,
  })

  const override: SchemaOverride = {
    entityTypes: [{ name: 'dataset', description: 'x' }],
    conceptTypes: [],
  }

  it('valid for custom entity type with override', () => {
    const r = validateMention(mention({ name: 'imagenet', type_hint: 'dataset' as any }), override)
    expect(r.valid).toBe(true)
    expect(r.category).toBe('entity')
    expect(r.type).toBe('dataset' as any)
  })

  it('invalid for same custom type without override', () => {
    const r = validateMention(mention({ name: 'imagenet', type_hint: 'dataset' as any }))
    expect(r.valid).toBe(false)
  })
})

// ── getEntityTypes / getConceptTypes ──

describe('getEntityTypes / getConceptTypes', () => {
  it('returns built-in types when no override', () => {
    const e = getEntityTypes()
    expect(e).toEqual(['organization', 'person', 'product', 'tool'])
    const c = getConceptTypes()
    expect(c).toEqual(['standard', 'methodology', 'document_type'])
  })

  it('merges built-in + override', () => {
    const override: SchemaOverride = {
      entityTypes: [{ name: 'dataset', description: 'x' }],
      conceptTypes: [{ name: 'regulation', description: 'y' }],
    }
    expect(getEntityTypes(override)).toEqual(['organization', 'person', 'product', 'tool', 'dataset'])
    expect(getConceptTypes(override)).toEqual(['standard', 'methodology', 'document_type', 'regulation'])
  })
})

// ── buildSchemaPromptBlock with override ──

describe('buildSchemaPromptBlock with override', () => {
  it('includes custom types and descriptions', () => {
    const override: SchemaOverride = {
      entityTypes: [{ name: 'dataset', description: '공개된 데이터 모음' }],
      conceptTypes: [{ name: 'regulation', description: '규제·법령' }],
    }
    const block = buildSchemaPromptBlock(override)
    expect(block).toContain('`dataset`')
    expect(block).toContain('공개된 데이터 모음')
    expect(block).toContain('`regulation`')
    expect(block).toContain('규제·법령')
  })

  it('notes custom-type count when override present', () => {
    const override: SchemaOverride = {
      entityTypes: [{ name: 'dataset', description: 'x' }],
      conceptTypes: [],
    }
    const block = buildSchemaPromptBlock(override)
    expect(block).toContain('Entity 타입 (5개)')  // 4 built-in + 1 custom
  })

  it('falls back to built-in counts without override', () => {
    const block = buildSchemaPromptBlock()
    expect(block).toContain('Entity 타입 (4개)')
    expect(block).toContain('Concept 타입 (3개)')
  })
})

// ── loadSchemaOverride (FS loader) ──

describe('loadSchemaOverride', () => {
  function makeFS(files: Record<string, string>): WikiFS {
    return {
      async exists(p: string) { return p in files },
      async read(p: string) {
        if (!(p in files)) throw new Error(`no such file: ${p}`)
        return files[p]
      },
      async write() { throw new Error('not impl') },
      async list() { return [] },
    }
  }

  it('returns null when file does not exist', async () => {
    const fs = makeFS({})
    expect(await loadSchemaOverride(fs)).toBeNull()
  })

  it('reads and parses .wikey/schema.yaml by default', async () => {
    const fs = makeFS({
      '.wikey/schema.yaml': `
entity_types:
  - name: dataset
    description: data
`,
    })
    const r = await loadSchemaOverride(fs)
    expect(r).not.toBeNull()
    expect(r!.entityTypes[0].name).toBe('dataset')
  })

  it('accepts custom path', async () => {
    const fs = makeFS({
      'custom/schema.yaml': `
concept_types:
  - name: regulation
    description: law
`,
    })
    const r = await loadSchemaOverride(fs, 'custom/schema.yaml')
    expect(r!.conceptTypes[0].name).toBe('regulation')
  })

  it('returns null when file exists but has no valid types', async () => {
    const fs = makeFS({ '.wikey/schema.yaml': '# empty' })
    expect(await loadSchemaOverride(fs)).toBeNull()
  })
})
