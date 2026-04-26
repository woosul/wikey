import { describe, it, expect } from 'vitest'
import { appendStandardDecomposition } from '../schema-yaml-writer.js'
import type { Suggestion, WikiFS } from '../types.js'

/**
 * §5.4 Stage 2 AC7 — section-range insertion writer for `.wikey/schema.yaml`.
 * Spec ref: plan/phase-5-todox-5.4-integration.md §3.2.5.
 */

function makeFS(initial: Record<string, string> = {}): WikiFS & { _files: Record<string, string> } {
  const files: Record<string, string> = { ...initial }
  return {
    _files: files,
    async read(path: string): Promise<string> {
      if (!(path in files)) throw new Error(`ENOENT: ${path}`)
      return files[path]
    },
    async write(path: string, content: string): Promise<void> {
      files[path] = content
    },
    async exists(path: string): Promise<boolean> {
      return path in files
    },
    async list(): Promise<string[]> {
      return Object.keys(files)
    },
  }
}

const sample = (overrides: Partial<Suggestion> = {}): Suggestion => ({
  id: 'sha1-iso-27001',
  umbrella_slug: 'iso-27001',
  umbrella_name: 'ISO 27001',
  candidate_components: [
    { slug: 'iso-27001-a-5', type: 'methodology' },
    { slug: 'iso-27001-a-6', type: 'methodology', aliases: ['legacy-iso-a6'] },
  ],
  support_count: 3,
  suffix_score: 0.85,
  mention_count: 17,
  confidence: 0.72,
  evidence: [],
  state: { kind: 'pending' },
  createdAt: '2026-05-01T12:34:56Z',
  updatedAt: '2026-05-01T12:34:56Z',
  ...overrides,
})

describe('appendStandardDecomposition — schema.yaml writer', () => {
  it('creates a new standard_decompositions section at EOF when key is absent (preserves prior content)', async () => {
    const fs = makeFS({
      '.wikey/schema.yaml':
        `entity_types:\n  - name: dataset\n    description: foo\n`,
    })
    const out = await appendStandardDecomposition(fs, sample())
    expect(out.appended).toBe(true)
    expect(out.reason).toBeUndefined()

    const written = fs._files['.wikey/schema.yaml']
    // Preserves prior entity_types entry verbatim.
    expect(written).toContain('entity_types:')
    expect(written).toContain('- name: dataset')
    // Adds standard_decompositions header + entry.
    expect(written).toContain('standard_decompositions:')
    expect(written).toContain('umbrella_slug: iso-27001')
    expect(written).toContain('confidence: 0.72')
    expect(written).toContain('origin: suggested')
    expect(written).toContain('aliases:')
    expect(written).toContain('- legacy-iso-a6')
  })

  it('is idempotent — second call with same umbrella_slug returns already-exists and does not modify file', async () => {
    const fs = makeFS()
    await appendStandardDecomposition(fs, sample())
    const after1 = fs._files['.wikey/schema.yaml']
    const out2 = await appendStandardDecomposition(fs, sample())
    expect(out2.appended).toBe(false)
    expect(out2.reason).toBe('already-exists')
    expect(fs._files['.wikey/schema.yaml']).toBe(after1)
  })

  it('refuses to write when standard_decompositions: [] (user explicit disable) — header-unsafe', async () => {
    const before = `entity_types: []\nstandard_decompositions: []\n`
    const fs = makeFS({ '.wikey/schema.yaml': before })
    const out = await appendStandardDecomposition(fs, sample())
    expect(out.appended).toBe(false)
    expect(out.reason).toBe('header-unsafe')
    // File unchanged.
    expect(fs._files['.wikey/schema.yaml']).toBe(before)
  })

  it('refuses umbrella_slug or component slug that does not match parser regex (round-trip safety, post-impl HIGH fix)', async () => {
    const fs = makeFS()
    // (a) wildcard prefix `*-management` (legacy detector output) — invalid
    const invalid = sample({ umbrella_slug: '*-management' })
    const out1 = await appendStandardDecomposition(fs, invalid)
    expect(out1.appended).toBe(false)
    expect(out1.reason).toBe('invalid-slug')
    expect(fs._files['.wikey/schema.yaml']).toBeUndefined()

    // (b) component slug 의 invalid char (uppercase, underscore) — invalid
    const invalidComp = sample({
      candidate_components: [{ slug: 'ISO_27001_A_5', type: 'methodology' }],
    })
    const out2 = await appendStandardDecomposition(fs, invalidComp)
    expect(out2.appended).toBe(false)
    expect(out2.reason).toBe('invalid-slug')
  })
})
