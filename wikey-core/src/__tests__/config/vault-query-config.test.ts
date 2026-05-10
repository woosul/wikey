/**
 * §5.7.8 Spec 6 — vault-query-config tests (AC-F8 + AC-F9).
 */

import { describe, it, expect } from 'vitest'

import {
  parseVaultQueryHintYaml,
  buildVaultHintPromptBlock,
  loadVaultQueryConfig,
  EMPTY_VAULT_QUERY_HINT,
  VAULT_QUERY_CONFIG_PATH,
  VAULT_FILTER_PROMPT_PATH,
  type VaultFileReader,
} from '../../config/vault-query-config.js'

function makeReader(files: Record<string, string>): VaultFileReader {
  return {
    async exists(p: string) { return Object.prototype.hasOwnProperty.call(files, p) },
    async read(p: string) {
      if (!Object.prototype.hasOwnProperty.call(files, p)) throw new Error(`ENOENT ${p}`)
      return files[p]
    },
  }
}

describe('vault-query-config — AC-F8 parser', () => {
  it('parses domainMarkers + priorityKeep lists', () => {
    const yaml = [
      'domainMarkers:',
      '  - 프로젝트',
      '  - PMBOK',
      'priorityKeep:',
      '  - 핵심 단어',
      '  - "rare-token"',
    ].join('\n')
    const hint = parseVaultQueryHintYaml(yaml)
    expect(hint.domainMarkers).toEqual(['프로젝트', 'PMBOK'])
    expect(hint.priorityKeep).toEqual(['핵심 단어', 'rare-token'])
  })

  it('empty input returns the canonical empty hint', () => {
    expect(parseVaultQueryHintYaml('')).toBe(EMPTY_VAULT_QUERY_HINT)
    expect(parseVaultQueryHintYaml('\n\n  \n')).toBe(EMPTY_VAULT_QUERY_HINT)
  })

  it('unknown top-level keys are ignored, returning empty section', () => {
    const yaml = 'mystery:\n  - x\n  - y\n'
    const hint = parseVaultQueryHintYaml(yaml)
    expect(hint.domainMarkers).toEqual([])
    expect(hint.priorityKeep).toEqual([])
  })

  it('buildVaultHintPromptBlock produces an inline-able description', () => {
    const block = buildVaultHintPromptBlock({
      domainMarkers: ['PMBOK'],
      priorityKeep: ['프로젝트'],
    })
    expect(block).toContain('PMBOK')
    expect(block).toContain('프로젝트')
  })
})

describe('vault-query-config — AC-F9 loader (yaml-only / prompt-only allowed)', () => {
  it('yaml + prompt overrides both load when present', async () => {
    const reader = makeReader({
      [VAULT_QUERY_CONFIG_PATH]: 'domainMarkers:\n  - PMBOK\n',
      [VAULT_FILTER_PROMPT_PATH]: '# overridden filter prompt',
    })
    const result = await loadVaultQueryConfig(reader)
    expect(result.hint.domainMarkers).toEqual(['PMBOK'])
    expect(result.filterPromptOverride).toBe('# overridden filter prompt')
  })

  it('Missing yaml + missing prompt → empty hint, all overrides undefined', async () => {
    const reader = makeReader({})
    const result = await loadVaultQueryConfig(reader)
    expect(result.hint.domainMarkers).toEqual([])
    expect(result.filterPromptOverride).toBeUndefined()
    expect(result.rewriterPromptOverride).toBeUndefined()
    expect(result.expanderPromptOverride).toBeUndefined()
  })

  it('Read failure on yaml → fallback to empty hint + console.warn (no throw)', async () => {
    const reader: VaultFileReader = {
      async exists() { return true },
      async read() { throw new Error('I/O') },
    }
    const result = await loadVaultQueryConfig(reader)
    expect(result.hint).toBe(EMPTY_VAULT_QUERY_HINT)
  })
})
