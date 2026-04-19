import type { LLMClient } from './llm-client.js'
import type {
  CanonicalizedResult, EntityType, ConceptType, Mention, WikiPage,
} from './types.js'
import {
  ENTITY_TYPES, CONCEPT_TYPES, isValidEntityType, isValidConceptType,
  detectAntiPattern, buildSchemaPromptBlock,
} from './schema.js'
import { normalizeBase } from './wiki-ops.js'

/**
 * Phase C v6: Stage 2 Canonicalizer.
 *
 * Single document-global LLM call that:
 *   1. Takes all mentions from chunk LLMs (Stage 1) + existing wiki page list
 *   2. Maps each mention to canonical entity/concept under schema constraints
 *   3. Resolves abbreviation↔fullname pairs and existing-page reuse
 *   4. Drops mentions that violate schema or anti-patterns
 *
 * Key invariants:
 *   - Output filenames are normalized base names (no path, no .md → wiki-ops adds .md)
 *   - Each kept page has an explicit entityType or conceptType
 *   - Schema validation + anti-pattern check both apply (defense in depth)
 */

const MAX_JSON_RETRIES = 2

export interface CanonicalizeArgs {
  readonly llm: LLMClient
  readonly mentions: readonly Mention[]
  readonly existingEntityBases: readonly string[]
  readonly existingConceptBases: readonly string[]
  readonly sourceFilename: string
  readonly today: string
  readonly guideHint?: string
  readonly provider: string
  readonly model: string
}

interface RawCanonical {
  entities?: Array<{ name?: string; type?: string; description?: string; aliases?: string[] }>
  concepts?: Array<{ name?: string; type?: string; description?: string; aliases?: string[] }>
  index_additions?: string[]
  log_entry?: string
}

export async function canonicalize(args: CanonicalizeArgs): Promise<CanonicalizedResult> {
  const { llm, mentions, existingEntityBases, existingConceptBases,
          sourceFilename, today, guideHint, provider, model } = args

  if (mentions.length === 0) {
    return { entities: [], concepts: [], dropped: [] }
  }

  const prompt = buildCanonicalizerPrompt({
    mentions, existingEntityBases, existingConceptBases,
    sourceFilename, guideHint,
  })

  const raw = await callLLMWithRetry(llm, prompt, provider, model)
  return assembleCanonicalResult(raw, mentions, sourceFilename, today)
}

// ── Prompt construction ──

interface PromptArgs {
  mentions: readonly Mention[]
  existingEntityBases: readonly string[]
  existingConceptBases: readonly string[]
  sourceFilename: string
  guideHint?: string
}

export function buildCanonicalizerPrompt(args: PromptArgs): string {
  const { mentions, existingEntityBases, existingConceptBases, sourceFilename, guideHint } = args

  const guideBlock = guideHint?.trim()
    ? `\n## 사용자 강조 지시 (우선 준수)\n\n> ${guideHint.trim()}\n`
    : ''

  // Existing pages — single flat list (v3 lesson: don't expose entity/concept split)
  const allExisting = Array.from(new Set([...existingEntityBases, ...existingConceptBases])).sort()
  const existingBlock = allExisting.length > 0
    ? `\n## 기존 wiki 페이지 (${allExisting.length}개) — 동일 대상 발견 시 filename 그대로 재사용\n${allExisting.slice(0, 80).map((x) => `\`${x}\``).join(', ')}\n`
    : ''

  // Mentions — compact JSON list
  const mentionsBlock = mentions.map((m, i) => {
    const evidence = m.evidence.slice(0, 200).replace(/\s+/g, ' ').trim()
    return `${i + 1}. \`${m.name}\` (hint: ${m.type_hint ?? 'unknown'}) — ${evidence}`
  }).join('\n')

  return `당신은 wikey LLM Wiki의 canonicalizer입니다. chunk LLM이 추출한 mention 리스트를 받아 schema에 맞춰 분류하고 canonical filename으로 통합합니다.

Source: ${sourceFilename}
${guideBlock}
${buildSchemaPromptBlock()}

## 작업 규칙

1. **분류**: 각 mention을 위 7개 타입 중 하나로 분류. 어디에도 안 맞으면 entities/concepts 출력에서 **제외** (자동 dropped 처리됨).
2. **약어↔풀네임 통합**: \`pms\`와 \`project-management-system\`이 같은 mention이면 풀네임 1개만 출력 (약어는 \`aliases\`에).
3. **기존 페이지 재사용**: 위 "기존 wiki 페이지" 목록과 매칭되면 filename은 기존 base 그대로 사용 (예: \`goodstream-co-ltd\` 발견 → \`goodstream\`로 새로 만들지 말 것).
4. **거부 패턴 자동 제외**: 한국어 라벨, X-management/X-service 같은 단순 기능명, 비즈니스 객체(quotation/order 등)는 schema 위반이므로 제외.
5. **filename 형식**: \`name\` 필드는 base name만 (소문자, 하이픈 구분, .md/디렉토리 prefix 금지).
6. **description**: 1~2문장, 산업 표준 정의 위주 (기능 설명 X).

## 입력 mention (${mentions.length}개)

${mentionsBlock}

## 출력 형식

JSON only:
\`\`\`json
{
  "entities": [
    {"name": "goodstream-co-ltd", "type": "organization", "description": "주식회사 굿스트림. 소프트웨어 개발/제조업.", "aliases": ["goodstream"]}
  ],
  "concepts": [
    {"name": "project-management-body-of-knowledge", "type": "standard", "description": "PMI가 제정한 프로젝트 관리 표준 지식체계.", "aliases": ["pmbok"]}
  ],
  "index_additions": [
    "- [[goodstream-co-ltd]] — 주식회사 굿스트림 (소스: 1개)"
  ],
  "log_entry": "- 엔티티 생성: [[goodstream-co-ltd]]\\n- 개념 생성: [[project-management-body-of-knowledge]]"
}
\`\`\`

규칙 위반 mention은 **entities/concepts에서 빼면 됨** (별도 dropped 필드 X — 코드가 자동 추적).`
}

// ── Response assembly ──

function assembleCanonicalResult(
  raw: RawCanonical,
  mentions: readonly Mention[],
  sourceFilename: string,
  today: string,
): CanonicalizedResult {
  const dropped: Array<{ mention: Mention; reason: string }> = []
  const keptBases = new Set<string>()
  const entities: WikiPage[] = []
  const concepts: WikiPage[] = []

  for (const e of raw.entities ?? []) {
    const result = validateAndBuildPage(e, 'entity', sourceFilename, today)
    if (!result.ok) continue
    entities.push(result.page)
    keptBases.add(normalizeBase(result.page.filename))
    for (const alias of e.aliases ?? []) keptBases.add(normalizeBase(alias))
  }

  for (const c of raw.concepts ?? []) {
    const result = validateAndBuildPage(c, 'concept', sourceFilename, today)
    if (!result.ok) continue
    // Cross-pool dedup: if entity with same base already kept, skip concept
    if (keptBases.has(normalizeBase(result.page.filename))) continue
    concepts.push(result.page)
    keptBases.add(normalizeBase(result.page.filename))
    for (const alias of c.aliases ?? []) keptBases.add(normalizeBase(alias))
  }

  // Track dropped mentions: anything in `mentions` whose normalized name (or hint) didn't survive
  for (const m of mentions) {
    const base = normalizeBase(m.name)
    if (keptBases.has(base)) continue
    const reason = computeDropReason(m)
    dropped.push({ mention: m, reason })
  }

  return {
    entities, concepts, dropped,
    indexAdditions: raw.index_additions,
    logEntry: raw.log_entry,
  }
}

interface PageBuildOk { ok: true; page: WikiPage }
interface PageBuildFail { ok: false; reason: string }

function validateAndBuildPage(
  raw: { name?: string; type?: string; description?: string },
  category: 'entity' | 'concept',
  sourceFilename: string,
  today: string,
): PageBuildOk | PageBuildFail {
  const name = (raw.name ?? '').trim()
  if (!name) return { ok: false, reason: 'empty name' }

  const base = normalizeBase(name)
  const antiPattern = detectAntiPattern(base)
  if (antiPattern) return { ok: false, reason: antiPattern }

  const type = (raw.type ?? '').trim()
  if (category === 'entity' && !isValidEntityType(type)) {
    return { ok: false, reason: `invalid entity type "${type}"` }
  }
  if (category === 'concept' && !isValidConceptType(type)) {
    return { ok: false, reason: `invalid concept type "${type}"` }
  }

  const description = (raw.description ?? '').trim() || '(설명 없음)'

  const page: WikiPage = {
    filename: `${base}.md`,
    category: category === 'entity' ? 'entities' : 'concepts',
    entityType: category === 'entity' ? (type as EntityType) : undefined,
    conceptType: category === 'concept' ? (type as ConceptType) : undefined,
    content: buildPageContent({ name: base, type, description, category, sourceFilename, today }),
  }
  return { ok: true, page }
}

function buildPageContent(args: {
  name: string; type: string; description: string;
  category: 'entity' | 'concept'; sourceFilename: string; today: string;
}): string {
  const { name, type, description, category, sourceFilename, today } = args
  const typeField = category === 'entity' ? `entity_type: ${type}` : `concept_type: ${type}`
  return `---
title: ${name}
type: ${category}
${typeField}
created: ${today}
updated: ${today}
sources: [${sourceFilename}]
tags: []
---

# ${name}

${description}

## 출처

- [[${sourceFilename.replace(/\.[^.]+$/, '')}]]
`
}

function computeDropReason(mention: Mention): string {
  const base = normalizeBase(mention.name)
  const antiPattern = detectAntiPattern(base)
  if (antiPattern) return antiPattern
  if (!mention.type_hint || mention.type_hint === 'unknown') return 'no type_hint'
  return 'rejected by canonicalizer LLM'
}

// ── LLM helpers ──

async function callLLMWithRetry(
  llm: LLMClient, prompt: string, provider: string, model: string,
): Promise<RawCanonical> {
  for (let attempt = 0; attempt <= MAX_JSON_RETRIES; attempt++) {
    const llmOpts = provider === 'gemini'
      ? { provider: provider as any, model, responseMimeType: 'application/json' as const, jsonMode: true }
      : { provider: provider as any, model, jsonMode: true }
    const response = await llm.call(prompt, llmOpts)
    const parsed = extractJsonBlock(response)
    if (parsed) return parsed
  }
  throw new Error('Canonicalizer JSON parse failed — max retries exceeded')
}

function extractJsonBlock(response: string): RawCanonical | null {
  // Try fenced JSON block
  const fenced = response.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) {
    try { return JSON.parse(fenced[1]) } catch { /* fall through */ }
  }
  // Try bare JSON object
  const start = response.indexOf('{')
  if (start < 0) return null
  // Naive: take from first { to last }
  const end = response.lastIndexOf('}')
  if (end < 0) return null
  try { return JSON.parse(response.slice(start, end + 1)) } catch { return null }
}
