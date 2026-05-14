/**
 * §5.6.6 Step F — Settings UI Subscription Mode dropdown per-provider.
 *
 * Spec Reference:
 *   - phase-5-spec-5.6.6-subscription-rest.md §1.1 Goal (per-provider toggle)
 *   - phase-5-spec-5.6.6-subscription-rest.md §1.2 I9 (UI English)
 *   - phase-5-spec-5.6.6-subscription-rest.md §1.5 AC-S23-ui (dropdown 'cli' immediate effect)
 *
 * Test mapping (todox §6.2):
 *   - T-F1 (UI render): 3 vendor subsections (gemini/anthropic/openai) each have a
 *     'Subscription Mode' dropdown with 3 options (rest/cli/pending). The
 *     ollama-cloud subsection does not have the dropdown (REST direct paradigm
 *     scope-out, I15).
 *   - T-F2 (dropdown change → settings save): selecting 'cli' calls plugin.saveSettings
 *     once and writes plugin.settings.geminiSubscriptionMode = 'cli'.
 *   - T-F3 (English-only invariant I9): label / option text / description all ASCII —
 *     zero hangul matches.
 *   - T-F4 (AC-S23-ui dropdown 'cli' immediate effect): plugin.saveSettings spy +
 *     buildConfig() returns GEMINI_SUBSCRIPTION_MODE='cli' right after the change.
 *
 * Approach: call renderApiKeysSection() directly on a freshly constructed
 * WikeySettingTab with a minimal WikeyPlugin mock. We avoid display() to keep
 * the test surface surgical (only the section under test).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { App, Vault } from './__mocks__/obsidian'
import { WikeySettingTab } from '../settings-tab'
import type WikeyPlugin from '../main'

interface MinimalSettings {
  geminiSubscriptionMode: 'cli' | 'rest' | 'pending'
  anthropicSubscriptionMode: 'cli' | 'rest' | 'pending'
  openaiSubscriptionMode: 'cli' | 'rest' | 'pending'
  geminiAuthMode: 'none' | 'subscription' | 'api'
  anthropicAuthMode: 'none' | 'subscription' | 'api'
  openaiAuthMode: 'none' | 'subscription' | 'api'
  ollamaCloudAuthMode: 'none' | 'subscription' | 'api'
  geminiApiKey: string
  anthropicApiKey: string
  openaiApiKey: string
  ollamaCloudApiKey: string
}

function makePlugin(initial?: Partial<MinimalSettings>): {
  plugin: WikeyPlugin
  saveSettings: ReturnType<typeof vi.fn>
} {
  const settings: MinimalSettings = {
    geminiSubscriptionMode: 'rest',
    anthropicSubscriptionMode: 'rest',
    openaiSubscriptionMode: 'rest',
    geminiAuthMode: 'subscription',
    anthropicAuthMode: 'subscription',
    openaiAuthMode: 'subscription',
    ollamaCloudAuthMode: 'subscription',
    geminiApiKey: '',
    anthropicApiKey: '',
    openaiApiKey: '',
    ollamaCloudApiKey: '',
    ...initial,
  }
  const saveSettings = vi.fn(async () => {
    /* no-op */
  })
  const plugin = {
    settings,
    saveSettings,
    // buildConfig (T-F4) — minimal stub returning the 3 SUBSCRIPTION_MODE fields
    // straight from settings (mirrors main.ts buildSubscriptionModesForConfig behavior).
    buildConfig: () => ({
      GEMINI_SUBSCRIPTION_MODE: settings.geminiSubscriptionMode,
      ANTHROPIC_SUBSCRIPTION_MODE: settings.anthropicSubscriptionMode,
      OPENAI_SUBSCRIPTION_MODE: settings.openaiSubscriptionMode,
    }),
  } as unknown as WikeyPlugin
  return { plugin, saveSettings }
}

function makeTab(plugin: WikeyPlugin): {
  tab: WikeySettingTab
  container: HTMLElement
} {
  const app = new App(new Vault())
  const tab = new WikeySettingTab(app as unknown as App, plugin)
  const container = document.createElement('div')
  // renderApiKeysSection is private — bracket access bypass for test.
  ;(tab as unknown as { renderApiKeysSection: (c: HTMLElement) => void })
    .renderApiKeysSection(container)
  return { tab, container }
}

/** Find the Subscription Mode <select> for a given provider heading.
 *  User UI request 2026-05-15 (final) — Subscription Mode selectbox is inlined
 *  inside the existing 'Subscription' row (16px margin after the label).
 *  No separate row / no Setting wrapper. Identified by class `wikey-subscription-mode-select`.
 */
function findSubscriptionModeSelect(
  container: HTMLElement,
  providerHeading: 'Google' | 'Anthropic' | 'OpenAI' | 'Ollama Cloud',
): HTMLSelectElement | null {
  const headings = Array.from(
    container.querySelectorAll('h3.wikey-auth-provider-heading'),
  ) as HTMLElement[]
  const providerRow = headings.find((h) => h.textContent === providerHeading)
  if (!providerRow) return null
  const headingDivRow = providerRow.parentElement
  if (!headingDivRow) return null
  let block: HTMLElement | null = headingDivRow.nextElementSibling as HTMLElement | null
  while (block && !block.classList.contains('wikey-auth-block')) {
    block = block.nextElementSibling as HTMLElement | null
  }
  if (!block) return null
  return block.querySelector('select.wikey-subscription-mode-select') as HTMLSelectElement | null
}

describe('§5.6.6 Step F — Settings UI Subscription Mode dropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('T-F1: gemini / anthropic / openai subsections each render a Subscription Mode dropdown with rest / cli / pending options', () => {
    const { plugin } = makePlugin()
    const { container } = makeTab(plugin)

    for (const provider of ['Google', 'Anthropic', 'OpenAI'] as const) {
      const select = findSubscriptionModeSelect(container, provider)
      expect(select, `${provider} Subscription Mode <select> exists`).not.toBeNull()
      const optionValues = Array.from(select!.options).map((o) => o.value).sort()
      expect(optionValues).toEqual(['cli', 'pending', 'rest'])
    }
  })

  it('T-F1 (scope-out I15): ollama-cloud subsection has no Subscription Mode dropdown', () => {
    const { plugin } = makePlugin()
    const { container } = makeTab(plugin)

    const select = findSubscriptionModeSelect(container, 'Ollama Cloud')
    expect(select).toBeNull()
  })

  it('T-F2: dropdown change to "cli" writes settings.geminiSubscriptionMode and calls plugin.saveSettings once', async () => {
    const { plugin, saveSettings } = makePlugin({ geminiSubscriptionMode: 'rest' })
    const { container } = makeTab(plugin)

    const select = findSubscriptionModeSelect(container, 'Google')
    expect(select).not.toBeNull()
    select!.value = 'cli'
    select!.dispatchEvent(new Event('change'))
    // Handler is async — await microtask flush.
    await new Promise((r) => setTimeout(r, 0))

    expect(plugin.settings.geminiSubscriptionMode).toBe('cli')
    expect(saveSettings).toHaveBeenCalledTimes(1)
  })

  it('T-F3 (I9): label / option text / description for all 3 vendor Subscription Mode rows are English-only (no hangul)', () => {
    const { plugin } = makePlugin()
    const { container } = makeTab(plugin)

    const hangulRe = /[ㄱ-힝]/u // Korean syllables + jamo range

    for (const provider of ['Google', 'Anthropic', 'OpenAI'] as const) {
      const select = findSubscriptionModeSelect(container, provider)
      expect(select).not.toBeNull()
      // User UI request 2026-05-15 (final) — Subscription Mode is inline in Subscription row.
      const row = select!.closest('.wikey-auth-block-row') as HTMLElement
      const rowText = row.textContent ?? ''
      expect(rowText, `${provider} row text English-only`).not.toMatch(hangulRe)
      // Each option label individually.
      for (const opt of Array.from(select!.options)) {
        expect(opt.textContent ?? '', `${provider} option "${opt.value}" English-only`).not.toMatch(hangulRe)
      }
    }
  })

  it('T-F4 (AC-S23-ui): dropdown "cli" → plugin.saveSettings spy + buildConfig() returns GEMINI_SUBSCRIPTION_MODE="cli"', async () => {
    const { plugin, saveSettings } = makePlugin({ geminiSubscriptionMode: 'rest' })
    const { container } = makeTab(plugin)

    const select = findSubscriptionModeSelect(container, 'Google')
    expect(select).not.toBeNull()
    select!.value = 'cli'
    select!.dispatchEvent(new Event('change'))
    await new Promise((r) => setTimeout(r, 0))

    expect(saveSettings).toHaveBeenCalledTimes(1)
    expect(plugin.settings.geminiSubscriptionMode).toBe('cli')
    // buildConfig() consistency check — next LLM call would see GEMINI_SUBSCRIPTION_MODE='cli'.
    const cfg = (plugin as unknown as {
      buildConfig: () => { GEMINI_SUBSCRIPTION_MODE: string }
    }).buildConfig()
    expect(cfg.GEMINI_SUBSCRIPTION_MODE).toBe('cli')
  })
})
