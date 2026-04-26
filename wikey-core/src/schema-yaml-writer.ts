import type { Suggestion, WikiFS } from './types.js'

/**
 * §5.4.2 AC7 — section-range insertion writer for `.wikey/schema.yaml`.
 *
 * Strategy: line-level scan, no YAML parser. Stage 1 v7 §3.2 mandates the
 * "minimal YAML subset" policy, so we never pull in a yaml lib. Plan §3.2.5
 * lists the six branches (a)..(f).
 */

const SCHEMA_YAML_PATH = '.wikey/schema.yaml'

export interface AppendResult {
  readonly appended: boolean
  readonly reason?: 'already-exists' | 'header-unsafe' | 'invalid-slug'
}

// schema.ts:435 parser regex 와 일치 — round-trip acceptance 보장.
// 본 validator 가 reject 하는 slug 는 parser 도 reject 하므로 append 의미 없음 (codex post-impl
// review HIGH finding fix).
const VALID_SLUG_RE = /^[a-z][a-z0-9-]*$/

export async function appendStandardDecomposition(
  wikiFS: WikiFS,
  suggestion: Suggestion,
  path: string = SCHEMA_YAML_PATH,
): Promise<AppendResult> {
  // (0) round-trip validation: umbrella_slug + components.slug 가 schema.ts parser regex 와
  //     일치해야 한다. 미일치 시 schema.yaml 에 write 해도 다음 ingest 시 parser 가 reject
  //     → suggestion accept 무용지물. 이를 방지하기 위해 writer 단계에서 reject.
  if (!VALID_SLUG_RE.test(suggestion.umbrella_slug)) {
    return { appended: false, reason: 'invalid-slug' }
  }
  for (const c of suggestion.candidate_components) {
    if (!VALID_SLUG_RE.test(c.slug)) {
      return { appended: false, reason: 'invalid-slug' }
    }
  }

  let content = ''
  try {
    if (await wikiFS.exists(path)) content = await wikiFS.read(path)
  } catch {
    content = ''
  }

  // (a) idempotency: existing umbrella_slug marker
  const marker = `umbrella_slug: ${suggestion.umbrella_slug}`
  if (content.includes(marker)) {
    return { appended: false, reason: 'already-exists' }
  }

  const block = formatSuggestionAsYaml(suggestion, /* indent */ 2)
  const lines = content.split('\n')

  // (b) find top-level standard_decompositions: key (column 0)
  let stdIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (/^standard_decompositions\s*:/.test(lines[i])) { stdIdx = i; break }
  }

  // (c) absent → append a fresh top-level section at EOF
  if (stdIdx === -1) {
    if (content.length > 0 && !content.endsWith('\n')) content += '\n'
    if (content.length > 0) content += '\n'
    content += 'standard_decompositions:\n' + block
    if (!content.endsWith('\n')) content += '\n'
    await wikiFS.write(path, content)
    return { appended: true }
  }

  // (d) explicit empty form `standard_decompositions: []` — protect user disable
  if (/^standard_decompositions\s*:\s*\[\s*\]\s*$/.test(lines[stdIdx])) {
    return { appended: false, reason: 'header-unsafe' }
  }

  // (e) section range = stdIdx+1 .. next top-level alphabetic key (column 0) | EOF
  let sectionEnd = lines.length
  for (let i = stdIdx + 1; i < lines.length; i++) {
    if (/^[a-zA-Z_]/.test(lines[i])) { sectionEnd = i; break }
  }

  // (f) splice block immediately before sectionEnd (or at EOF)
  const blockLines = block.replace(/\n+$/, '').split('\n')
  lines.splice(sectionEnd, 0, ...blockLines)
  let next = lines.join('\n')
  if (!next.endsWith('\n')) next += '\n'

  await wikiFS.write(path, next)
  return { appended: true }
}

/**
 * Deterministic YAML formatter for one StandardDecomposition entry. 2-space
 * indent, no quoting (slugs are restricted to `[a-z0-9-]` upstream so no
 * escaping needed). Keep this function pure and synchronous.
 */
function formatSuggestionAsYaml(s: Suggestion, indent: number): string {
  const pad = ' '.repeat(indent)
  const out: string[] = []
  out.push(`${pad}- name: ${s.umbrella_name ?? s.umbrella_slug}`)
  out.push(`${pad}  umbrella_slug: ${s.umbrella_slug}`)
  out.push(`${pad}  rule: decompose`)
  out.push(`${pad}  require_explicit_mention: true`)
  out.push(`${pad}  origin: suggested`)
  out.push(`${pad}  confidence: ${s.confidence.toFixed(2)}`)
  out.push(`${pad}  components:`)
  for (const c of s.candidate_components) {
    out.push(`${pad}    - slug: ${c.slug}`)
    out.push(`${pad}      type: ${c.type}`)
    if (c.aliases && c.aliases.length > 0) {
      out.push(`${pad}      aliases:`)
      for (const a of c.aliases) out.push(`${pad}        - ${a}`)
    }
  }
  return out.join('\n') + '\n'
}
