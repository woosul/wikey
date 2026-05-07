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
