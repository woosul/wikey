import type { WikeyConfig, LLMProvider } from './types.js'

const NUMERIC_KEYS = new Set(['WIKEY_QMD_TOP_N', 'COST_LIMIT'])

const DEFAULTS: WikeyConfig = {
  WIKEY_BASIC_MODEL: 'claude-code',
  WIKEY_SEARCH_BACKEND: 'basic',
  WIKEY_MODEL: 'wikey',
  WIKEY_QMD_TOP_N: 5,
  GEMINI_API_KEY: '',
  ANTHROPIC_API_KEY: '',
  OPENAI_API_KEY: '',
  OLLAMA_URL: 'http://localhost:11434',
  INGEST_PROVIDER: '',
  LINT_PROVIDER: '',
  SUMMARIZE_PROVIDER: '',
  CONTEXTUAL_MODEL: 'gemma4',
  COST_LIMIT: 50,
}

export function parseWikeyConf(content: string): Partial<WikeyConfig> {
  const result: Record<string, string | number> = {}

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue

    const eqIdx = line.indexOf('=')
    if (eqIdx === -1) continue

    const key = line.slice(0, eqIdx).trim()
    const rawValue = line.slice(eqIdx + 1)
    const value = rawValue.replace(/#.*$/, '').trim()

    if (key === '' || value === '') continue

    result[key] = NUMERIC_KEYS.has(key) ? Number(value) : value
  }

  return result as Partial<WikeyConfig>
}

export function loadConfig(projectDir: string): WikeyConfig {
  // Phase 3-1-A: 파일시스템 기반 구현 (테스트 외 실제 환경)
  // 우선순위: 환경변수 > wikey.conf > 기본값
  // .env 파일은 Obsidian 플러그인에서 별도 처리
  void projectDir
  return { ...DEFAULTS }
}

export function resolveProvider(
  process: string,
  config: WikeyConfig,
): { provider: LLMProvider; model: string } {
  const basicModel = config.WIKEY_BASIC_MODEL || 'claude-code'

  let resolved: string
  switch (process) {
    case 'ingest':
      resolved = config.INGEST_PROVIDER || basicModel
      break
    case 'lint':
      resolved = config.LINT_PROVIDER || basicModel
      break
    case 'summarize':
      resolved = config.SUMMARIZE_PROVIDER || basicModel
      break
    case 'cr':
      return {
        provider: 'ollama',
        model: config.CONTEXTUAL_MODEL || 'gemma4',
      }
    default:
      resolved = basicModel
  }

  return mapToProvider(resolved, config)
}

function mapToProvider(
  name: string,
  config: WikeyConfig,
): { provider: LLMProvider; model: string } {
  switch (name) {
    case 'gemini':
      return { provider: 'gemini', model: 'gemini-2.5-flash' }
    case 'anthropic':
      return { provider: 'anthropic', model: 'claude-sonnet-4-20250514' }
    case 'openai':
    case 'codex':
      return { provider: 'openai', model: 'gpt-4.1' }
    case 'ollama':
    case 'local':
      return { provider: 'ollama', model: config.WIKEY_MODEL || 'gemma4' }
    case 'claude-code':
      if (config.ANTHROPIC_API_KEY) {
        return { provider: 'anthropic', model: 'claude-sonnet-4-20250514' }
      }
      return { provider: 'ollama', model: config.WIKEY_MODEL || 'gemma4' }
    default:
      return { provider: 'ollama', model: config.WIKEY_MODEL || 'gemma4' }
  }
}
