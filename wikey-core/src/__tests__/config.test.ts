import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parseWikeyConf, resolveProvider } from '../config.js'
import type { WikeyConfig } from '../types.js'

describe('parseWikeyConf', () => {
  it('parses key=value pairs', () => {
    const content = 'WIKEY_BASIC_MODEL=gemini\nWIKEY_QMD_TOP_N=5'
    const result = parseWikeyConf(content)
    expect(result.WIKEY_BASIC_MODEL).toBe('gemini')
    expect(result.WIKEY_QMD_TOP_N).toBe(5)
  })

  it('skips comment lines', () => {
    const content = '# This is a comment\nWIKEY_BASIC_MODEL=gemini\n# Another comment'
    const result = parseWikeyConf(content)
    expect(result.WIKEY_BASIC_MODEL).toBe('gemini')
  })

  it('skips empty lines', () => {
    const content = '\nWIKEY_BASIC_MODEL=gemini\n\n\nWIKEY_MODEL=wikey\n'
    const result = parseWikeyConf(content)
    expect(result.WIKEY_BASIC_MODEL).toBe('gemini')
    expect(result.WIKEY_MODEL).toBe('wikey')
  })

  it('strips inline comments', () => {
    const content = 'WIKEY_BASIC_MODEL=gemini  # default model'
    const result = parseWikeyConf(content)
    expect(result.WIKEY_BASIC_MODEL).toBe('gemini')
  })

  it('trims whitespace from keys and values', () => {
    const content = '  WIKEY_BASIC_MODEL  =  ollama  '
    const result = parseWikeyConf(content)
    expect(result.WIKEY_BASIC_MODEL).toBe('ollama')
  })

  it('skips commented-out settings', () => {
    const content = '# INGEST_PROVIDER=gemini\nWIKEY_BASIC_MODEL=claude-code'
    const result = parseWikeyConf(content)
    expect(result.INGEST_PROVIDER).toBeUndefined()
    expect(result.WIKEY_BASIC_MODEL).toBe('claude-code')
  })

  it('handles the full wikey.conf format', () => {
    const content = `# wikey.conf
WIKEY_BASIC_MODEL=claude-code
WIKEY_SEARCH_BACKEND=basic
WIKEY_MODEL=wikey
WIKEY_QMD_TOP_N=5
CONTEXTUAL_MODEL=gemma4
SUMMARIZE_PROVIDER=gemini
GEMINI_MODEL=gemini-2.5-flash
INGEST_MODEL=opus
# INGEST_PROVIDER=gemini
# OLLAMA_URL=http://localhost:11434`

    const result = parseWikeyConf(content)
    expect(result.WIKEY_BASIC_MODEL).toBe('claude-code')
    expect(result.WIKEY_SEARCH_BACKEND).toBe('basic')
    expect(result.WIKEY_MODEL).toBe('wikey')
    expect(result.WIKEY_QMD_TOP_N).toBe(5)
    expect(result.CONTEXTUAL_MODEL).toBe('gemma4')
    expect(result.SUMMARIZE_PROVIDER).toBe('gemini')
    expect(result.INGEST_PROVIDER).toBeUndefined()
  })
})

describe('resolveProvider', () => {
  const baseConfig: WikeyConfig = {
    WIKEY_BASIC_MODEL: 'claude-code',
    WIKEY_SEARCH_BACKEND: 'basic',
    WIKEY_MODEL: 'wikey',
    WIKEY_QMD_TOP_N: 5,
    GEMINI_API_KEY: '',
    ANTHROPIC_API_KEY: 'sk-ant-xxx',
    OPENAI_API_KEY: '',
    OLLAMA_URL: 'http://localhost:11434',
    INGEST_PROVIDER: '',
    LINT_PROVIDER: '',
    SUMMARIZE_PROVIDER: '',
    CONTEXTUAL_MODEL: 'gemma4',
    COST_LIMIT: 50,
  }

  it('returns BASIC_MODEL for default process', () => {
    const result = resolveProvider('default', baseConfig)
    expect(result.provider).toBe('anthropic')
  })

  it('uses INGEST_PROVIDER override when set', () => {
    const config = { ...baseConfig, INGEST_PROVIDER: 'gemini' }
    const result = resolveProvider('ingest', config)
    expect(result.provider).toBe('gemini')
  })

  it('falls back to BASIC_MODEL for ingest when no override', () => {
    const result = resolveProvider('ingest', baseConfig)
    expect(result.provider).toBe('anthropic')
  })

  it('uses LINT_PROVIDER override when set', () => {
    const config = { ...baseConfig, LINT_PROVIDER: 'openai' }
    const result = resolveProvider('lint', config)
    expect(result.provider).toBe('openai')
  })

  it('uses SUMMARIZE_PROVIDER override when set', () => {
    const config = { ...baseConfig, SUMMARIZE_PROVIDER: 'gemini' }
    const result = resolveProvider('summarize', config)
    expect(result.provider).toBe('gemini')
  })

  it('returns ollama for cr process', () => {
    const result = resolveProvider('cr', baseConfig)
    expect(result.provider).toBe('ollama')
    expect(result.model).toBe('gemma4')
  })

  it('resolves claude-code to anthropic when API key present', () => {
    const result = resolveProvider('default', baseConfig)
    expect(result.provider).toBe('anthropic')
  })

  it('resolves claude-code to ollama when no API key', () => {
    const config = { ...baseConfig, ANTHROPIC_API_KEY: '' }
    const result = resolveProvider('default', config)
    expect(result.provider).toBe('ollama')
  })

  it('resolves ollama provider correctly', () => {
    const config = { ...baseConfig, WIKEY_BASIC_MODEL: 'ollama' }
    const result = resolveProvider('default', config)
    expect(result.provider).toBe('ollama')
  })

  it('resolves gemini provider correctly', () => {
    const config = { ...baseConfig, WIKEY_BASIC_MODEL: 'gemini' }
    const result = resolveProvider('default', config)
    expect(result.provider).toBe('gemini')
  })
})
