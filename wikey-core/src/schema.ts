import type {
  EntityType, ConceptType, Mention, SchemaOverride, SchemaCustomType, WikiFS,
  StandardDecomposition, StandardDecompositionComponent, StandardDecompositionsState,
} from './types.js'
import {
  EXAMPLE_ORG_BASE, EXAMPLE_PERSON_BASE, EXAMPLE_PRODUCT_BASE,
} from './example-placeholders.js'

/**
 * Phase B v6: Schema-Guided Extraction.
 *
 * Lessons from v1~v5 (PMS PDF, 6 runs, page count 35→102 oscillation):
 *   - LLM 자유 분류는 entity↔concept↔Korean label 사이를 회피 이동시킨다.
 *   - 차단 메시지를 늘리면 새 카테고리(비즈니스 객체)로 회피한다.
 *   - 분류 자유도를 미리 제한하는 것이 가장 안정적 (LlamaIndex SchemaLLMPathExtractor 패턴).
 *
 * 4 entity types + 3 concept types only. 이 외 분류는 dropped.
 */

export const ENTITY_TYPES: readonly EntityType[] = ['organization', 'person', 'product', 'tool']
export const CONCEPT_TYPES: readonly ConceptType[] = ['standard', 'methodology', 'document_type']

/** Human-readable description for prompt injection. Keep short — LLM uses these to classify. */
export const ENTITY_TYPE_DESCRIPTIONS: Record<EntityType, string> = {
  organization: `회사·기관·법인·정부조직 (예: ${EXAMPLE_ORG_BASE}, national-tax-service)`,
  person: `실명 인물 (예: ${EXAMPLE_PERSON_BASE}). 직책/역할 라벨 제외.`,
  product: `구체적 제품명·서비스명 (예: ${EXAMPLE_PRODUCT_BASE}, mariadb). 제품 카테고리 제외.`,
  tool: '소프트웨어 도구·라이브러리·프로토콜 (예: apache-tomcat, mqtt, restful-api).',
}

export const CONCEPT_TYPE_DESCRIPTIONS: Record<ConceptType, string> = {
  standard:
    '공식 발행되거나 산업 합의된 **명명된 규격·프레임워크·프로토콜** ' +
    '(예: pmbok, work-breakdown-structure, gantt-chart, iso-13320, fda-21-cfr-part-11, hart-7, atex-zone-1). ' +
    '판단 기준: 표준화 기관 또는 약어로 식별되며, 다수 조직이 공유하는 정의가 있다.',
  methodology:
    '특정 결과를 만드는 **반복 가능한 절차·접근법·기법** ' +
    '(예: agile, scrum, supply-chain-management, process-analytical-technology). ' +
    '판단 기준: "어떻게 한다"의 동작 원리 — 표준 문서가 없어도 업계에서 통용되는 방법.',
  document_type:
    '특정 양식을 갖는 **문서·증명서 유형명** ' +
    '(예: business-registration-certificate, electronic-tax-invoice). ' +
    '판단 기준: 종이/전자 양식으로 발행 가능하고 고유 항목 구조가 있다. 실제 인스턴스가 아닌 **유형**만.',
}

/**
 * Decision tree for concept classification — emit alongside CONCEPT_TYPE_DESCRIPTIONS in canonicalizer prompt.
 * Goal: reduce Concepts CV (measured 21% on Greendale, 33% on PMS).
 */
export const CONCEPT_DECISION_TREE = `
## Concept 분류 결정 트리

후보가 concept이라고 판단되면 다음 순서로 검사하세요:

1. **표준화 기관(ISO/IEC/FDA/IEEE/W3C 등) 또는 약어가 이름에 명시되어 있나?** → \`standard\`
   - 예: \`fda-21-cfr-part-11\`, \`iso-13320\`, \`iec-60601-1-2-2007\`
   - 약어형(pmbok, erp, mes, opc-ua) 자체가 "위원회가 합의한 명명"이면 standard

2. **양식·증명서·보고서로 인쇄·발행 가능한 "문서 유형"인가?** → \`document_type\`
   - 예: \`business-registration-certificate\`, \`electronic-tax-invoice\`
   - 주의: 실제 한 장의 문서가 아닌 **유형 이름**만 (인스턴스는 source 본문에 두기)

3. **"이렇게 한다"의 절차·접근법·기법인가?** → \`methodology\`
   - 예: \`agile\`, \`scrum\`, \`process-analytical-technology\`, \`supply-chain-management\`
   - 동사형 한정사("management/control/optimization 등") + 도메인 결합으로 절차 의미가 있어야 함

4. **위 셋 중 어디에도 명확히 들어가지 않는다** → **drop** (분류 불가)
   - 단순 도메인 용어(예: "혈압", "정확도") · 제품 카테고리 · 기능 라벨은 entity·concept 모두 아님
`.trim()

/** Validate a mention's type_hint against the allowed schema (optionally extended by override). */
export function isValidEntityType(t: string, override?: SchemaOverride): t is EntityType {
  if ((ENTITY_TYPES as readonly string[]).includes(t)) return true
  if (override && override.entityTypes.some((x) => x.name === t)) return true
  return false
}

export function isValidConceptType(t: string, override?: SchemaOverride): t is ConceptType {
  if ((CONCEPT_TYPES as readonly string[]).includes(t)) return true
  if (override && override.conceptTypes.some((x) => x.name === t)) return true
  return false
}

/** Merged list of built-in + override entity type names. */
export function getEntityTypes(override?: SchemaOverride): readonly string[] {
  if (!override || override.entityTypes.length === 0) return ENTITY_TYPES
  return [...ENTITY_TYPES, ...override.entityTypes.map((x) => x.name)]
}

export function getConceptTypes(override?: SchemaOverride): readonly string[] {
  if (!override || override.conceptTypes.length === 0) return CONCEPT_TYPES
  return [...CONCEPT_TYPES, ...override.conceptTypes.map((x) => x.name)]
}

export interface ValidationOutcome {
  readonly valid: boolean
  readonly category?: 'entity' | 'concept'
  readonly type?: EntityType | ConceptType
  readonly reason?: string
}

/**
 * Validate a mention against schema. Returns valid + category/type, or invalid + reason.
 * Stage 2 canonicalizer uses this to decide drop vs keep.
 */
export function validateMention(mention: Mention, override?: SchemaOverride): ValidationOutcome {
  const hint = mention.type_hint
  if (!hint || hint === 'unknown') {
    return { valid: false, reason: 'no type_hint provided' }
  }
  if (isValidEntityType(hint, override)) {
    return { valid: true, category: 'entity', type: hint as EntityType }
  }
  if (isValidConceptType(hint, override)) {
    return { valid: true, category: 'concept', type: hint as ConceptType }
  }
  const allowed = [...getEntityTypes(override), ...getConceptTypes(override)].join(', ')
  return { valid: false, reason: `type_hint "${hint}" is not in schema (allowed: ${allowed})` }
}

/**
 * Normalize a name for blocklist lookup: lowercase, strip all hyphens.
 * Catches LLM variants like `turnkey-contract` ↔ `turn-key-contract`.
 */
function normalizeForLookup(name: string): string {
  return name.toLowerCase().replace(/-/g, '')
}

/**
 * Detect common anti-patterns from v1~v6 lessons. Used as a SECONDARY check after
 * schema validation — even valid types can be UI labels (e.g. type='product' but name='mobile-app-service').
 *
 * Returns null if clean, else a reason string.
 */
export function detectAntiPattern(name: string): string | null {
  const lower = name.toLowerCase()
  const normalized = normalizeForLookup(name)

  // Pattern: 한국어 라벨 (UI/메뉴 회피 패턴, v5에서 발견)
  if (/[가-힣]/.test(name)) {
    return 'Korean label — likely UI/menu name, not industry-standard concept'
  }

  // Pattern: X-management/-service/-system 단순 기능명 (v3.2~v4 잔존)
  // 단, 산업 표준은 예외 (electronic-approval-system, supply-chain-management-system 등)
  const FUNCTIONAL_SUFFIXES = ['-management', '-service', '-support', '-processing', '-printing', '-viewer']
  const STANDARD_EXCEPTIONS = new Set([
    'electronic-approval-system',
    'supply-chain-management-system',
    'manufacturing-execution-system',
    'enterprise-resource-planning',
    'supply-chain-management',
    'product-lifecycle-management',
    'risk-management',
    'project-integration-management',
    'project-scope-management',
    'project-schedule-management',
    'project-time-management',
    'project-cost-management',
    'project-quality-management',
    'project-resource-management',
    'project-human-resource-management',
    'project-communications-management',
    'project-risk-management',
    'project-procurement-management',
    'project-stakeholder-management',
  ])
  if (STANDARD_EXCEPTIONS.has(lower)) return null
  for (const suffix of FUNCTIONAL_SUFFIXES) {
    if (lower.endsWith(suffix)) {
      return `name ends with "${suffix}" — likely UI feature label (v3.2~v4 anti-pattern)`
    }
  }

  // Pattern: 비즈니스 객체 (v4 회피 패턴) — match on hyphen-stripped form for variant tolerance
  const BUSINESS_OBJECT_NAMES = new Set([
    'quotation', 'ordercontract', 'purchaseorder', 'deliverystatement',
    'taxinvoice', 'inspectionreport', 'salesorder', 'deliverynote',
    'purchaseapprovalrequest', 'paymentcollection',
  ])
  if (BUSINESS_OBJECT_NAMES.has(normalized)) {
    return 'business object name — data model item, not industry-standard concept'
  }

  // Pattern: 운영 항목 (v6 잔여 노이즈, hyphen-stripped match)
  const OPERATIONAL_ITEMS = new Set([
    'issuelog', 'meetingminutes', 'incominginspection',
    'turnkeycontract', 'deliveryspecification', 'capacityanalysis',
    'barcode', 'productintroductiondocument', 'productintroduction',
    'weeklyreport', 'businessregistrationnumber',
    // v6+D+C 검증에서 새로 발견된 변형
    'deliveryconfirmation', '3dworkspace',
    // v7-2 (2026-04-20) 추가 — 운영 잡음 패턴
    'workhours', 'employeerole', 'departmentcode', 'productcategory',
    'paymentterm', 'shipmentstatus', 'returnpolicy', 'warrantyperiod',
    // 'deliveryconfirmationlist' is caught by *-list suffix pattern below
  ])
  if (OPERATIONAL_ITEMS.has(normalized)) {
    return 'operational artifact/process — not industry-standard concept'
  }

  // Pattern: *-list 접미사 — 데이터 목록 라벨 (예: delivery-confirmation-list, purchase-list)
  // 단, 산업 표준 *-list (예: bill-of-materials는 list 아님)는 별도 예외
  if (lower.endsWith('-list')) {
    return 'name ends with "-list" — likely data list label, not industry-standard concept'
  }

  // Pattern: *-report 접미사 — 운영 보고서 (예: weekly-report, inspection-report)
  // 산업 표준은 위 STANDARD_EXCEPTIONS와 BUSINESS_OBJECT에서 처리
  if (lower.endsWith('-report')) {
    return 'name ends with "-report" — likely operational report, not industry-standard concept'
  }

  // Pattern: *-form 접미사 — 양식 라벨 (예: standard-deliverable-form)
  if (lower.endsWith('-form') && lower !== 'form') {
    return 'name ends with "-form" — likely UI form label, not industry-standard concept'
  }

  // v7-2 (2026-04-20) — UI/메뉴 라벨이 entity로 회피하는 패턴
  // *-button, *-menu, *-tab, *-page, *-screen, *-dialog, *-modal
  // *-section, *-panel, *-widget, *-icon (UI atoms)
  if (/-(button|menu|tab|page|screen|dialog|modal|section|panel|widget|icon)$/.test(lower)) {
    return `name ends with UI element suffix — likely UI label, not entity/concept`
  }

  // v7-2 — 데이터 모델 필드 회피 패턴
  // *-id, *-code, *-number, *-key, *-flag, *-status (DB column-style)
  // 단, 산업 표준의 자연어 이름이 아닌 raw column suffix만 차단
  if (/-(id|code|number|key|flag|status|count|amount|total)$/.test(lower) && lower.split('-').length <= 3) {
    return `name ends with data-field suffix — likely DB column label, not industry-standard concept`
  }

  return null
}

/**
 * Build a compact schema description for prompt injection. Used by Stage 2 canonicalizer
 * to constrain LLM output to allowed types. Optionally includes user-defined types from
 * `.wikey/schema.yaml` (v7-5).
 */
export function buildSchemaPromptBlock(override?: SchemaOverride): string {
  const lines: string[] = []
  const eTotal = ENTITY_TYPES.length + (override?.entityTypes.length ?? 0)
  const cTotal = CONCEPT_TYPES.length + (override?.conceptTypes.length ?? 0)
  lines.push('## 분류 스키마 (이 외 분류는 거부됨)')
  lines.push('')
  lines.push(`**Entity 타입 (${eTotal}개)**:`)
  for (const t of ENTITY_TYPES) {
    lines.push(`- \`${t}\`: ${ENTITY_TYPE_DESCRIPTIONS[t]}`)
  }
  if (override) {
    for (const t of override.entityTypes) {
      lines.push(`- \`${t.name}\` (user-defined): ${t.description}`)
    }
  }
  lines.push('')
  lines.push(`**Concept 타입 (${cTotal}개)**:`)
  for (const t of CONCEPT_TYPES) {
    lines.push(`- \`${t}\`: ${CONCEPT_TYPE_DESCRIPTIONS[t]}`)
  }
  if (override) {
    for (const t of override.conceptTypes) {
      lines.push(`- \`${t.name}\` (user-defined): ${t.description}`)
    }
  }
  lines.push('')
  lines.push(CONCEPT_DECISION_TREE)
  lines.push('')
  lines.push('**거부 패턴**: 한국어 라벨, X-management/-service/-support 단순 기능명, 비즈니스 객체(quotation/order/invoice 등), UI 요소(*-button/-menu/-page 등), DB 필드명(*-id/-code/-status 등)')
  return lines.join('\n')
}

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

const RESERVED_ENTITY_NAMES = new Set<string>(ENTITY_TYPES)
const RESERVED_CONCEPT_NAMES = new Set<string>(CONCEPT_TYPES)

function normalizeTypeName(raw: string): string {
  return raw.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_')
}

/**
 * Minimal YAML parser for schema override. Only supports the narrow structure:
 *   entity_types:
 *     - name: <string>
 *       description: <string>
 *   concept_types:
 *     - name: <string>
 *       description: <string>
 *   standard_decompositions:           # §5.4.1 Stage 1
 *     - name: <string>
 *       umbrella_slug: <slug>
 *       rule: decompose | bundle
 *       require_explicit_mention: true | false
 *       aliases: [list of strings]
 *       components:
 *         - slug: <slug>
 *           type: <entity-or-concept-type>
 *           aliases: [list of strings]
 *
 * No anchors/aliases/multiline scalars. Flow style rejected EXCEPT
 * `standard_decompositions: []` (explicit disable).
 * Comments (`#`) and blanks ignored. Tab indentation rejected (warn + line skip).
 * Returns null only if no valid entity/concept entries AND `standard_decompositions:` key absent.
 */
export function parseSchemaOverrideYaml(input: string): SchemaOverride | null {
  if (!input.trim()) return null

  type Section = 'entity' | 'concept' | 'standard' | null
  let section: Section = null
  const entityTypes: SchemaCustomType[] = []
  const conceptTypes: SchemaCustomType[] = []
  let current: { name?: string; description?: string } | null = null

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

  const flushTypesEntry = () => {
    if (!current) return
    const name = current.name ? normalizeTypeName(current.name) : ''
    const description = (current.description ?? '').trim()
    current = null
    if (!name || !description) return
    if (section === 'entity') {
      if (RESERVED_ENTITY_NAMES.has(name)) return
      if (entityTypes.some((x) => x.name === name)) return
      entityTypes.push({ name, description })
    } else if (section === 'concept') {
      if (RESERVED_CONCEPT_NAMES.has(name)) return
      if (conceptTypes.some((x) => x.name === name)) return
      conceptTypes.push({ name, description })
    }
  }

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
    // F5: type runtime check against entity ∪ concept union (built-in + user override declared so far)
    const entityUnion = [...ENTITY_TYPES, ...entityTypes.map((x) => x.name)]
    const conceptUnion = [...CONCEPT_TYPES, ...conceptTypes.map((x) => x.name)]
    if (!entityUnion.includes(type) && !conceptUnion.includes(type)) {
      console.warn(`[wikey] schema.yaml standard_decomposition skipped (component "${slug}" type "${type}"): not in entity/concept union`)
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

    // Top-level keys
    const topTypesMatch = line.match(/^(entity_types|concept_types)\s*:\s*$/)
    if (topTypesMatch) {
      flushTypesEntry()
      flushEntry()
      section = topTypesMatch[1] === 'entity_types' ? 'entity' : 'concept'
      continue
    }
    const stdHeader = line.match(/^standard_decompositions\s*:\s*(.*)$/)
    if (stdHeader) {
      flushTypesEntry()
      flushEntry()
      section = 'standard'
      stdSeen = true
      const tail = stdHeader[1].trim()
      if (tail === '[]') stdExplicitEmpty = true
      continue
    }

    if (section === null) continue

    if (section === 'entity' || section === 'concept') {
      const itemStart = line.match(/^\s*-\s+(name|description)\s*:\s*(.+)$/)
      if (itemStart) {
        flushTypesEntry()
        current = {}
        current[itemStart[1] as 'name' | 'description'] = unquote(itemStart[2])
        continue
      }
      const contMatch = line.match(/^\s+(name|description)\s*:\s*(.+)$/)
      if (contMatch && current) {
        current[contMatch[1] as 'name' | 'description'] = unquote(contMatch[2])
        continue
      }
      continue
    }

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
  flushTypesEntry()
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

  if (
    entityTypes.length === 0
    && conceptTypes.length === 0
    && standardDecompositions === undefined
  ) {
    return null
  }
  if (standardDecompositions === undefined) {
    return { entityTypes, conceptTypes }
  }
  return { entityTypes, conceptTypes, standardDecompositions }
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
