import { describe, it, expect, vi } from 'vitest'
import {
  parseSchemaOverrideYaml,
  loadSchemaOverride,
  isValidEntityType,
  isValidConceptType,
  validateMention,
  buildSchemaPromptBlock,
  buildStandardDecompositionBlock,
  getEntityTypes,
  getConceptTypes,
  BUILTIN_STANDARD_DECOMPOSITIONS,
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

// ── §5.4.1 Stage 1: standard_decompositions parser (AC2) ──

describe('parseSchemaOverrideYaml — standard_decompositions (§5.4.1)', () => {
  // (1) standard_decompositions only YAML → 파서 non-null + entityTypes []
  it('(1) parses standard_decompositions only — entity/concept types empty but override returned', () => {
    const yaml = `
standard_decompositions:
  - name: ISO-27001
    umbrella_slug: iso-27001
    rule: decompose
    require_explicit_mention: true
    aliases:
      - Information Security Management
    components:
      - slug: a-5-control
        type: standard
`
    const r = parseSchemaOverrideYaml(yaml)
    expect(r).not.toBeNull()
    expect(r!.entityTypes).toHaveLength(0)
    expect(r!.conceptTypes).toHaveLength(0)
    expect(r!.standardDecompositions).toBeDefined()
    expect(r!.standardDecompositions!.kind).toBe('present')
    if (r!.standardDecompositions!.kind === 'present') {
      expect(r!.standardDecompositions!.items).toHaveLength(1)
      expect(r!.standardDecompositions!.items[0].name).toBe('ISO-27001')
    }
  })

  // (2) explicit `standard_decompositions: []` → state empty-explicit
  it('(2) explicit empty list → kind: empty-explicit', () => {
    const yaml = `
entity_types:
  - name: dataset
    description: data
standard_decompositions: []
`
    const r = parseSchemaOverrideYaml(yaml)
    expect(r).not.toBeNull()
    expect(r!.standardDecompositions).toEqual({ kind: 'empty-explicit' })
  })

  // (3) standard_decompositions key absent → standardDecompositions === undefined
  it('(3) absent key → standardDecompositions field undefined', () => {
    const yaml = `
entity_types:
  - name: dataset
    description: data
`
    const r = parseSchemaOverrideYaml(yaml)
    expect(r).not.toBeNull()
    expect(r!.standardDecompositions).toBeUndefined()
  })

  // (4) all entries invalid → empty-all-skipped + warn + builder built-in fallback
  it('(4) all entries invalid → kind: empty-all-skipped + warn + builder fallback', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const yaml = `
standard_decompositions:
  - name: BAD-1
    umbrella_slug: bad-1
    rule: lol-not-a-rule
    components:
      - slug: foo
        type: methodology
  - name: BAD-2
    umbrella_slug: BAD-UPPER
    rule: decompose
    components:
      - slug: bar
        type: methodology
`
    const r = parseSchemaOverrideYaml(yaml)
    expect(r).not.toBeNull()
    expect(r!.standardDecompositions).toBeDefined()
    expect(r!.standardDecompositions!.kind).toBe('empty-all-skipped')
    if (r!.standardDecompositions!.kind === 'empty-all-skipped') {
      expect(r!.standardDecompositions!.skippedCount).toBe(2)
    }
    expect(warnSpy).toHaveBeenCalled()
    // builder fallback: empty-all-skipped → built-in PMBOK still emitted
    const block = buildStandardDecompositionBlock(r!)
    expect(block).toContain('PMBOK')
    expect(block).toContain('project-integration-management')
    warnSpy.mockRestore()
  })

  // (5) component slug 충돌 first-wins (built-in 우선) + warn
  it('(5) component slug duplicate vs built-in → user component dropped + warn (first-wins)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const yaml = `
standard_decompositions:
  - name: MY-PM
    umbrella_slug: my-pm-framework
    rule: decompose
    require_explicit_mention: true
    components:
      - slug: project-cost-management
        type: methodology
      - slug: my-unique-area
        type: methodology
`
    const r = parseSchemaOverrideYaml(yaml)
    expect(r).not.toBeNull()
    expect(r!.standardDecompositions!.kind).toBe('present')
    if (r!.standardDecompositions!.kind === 'present') {
      const items = r!.standardDecompositions!.items
      expect(items).toHaveLength(1)
      // user's `project-cost-management` dropped (built-in already owns it)
      const slugs = items[0].components.map((c) => c.slug)
      expect(slugs).not.toContain('project-cost-management')
      expect(slugs).toContain('my-unique-area')
    }
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('decomposition component slug duplicate'),
    )
    warnSpy.mockRestore()
  })

  // (6) tab indentation 거부 + warn (Scrutiny c)
  it('(6) tab indentation rejected with warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const yaml = 'standard_decompositions:\n\t- name: TAB-INDENT\n\t  umbrella_slug: tab-indent\n\t  rule: decompose\n'
    parseSchemaOverrideYaml(yaml)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('tab'),
    )
    warnSpy.mockRestore()
  })

  // (7) components[].type invalid → component skip + warn
  it('(7) component type not in entity/concept union → component skip + warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const yaml = `
standard_decompositions:
  - name: ITIL-4
    umbrella_slug: itil-4
    rule: decompose
    components:
      - slug: service-strategy
        type: methodology
      - slug: bogus-component
        type: not-a-real-type
`
    const r = parseSchemaOverrideYaml(yaml)
    expect(r!.standardDecompositions!.kind).toBe('present')
    if (r!.standardDecompositions!.kind === 'present') {
      const slugs = r!.standardDecompositions!.items[0].components.map((c) => c.slug)
      expect(slugs).toContain('service-strategy')
      expect(slugs).not.toContain('bogus-component')
    }
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('not-a-real-type'),
    )
    warnSpy.mockRestore()
  })

  // (8) rule invalid → entry skip
  it('(8) invalid rule (not decompose|bundle) → entry skip', () => {
    const yaml = `
standard_decompositions:
  - name: INVALID-RULE
    umbrella_slug: invalid-rule
    rule: explode
    components:
      - slug: alpha
        type: methodology
  - name: OK-ENTRY
    umbrella_slug: ok-entry
    rule: bundle
    components:
      - slug: beta
        type: methodology
`
    const r = parseSchemaOverrideYaml(yaml)
    expect(r!.standardDecompositions!.kind).toBe('present')
    if (r!.standardDecompositions!.kind === 'present') {
      const items = r!.standardDecompositions!.items
      expect(items).toHaveLength(1)
      expect(items[0].name).toBe('OK-ENTRY')
    }
  })

  // (9) components[].aliases parsed + duplicate alias dropped within same component
  it('(9) component aliases parsed + same-entry duplicate alias skipped', () => {
    const yaml = `
standard_decompositions:
  - name: TEST-STD
    umbrella_slug: test-std
    rule: decompose
    components:
      - slug: my-component
        type: methodology
        aliases:
          - alt-slug-one
          - alt-slug-two
          - alt-slug-one
`
    const r = parseSchemaOverrideYaml(yaml)
    expect(r!.standardDecompositions!.kind).toBe('present')
    if (r!.standardDecompositions!.kind === 'present') {
      const comp = r!.standardDecompositions!.items[0].components[0]
      expect(comp.aliases).toEqual(['alt-slug-one', 'alt-slug-two'])
    }
  })
})

// ── §5.4.1 Stage 1: buildStandardDecompositionBlock (AC3) ──

describe('buildStandardDecompositionBlock (§5.4.1)', () => {
  // (a) override === undefined → built-in PMBOK
  it('(a) override undefined → built-in PMBOK block (10 components + 2 alternate slugs)', () => {
    const block = buildStandardDecompositionBlock(undefined)
    expect(block).toContain('PMBOK')
    expect(block).toContain('project-integration-management')
    expect(block).toContain('project-stakeholder-management')
    // F3 alternate slugs (legacy anchor)
    expect(block).toContain('project-time-management')
    expect(block).toContain('project-human-resource-management')
  })

  // (b) state undefined (override exists, field absent) → same anchors
  it('(b) state undefined (override has no standardDecompositions field) → built-in PMBOK', () => {
    const override: SchemaOverride = { entityTypes: [], conceptTypes: [] }
    const block = buildStandardDecompositionBlock(override)
    expect(block).toContain('PMBOK')
    expect(block).toContain('project-integration-management')
    expect(block).toContain('project-time-management')
  })

  // (c) empty-explicit → empty string
  it('(c) empty-explicit → empty string (PMBOK disabled)', () => {
    const override: SchemaOverride = {
      entityTypes: [],
      conceptTypes: [],
      standardDecompositions: { kind: 'empty-explicit' },
    }
    const block = buildStandardDecompositionBlock(override)
    expect(block).toBe('')
  })

  // (d) empty-all-skipped → built-in PMBOK fallback
  it('(d) empty-all-skipped → built-in PMBOK fallback (silent disable 방지)', () => {
    const override: SchemaOverride = {
      entityTypes: [],
      conceptTypes: [],
      standardDecompositions: { kind: 'empty-all-skipped', skippedCount: 2 },
    }
    const block = buildStandardDecompositionBlock(override)
    expect(block).toContain('PMBOK')
    expect(block).toContain('project-integration-management')
  })

  // (e) present → built-in + user items both rendered (F1 append)
  it('(e) present (ISO-27001) → built-in PMBOK + ISO-27001 both rendered (F1 append)', () => {
    const override: SchemaOverride = {
      entityTypes: [],
      conceptTypes: [],
      standardDecompositions: {
        kind: 'present',
        items: [{
          name: 'ISO-27001',
          aliases: ['Information Security Management'],
          umbrella_slug: 'iso-27001',
          rule: 'decompose',
          require_explicit_mention: true,
          origin: 'user-yaml',
          components: [
            { slug: 'a-5-organizational-controls', type: 'standard' },
            { slug: 'a-6-people-controls', type: 'standard' },
          ],
        }],
      },
    }
    const block = buildStandardDecompositionBlock(override)
    expect(block).toContain('PMBOK')
    expect(block).toContain('project-integration-management')
    expect(block).toContain('ISO-27001')
    expect(block).toContain('a-5-organizational-controls')
    expect(block).toContain('a-6-people-controls')
  })

  // bundle rule
  it('(e2) bundle rule → umbrella-only line, no per-component decomposition', () => {
    const override: SchemaOverride = {
      entityTypes: [],
      conceptTypes: [],
      standardDecompositions: {
        kind: 'present',
        items: [{
          name: 'GDPR-CORE',
          aliases: [],
          umbrella_slug: 'gdpr-core',
          rule: 'bundle',
          require_explicit_mention: true,
          origin: 'user-yaml',
          components: [
            { slug: 'data-protection', type: 'standard' },
          ],
        }],
      },
    }
    const block = buildStandardDecompositionBlock(override)
    expect(block).toContain('GDPR-CORE')
    expect(block).toContain('bundle')
    expect(block).toContain('gdpr-core')
  })
})

// ── BUILTIN_STANDARD_DECOMPOSITIONS sanity ──

describe('BUILTIN_STANDARD_DECOMPOSITIONS', () => {
  it('exports PMBOK with 10 components and 2 alternate slugs', () => {
    expect(BUILTIN_STANDARD_DECOMPOSITIONS).toHaveLength(1)
    const pmbok = BUILTIN_STANDARD_DECOMPOSITIONS[0]
    expect(pmbok.name).toBe('PMBOK')
    expect(pmbok.components).toHaveLength(10)
    const sched = pmbok.components.find((c) => c.slug === 'project-schedule-management')
    expect(sched?.aliases).toContain('project-time-management')
    const res = pmbok.components.find((c) => c.slug === 'project-resource-management')
    expect(res?.aliases).toContain('project-human-resource-management')
  })
})
