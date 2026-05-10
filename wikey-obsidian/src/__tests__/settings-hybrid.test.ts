/**
 * §5.7.7 Step B4 RED — Spec 4 (Settings UI integration) — 6 AC.
 *
 * Validates the WikeySettings interface 신규 3 field (Q10 LOCKED v1.1 — toggle 단일):
 *   - searchHybridEnabled: boolean (default false, Spec I15 backward compat)
 *   - searchRrfK: number (default 60, RRF k value)
 *   - searchQwen3DownloadStatus: 'idle' | 'downloading' | 'installed' | 'failed' (default 'idle')
 *
 * settings-tab.ts 의 Advanced query tuning section 안에 hybrid 통합 (사용자 추가 요구사항 mirror):
 *   - Hybrid search toggle (slide)
 *   - RRF k value (number input, 60 default)
 *   - Qwen3 download status badge
 *
 * Pattern mirror: settings-tab-query-tuning.test.ts (source 검증 — fs.readFileSync + grep).
 *
 * AC mapping (Spec 1.4):
 *   AC-S1 Happy default OFF              — searchHybridEnabled = false
 *   AC-S2 Happy master ON + hybrid OFF   — toggle 표시 + retrieval = BM25-only
 *   AC-S3 Happy master ON + hybrid ON    — RRF k 활성 + Qwen3 status 표시
 *   AC-S4 Happy RRF k = 30               — number input customizable
 *   AC-S5 Edge model 미설치 + hybrid ON  — download progress 표시
 *   AC-S6 Edge download fail             — hybrid 자동 OFF + status 'failed'
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SETTINGS_TAB_SRC = readFileSync(
  join(__dirname, '..', 'settings-tab.ts'),
  'utf-8',
)
const MAIN_SRC = readFileSync(join(__dirname, '..', 'main.ts'), 'utf-8')

describe('§5.7.7 Spec 4 — settings hybrid integration (6 AC)', () => {
  it('AC-S1 (Happy default OFF): WikeySettings has searchHybridEnabled / searchRrfK / searchQwen3DownloadStatus + DEFAULT_SETTINGS = false / 60 / "idle"', () => {
    const fields = ['searchHybridEnabled', 'searchRrfK', 'searchQwen3DownloadStatus']
    for (const field of fields) {
      expect(MAIN_SRC, `expected field ${field} in WikeySettings interface`).toContain(field)
    }
    // Spec I15 — default OFF (backward compat)
    expect(MAIN_SRC).toMatch(/searchHybridEnabled:\s*false/u)
    // Q3 LOCKED v1.2 — RRF k = 60 (논문 권고)
    expect(MAIN_SRC).toMatch(/searchRrfK:\s*60/u)
    // status badge default = 'idle'
    expect(MAIN_SRC).toMatch(/searchQwen3DownloadStatus:\s*['"]idle['"]/u)
  })

  it('AC-S2 (Happy master ON + hybrid OFF): Hybrid toggle UI 가 Advanced query tuning section 안에 통합 (사용자 추가 요구사항)', () => {
    // 사용자 추가 요구사항 (2026-05-10): hybrid 도 Advanced query tuning section 안 통합
    const sectionStart = SETTINGS_TAB_SRC.indexOf(
      'renderAdvancedQueryTuningSection(containerEl: HTMLElement)',
    )
    expect(sectionStart, 'Advanced query tuning section 가 존재해야 함').toBeGreaterThan(-1)
    const sectionEnd = SETTINGS_TAB_SRC.indexOf('// ── Section: Reset', sectionStart)
    expect(sectionEnd).toBeGreaterThan(sectionStart)
    const section = SETTINGS_TAB_SRC.slice(sectionStart, sectionEnd)
    // Hybrid toggle 표시 — searchHybridEnabled binding
    expect(section, 'section 안 hybrid toggle binding').toContain('searchHybridEnabled')
    // toggle UI 사용 (Setting 의 addToggle pattern)
    expect(section).toMatch(/addToggle/u)
  })

  it('AC-S3 (Happy master ON + hybrid ON): RRF k input 활성 + Qwen3 status badge 표시', () => {
    const sectionStart = SETTINGS_TAB_SRC.indexOf(
      'renderAdvancedQueryTuningSection(containerEl: HTMLElement)',
    )
    const sectionEnd = SETTINGS_TAB_SRC.indexOf('// ── Section: Reset', sectionStart)
    const section = SETTINGS_TAB_SRC.slice(sectionStart, sectionEnd)
    // RRF k value 입력 binding
    expect(section, 'searchRrfK binding').toContain('searchRrfK')
    // Qwen3 download status badge — searchQwen3DownloadStatus binding
    expect(section, 'searchQwen3DownloadStatus binding').toContain('searchQwen3DownloadStatus')
  })

  it('AC-S4 (Happy RRF k = 30 customizable): number input + 사용자 변경 가능', () => {
    const sectionStart = SETTINGS_TAB_SRC.indexOf(
      'renderAdvancedQueryTuningSection(containerEl: HTMLElement)',
    )
    const sectionEnd = SETTINGS_TAB_SRC.indexOf('// ── Section: Reset', sectionStart)
    const section = SETTINGS_TAB_SRC.slice(sectionStart, sectionEnd)
    // number input — addText 또는 명시 number type
    // searchRrfK 가 변경 가능한 input (addText / addSlider 등)
    expect(section).toMatch(/searchRrfK\s*=/u)
  })

  it('AC-S5 (Edge model 미설치 + hybrid ON): download progress / Qwen3 model 안내 표시', () => {
    const sectionStart = SETTINGS_TAB_SRC.indexOf(
      'renderAdvancedQueryTuningSection(containerEl: HTMLElement)',
    )
    const sectionEnd = SETTINGS_TAB_SRC.indexOf('// ── Section: Reset', sectionStart)
    const section = SETTINGS_TAB_SRC.slice(sectionStart, sectionEnd)
    // download status 4 phase 중 'downloading' / 'installed' 가 section 안 명시
    expect(section).toMatch(/downloading|installed|Qwen3/iu)
  })

  it('AC-S6 (Edge download fail): WikeySettings status 4 phase = idle / downloading / installed / failed', () => {
    // status type 정의 자체에 4 phase 가 모두 있어야 함 (interface line)
    expect(MAIN_SRC).toMatch(/searchQwen3DownloadStatus:\s*['"]idle['"]\s*\|\s*['"]downloading['"]\s*\|\s*['"]installed['"]\s*\|\s*['"]failed['"]/u)
  })
})
