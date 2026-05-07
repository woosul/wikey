import { describe, it, expect } from 'vitest'
import {
  DEFAULT_PROMOTION_THRESHOLD,
  loadPromotionThreshold,
  parsePromotionThresholdYaml,
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
    }
    expect(await loadPromotionThreshold(fs)).toBe(DEFAULT_PROMOTION_THRESHOLD)
  })
})
