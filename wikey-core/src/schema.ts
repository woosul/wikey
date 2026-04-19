import type { EntityType, ConceptType, Mention } from './types.js'

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
  organization: '회사·기관·법인·정부조직 (예: goodstream-co-ltd, national-tax-service)',
  person: '실명 인물 (예: kim-myung-ho). 직책/역할 라벨 제외.',
  product: '구체적 제품명·서비스명 (예: lotus-pms, mariadb). 제품 카테고리 제외.',
  tool: '소프트웨어 도구·라이브러리·프로토콜 (예: apache-tomcat, mqtt, restful-api).',
}

export const CONCEPT_TYPE_DESCRIPTIONS: Record<ConceptType, string> = {
  standard: '산업 표준·규격·프레임워크 (예: pmbok, work-breakdown-structure, gantt-chart).',
  methodology: '방법론·이론·접근법 (예: agile, scrum, supply-chain-management).',
  document_type: '문서 종류·증명서 유형 (예: business-registration-certificate, electronic-tax-invoice).',
}

/** Validate a mention's type_hint against the allowed schema. */
export function isValidEntityType(t: string): t is EntityType {
  return (ENTITY_TYPES as readonly string[]).includes(t)
}

export function isValidConceptType(t: string): t is ConceptType {
  return (CONCEPT_TYPES as readonly string[]).includes(t)
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
export function validateMention(mention: Mention): ValidationOutcome {
  const hint = mention.type_hint
  if (!hint || hint === 'unknown') {
    return { valid: false, reason: 'no type_hint provided' }
  }
  if (isValidEntityType(hint)) {
    return { valid: true, category: 'entity', type: hint }
  }
  if (isValidConceptType(hint)) {
    return { valid: true, category: 'concept', type: hint }
  }
  return { valid: false, reason: `type_hint "${hint}" is not in schema (allowed: ${[...ENTITY_TYPES, ...CONCEPT_TYPES].join(', ')})` }
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
    'project-time-management',
    'project-cost-management',
    'project-quality-management',
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

  return null
}

/**
 * Build a compact schema description for prompt injection. Used by Stage 2 canonicalizer
 * to constrain LLM output to allowed types.
 */
export function buildSchemaPromptBlock(): string {
  const lines: string[] = []
  lines.push('## 분류 스키마 (이 외 분류는 거부됨)')
  lines.push('')
  lines.push('**Entity 타입 (4개)**:')
  for (const t of ENTITY_TYPES) {
    lines.push(`- \`${t}\`: ${ENTITY_TYPE_DESCRIPTIONS[t]}`)
  }
  lines.push('')
  lines.push('**Concept 타입 (3개)**:')
  for (const t of CONCEPT_TYPES) {
    lines.push(`- \`${t}\`: ${CONCEPT_TYPE_DESCRIPTIONS[t]}`)
  }
  lines.push('')
  lines.push('**거부 패턴**: 한국어 라벨, X-management/-service/-support 단순 기능명, 비즈니스 객체(quotation/order/invoice 등)')
  return lines.join('\n')
}
