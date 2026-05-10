/**
 * §5.7.8 Spec 6 — vault-level customisation: `.wikey/query-filter.yaml` + prompt overrides.
 *
 * Minimal parser (mirrors `promotion-config.ts:25` shape) — accepts the two list fields
 * `domainMarkers:` and `priorityKeep:`. Anything else is ignored (forward-compat).
 *
 * Spec invariants:
 *  - I25 vault hint comes from user-authored YAML — not a hardcoded list (anchor (k) safe).
 *  - I26 vault override wins over wikey-core defaults (yaml-only / prompt-only allowed).
 *  - I27 parse failure → empty hint + console warn, never throws (fail-open, search 0 회귀).
 */

export const VAULT_QUERY_CONFIG_PATH = '.wikey/query-filter.yaml'
export const VAULT_FILTER_PROMPT_PATH = '.wikey/prompts/query-intent-filter.prompt.md'
export const VAULT_REWRITER_PROMPT_PATH = '.wikey/prompts/query-rewriter.prompt.md'
export const VAULT_EXPANDER_PROMPT_PATH = '.wikey/prompts/query-expander.prompt.md'

export interface VaultQueryHint {
  readonly domainMarkers: readonly string[]
  readonly priorityKeep: readonly string[]
}

export const EMPTY_VAULT_QUERY_HINT: VaultQueryHint = Object.freeze({
  domainMarkers: Object.freeze([] as readonly string[]),
  priorityKeep: Object.freeze([] as readonly string[]),
})

/**
 * Parse the minimal YAML shape:
 *   domainMarkers:
 *     - 프로젝트
 *     - PMBOK
 *   priorityKeep:
 *     - 핵심 단어
 *
 * Unknown top-level keys are ignored. Empty input or a parse error returns the empty hint.
 */
export function parseVaultQueryHintYaml(input: string): VaultQueryHint {
  if (!input || !input.trim()) return EMPTY_VAULT_QUERY_HINT
  const lines = input.split(/\r?\n/)
  const sections: Record<string, string[]> = {}
  let current: string | null = null

  for (const rawLine of lines) {
    // Strip trailing comments and surrounding whitespace; preserve indentation cue.
    const noComment = rawLine.replace(/\s+#.*$/, '').replace(/^#.*$/, '')
    if (!noComment.trim()) continue
    const headerMatch = noComment.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*$/)
    if (headerMatch) {
      current = headerMatch[1]
      sections[current] = []
      continue
    }
    const itemMatch = noComment.match(/^\s*-\s*(.+?)\s*$/)
    if (itemMatch && current) {
      sections[current].push(stripQuotes(itemMatch[1]))
      continue
    }
    // Unknown shape — reset current section to avoid mis-attributing later lines.
    current = null
  }

  return {
    domainMarkers: Object.freeze(sections.domainMarkers ?? []),
    priorityKeep: Object.freeze(sections.priorityKeep ?? []),
  }
}

function stripQuotes(value: string): string {
  const m = value.match(/^["'](.*)["']$/)
  return m ? m[1] : value
}

/**
 * Build the `{{VAULT_HINT_BLOCK}}` substitution for the filter prompt. Empty hint produces
 * a short "no hint provided" sentence so the prompt remains well-formed.
 */
export function buildVaultHintPromptBlock(hint: VaultQueryHint): string {
  const markers = hint.domainMarkers.filter((s) => s.trim().length > 0)
  const keep = hint.priorityKeep.filter((s) => s.trim().length > 0)
  if (markers.length === 0 && keep.length === 0) {
    return '(No vault-specific hints provided. Use only the query semantics.)'
  }
  const lines: string[] = []
  if (markers.length > 0) {
    lines.push(`Preferred domain markers for this vault: ${markers.join(', ')}`)
  }
  if (keep.length > 0) {
    lines.push(`Priority-keep tokens for this vault: ${keep.join(', ')}`)
  }
  return lines.join('\n')
}

/**
 * Minimal async file reader contract — both wikey-obsidian (vault adapter) and tests
 * (in-memory map) implement this. Kept narrow to avoid pulling WikiFS into the search layer.
 */
export interface VaultFileReader {
  exists(path: string): Promise<boolean>
  read(path: string): Promise<string>
}

export interface LoadVaultQueryConfigResult {
  readonly hint: VaultQueryHint
  readonly filterPromptOverride?: string
  readonly rewriterPromptOverride?: string
  readonly expanderPromptOverride?: string
}

/**
 * Load the vault hint + optional prompt overrides. Each piece is independently optional
 * (yaml-only or prompt-only is valid). All failures fall back to empty / undefined +
 * console.warn — never throw.
 */
export async function loadVaultQueryConfig(
  reader: VaultFileReader,
): Promise<LoadVaultQueryConfigResult> {
  const hint = await loadHint(reader)
  const filterPromptOverride = await loadOptionalText(reader, VAULT_FILTER_PROMPT_PATH)
  const rewriterPromptOverride = await loadOptionalText(reader, VAULT_REWRITER_PROMPT_PATH)
  const expanderPromptOverride = await loadOptionalText(reader, VAULT_EXPANDER_PROMPT_PATH)
  return { hint, filterPromptOverride, rewriterPromptOverride, expanderPromptOverride }
}

async function loadHint(reader: VaultFileReader): Promise<VaultQueryHint> {
  if (!(await safeExists(reader, VAULT_QUERY_CONFIG_PATH))) return EMPTY_VAULT_QUERY_HINT
  try {
    const raw = await reader.read(VAULT_QUERY_CONFIG_PATH)
    return parseVaultQueryHintYaml(raw)
  } catch (err) {
    console.warn(`[vault-query-config] read/parse failed for ${VAULT_QUERY_CONFIG_PATH}:`, err)
    return EMPTY_VAULT_QUERY_HINT
  }
}

async function loadOptionalText(
  reader: VaultFileReader,
  path: string,
): Promise<string | undefined> {
  if (!(await safeExists(reader, path))) return undefined
  try {
    return await reader.read(path)
  } catch (err) {
    console.warn(`[vault-query-config] read failed for ${path}:`, err)
    return undefined
  }
}

async function safeExists(reader: VaultFileReader, path: string): Promise<boolean> {
  try {
    return await reader.exists(path)
  } catch {
    return false
  }
}
