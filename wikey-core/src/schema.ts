import type {
  Mention, SchemaOverride, WikiFS,
  StandardDecomposition, StandardDecompositionComponent, StandardDecompositionsState,
} from './types.js'

/**
 * Phase 5 §5.10.3 R1 (D-wide LLM-only ontology): 7-type schema gate 폐기.
 *
 * 변경 전 (~Phase 5 §5.4): 4 entity types + 3 concept types union 강제.
 *   - LLM 출력 type_hint 가 7-type 중 하나가 아니면 drop.
 *   - canonicalizer prompt 의 schema block 으로 LLM 분류 범위 제한.
 *
 * 변경 후 (§5.10.3 D-wide): LLM 자율 type 분류. type_hint 자유 string.
 *   - 폐기: ENTITY_TYPES / CONCEPT_TYPES 상수 + ENTITY_TYPE_DESCRIPTIONS / CONCEPT_TYPE_DESCRIPTIONS
 *   - 폐기: isValidEntityType / isValidConceptType / getEntityTypes / getConceptTypes
 *   - 폐기: validateMention (LLM 자율 통과)
 *   - 폐기: buildSchemaPromptBlock + CONCEPT_DECISION_TREE
 *   - 폐기: detectAntiPattern + normalizeForLookup (Korean label / business object 등 anti-pattern 차단)
 *   - 보존: BUILTIN_STANDARD_DECOMPOSITIONS + parseSchemaOverrideYaml + buildStandardDecompositionBlock + loadSchemaOverride
 *           (§5.10.4 M migration 단계에서 별도 폐기)
 *
 * 사용자 본질 비판 6 chain (wikey.schema.md 핵심 원칙 #2 "위키는 LLM 이 소유한다") 의 정확한 코드 구현.
 */

// ── §5.4.1 Stage 1: built-in standard decompositions ──

/**
 * §5.4.1 Stage 1: built-in PMBOK decomposition. Replaces the hardcoded
 * canonicalizer prompt block (formerly `canonicalizer.ts:262`) with a
 * declarative form that user yaml can append to or explicitly disable.
 *
 * F3: legacy alternate slugs (`project-time-management`,
 * `project-human-resource-management`) preserved as component aliases so the
 * §4.5.1.7.2 prompt anchors continue to match.
 */
export const BUILTIN_STANDARD_DECOMPOSITIONS: readonly StandardDecomposition[] = [
  {
    name: 'PMBOK',
    aliases: ['Project Management Body of Knowledge', '프로젝트 관리 지식체계'],
    umbrella_slug: 'project-management-body-of-knowledge',
    rule: 'decompose',
    require_explicit_mention: true,
    origin: 'hardcoded',
    components: [
      { slug: 'project-integration-management', type: 'methodology' },
      { slug: 'project-scope-management', type: 'methodology' },
      { slug: 'project-schedule-management', type: 'methodology', aliases: ['project-time-management'] },
      { slug: 'project-cost-management', type: 'methodology' },
      { slug: 'project-quality-management', type: 'methodology' },
      { slug: 'project-resource-management', type: 'methodology', aliases: ['project-human-resource-management'] },
      { slug: 'project-communications-management', type: 'methodology' },
      { slug: 'project-risk-management', type: 'methodology' },
      { slug: 'project-procurement-management', type: 'methodology' },
      { slug: 'project-stakeholder-management', type: 'methodology' },
    ],
  },
]

// ── v7-5: User schema override (.wikey/schema.yaml) ──
// Phase 5 §5.10.3 R1 (D-wide): entity_types / concept_types section parser 폐기.
// parser 가 entity_types / concept_types 헤더를 만나면 silently skip — D-wide LLM-only
// ontology 에서 7-type schema gate 자체가 비-기능. standard_decompositions parser 만 active
// (§5.4.1 보조 정형 표준 자료 ingest 지원). standard_decompositions 도 §5.10.4 M migration
// 단계에서 별도 폐기.

/**
 * Minimal YAML parser for schema override (D-wide simplification).
 * - entity_types / concept_types section: silently skipped (D-wide LLM-only).
 * - standard_decompositions: parsed (§5.4.1 보조).
 *   structure:
 *     standard_decompositions:
 *       - name: <string>
 *         umbrella_slug: <slug>
 *         rule: decompose | bundle
 *         require_explicit_mention: true | false
 *         aliases: [list of strings]
 *         components:
 *           - slug: <slug>
 *             type: <free string — D-wide>
 *             aliases: [list of strings]
 *
 * No anchors/aliases/multiline scalars. Flow style rejected EXCEPT
 * `standard_decompositions: []` (explicit disable).
 * Comments (`#`) and blanks ignored. Tab indentation rejected (warn + line skip).
 * Returns null only if `standard_decompositions:` key absent (entity_types / concept_types
 * are silently ignored — never produce output).
 */
export function parseSchemaOverrideYaml(input: string): SchemaOverride | null {
  if (!input.trim()) return null

  type Section = 'standard' | 'ignored' | null
  let section: Section = null

  // §5.4.1 standard_decompositions parser state
  let stdSeen = false                       // top-level key encountered (regardless of body)
  let stdExplicitEmpty = false              // `standard_decompositions: []` flow form
  const stdItems: StandardDecomposition[] = []
  let stdSkipped = 0
  // first-wins ownership (built-in primary slugs + aliases included)
  const ownedComponentSlugs = new Set<string>()
  for (const d of BUILTIN_STANDARD_DECOMPOSITIONS) {
    for (const c of d.components) {
      ownedComponentSlugs.add(c.slug)
      if (c.aliases) for (const a of c.aliases) ownedComponentSlugs.add(a)
    }
  }

  type CompDraft = { slug?: string; type?: string; aliases?: string[] }
  type EntryDraft = {
    name?: string
    aliases: string[]
    umbrella_slug?: string
    rule?: string
    require_explicit_mention?: boolean
    components: Array<{ slug: string; type: string; aliases?: readonly string[] }>
  }
  let entry: EntryDraft | null = null
  let comp: CompDraft | null = null
  // Tracks the active list a `- value` line should append to.
  let listMode: 'top-aliases' | 'comp-aliases' | null = null

  const flushComponent = () => {
    if (!entry || !comp) { comp = null; return }
    const c = comp
    comp = null
    const slug = (c.slug ?? '').trim()
    const type = (c.type ?? '').trim()
    if (!slug) return
    if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
      console.warn(`[wikey] schema.yaml standard_decomposition skipped (component slug "${slug}"): invalid format`)
      return
    }
    if (entry.components.some((x) => x.slug === slug)) return
    // Phase 5 §5.10.3 R1 (D-wide): type 자유 string. 7-type union 검증 폐기.
    if (!type) {
      console.warn(`[wikey] schema.yaml standard_decomposition skipped (component "${slug}"): empty type`)
      return
    }
    // M6: cross-decomposition slug collision = first-wins (built-in or earlier user entry wins)
    if (ownedComponentSlugs.has(slug)) {
      console.warn(`[wikey] decomposition component slug duplicate: ${slug} owned by built-in or earlier entry, skipped from "${entry.name ?? '(unnamed)'}"`)
      return
    }
    ownedComponentSlugs.add(slug)
    const aliases = c.aliases && c.aliases.length > 0
      ? Array.from(new Set(c.aliases))
      : undefined
    entry.components.push({ slug, type, aliases })
  }

  const flushEntry = () => {
    if (!entry) return
    flushComponent()
    listMode = null
    const cur = entry
    entry = null
    const name = (cur.name ?? '').trim()
    const umbrella = (cur.umbrella_slug ?? '').trim()
    const rule = (cur.rule ?? 'decompose').trim()
    if (!name) { stdSkipped++; console.warn('[wikey] schema.yaml standard_decomposition skipped: missing name'); return }
    if (!umbrella || !/^[a-z][a-z0-9-]*$/.test(umbrella)) {
      stdSkipped++
      console.warn(`[wikey] schema.yaml standard_decomposition skipped (${name}): invalid umbrella_slug`)
      return
    }
    if (rule !== 'decompose' && rule !== 'bundle') {
      stdSkipped++
      console.warn(`[wikey] schema.yaml standard_decomposition skipped (${name}): rule "${rule}" not in {decompose, bundle}`)
      return
    }
    if (cur.components.length === 0) {
      stdSkipped++
      console.warn(`[wikey] schema.yaml standard_decomposition skipped (${name}): no valid components`)
      return
    }
    stdItems.push({
      name,
      aliases: cur.aliases,
      umbrella_slug: umbrella,
      components: cur.components,
      rule: rule as 'decompose' | 'bundle',
      require_explicit_mention: cur.require_explicit_mention ?? true,
      origin: 'user-yaml',
    })
  }

  const unquote = (v: string): string => {
    const t = v.trim()
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      return t.slice(1, -1)
    }
    return t
  }

  for (const rawLine of input.split(/\r?\n/)) {
    if (rawLine.includes('\t')) {
      console.warn('[wikey] schema.yaml: tab indentation rejected, line skipped')
      continue
    }
    const line = rawLine.replace(/\s+#.*$/, '').replace(/^#.*$/, '')
    if (!line.trim()) continue

    // Top-level keys.
    // Phase 5 §5.10.3 R1 (D-wide): entity_types / concept_types section silently skipped.
    const topTypesMatch = line.match(/^(entity_types|concept_types)\s*:\s*(.*)$/)
    if (topTypesMatch) {
      flushEntry()
      section = 'ignored'
      continue
    }
    const stdHeader = line.match(/^standard_decompositions\s*:\s*(.*)$/)
    if (stdHeader) {
      flushEntry()
      section = 'standard'
      stdSeen = true
      const tail = stdHeader[1].trim()
      if (tail === '[]') stdExplicitEmpty = true
      continue
    }

    if (section === null || section === 'ignored') continue

    // section === 'standard'
    // Entry start: `  - name: X`
    const entryStart = line.match(/^\s*-\s+name\s*:\s*(.+)$/)
    if (entryStart) {
      flushEntry()
      entry = { aliases: [], components: [] }
      entry.name = unquote(entryStart[1])
      listMode = null
      continue
    }
    if (!entry) continue

    // Component start: `      - slug: X`
    const compStart = line.match(/^\s*-\s+slug\s*:\s*(.+)$/)
    if (compStart) {
      flushComponent()
      comp = { slug: unquote(compStart[1]) }
      listMode = null
      continue
    }

    // List-of-strings item: `      - <value>`
    const listItem = line.match(/^\s*-\s+(.+)$/)
    if (listItem && (listMode === 'top-aliases' || listMode === 'comp-aliases')) {
      const v = unquote(listItem[1])
      if (listMode === 'top-aliases') {
        if (!entry.aliases.includes(v)) entry.aliases.push(v)
      } else if (comp) {
        if (!comp.aliases) comp.aliases = []
        if (!comp.aliases.includes(v)) comp.aliases.push(v)
      }
      continue
    }

    // Field assignment: `    key: value`
    const fieldMatch = line.match(/^\s+(\w+)\s*:\s*(.*)$/)
    if (fieldMatch) {
      const key = fieldMatch[1]
      const val = fieldMatch[2].trim()
      // List-headers: `aliases:` / `components:` followed by indented dash items.
      if ((key === 'aliases' || key === 'components') && val === '') {
        if (key === 'aliases') {
          if (comp) listMode = 'comp-aliases'
          else listMode = 'top-aliases'
        } else {
          flushComponent()
          listMode = null
        }
        continue
      }
      // Component-level fields require a current component.
      if (comp && (key === 'slug' || key === 'type')) {
        if (key === 'slug') comp.slug = unquote(val)
        else comp.type = unquote(val)
        continue
      }
      // Entry-level fields.
      if (key === 'umbrella_slug') { entry.umbrella_slug = unquote(val); listMode = null; continue }
      if (key === 'rule') { entry.rule = unquote(val); listMode = null; continue }
      if (key === 'require_explicit_mention') {
        entry.require_explicit_mention = unquote(val).toLowerCase() === 'true'
        listMode = null
        continue
      }
      // Unrecognized keys silently ignored (minimal subset).
      continue
    }
  }
  flushEntry()

  let standardDecompositions: StandardDecompositionsState | undefined
  if (stdSeen) {
    if (stdExplicitEmpty) {
      standardDecompositions = { kind: 'empty-explicit' }
    } else if (stdItems.length === 0 && stdSkipped > 0) {
      standardDecompositions = { kind: 'empty-all-skipped', skippedCount: stdSkipped }
      console.warn(`[wikey] all standard_decompositions entries dropped (${stdSkipped} invalid), falling back to built-in PMBOK`)
    } else if (stdItems.length === 0) {
      // block-empty (key + no value + no entries) — treat as explicit disable.
      standardDecompositions = { kind: 'empty-explicit' }
    } else {
      standardDecompositions = { kind: 'present', items: stdItems }
    }
  }

  // Phase 5 §5.10.3 R1 (D-wide): entityTypes / conceptTypes 항상 빈 배열 (silently ignored section).
  if (standardDecompositions === undefined) {
    return null
  }
  return { entityTypes: [], conceptTypes: [], standardDecompositions }
}

/**
 * §5.4.1 Stage 1: build the canonicalizer prompt's task rule #7 (standard
 * decomposition) block. Branches:
 *   - state === undefined           → built-in PMBOK only (key absent)
 *   - state.kind === 'empty-explicit' → '' (PMBOK explicitly disabled)
 *   - state.kind === 'empty-all-skipped' → built-in PMBOK only (silent disable 방지)
 *   - state.kind === 'present'      → built-in PMBOK + user items appended (F1)
 *
 * Output text preserves §4.5.1.7.2 anchors:
 *   - "PMBOK 10 knowledge areas 개별 추출"
 *   - "묶지 말 것"
 *   - "직접 언급되지 않으면 추출하지 않는다"
 */
export function buildStandardDecompositionBlock(override?: SchemaOverride): string {
  const state = override?.standardDecompositions
  if (state?.kind === 'empty-explicit') return ''

  let decomps: readonly StandardDecomposition[]
  if (!state || state.kind === 'empty-all-skipped') {
    decomps = BUILTIN_STANDARD_DECOMPOSITIONS
  } else {
    decomps = [...BUILTIN_STANDARD_DECOMPOSITIONS, ...state.items]
  }
  if (decomps.length === 0) return ''

  const sections: string[] = []
  for (const d of decomps) {
    if (d.rule === 'bundle') {
      sections.push(
        `- **${d.name}** (rule: bundle): 본문 등장 시 \`${d.umbrella_slug}\` 1 개로 묶고 하위 영역 분해 금지.`,
      )
      continue
    }
    const componentsList = d.components
      .map((c) => {
        const altPart = c.aliases && c.aliases.length > 0
          ? ` (또는 ${c.aliases.map((a) => `\`${a}\``).join(' / ')})`
          : ''
        return `\`${c.slug}\`${altPart} (${c.type})`
      })
      .join(', ')
    const explicit = d.require_explicit_mention
      ? '본문에 해당 영역이 직접 언급되지 않으면 추출하지 않는다 (hallucination 금지).'
      : '관련 영역 모두 추출 가능.'
    const aliasNames = d.aliases.length > 0 ? d.aliases.join(' / ') : d.umbrella_slug
    sections.push(
      `- **${d.name}** (rule: decompose, ${d.components.length}개 영역): ` +
      `본문에 ${d.name} / ${aliasNames} 맥락이 등장하면 ` +
      `다음 ${d.components.length}개 영역은 각각 **별도 entity 또는 concept** 로 분해하고 ` +
      `상위 \`${d.umbrella_slug}\` 하나로 묶지 말 것. ${explicit} ` +
      `대상: ${componentsList}.`,
    )
  }
  return [
    '## 표준 분해 규칙 (작업 규칙 #7)',
    '## PMBOK 10 knowledge areas 개별 추출 (concepts 결정화)',
    '',
    ...sections,
  ].join('\n')
}

/**
 * Load `.wikey/schema.yaml` (or custom path) via the wiki filesystem.
 * Returns null if the file is absent or parses to no valid types.
 */
export async function loadSchemaOverride(
  wikiFS: WikiFS,
  path = '.wikey/schema.yaml',
): Promise<SchemaOverride | null> {
  if (!(await wikiFS.exists(path))) return null
  const raw = await wikiFS.read(path)
  return parseSchemaOverrideYaml(raw)
}
