/**
 * §5.6.5 Step A — Ollama Cloud model catalog (single source of truth).
 *
 * Catalog locked from PoC §0 master direct probe (2026-05-14):
 *   plan/phase-5/fixtures/cycle-5.6.5-ollama-cloud-poc/SUMMARY.md §1
 *
 * Why a single file: catalog changes (new cloud models, removed models,
 * capability shifts) must edit exactly one location. Karpathy "Yours"
 * principle (BYOAI ownership) + feedback_no_hardcoding_general.md LOCK —
 * no `:cloud` literal scattered across callsites; every check funnels
 * through `isCloudModel(modelId)` here.
 *
 * Provider key: 'ollama-cloud' is a UI subsection + credential separation
 * label only. PoC §0 §2 confirmed transport identical to local Ollama
 * (`localhost:11434/api/chat`). The runtime cloud branch in `callOllama`
 * adds (a) debug log + (b) M5 markdown ```json``` strip — nothing else.
 *
 * jsonMode flavor:
 *   - 'native'        : M1~M4 + L1 return raw JSON to `format:json`.
 *   - 'markdown-wrap' : M5 mistral-large-3 wraps in ```json``` block;
 *                       callOllama strips the fence post-fetch.
 *   - 'adaptive'      : L2 qwen3.6 mlx runner rejects `format:json`;
 *                       caller must use adaptive prefix (JSON_ONLY_PROMPT_PREFIX).
 *                       Local-only — not present in CLOUD_MODEL_CATALOG.
 */

export interface CloudModelEntry {
  /** Exact Ollama identifier passed to `/api/chat` body.model. */
  readonly id: string
  /** Capability tags from `ollama show <id>` (PoC §0 capture). */
  readonly capabilities: readonly ('completion' | 'tools' | 'thinking' | 'vision')[]
  /** Context window in tokens. 32_000 fallback when `ollama show` returns "unknown". */
  readonly contextTokens: number
  /** Response shape under `format:json`. M5 only emits markdown wrap; M1~M4 native. */
  readonly jsonMode: 'native' | 'markdown-wrap'
}

export const CLOUD_MODEL_CATALOG: readonly CloudModelEntry[] = [
  {
    id: 'deepseek-v3.1:671b-cloud',
    capabilities: ['completion', 'tools', 'thinking'],
    contextTokens: 32_000,
    jsonMode: 'native',
  },
  {
    id: 'qwen3-coder:480b-cloud',
    capabilities: ['completion', 'tools'],
    contextTokens: 32_000,
    jsonMode: 'native',
  },
  {
    id: 'kimi-k2.6:cloud',
    capabilities: ['vision', 'thinking', 'completion', 'tools'],
    contextTokens: 32_000,
    jsonMode: 'native',
  },
  {
    id: 'gpt-oss:120b-cloud',
    capabilities: ['completion', 'tools', 'thinking'],
    contextTokens: 131_072,
    jsonMode: 'native',
  },
  {
    id: 'mistral-large-3:675b-cloud',
    capabilities: ['completion', 'tools', 'vision'],
    contextTokens: 262_144,
    jsonMode: 'markdown-wrap',
  },
] as const

/**
 * Whether a model identifier is an Ollama Cloud model. Catalog lookup first
 * (locked 5 PoC §0 entries), then `:cloud` suffix fallback so new cloud
 * models from upstream Ollama dispatch correctly before the catalog catches up.
 */
export function isCloudModel(modelId: string): boolean {
  if (!modelId) return false
  if (CLOUD_MODEL_CATALOG.some((e) => e.id === modelId)) return true
  // PoC §0 SUMMARY.md §1 — 4/5 catalogued ids use `-cloud` suffix
  // (deepseek/qwen3-coder/gpt-oss/mistral-large-3), 1/5 uses bare `:cloud`
  // (kimi-k2.6). Future Ollama uploads may follow either convention.
  return /\w[-:]cloud(?:$|[-:])/.test(modelId)
}

/** Optional catalog lookup for downstream callers (jsonMode flavor, capabilities). */
export function lookupCloudModel(modelId: string): CloudModelEntry | undefined {
  return CLOUD_MODEL_CATALOG.find((e) => e.id === modelId)
}
