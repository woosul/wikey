/**
 * §5.7.8 Spec 4 / AC-S1 — Advanced query tuning settings UI.
 *
 * Validates the WikeySettings interface defaults (I16 default OFF + I7 backward compat) and
 * that the Setting-tab section produces controls into the container.
 *
 * Note: full PluginSettingTab wiring is hard to mock fully (App / saveData), so we focus
 * on the data-shape contract + section header presence (the controls themselves use the
 * Setting class which is stubbed in obsidian.ts mock).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SETTINGS_TAB_SRC = readFileSync(
  join(__dirname, '..', 'settings-tab.ts'),
  'utf-8',
)
const MAIN_SRC = readFileSync(join(__dirname, '..', 'main.ts'), 'utf-8')

describe('Advanced query tuning settings — AC-S1', () => {
  it('main.ts WikeySettings has all 9 advancedQueryTuning* fields', () => {
    const fields = [
      'advancedQueryTuningEnabled',
      'advancedQueryTuningMode',
      'advancedQueryTuningTimeoutMs',
      'advancedQueryTuningCacheSize',
      'advancedQueryTuningProvider',
      'advancedQueryTuningModel',
      'advancedQueryTuningTemperature',
      'advancedQueryTuningMaxTokens',
      'advancedQueryTuningAutoExtendThreshold',
    ]
    for (const field of fields) {
      expect(MAIN_SRC, `expected field ${field} in WikeySettings`).toContain(field)
    }
  })

  it('DEFAULT_SETTINGS has advancedQueryTuningEnabled = false (I16 / I7)', () => {
    expect(MAIN_SRC).toMatch(/advancedQueryTuningEnabled:\s*false/u)
  })

  it('DEFAULT_SETTINGS has timeout=5000, cacheSize=1000, threshold=5 defaults', () => {
    expect(MAIN_SRC).toMatch(/advancedQueryTuningTimeoutMs:\s*5000/u)
    expect(MAIN_SRC).toMatch(/advancedQueryTuningCacheSize:\s*1000/u)
    expect(MAIN_SRC).toMatch(/advancedQueryTuningAutoExtendThreshold:\s*5/u)
  })

  it('settings-tab.ts has renderAdvancedQueryTuningSection', () => {
    expect(SETTINGS_TAB_SRC).toContain('renderAdvancedQueryTuningSection')
  })

  it('settings-tab.ts uses renderProviderModelPair for the Filter LLM provider+model pair', () => {
    // Spec Q1 LOCKED + 2026-05-10 사용자 raise — provider+model 1 row helper.
    // The section must call renderProviderModelPair (single Setting row holding
    // both selects), mirroring Default Model / Ingest Model / OCR sections.
    const sectionStart = SETTINGS_TAB_SRC.indexOf('renderAdvancedQueryTuningSection(containerEl: HTMLElement)')
    expect(sectionStart).toBeGreaterThan(-1)
    const sectionEnd = SETTINGS_TAB_SRC.indexOf('// ── Section: Reset', sectionStart)
    expect(sectionEnd).toBeGreaterThan(sectionStart)
    const section = SETTINGS_TAB_SRC.slice(sectionStart, sectionEnd)
    expect(section).toContain('renderProviderModelPair')
    expect(section).toContain('Filter LLM Provider / Model')
  })

  it('安내문구 description text mentions paradigm intent + cost / benefit (I18)', () => {
    const sectionStart = SETTINGS_TAB_SRC.indexOf('renderAdvancedQueryTuningSection(containerEl: HTMLElement)')
    const sectionEnd = SETTINGS_TAB_SRC.indexOf('// ── Section: Reset', sectionStart)
    const section = SETTINGS_TAB_SRC.slice(sectionStart, sectionEnd)
    // (a) what — LLM semantic analysis
    expect(section).toMatch(/semantic/iu)
    // (b) options — filter / rewrite / expand layer
    expect(section).toContain('rewrite')
    expect(section).toContain('expand')
    // (c) cost / benefit — latency or cache
    expect(section).toMatch(/cache|latency|Budget/u)
    // (d) provider — BYOAI
    expect(section).toContain('BYOAI')
  })

  it('Section adds a Run query analysis button (manual trigger, AC-S4 mirror)', () => {
    const sectionStart = SETTINGS_TAB_SRC.indexOf('renderAdvancedQueryTuningSection(containerEl: HTMLElement)')
    const sectionEnd = SETTINGS_TAB_SRC.indexOf('// ── Section: Reset', sectionStart)
    const section = SETTINGS_TAB_SRC.slice(sectionStart, sectionEnd)
    expect(section).toContain('Run query analysis')
    expect(section).toContain('runQueryAnalysis')
  })

  it('Provider clear-on-change pattern mirrored (provider change → model cleared)', () => {
    const sectionStart = SETTINGS_TAB_SRC.indexOf('renderAdvancedQueryTuningSection(containerEl: HTMLElement)')
    const sectionEnd = SETTINGS_TAB_SRC.indexOf('// ── Section: Reset', sectionStart)
    const section = SETTINGS_TAB_SRC.slice(sectionStart, sectionEnd)
    expect(section).toMatch(/advancedQueryTuningModel\s*=\s*''/u)
  })
})
