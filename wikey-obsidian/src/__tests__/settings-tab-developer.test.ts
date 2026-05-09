/**
 * §5.7.5 RED — settings-tab developer section + renderUpdateRow.
 *
 * AC-U3: developerMode toggle off → 섹션 부재, true → 'Developer (advanced)' heading 표시.
 * AC-U5: hasUpdate=true → '[upgrade]' active 뱃지, false → 회색 ('--none' 또는 dimmed).
 * AC-U7: hasUpdate=false → '[분석]' button disabled.
 * AC-U8: devRequired=true → '[개발필요]' mark + reason text 1줄 표시.
 */

import { describe, it, expect } from 'vitest'
import { renderDeveloperSection, renderUpdateRow } from '../settings-tab-developer.js'
import type { UpdateItemDescriptor } from 'wikey-core'

const ITEM_WITH_UPDATE: UpdateItemDescriptor = {
  id: 'orama',
  kind: 'orama',
  displayName: 'Orama',
  currentVersion: '3.1.18',
  upstreamVersion: '4.0.0',
  hasUpdate: true,
  diffSource: 'https://github.com/oramasearch/orama/releases',
}

const ITEM_NO_UPDATE: UpdateItemDescriptor = {
  id: 'kiwi-nlp',
  kind: 'kiwi-nlp',
  displayName: 'Kiwi NLP',
  currentVersion: '0.23.0',
  upstreamVersion: '0.23.0',
  hasUpdate: false,
  diffSource: 'https://github.com/bab2min/Kiwi/releases',
}

describe('§5.7.5 settings-tab developer section', () => {
  it('AC-U3: developerMode false → section absent; true → "Developer (advanced)" heading', () => {
    const c1 = document.createElement('div')
    renderDeveloperSection(c1, {
      developerMode: false,
      allowUpdateCheck: false,
      items: [],
      onAnalyze: () => undefined,
      onToggleAllow: () => undefined,
    })
    expect(c1.textContent ?? '').not.toContain('Developer (advanced)')

    const c2 = document.createElement('div')
    renderDeveloperSection(c2, {
      developerMode: true,
      allowUpdateCheck: false,
      items: [],
      onAnalyze: () => undefined,
      onToggleAllow: () => undefined,
    })
    expect(c2.textContent ?? '').toContain('Developer (advanced)')
  })

  it('AC-U5: hasUpdate=true shows active [upgrade] badge; hasUpdate=false shows dimmed', () => {
    const cAct = document.createElement('div')
    renderUpdateRow(cAct, ITEM_WITH_UPDATE, { onAnalyze: () => undefined })
    expect(cAct.textContent ?? '').toContain('[upgrade]')
    const activeBadge = cAct.querySelector('.wikey-settings-upgrade-badge--active')
    expect(activeBadge).not.toBeNull()

    const cNone = document.createElement('div')
    renderUpdateRow(cNone, ITEM_NO_UPDATE, { onAnalyze: () => undefined })
    const noneBadge = cNone.querySelector('.wikey-settings-upgrade-badge--none')
    expect(noneBadge).not.toBeNull()
  })

  it('AC-U7: hasUpdate=false disables [분석] button; hasUpdate=true enables', () => {
    const cYes = document.createElement('div')
    renderUpdateRow(cYes, ITEM_WITH_UPDATE, { onAnalyze: () => undefined })
    const btnYes = cYes.querySelector('button.wikey-settings-developer-analyze') as HTMLButtonElement | null
    expect(btnYes).not.toBeNull()
    expect(btnYes!.disabled).toBe(false)
    expect(btnYes!.textContent ?? '').toContain('[분석]')

    const cNo = document.createElement('div')
    renderUpdateRow(cNo, ITEM_NO_UPDATE, { onAnalyze: () => undefined })
    const btnNo = cNo.querySelector('button.wikey-settings-developer-analyze') as HTMLButtonElement | null
    expect(btnNo!.disabled).toBe(true)
  })

  it('AC-U8: devRequired=true → [개발필요] mark + reason text rendered', () => {
    const c = document.createElement('div')
    renderUpdateRow(
      c,
      ITEM_WITH_UPDATE,
      {
        onAnalyze: () => undefined,
        analysis: {
          summary: 'Breaking change in tokenizer pipeline',
          devRequired: true,
          devRequiredReason: 'tokenizer interface 변경 — wikey 측 wrap 갱신 필요',
        },
      },
    )
    expect(c.textContent ?? '').toContain('[개발필요]')
    expect(c.textContent ?? '').toContain('tokenizer interface')
  })
})
