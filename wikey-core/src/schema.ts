import type { SchemaOverride, StandardDecomposition, WikiFS } from './types.js'

/**
 * Phase 5 §5.10.3 + §5.10.4 (D-wide LLM-only ontology): schema gate 전부 폐기.
 *
 * 변경 history:
 * - ~Phase 5 §5.4: 4 entity + 3 concept type union 강제 + standard_decompositions
 *   (BUILTIN PMBOK 등) + Stage 3 self-declaration runtime merge.
 * - §5.10.3 D-wide: ENTITY_TYPES / CONCEPT_TYPES / isValidEntityType /
 *   isValidConceptType / detectAntiPattern / buildSchemaPromptBlock 폐기. LLM 자율 type.
 * - §5.10.4 D-wide completion: BUILTIN_STANDARD_DECOMPOSITIONS / parseSchemaOverrideYaml /
 *   buildStandardDecompositionBlock / loadSchemaOverride 모두 폐기. canonicalizer 가
 *   schemaOverride 받지 않고 LLM 자율 type 분류 + alias normalization (canonicalizer.ts
 *   내부 SLUG_ALIASES) 으로 동작.
 *
 * 보존 (별 layer):
 * - canonicalizer.ts SLUG_ALIASES (canonical slug normalization, deterministic)
 * - .wikey/pii-patterns.yaml (별 file 에서 pii-patterns.ts 가 load)
 *
 * §5.10.4 P2-2 (codex finding) 후속: .wikey/schema.yaml 의 aliases 영역을 SLUG_ALIASES
 * 와 merge 하는 minimal parser 신규 도입 예정 — 본 stub 가 그 entry point.
 *
 * 사용자 본질 비판 6 chain (wikey.schema.md 핵심 원칙 #2 "위키는 LLM 이 소유한다") 의
 * 정확한 코드 구현.
 */

/** D-wide stub — schema override 폐기 후 항상 null 반환. */
export async function loadSchemaOverride(
  _wikiFS: WikiFS,
  _path = '.wikey/schema.yaml',
): Promise<SchemaOverride | null> {
  return null
}

/**
 * §5.10.4 P2-2 (codex follow-up): minimal `.wikey/schema.yaml` aliases parser.
 *
 * D-wide 보존 영역 = `aliases` (canonical slug normalization) + `pii_patterns` (별 layer).
 * 본 함수는 `aliases:` block 만 read — `pii_patterns` 는 `pii-patterns.ts` 가 별 file
 * (`.wikey/pii-patterns.yaml`) 에서 별도 load.
 *
 * 지원 syntax (minimal, anchors / multiline scalars 미지원):
 *   aliases:
 *     <canonical-slug>:
 *       - "<variant 1>"
 *       - "<variant 2>"
 *
 * 결과: `{ "<variant>": "<canonical-slug>", ... }` — `canonicalizer.ts::canonicalizeSlug`
 * 가 SLUG_ALIASES 와 merge 하여 사용 (variant → canonical 방향). variant 는 그대로
 * (lowercase / hyphen 변환은 canonicalizer 의 normalizeBase 가 수행).
 */
export async function loadUserAliases(
  wikiFS: WikiFS,
  path = '.wikey/schema.yaml',
): Promise<Readonly<Record<string, string>>> {
  if (!(await wikiFS.exists(path).catch(() => false))) return {}
  let raw: string
  try {
    raw = await wikiFS.read(path)
  } catch {
    return {}
  }
  return parseUserAliasesYaml(raw)
}

export function parseUserAliasesYaml(input: string): Readonly<Record<string, string>> {
  const out: Record<string, string> = {}
  if (!input.trim()) return out
  let inAliases = false
  let currentCanonical: string | null = null
  for (const rawLine of input.split(/\r?\n/)) {
    const stripped = rawLine.replace(/\s+#.*$/, '').replace(/^#.*$/, '')
    if (!stripped.trim()) continue
    if (/^aliases\s*:\s*$/.test(stripped)) {
      inAliases = true
      currentCanonical = null
      continue
    }
    if (/^[a-zA-Z_]/.test(stripped) && !/^aliases\s*:/.test(stripped)) {
      inAliases = false
      currentCanonical = null
      continue
    }
    if (!inAliases) continue
    const canonicalKey = stripped.match(/^[ \t]+([a-zA-Z0-9_-]+)\s*:\s*$/)
    if (canonicalKey) {
      currentCanonical = canonicalKey[1].trim()
      continue
    }
    const variantItem = stripped.match(/^[ \t]+-\s+(.+)$/)
    if (variantItem && currentCanonical) {
      const variant = variantItem[1].trim().replace(/^["']|["']$/g, '')
      if (variant) out[variant] = currentCanonical
    }
  }
  return out
}

/**
 * D-wide stub — empty array. 보존 이유: deprecated `suggestion-detector.ts` 가 import
 * (해당 module 의 test 는 §5.10.4 R8.2 에서 .skip 처리, runtime 호출 사이트는 ingest-pipeline
 * 에서 §5.10.4 P1-2 으로 제거). 본 stub 은 build green 만 보장.
 */
export const BUILTIN_STANDARD_DECOMPOSITIONS: readonly StandardDecomposition[] = []
