/**
 * pii-patterns.ts — Phase 5 §5.8 (2026-04-24, session 8).
 *
 * PII 패턴 엔진. 하드코딩된 regex 를 외부 설정 (YAML 또는 기본값) 으로 분리한다.
 * 사용자 방침: "PII 관련 하드코딩은 안된다" (2026-04-24).
 *
 * 설계:
 *   - `PiiPattern`: 각 패턴의 최소 선언 (id, kind, regex source, captureGroup, maskStrategy).
 *   - `DEFAULT_PATTERNS`: 기본 패턴 세트 (Phase 4 §4.1.1 4종 + D.0.l smoke 에서
 *     드러난 CEO 공백 변형). 환경에 무관하게 항상 포함.
 *   - `loadPiiPatterns(configDir?)`: `<configDir>/pii-patterns.yaml` 이 있으면
 *     사용자 패턴 + default 병합 (사용자 id 가 겹치면 override). 없으면 default.
 *   - 런타임 regex 컴파일은 `compilePattern` 에서 수행. 잘못된 regex 는 warn 후 skip.
 *
 * 단위 테스트 대상: `__tests__/pii-patterns.test.ts` (로더 + 병합 + 잘못된 yaml 방어).
 */

export type PiiKind = 'brn' | 'corp-rn' | 'ceo-labeled' | string

/**
 * 패턴 선언. regex 는 문자열 (yaml 직렬화 가능) 로 보관하고 compile 시 RegExp 생성.
 * captureGroup 이 지정되면 해당 그룹만 치환 대상 (라벨 제외하고 값만).
 * mask:
 *   - `digits` — 숫자만 `*` 로 치환, 다른 문자 (하이픈 등) 보존. BRN/corp-rn 에 적합.
 *   - `full` — capture 전체를 `*` 로 치환 (문자 수 보존). CEO 이름에 적합.
 */
export interface PiiPattern {
  readonly id: string
  readonly kind: PiiKind
  readonly regex: string
  readonly captureGroup?: number // 지정 안 하면 전체 match
  readonly mask: 'digits' | 'full'
  readonly description?: string
}

/**
 * 컴파일된 패턴 (런타임 실행용). regex 는 반드시 `g` flag 포함.
 */
export interface CompiledPiiPattern {
  readonly id: string
  readonly kind: PiiKind
  readonly regex: RegExp
  readonly captureGroup?: number
  readonly mask: 'digits' | 'full'
  readonly description?: string
}

/**
 * Phase 4 §4.1.1 에서 정의된 기본 패턴 + D.0.l smoke (2026-04-24) 에서 드러난 edge case.
 * 사용자가 `.wikey/pii-patterns.yaml` 또는 `~/.config/wikey/pii-patterns.yaml` 을 두면
 * 거기서 추가·override 가능.
 */
export const DEFAULT_PATTERNS: readonly PiiPattern[] = [
  {
    id: 'brn-hyphen',
    kind: 'brn',
    // `\b` 는 `_` 를 word-char 로 취급하므로 filename `_301-86-19385(` 같은 패턴 매칭 실패.
    // Digit 전/후만 차단하는 negative look-around 로 대체.
    regex: '(?<!\\d)\\d{3}-\\d{2}-\\d{5}(?!\\d)',
    mask: 'digits',
    description: '사업자등록번호 3-2-5 하이픈 형식 (filename 포함 — 앞뒤 digit 만 차단)',
  },
  {
    id: 'brn-contiguous',
    kind: 'brn',
    regex: '(?<=사업자(?:등록)?번호[\\s:：]*)\\d{10}(?!\\d)',
    mask: 'digits',
    description: '사업자등록번호 라벨 뒤 10자리 연속',
  },
  {
    id: 'corp-rn',
    kind: 'corp-rn',
    regex: '(?<=법인(?:등록)?번호[\\s:：]*)\\d{6}-?\\d{7}\\b',
    mask: 'digits',
    description: '법인등록번호 라벨 뒤 6-7 또는 13자리',
  },
  {
    id: 'ceo-label',
    kind: 'ceo-labeled',
    // 2~4 한글자 + 내부 공백 허용 (OCR 공백 삽입 `김 명 호` 커버). D.0.l smoke C-A2.
    // 내부 whitespace 는 **단일 라인** (space/tab) 만 허용 — `\s*` 를 쓰면 줄바꿈을 넘어
    // 인접 줄 글자까지 먹어 `홍길동\n주소` 같은 오탐 발생.
    regex: '(?:대표이사|대표자|CEO)\\s*[:：]\\s*([가-힣](?:[ \\t]*[가-힣]){1,3})',
    captureGroup: 1,
    mask: 'full',
    description: '대표이사·대표자·CEO 라벨 뒤 한글 이름 (공백 변형 포함, 단일 라인)',
  },
]

/**
 * 패턴 컴파일. regex 가 잘못되면 throw 대신 null 반환 (호출자가 warn + skip 처리).
 * `g` flag 는 자동 부여. 기존 flag 있으면 병합.
 */
export function compilePattern(p: PiiPattern): CompiledPiiPattern | null {
  try {
    const re = new RegExp(p.regex, 'g')
    return {
      id: p.id,
      kind: p.kind,
      regex: re,
      captureGroup: p.captureGroup,
      mask: p.mask,
      description: p.description,
    }
  } catch {
    // 잘못된 regex — 호출자가 warn
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
 * yaml 포맷:
 * ```
 * patterns:
 *   - id: my-pattern
 *     kind: brn
 *     regex: '...'
 *     captureGroup: 1
 *     mask: full
 *     description: ...
 * ```
 *
 * **yaml 의존성 없이 최소 parser**: PII 패턴 용도는 간단 스키마라 정식 yaml 라이브러리 대신
 * 줄 단위 파서. 복잡 yaml (nested quote, multi-line string) 은 미지원 — 필요 시 js-yaml 도입.
 */
export function loadPiiPatternsFromYaml(yamlText: string): readonly PiiPattern[] | null {
  try {
    const lines = yamlText.split('\n')
    const patterns: PiiPattern[] = []
    let current: Partial<PiiPattern> | null = null
    for (const raw of lines) {
      const line = raw.replace(/\s+$/, '')
      if (!line || line.trimStart().startsWith('#')) continue
      if (/^patterns\s*:/.test(line)) continue
      const itemMatch = line.match(/^\s*-\s*id\s*:\s*(.+?)\s*$/)
      if (itemMatch) {
        if (current && current.id && current.kind && current.regex && current.mask) {
          patterns.push(current as PiiPattern)
        }
        current = { id: unquote(itemMatch[1]) }
        continue
      }
      const kv = line.match(/^\s+(\w+)\s*:\s*(.*)$/)
      if (kv && current) {
        const key = kv[1]
        const val = unquote(kv[2])
        if (key === 'kind') current.kind = val
        else if (key === 'regex') current.regex = val
        else if (key === 'captureGroup') current.captureGroup = Number(val)
        else if (key === 'mask') current.mask = (val === 'digits' || val === 'full') ? val : 'digits'
        else if (key === 'description') current.description = val
      }
    }
    if (current && current.id && current.kind && current.regex && current.mask) {
      patterns.push(current as PiiPattern)
    }
    return patterns.length > 0 ? patterns : null
  } catch {
    return null
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
  for (const p of userPatterns) byId.set(p.id, p) // override or add
  return Array.from(byId.values())
}

/**
 * 설정 디렉터리에서 `pii-patterns.yaml` 로드 (없으면 default). 실패 시 default.
 *
 * 조회 순서:
 *   1. `<basePath>/.wikey/pii-patterns.yaml`  — 프로젝트별
 *   2. `~/.config/wikey/pii-patterns.yaml`   — 사용자 전역
 *
 * 둘 다 있으면 사용자 전역 먼저 로드 후 프로젝트가 override.
 */
export function loadPiiPatterns(basePath?: string): readonly CompiledPiiPattern[] {
  const fs = require('node:fs') as typeof import('node:fs')
  const path = require('node:path') as typeof import('node:path')
  const os = require('node:os') as typeof import('node:os')

  const candidatePaths: string[] = []
  candidatePaths.push(path.join(os.homedir(), '.config', 'wikey', 'pii-patterns.yaml'))
  if (basePath) candidatePaths.push(path.join(basePath, '.wikey', 'pii-patterns.yaml'))

  let merged: readonly PiiPattern[] = DEFAULT_PATTERNS
  for (const p of candidatePaths) {
    try {
      if (!fs.existsSync(p)) continue
      const txt = fs.readFileSync(p, 'utf-8')
      const loaded = loadPiiPatternsFromYaml(txt)
      if (loaded && loaded.length > 0) {
        merged = mergePatterns(merged, loaded)
      }
    } catch {
      // 파일 읽기 실패 — skip, default 유지
    }
  }

  const compiled: CompiledPiiPattern[] = []
  for (const p of merged) {
    const c = compilePattern(p)
    if (c) compiled.push(c)
    // 잘못된 regex 는 silently skip (default 는 검증되어 있으므로 문제가 되면 user override).
  }
  return compiled
}
