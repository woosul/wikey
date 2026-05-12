import { describe, it, expect } from 'vitest'
import {
  DEFAULT_PROMOTION_THRESHOLD,
  loadPromotionThreshold,
  parsePromotionThresholdYaml,
  // §5.17 Step B RED — Spec 1 (I1, I3, I4): ceiling/charsPerPage/ceilingMin 외부화 의무.
  // 현 코드에는 미구현이라 import resolution 자체가 FAIL → RED 확증.
  loadPromotionConfig,
  DEFAULT_CHARS_PER_PAGE,
  DEFAULT_CEILING_MIN,
  type PromotionThresholdConfig,
} from '../promotion-config.js'
import type { WikiFS } from '../types.js'

function makeFS(files: Record<string, string>): WikiFS {
  return {
    async read(path) {
      if (path in files) return files[path]
      throw new Error(`ENOENT: ${path}`)
    },
    async write() { /* no-op */ },
    async exists(path) { return path in files },
    async list() { return [] },
    async walk() { return [] },
  }
}

describe('parsePromotionThresholdYaml', () => {
  it('AC-B1: empty input → null (default fallback)', () => {
    expect(parsePromotionThresholdYaml('')).toBeNull()
    expect(parsePromotionThresholdYaml('   \n\n')).toBeNull()
  })

  it('AC-B2: `default: 1` → 1', () => {
    expect(parsePromotionThresholdYaml('default: 1\n')).toBe(1)
    expect(parsePromotionThresholdYaml('default:1')).toBe(1)
    expect(parsePromotionThresholdYaml('default :  1  ')).toBe(1)
  })

  it('AC-B3: `default: 3` → 3', () => {
    expect(parsePromotionThresholdYaml('default: 3\n# comment\n')).toBe(3)
  })

  it('AC-B5: invalid value → null (fallback)', () => {
    expect(parsePromotionThresholdYaml('default: abc')).toBeNull()
    expect(parsePromotionThresholdYaml('default: 0')).toBeNull()
    expect(parsePromotionThresholdYaml('default: -1')).toBeNull()
    expect(parsePromotionThresholdYaml('default: 1.5')).toBeNull()
  })

  it('AC-B5: malformed YAML → null', () => {
    expect(parsePromotionThresholdYaml('not yaml at all\n')).toBeNull()
    expect(parsePromotionThresholdYaml('threshold: 2\n')).toBeNull() // wrong key
  })

  it('comments / leading whitespace tolerated', () => {
    expect(parsePromotionThresholdYaml('# header comment\ndefault: 2\n')).toBe(2)
  })
})

describe('loadPromotionThreshold', () => {
  const PATH = '.wikey/promotion-threshold.yaml'

  it('AC-B1: file absent → DEFAULT_PROMOTION_THRESHOLD (=2)', async () => {
    const fs = makeFS({})
    const t = await loadPromotionThreshold(fs)
    expect(t).toBe(DEFAULT_PROMOTION_THRESHOLD)
    expect(t).toBe(2)
  })

  it('AC-B2: `default: 1` file → 1', async () => {
    const fs = makeFS({ [PATH]: 'default: 1\n' })
    expect(await loadPromotionThreshold(fs)).toBe(1)
  })

  it('AC-B3: `default: 3` file → 3', async () => {
    const fs = makeFS({ [PATH]: 'default: 3\n' })
    expect(await loadPromotionThreshold(fs)).toBe(3)
  })

  it('AC-B5: malformed file → DEFAULT_PROMOTION_THRESHOLD', async () => {
    const fs = makeFS({ [PATH]: 'default: abc\n' })
    expect(await loadPromotionThreshold(fs)).toBe(DEFAULT_PROMOTION_THRESHOLD)
  })

  it('AC-B5: read throws → DEFAULT_PROMOTION_THRESHOLD', async () => {
    const fs: WikiFS = {
      async read() { throw new Error('I/O failure') },
      async write() {},
      async exists() { return true },
      async list() { return [] },
      async walk() { return [] },
    }
    expect(await loadPromotionThreshold(fs)).toBe(DEFAULT_PROMOTION_THRESHOLD)
  })
})

/**
 * §5.17 Step B (RED) — Spec 1 invariants:
 *   I1 (ratio 외부화): ceiling.charsPerPage 가 yaml 또는 default 1500 으로 노출
 *   I3 (hardcoded list 0): ceiling config 는 *count* 만 — entity name list 없음
 *   I4 (config override 우선): yaml 의 ceiling.charsPerPage / ceiling.absolute / ceilingMin 적용
 *
 * 통과 조건: 신규 export `loadPromotionConfig` / `DEFAULT_CHARS_PER_PAGE` /
 * `DEFAULT_CEILING_MIN` / `PromotionThresholdConfig` 가 implement 되어야 PASS.
 * RED 단계 = 현 코드에 미구현 → import resolution / type / assertion FAIL.
 */
describe('§5.17 loadPromotionConfig — ceiling / charsPerPage 외부화 (Spec 1 I1/I3/I4)', () => {
  const PATH = '.wikey/promotion-threshold.yaml'

  // T1 ↔ Spec 1 I1 (Happy default — yaml 부재 시 charsPerPage = 1500)
  it('T1 ↔ Spec 1 I1: yaml 부재 → config.ceiling.charsPerPage = DEFAULT_CHARS_PER_PAGE (1500)', async () => {
    const fs = makeFS({})
    const config: PromotionThresholdConfig = await loadPromotionConfig(fs)
    expect(DEFAULT_CHARS_PER_PAGE).toBe(1500)
    expect(config.ceiling?.charsPerPage ?? DEFAULT_CHARS_PER_PAGE).toBe(1500)
  })

  // T2 ↔ Spec 1 I1 (Edge — absolute 는 yaml 부재 시 undefined)
  it('T2 ↔ Spec 1 I1: yaml 부재 → config.ceiling.absolute = undefined (no default hard cap)', async () => {
    const fs = makeFS({})
    const config: PromotionThresholdConfig = await loadPromotionConfig(fs)
    expect(config.ceiling?.absolute).toBeUndefined()
  })

  // T3 ↔ Spec 1 I1 (Happy — ceilingMin default 8)
  it('T3 ↔ Spec 1 I1: yaml 부재 → DEFAULT_CEILING_MIN = 8 (schema 권고 5~15 lower-mid)', async () => {
    const fs = makeFS({})
    const config: PromotionThresholdConfig = await loadPromotionConfig(fs)
    expect(DEFAULT_CEILING_MIN).toBe(8)
    expect(config.ceilingMin ?? DEFAULT_CEILING_MIN).toBe(8)
  })

  // T4 ↔ Spec 1 I4 (Edge — yaml override)
  it('T4 ↔ Spec 1 I4: yaml `ceiling: { charsPerPage: 3000 }` → config 가 3000 반환', async () => {
    const yaml = [
      'default: 2',
      'ceiling:',
      '  charsPerPage: 3000',
      '',
    ].join('\n')
    const fs = makeFS({ [PATH]: yaml })
    const config: PromotionThresholdConfig = await loadPromotionConfig(fs)
    expect(config.ceiling?.charsPerPage).toBe(3000)
  })
})
