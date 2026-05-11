import type { WikiFS } from './types.js'

/**
 * §5.15.B: §5.11 v2/v3 page promotion gate 의 user-defined threshold override.
 *
 * Default = 2 (1회만 mention 된 noise 차단). 도메인 (예: 논문 / 기술 매뉴얼) 에 따라
 * 1 (모든 mention promote) 또는 3+ (엄격 정책) 으로 조정 가능.
 *
 * 설정 위치: `.wikey/promotion-threshold.yaml`
 * 형식 (v0 minimal):
 *   default: <integer ≥ 1>
 *
 * patterns / 도메인별 override 는 v0 out-of-scope (사용자 raise 시 확장).
 */

export const PROMOTION_CONFIG_PATH = '.wikey/promotion-threshold.yaml'

/** §5.11 v2 paradigm 기본값. 기존 동작 backwards compat. */
export const DEFAULT_PROMOTION_THRESHOLD = 2

/** §5.17 Spec 1 I1 — body char ÷ N → ceiling N pages (코드 const fallback; yaml override 가능). */
export const DEFAULT_CHARS_PER_PAGE = 1500

/** §5.17 Spec 1 I1 — schema §"인제스트 분할 전략" 5~15 lower-mid; ceiling 의 floor. */
export const DEFAULT_CEILING_MIN = 8

/**
 * §5.17 Spec 1 — Promotion threshold + ceiling 통합 config.
 * `default` 는 §5.15.B mention count threshold, `ceiling` / `ceilingMin` 은 §5.17 outlier cap.
 */
export interface PromotionThresholdConfig {
  readonly default: number
  readonly ceiling?: {
    readonly charsPerPage?: number
    readonly absolute?: number
  }
  readonly ceilingMin?: number
}

/**
 * `default: N` 형태의 minimal YAML parser. 매칭 실패 / 정수 ≥ 1 가 아닌 값 → null
 * (loader 가 default fallback). 주석 (`#`) 과 leading whitespace 허용.
 */
export function parsePromotionThresholdYaml(input: string): number | null {
  if (!input.trim()) return null
  for (const rawLine of input.split(/\r?\n/)) {
    const stripped = rawLine.replace(/\s+#.*$/, '').replace(/^#.*$/, '').trim()
    if (!stripped) continue
    const m = stripped.match(/^default\s*:\s*(\S+)\s*$/)
    if (!m) continue
    const n = Number(m[1])
    if (!Number.isInteger(n) || n < 1) return null
    return n
  }
  return null
}

/**
 * `.wikey/promotion-threshold.yaml` 로드 — 부재 / read 실패 / parse 실패 시
 * DEFAULT_PROMOTION_THRESHOLD fallback (warn console).
 */
export async function loadPromotionThreshold(wikiFS: WikiFS): Promise<number> {
  if (!(await wikiFS.exists(PROMOTION_CONFIG_PATH).catch(() => false))) {
    return DEFAULT_PROMOTION_THRESHOLD
  }
  let raw: string
  try {
    raw = await wikiFS.read(PROMOTION_CONFIG_PATH)
  } catch (err) {
    console.warn(`[promotion-config] read failed: ${PROMOTION_CONFIG_PATH} — ${(err as Error).message}; falling back to default ${DEFAULT_PROMOTION_THRESHOLD}`)
    return DEFAULT_PROMOTION_THRESHOLD
  }
  const parsed = parsePromotionThresholdYaml(raw)
  if (parsed === null) {
    console.warn(`[promotion-config] parse failed: ${PROMOTION_CONFIG_PATH}; falling back to default ${DEFAULT_PROMOTION_THRESHOLD}`)
    return DEFAULT_PROMOTION_THRESHOLD
  }
  return parsed
}

/**
 * §5.17 Spec 1 I1/I4 — yaml 로부터 `ceiling.*` + `ceilingMin` + `default` 통합 load.
 * minimal parser (외부 yaml lib 회피 — Karpathy Simplicity First).
 * yaml 부재 / read 실패 시 default 만 채워진 config 반환 (ceiling/ceilingMin = undefined → 호출측이 DEFAULT_* 적용).
 */
export async function loadPromotionConfig(wikiFS: WikiFS): Promise<PromotionThresholdConfig> {
  const baseDefault = DEFAULT_PROMOTION_THRESHOLD
  if (!(await wikiFS.exists(PROMOTION_CONFIG_PATH).catch(() => false))) {
    return { default: baseDefault }
  }
  let raw: string
  try {
    raw = await wikiFS.read(PROMOTION_CONFIG_PATH)
  } catch (err) {
    console.warn(`[promotion-config] read failed: ${PROMOTION_CONFIG_PATH} — ${(err as Error).message}; using defaults`)
    return { default: baseDefault }
  }
  return parsePromotionConfigYaml(raw, baseDefault)
}

/** I4 — top-level `default:` + nested `ceiling:` block + `ceilingMin:` 인식하는 minimal parser. */
export function parsePromotionConfigYaml(input: string, baseDefault: number): PromotionThresholdConfig {
  const cfg: { default: number; ceiling: Record<string, number>; ceilingMin?: number } = {
    default: baseDefault, ceiling: {},
  }
  let inCeiling = false
  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, '').replace(/^#.*$/, '')
    if (!line.trim()) continue
    const indent = line.length - line.trimStart().length
    const m = line.trim().match(/^([A-Za-z][A-Za-z0-9]*)\s*:\s*(\S.*)?$/)
    if (!m) continue
    const [, key, value] = m
    const v = value?.trim()
    if (indent === 0) {
      inCeiling = key === 'ceiling' && !v
      if (key === 'default' && v) { const n = Number(v); if (Number.isInteger(n) && n >= 1) cfg.default = n }
      else if (key === 'ceilingMin' && v) { const n = Number(v); if (Number.isInteger(n) && n >= 1) cfg.ceilingMin = n }
    } else if (inCeiling && indent >= 2 && v) {
      if (key === 'charsPerPage') { const n = Number(v); if (Number.isFinite(n) && n > 0) cfg.ceiling.charsPerPage = n }
      else if (key === 'absolute') { const n = Number(v); if (Number.isInteger(n) && n >= 1) cfg.ceiling.absolute = n }
      // v0.3 codex cycle #1 P2 closure: `mode` field removed — `ceiling.absolute` 이미 hard cap.
    }
  }
  const ceilingKeys = Object.keys(cfg.ceiling)
  return {
    default: cfg.default,
    ...(ceilingKeys.length > 0 && { ceiling: cfg.ceiling as PromotionThresholdConfig['ceiling'] }),
    ...(cfg.ceilingMin !== undefined && { ceilingMin: cfg.ceilingMin }),
  }
}
