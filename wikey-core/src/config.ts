import type { WikeyConfig, LLMProvider } from './types.js'
import { PROVIDER_CHAT_DEFAULTS, CONTEXTUAL_DEFAULT_MODEL } from './provider-defaults.js'

const NUMERIC_KEYS = new Set([
  // §5.7.5 — WIKEY_SEARCH_TOP_N (canonical) + WIKEY_QMD_TOP_N (deprecated alias).
  'WIKEY_SEARCH_TOP_N', 'WIKEY_QMD_TOP_N',
  'OCR_DPI', 'OCR_PARALLEL', 'OCR_MAX_PAGES',
  'DOCLING_TIMEOUT_MS',
  // §5.7.7 — Hybrid search env override (RRF k).
  'WIKEY_RRF_K',
])
const BOOLEAN_KEYS = new Set(['DOCLING_DISABLE', 'WIKEY_EXTRACTION_DETERMINISM'])

const DEFAULTS: WikeyConfig = {
  WIKEY_BASIC_MODEL: 'claude-code',
  WIKEY_SEARCH_BACKEND: 'basic',
  WIKEY_SEARCH_ENGINE: 'orama',
  WIKEY_MODEL: 'wikey',
  WIKEY_QMD_TOP_N: 8,
  // §5.7.5 cycle #4 fix — WIKEY_SEARCH_TOP_N (optional canonical) 는 DEFAULTS 에서 omit.
  // default 가 명시되면 user 의 deprecated WIKEY_QMD_TOP_N=N override 가 차단됨
  // (Object.assign(DEFAULTS, parsedConf) 시 user 가 canonical 미명시 → DEFAULTS 의 8
  // 그대로 잔존 → getSearchTopN canonical=8 우선 → deprecated N 무시).
  // omit 후 type-wise 정합 (types.ts: `readonly WIKEY_SEARCH_TOP_N?: number`).
  GEMINI_API_KEY: '',
  ANTHROPIC_API_KEY: '',
  OPENAI_API_KEY: '',
  OLLAMA_URL: 'http://localhost:11434',
  INGEST_PROVIDER: '',
  LINT_PROVIDER: '',
  SUMMARIZE_PROVIDER: '',
  CONTEXTUAL_MODEL: CONTEXTUAL_DEFAULT_MODEL,
  // §5.6.4 v0.7 — per-provider auth mode defaults (user plan 2026-05-14).
  // 'auto' polished out. 'subscription' is the v0.7 default: subscription-first
  // intent preserved (most users have CLI OAuth set up) but failure now surfaces
  // a Notice instead of silently spending API-key credit. Users explicitly
  // switch to 'api' or 'none' from the Settings UI when needed.
  GEMINI_AUTH_MODE: 'subscription',
  ANTHROPIC_AUTH_MODE: 'subscription',
  OPENAI_AUTH_MODE: 'subscription',
}

/**
 * §5.7.5 cycle #3 fix — Resolve canonical search top-N with backward-compat fallback.
 * Priority: WIKEY_SEARCH_TOP_N > WIKEY_QMD_TOP_N (deprecated) > 8 (default).
 * Used by query-pipeline.ts (qmd + Orama paths) so the alias is honored end-to-end.
 */
export function getSearchTopN(config: WikeyConfig): number {
  if (typeof config.WIKEY_SEARCH_TOP_N === 'number' && config.WIKEY_SEARCH_TOP_N > 0) {
    return config.WIKEY_SEARCH_TOP_N
  }
  if (typeof config.WIKEY_QMD_TOP_N === 'number' && config.WIKEY_QMD_TOP_N > 0) {
    return config.WIKEY_QMD_TOP_N
  }
  return 8
}

export function parseWikeyConf(content: string): Partial<WikeyConfig> {
  const result: Record<string, string | number> = {}
  // §5.7.5 — deprecation warn for WIKEY_QMD_TOP_N is emitted at most once per parse.
  let qmdTopNWarned = false

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue

    const eqIdx = line.indexOf('=')
    if (eqIdx === -1) continue

    const key = line.slice(0, eqIdx).trim()
    const rawValue = line.slice(eqIdx + 1)
    const value = rawValue.replace(/#.*$/, '').trim()

    if (key === '' || value === '') continue

    if (NUMERIC_KEYS.has(key)) {
      result[key] = Number(value)
      if (key === 'WIKEY_QMD_TOP_N' && !qmdTopNWarned) {
        // eslint-disable-next-line no-console
        console.warn('[wikey] WIKEY_QMD_TOP_N is deprecated, use WIKEY_SEARCH_TOP_N')
        qmdTopNWarned = true
      }
    } else if (BOOLEAN_KEYS.has(key)) {
      ;(result as Record<string, unknown>)[key] = value === 'true' || value === '1' || value.toLowerCase() === 'yes'
    } else {
      result[key] = value
    }
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
    case 'classify': {
      // §4.2.3 S3-2: CLASSIFY_PROVIDER 설정 시 해당 provider 체인, 미설정 시 ingest 승계.
      // CLASSIFY_MODEL 은 두 경로 모두에서 모델만 override.
      if (config.CLASSIFY_PROVIDER) {
        const mapped = mapToProvider(config.CLASSIFY_PROVIDER, config)
        return { provider: mapped.provider, model: config.CLASSIFY_MODEL || mapped.model }
      }
      const inherited = resolveProvider('ingest', config)
      return { provider: inherited.provider, model: config.CLASSIFY_MODEL || inherited.model }
    }
    case 'cr':
      return {
        provider: 'ollama',
        model: config.CONTEXTUAL_MODEL || CONTEXTUAL_DEFAULT_MODEL,
      }
    default:
      resolved = basicModel
  }

  return mapToProvider(resolved, config)
}

// PROVIDER defaults moved to provider-defaults.ts (single source of truth).
// Imported below as PROVIDER_CHAT_DEFAULTS.

function mapToProvider(
  name: string,
  config: WikeyConfig,
): { provider: LLMProvider; model: string } {
  const userModel = config.WIKEY_MODEL && config.WIKEY_MODEL !== 'wikey' ? config.WIKEY_MODEL : ''

  switch (name) {
    case 'gemini':
      return { provider: 'gemini', model: userModel || PROVIDER_CHAT_DEFAULTS.gemini }
    case 'anthropic':
      return { provider: 'anthropic', model: userModel || PROVIDER_CHAT_DEFAULTS.anthropic }
    case 'openai':
    case 'codex':
      return { provider: 'openai', model: userModel || PROVIDER_CHAT_DEFAULTS.openai }
    case 'ollama':
    case 'local':
      return { provider: 'ollama', model: userModel || config.WIKEY_MODEL || PROVIDER_CHAT_DEFAULTS.ollama }
    case 'claude-code':
      if (config.ANTHROPIC_API_KEY) {
        return { provider: 'anthropic', model: userModel || PROVIDER_CHAT_DEFAULTS.anthropic }
      }
      return { provider: 'ollama', model: userModel || config.WIKEY_MODEL || PROVIDER_CHAT_DEFAULTS.ollama }
    default:
      return { provider: 'ollama', model: userModel || config.WIKEY_MODEL || PROVIDER_CHAT_DEFAULTS.ollama }
  }
}
