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
  const config = { ...DEFAULTS }

  // 1. wikey.conf 읽기
  try {
    const fs = require('node:fs') as typeof import('node:fs')
    const path = require('node:path') as typeof import('node:path')
    const confPath = path.join(projectDir, 'wikey.conf')
    const content = fs.readFileSync(confPath, 'utf-8')
    Object.assign(config, parseWikeyConf(content))
  } catch {
    // 파일 없음
  }

  // 2. credentials.json 읽기
  try {
    const fs = require('node:fs') as typeof import('node:fs')
    const path = require('node:path') as typeof import('node:path')
    const os = require('node:os') as typeof import('node:os')
    const credPath = path.join(os.homedir(), '.config', 'wikey', 'credentials.json')
    const cred = JSON.parse(fs.readFileSync(credPath, 'utf-8'))
    if (cred.geminiApiKey && !config.GEMINI_API_KEY) config.GEMINI_API_KEY = cred.geminiApiKey
    if (cred.anthropicApiKey && !config.ANTHROPIC_API_KEY) config.ANTHROPIC_API_KEY = cred.anthropicApiKey
    if (cred.openaiApiKey && !config.OPENAI_API_KEY) config.OPENAI_API_KEY = cred.openaiApiKey
  } catch {
    // 파일 없음
  }

  return config
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

const PROVIDER_DEFAULTS: Record<string, string> = {
  gemini: 'gemini-2.5-flash',
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4.1',
  ollama: 'gemma4',
}

function mapToProvider(
  name: string,
  config: WikeyConfig,
): { provider: LLMProvider; model: string } {
  const userModel = config.WIKEY_MODEL && config.WIKEY_MODEL !== 'wikey' ? config.WIKEY_MODEL : ''

  switch (name) {
    case 'gemini':
      return { provider: 'gemini', model: userModel || PROVIDER_DEFAULTS.gemini }
    case 'anthropic':
      return { provider: 'anthropic', model: userModel || PROVIDER_DEFAULTS.anthropic }
    case 'openai':
    case 'codex':
      return { provider: 'openai', model: userModel || PROVIDER_DEFAULTS.openai }
    case 'ollama':
    case 'local':
      return { provider: 'ollama', model: userModel || config.WIKEY_MODEL || PROVIDER_DEFAULTS.ollama }
    case 'claude-code':
      if (config.ANTHROPIC_API_KEY) {
        return { provider: 'anthropic', model: userModel || PROVIDER_DEFAULTS.anthropic }
      }
      return { provider: 'ollama', model: userModel || config.WIKEY_MODEL || PROVIDER_DEFAULTS.ollama }
    default:
      return { provider: 'ollama', model: userModel || config.WIKEY_MODEL || PROVIDER_DEFAULTS.ollama }
  }
}
