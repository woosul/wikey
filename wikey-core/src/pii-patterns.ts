/**
 * pii-patterns.ts — Phase 5 §5.8 (2026-04-24, session 8) + §5.1 (2026-04-25).
 *
 * PII 패턴 엔진. 하드코딩된 regex 를 외부 설정 (YAML 또는 기본값) 으로 분리한다.
 * 사용자 방침: "PII 관련 하드코딩은 안된다" (2026-04-24).
 *
 * §5.1 (2026-04-25): discriminated union 도입. 기존 single-line 패턴은 그대로 유지하고,
 * multi-line 폼 (label ↔ value 가 서로 다른 줄) 을 커버하는 `structural` 패턴을 추가.
 *
 * 설계:
 *   - `PiiPattern` = `SingleLinePiiPattern | StructuralPiiPattern` (discriminator: `patternType`).
 *   - `DEFAULT_PATTERNS`: 기본 single-line 패턴 세트. bundled default YAML 로드 실패 시 fallback.
 *   - `loadPiiPatterns(configDir?)`: bundled default YAML + `~/.config/wikey/pii-patterns.yaml`
 *     + `<configDir>/.wikey/pii-patterns.yaml` 병합. override 순서는 아래가 우선.
 *   - 런타임 regex 컴파일은 `compilePattern` 에서 수행. 잘못된 regex 는 warn 후 skip.
 *
 * 단위 테스트: `__tests__/pii-redact.test.ts` (single-line + 엔진), `__tests__/pii-structural.test.ts` (§5.1).
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export type PiiKind =
  | 'brn'
  | 'corp-rn'
  | 'ceo-labeled'
  | 'ceo-structural'
  | 'brn-structural'
  | string

/**
 * 기존 single-line 패턴.
 *
 * `patternType` 은 **optional** (default `'single-line'`). 이유: 기존 호출자가
 * `{id, kind, regex, mask}` 로 객체 리터럴을 직접 생성 (`pii-redact.test.ts` 등).
 * `patternType` 을 required 로 만들면 모든 호출자가 type error — 하위 호환을 위해 optional.
 */
export interface SingleLinePiiPattern {
  readonly id: string
  readonly patternType?: 'single-line'
  readonly kind: PiiKind
  readonly regex: string
  readonly captureGroup?: number
  readonly mask: 'digits' | 'full'
  readonly description?: string
}

/**
 * §5.1 신규 structural 패턴. `patternType` 은 필수 discriminator.
 *
 * `labelPattern` 이 일치한 뒤 forward window (non-empty 줄 N개) 안에서 `valuePattern`
 * 의 모든 매치를 수집. `valueExcludePrefixes` 에 걸리는 후보는 배제.
 */
export interface StructuralPiiPattern {
  readonly id: string
  readonly patternType: 'structural'
  readonly kind: PiiKind
  readonly labelPattern: string
  readonly valuePattern: string
  /** non-empty 줄 개수 기준. default 5. */
  readonly windowLines: number
  readonly windowChars?: number
  readonly valueExcludePrefixes?: readonly string[]
  readonly mask: 'digits' | 'full'
  readonly description?: string
}

export type PiiPattern = SingleLinePiiPattern | StructuralPiiPattern

/**
 * 컴파일된 single-line 패턴. regex 는 `g` flag 포함.
 */
export interface CompiledSingleLinePiiPattern {
  readonly id: string
  readonly patternType: 'single-line'
  readonly kind: PiiKind
  readonly regex: RegExp
  readonly captureGroup?: number
  readonly mask: 'digits' | 'full'
  readonly description?: string
}

/**
 * 컴파일된 structural 패턴. label/value 두 regex 모두 `g` flag 포함.
 */
export interface CompiledStructuralPiiPattern {
  readonly id: string
  readonly patternType: 'structural'
  readonly kind: PiiKind
  readonly labelRegex: RegExp
  readonly valueRegex: RegExp
  readonly windowLines: number
  readonly windowChars?: number
  readonly valueExcludePrefixes?: readonly string[]
  readonly mask: 'digits' | 'full'
  readonly description?: string
}

export type CompiledPiiPattern = CompiledSingleLinePiiPattern | CompiledStructuralPiiPattern

/**
 * Phase 4 §4.1.1 에서 정의된 기본 패턴 + D.0.l smoke (2026-04-24) 에서 드러난 edge case.
 * bundled default YAML 로드 실패 시 **fallback** 으로만 사용. 정상 경로는 YAML 로드.
 */
export const DEFAULT_PATTERNS: readonly PiiPattern[] = [
  {
    id: 'brn-hyphen',
    patternType: 'single-line',
    kind: 'brn',
    regex: '(?<!\\d)\\d{3}-\\d{2}-\\d{5}(?!\\d)',
    mask: 'digits',
    description: '사업자등록번호 3-2-5 하이픈 형식 (filename 포함 — 앞뒤 digit 만 차단)',
  },
  {
    id: 'brn-contiguous',
    patternType: 'single-line',
    kind: 'brn',
    regex: '(?<=사업자(?:등록)?번호[\\s:：]*)\\d{10}(?!\\d)',
    mask: 'digits',
    description: '사업자등록번호 라벨 뒤 10자리 연속',
  },
  {
    id: 'corp-rn',
    patternType: 'single-line',
    kind: 'corp-rn',
    regex: '(?<=법인(?:등록)?번호[\\s:：]*)\\d{6}-?\\d{7}\\b',
    mask: 'digits',
    description: '법인등록번호 라벨 뒤 6-7 또는 13자리',
  },
  {
    id: 'ceo-label',
    patternType: 'single-line',
    kind: 'ceo-labeled',
    regex: '(?:대표이사|대표자|CEO)\\s*[:：]\\s*([가-힣](?:[ \\t]*[가-힣]){1,3})',
    captureGroup: 1,
    mask: 'full',
    description: '대표이사·대표자·CEO 라벨 뒤 한글 이름 (공백 변형 포함, 단일 라인)',
  },
]

/**
 * 패턴 컴파일. regex 가 잘못되면 throw 대신 null 반환 (호출자가 warn + skip 처리).
 * `g` flag 는 자동 부여.
 */
export function compilePattern(p: PiiPattern): CompiledPiiPattern | null {
  try {
    if (p.patternType === 'structural') {
      if (!p.labelPattern || !p.valuePattern) return null
      const labelRegex = new RegExp(p.labelPattern, 'g')
      const valueRegex = new RegExp(p.valuePattern, 'g')
      return {
        id: p.id,
        patternType: 'structural',
        kind: p.kind,
        labelRegex,
        valueRegex,
        windowLines: p.windowLines,
        windowChars: p.windowChars,
        valueExcludePrefixes: p.valueExcludePrefixes,
        mask: p.mask,
        description: p.description,
      }
    }
    // single-line (default)
    if (!p.regex) return null
    const re = new RegExp(p.regex, 'g')
    return {
      id: p.id,
      patternType: 'single-line',
      kind: p.kind,
      regex: re,
      captureGroup: p.captureGroup,
      mask: p.mask,
      description: p.description,
    }
  } catch {
    return null
  }
}

/**
 * DEFAULT_PATTERNS 전체를 컴파일. 내부 default 는 검증되어 있으므로 null 이 나오면 버그.
 */
export function compileDefaults(): readonly CompiledPiiPattern[] {
  const out: CompiledPiiPattern[] = []
  for (const p of DEFAULT_PATTERNS) {
    const c = compilePattern(p)
    if (c) out.push(c)
  }
  return out
}

/**
 * yaml 파일 로딩. 없으면 null. yaml 파싱 실패 또는 스키마 불일치 시 null + warn.
 *
 * **최소 parser** (js-yaml 의존성 회피):
 *   - 줄 단위 key: value 파싱.
 *   - `- item` 형태의 single-line list 지원 (valueExcludePrefixes 용).
 *   - 기존 single-line 엔트리: patternType 누락 시 'single-line' 로 fallback.
 *   - structural 엔트리: patternType=structural 명시 시 labelPattern/valuePattern/windowLines 필수.
 */
export function loadPiiPatternsFromYaml(yamlText: string): readonly PiiPattern[] | null {
  try {
    const lines = yamlText.split('\n')
    const patterns: PiiPattern[] = []
    // Work-in-progress pattern (flat bag of fields; finalized when next entry starts or EOF).
    let current: Record<string, unknown> | null = null
    let listKey: string | null = null
    let listItems: string[] = []

    const finalizeListIfAny = () => {
      if (current && listKey) {
        current[listKey] = listItems
        listKey = null
        listItems = []
      }
    }

    const finalizeCurrent = () => {
      finalizeListIfAny()
      if (!current) return
      const built = buildPatternFromYamlEntry(current)
      if (built) patterns.push(built)
      current = null
    }

    for (const raw of lines) {
      const line = raw.replace(/\s+$/, '')
      if (!line || line.trimStart().startsWith('#')) continue
      if (/^patterns\s*:/.test(line)) continue

      // New pattern entry header: "  - id: xxx"
      const itemMatch = line.match(/^\s*-\s*id\s*:\s*(.+?)\s*$/)
      if (itemMatch) {
        finalizeCurrent()
        current = { id: unquote(itemMatch[1]) }
        continue
      }

      // List item under a list key (e.g. "    - '주식회사'")
      const listItemMatch = line.match(/^\s+-\s+(.+?)\s*$/)
      if (listItemMatch && listKey && current) {
        listItems.push(unquote(listItemMatch[1]))
        continue
      }

      // Inline list open: "    valueExcludePrefixes: []"
      const inlineEmptyList = line.match(/^\s+(\w+)\s*:\s*\[\s*\]\s*$/)
      if (inlineEmptyList && current) {
        finalizeListIfAny()
        current[inlineEmptyList[1]] = []
        continue
      }

      // Key / value line
      const kv = line.match(/^\s+(\w+)\s*:\s*(.*)$/)
      if (kv && current) {
        const key = kv[1]
        const rawVal = kv[2]
        // If value is empty -> expect a list to follow
        if (rawVal === '') {
          finalizeListIfAny()
          listKey = key
          listItems = []
          continue
        }
        // Any other key closes a pending list.
        finalizeListIfAny()
        const val = unquote(rawVal)
        if (key === 'captureGroup' || key === 'windowLines' || key === 'windowChars') {
          current[key] = Number(val)
        } else {
          current[key] = val
        }
        continue
      }
    }
    finalizeCurrent()
    return patterns.length > 0 ? patterns : null
  } catch {
    return null
  }
}

function buildPatternFromYamlEntry(e: Record<string, unknown>): PiiPattern | null {
  const id = typeof e.id === 'string' ? e.id : null
  const kind = typeof e.kind === 'string' ? e.kind : null
  const mask = e.mask === 'digits' || e.mask === 'full' ? e.mask : null
  if (!id || !kind || !mask) return null

  const patternType = e.patternType
  if (patternType === 'structural') {
    const labelPattern = typeof e.labelPattern === 'string' ? e.labelPattern : null
    const valuePattern = typeof e.valuePattern === 'string' ? e.valuePattern : null
    const windowLines = typeof e.windowLines === 'number' && e.windowLines > 0 ? e.windowLines : null
    if (!labelPattern || !valuePattern || !windowLines) return null
    const windowChars = typeof e.windowChars === 'number' && e.windowChars > 0 ? e.windowChars : undefined
    const valueExcludePrefixes = Array.isArray(e.valueExcludePrefixes)
      ? (e.valueExcludePrefixes as unknown[]).filter((x): x is string => typeof x === 'string')
      : undefined
    const description = typeof e.description === 'string' ? e.description : undefined
    return {
      id,
      patternType: 'structural',
      kind,
      labelPattern,
      valuePattern,
      windowLines,
      windowChars,
      valueExcludePrefixes,
      mask,
      description,
    }
  }

  // single-line (patternType 누락 → 'single-line' fallback)
  const regex = typeof e.regex === 'string' ? e.regex : null
  if (!regex) return null
  const captureGroup = typeof e.captureGroup === 'number' ? e.captureGroup : undefined
  const description = typeof e.description === 'string' ? e.description : undefined
  const pt: 'single-line' | undefined = patternType === 'single-line' ? 'single-line' : undefined
  return {
    id,
    patternType: pt,
    kind,
    regex,
    captureGroup,
    mask,
    description,
  }
}

function unquote(s: string): string {
  const t = s.trim()
  if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) {
    return t.slice(1, -1)
  }
  return t
}

/**
 * 기본 패턴 + 사용자 yaml 패턴 병합. 동일 `id` 가 yaml 에 있으면 yaml 이 default override.
 * 신규 id 는 단순 추가.
 */
export function mergePatterns(
  defaults: readonly PiiPattern[],
  userPatterns: readonly PiiPattern[],
): readonly PiiPattern[] {
  const byId = new Map<string, PiiPattern>()
  for (const p of defaults) byId.set(p.id, p)
  for (const p of userPatterns) byId.set(p.id, p)
  return Array.from(byId.values())
}

/**
 * bundled default YAML 경로 (src/defaults/pii-patterns.default.yaml).
 *
 * ESM 프로젝트 (`"type": "module"`) 특성상 `__dirname` 미정의. `import.meta.url` 기반.
 * 개발 환경: `src/defaults/` 에서 resolve. 배포 환경: 빌드 후 `dist/defaults/` 로 복사.
 */
function bundledDefaultYamlUrl(): URL {
  return new URL('./defaults/pii-patterns.default.yaml', import.meta.url)
}

function readBundledDefaultPatterns(): readonly PiiPattern[] | null {
  try {
    const url = bundledDefaultYamlUrl()
    if (!fs.existsSync(url)) return null
    const txt = fs.readFileSync(url, 'utf-8')
    const loaded = loadPiiPatternsFromYaml(txt)
    return loaded && loaded.length > 0 ? loaded : null
  } catch {
    return null
  }
}

/**
 * 설정 디렉터리에서 `pii-patterns.yaml` 로드. 실패 시 default.
 *
 * 조회 순서 (뒤가 우선 override):
 *   1. bundled default YAML (wikey-core 배포 번들)
 *   2. `~/.config/wikey/pii-patterns.yaml`  — 사용자 전역
 *   3. `<basePath>/.wikey/pii-patterns.yaml`  — 프로젝트별
 *
 * bundled YAML 로드 실패 시 TS `DEFAULT_PATTERNS` 로 fallback (single-line 4종 보장).
 */
export function loadPiiPatterns(basePath?: string): readonly CompiledPiiPattern[] {
  const bundled = readBundledDefaultPatterns()
  let merged: readonly PiiPattern[] = bundled ?? DEFAULT_PATTERNS

  const candidatePaths: string[] = []
  candidatePaths.push(path.join(os.homedir(), '.config', 'wikey', 'pii-patterns.yaml'))
  if (basePath) candidatePaths.push(path.join(basePath, '.wikey', 'pii-patterns.yaml'))

  for (const p of candidatePaths) {
    try {
      if (!fs.existsSync(p)) continue
      const txt = fs.readFileSync(p, 'utf-8')
      const loaded = loadPiiPatternsFromYaml(txt)
      if (loaded && loaded.length > 0) {
        merged = mergePatterns(merged, loaded)
      }
    } catch {
      // skip — 파일 읽기 실패 시 이전 merged 유지
    }
  }

  const compiled: CompiledPiiPattern[] = []
  for (const p of merged) {
    const c = compilePattern(p)
    if (c) compiled.push(c)
  }
  return compiled
}
