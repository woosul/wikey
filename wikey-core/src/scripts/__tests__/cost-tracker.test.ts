/**
 * cost-tracker.test.ts — Phase 5 §5.7.1 (2026-05-08).
 *
 * AC: calcCost / cmdAdd / parseCostLog / cmdSummary / cmdProviders.
 */
import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  calcCost,
  cmdAdd,
  cmdProviders,
  cmdSummary,
  parseCostLog,
  PROVIDER_RATES,
  MONTHLY_BUDGET_USD,
} from '../cost-tracker.js'

describe('calcCost', () => {
  it('claude-code: 1M input + 1M output = 15 + 75 = 90', () => {
    expect(calcCost('claude-code', 1_000_000, 1_000_000)).toBeCloseTo(90.0, 2)
  })

  it('gemini: 0.15 + 0.6 = 0.75', () => {
    expect(calcCost('gemini', 1_000_000, 1_000_000)).toBeCloseTo(0.75, 2)
  })

  it('ollama-local: 0', () => {
    expect(calcCost('ollama-local', 1_000_000, 1_000_000)).toBe(0)
  })

  it('알 수 없는 provider → fallback (claude-code rate)', () => {
    expect(calcCost('unknown-provider', 1_000_000, 1_000_000)).toBeCloseTo(90.0, 2)
  })

  it('zero tokens → 0', () => {
    expect(calcCost('claude-code', 0, 0)).toBe(0)
  })
})

describe('cmdAdd — AC5', () => {
  it('cost-log.md 에 entry 추가 + 정확한 cost 계산', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wikey-571-cost-'))
    try {
      mkdirSync(join(tmp, 'activity'), { recursive: true })
      const errLines: string[] = []
      const r = cmdAdd(
        {
          basePath: tmp,
          today: '2026-05-08',
          writeErr: (s) => errLines.push(s),
        },
        {
          provider: 'claude-code',
          task: 'ingest',
          desc: '테스트 ingest',
          inputTokens: 50_000,
          outputTokens: 30_000,
          durationMin: 10,
          notes: '테스트 노트',
        },
      )
      expect(r.exitCode).toBe(0)
      const log = readFileSync(join(tmp, 'activity', 'cost-log.md'), 'utf-8')
      expect(log).toContain('## [2026-05-08] claude-code | ingest | 테스트 ingest')
      expect(log).toContain('- task: 테스트 ingest')
      expect(log).toContain('- est_input_tokens: ~50000')
      expect(log).toContain('- est_output_tokens: ~30000')
      // claude-code: 50000/1M*15 + 30000/1M*75 = 0.75 + 2.25 = 3.00
      expect(log).toContain('- est_cost_usd: $3.00')
      expect(log).toContain('- duration_min: 10')
      expect(log).toContain('- notes: 테스트 노트')
      expect(errLines.some((l) => l.includes('비용 기록 추가'))).toBe(true)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('inputTokens 0 → est_input_tokens 라인 생략', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wikey-571-cost-'))
    try {
      cmdAdd(
        { basePath: tmp, today: '2026-05-08' },
        {
          provider: 'ollama-local',
          task: 'query',
          desc: '로컬 쿼리',
          durationMin: 5,
        },
      )
      const log = readFileSync(join(tmp, 'activity', 'cost-log.md'), 'utf-8')
      expect(log).not.toContain('est_input_tokens')
      expect(log).not.toContain('est_output_tokens')
      expect(log).toContain('est_cost_usd: $0.00')
      expect(log).toContain('duration_min: 5')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})

describe('parseCostLog', () => {
  it('단일 entry parse', () => {
    const log = `
## [2026-05-08] claude-code | ingest | 테스트
- task: 테스트
- est_input_tokens: ~10000
- est_output_tokens: ~5000
- est_cost_usd: $0.53
`
    const entries = parseCostLog(log)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      date: '2026-05-08',
      provider: 'claude-code',
      task: 'ingest',
      desc: '테스트',
      cost: 0.53,
      inputTokens: 10000,
      outputTokens: 5000,
    })
  })

  it('복수 entry parse', () => {
    const log = `
## [2026-05-01] gemini | summarize | 요약
- est_cost_usd: $0.50

## [2026-05-08] claude-code | ingest | 인제스트
- est_cost_usd: $1.20
- est_input_tokens: ~80000
`
    const entries = parseCostLog(log)
    expect(entries).toHaveLength(2)
    expect(entries[0].provider).toBe('gemini')
    expect(entries[1].provider).toBe('claude-code')
    expect(entries[1].inputTokens).toBe(80000)
  })
})

describe('cmdSummary — AC6/AC7', () => {
  it('AC6 — cost-log.md 없음 → exit 1, "비용 로그 없음"', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wikey-571-cost-'))
    try {
      const errLines: string[] = []
      const r = cmdSummary(
        { basePath: tmp, writeErr: (s) => errLines.push(s) },
        {},
      )
      expect(r.exitCode).toBe(1)
      expect(errLines.join('\n')).toContain('비용 로그 없음')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('AC7 — entries 있음 → exit 0 + provider/task aggregation', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wikey-571-cost-'))
    try {
      mkdirSync(join(tmp, 'activity'), { recursive: true })
      writeFileSync(
        join(tmp, 'activity', 'cost-log.md'),
        `
## [2026-05-01] gemini | summarize | 요약
- est_cost_usd: $0.50

## [2026-05-08] claude-code | ingest | 인제스트
- est_cost_usd: $1.20
- est_input_tokens: ~80000
- est_output_tokens: ~16000
`,
        'utf-8',
      )
      const lines: string[] = []
      const r = cmdSummary(
        { basePath: tmp, write: (s) => lines.push(s) },
        {},
      )
      expect(r.exitCode).toBe(0)
      const out = lines.join('\n')
      expect(out).toContain('===== LLM 비용 요약 (전체) =====')
      expect(out).toContain('기록 수: 2건')
      expect(out).toContain('총 비용: $1.70')
      expect(out).toContain('claude-code')
      expect(out).toContain('gemini')
      expect(out).toContain('--- 예산 상태 ---')
      expect(out).toContain('✓ 예산 범위 내')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('--month 필터 — 해당 월만 집계', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wikey-571-cost-'))
    try {
      mkdirSync(join(tmp, 'activity'), { recursive: true })
      writeFileSync(
        join(tmp, 'activity', 'cost-log.md'),
        `
## [2026-04-15] gemini | summarize | 4월 entry
- est_cost_usd: $5.00

## [2026-05-08] claude-code | ingest | 5월 entry
- est_cost_usd: $1.00
`,
        'utf-8',
      )
      const lines: string[] = []
      cmdSummary({ basePath: tmp, write: (s) => lines.push(s) }, { month: '2026-05' })
      const out = lines.join('\n')
      expect(out).toContain('월: 2026-05')
      expect(out).toContain('기록 수: 1건')
      expect(out).toContain('총 비용: $1.00')
      expect(out).not.toContain('총 비용: $6.00')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('예산 초과 → ⚠️ 메시지', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wikey-571-cost-'))
    try {
      mkdirSync(join(tmp, 'activity'), { recursive: true })
      writeFileSync(
        join(tmp, 'activity', 'cost-log.md'),
        '\n## [2026-05-08] claude-code | ingest | 예산 초과\n- est_cost_usd: $60.00\n',
        'utf-8',
      )
      const lines: string[] = []
      cmdSummary({ basePath: tmp, write: (s) => lines.push(s) }, {})
      expect(lines.join('\n')).toContain('월간 예산 초과')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})

describe('cmdProviders — AC8', () => {
  it('5 row 요금표 출력 (byte-equal padding)', () => {
    const lines: string[] = []
    const r = cmdProviders({ basePath: '/tmp', write: (s) => lines.push(s) })
    expect(r.exitCode).toBe(0)
    const out = lines.join('\n')
    expect(out).toContain('claude-code (Opus)')
    expect(out).toContain('claude-code (Sonnet)')
    expect(out).toContain('gemini (Flash)')
    expect(out).toContain('codex (GPT-4.1)')
    expect(out).toContain('ollama-local')
    // header 행 + 구분선 + 5 row = 7 row + intro 2 row
    expect(out).toContain('Input $/1M')
    expect(out).toContain('Output $/1M')
  })
})

describe('PROVIDER_RATES + MONTHLY_BUDGET_USD invariants', () => {
  it('모든 default provider rate 양수 또는 0', () => {
    for (const r of Object.values(PROVIDER_RATES)) {
      expect(r.inputUsdPerM).toBeGreaterThanOrEqual(0)
      expect(r.outputUsdPerM).toBeGreaterThanOrEqual(0)
    }
  })

  it('월 예산 = $50', () => {
    expect(MONTHLY_BUDGET_USD).toBe(50.0)
  })
})
