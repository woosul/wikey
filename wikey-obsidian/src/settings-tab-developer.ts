/**
 * §5.7.5 — settings-tab `[developer]` 섹션 helpers.
 *
 * settings-tab.ts 의 display() 가 호출. 본 모듈은 DOM 작성 helper 만 — Plugin /
 * Setting / Notice 등 obsidian runtime 의존성 0 (test 가능 단위).
 *
 * 사용자 결정 #1 (A) settings 토글 잠금 mirror — env 키 미도입.
 */

import type { UpdateItemDescriptor, UpdateAnalysis } from 'wikey-core'

export interface RenderUpdateRowOptions {
  readonly onAnalyze: (item: UpdateItemDescriptor) => void
  /** Optional cached analysis result — devRequired mark 표시 trigger. */
  readonly analysis?: UpdateAnalysis
}

export interface RenderDeveloperSectionOptions {
  readonly developerMode: boolean
  readonly allowUpdateCheck: boolean
  readonly items: readonly UpdateItemDescriptor[]
  readonly onAnalyze: (item: UpdateItemDescriptor) => void
  readonly onToggleAllow: (next: boolean) => void
  /** kind → cached analysis map. */
  readonly analyses?: ReadonlyMap<string, UpdateAnalysis>
}

/** Render a single update row inside the developer section container. */
export function renderUpdateRow(
  parent: HTMLElement,
  item: UpdateItemDescriptor,
  opts: RenderUpdateRowOptions,
): HTMLElement {
  const row = document.createElement('div')
  row.classList.add('wikey-settings-developer-row')
  parent.appendChild(row)

  // Display name + version comparison
  const head = document.createElement('div')
  head.classList.add('wikey-settings-developer-head')
  head.textContent = `${item.displayName}: ${item.currentVersion}` +
    (item.upstreamVersion ? ` → ${item.upstreamVersion}` : '')
  row.appendChild(head)

  // Upgrade badge
  const badge = document.createElement('span')
  if (item.hasUpdate) {
    badge.classList.add('wikey-settings-upgrade-badge', 'wikey-settings-upgrade-badge--active')
    badge.textContent = '[upgrade]'
  } else {
    badge.classList.add('wikey-settings-upgrade-badge', 'wikey-settings-upgrade-badge--none')
    badge.textContent = '[upgrade]'
  }
  row.appendChild(badge)

  // [분석] button
  const btn = document.createElement('button')
  btn.classList.add('wikey-settings-developer-analyze')
  btn.textContent = '[분석]'
  btn.disabled = !item.hasUpdate
  btn.addEventListener('click', () => opts.onAnalyze(item))
  row.appendChild(btn)

  // Analysis result (when available)
  if (opts.analysis) {
    const analysisBox = document.createElement('div')
    analysisBox.classList.add('wikey-settings-developer-analysis')
    analysisBox.textContent = opts.analysis.summary
    row.appendChild(analysisBox)

    if (opts.analysis.devRequired) {
      const mark = document.createElement('div')
      mark.classList.add('wikey-settings-developer-required')
      const reason = opts.analysis.devRequiredReason ?? '근거 미상'
      mark.textContent = `[개발필요] ${reason}`
      row.appendChild(mark)
    }
  }

  // Fetch error (network 실패 시 회색 표시)
  if (item.fetchError) {
    const errEl = document.createElement('div')
    errEl.classList.add('wikey-settings-developer-error')
    errEl.textContent = `fetch error: ${item.fetchError}`
    row.appendChild(errEl)
  }

  return row
}

/** Render the entire developer section (heading + allow-toggle + rows). */
export function renderDeveloperSection(
  parent: HTMLElement,
  opts: RenderDeveloperSectionOptions,
): HTMLElement | null {
  if (!opts.developerMode) return null

  const section = document.createElement('div')
  section.classList.add('wikey-settings-developer-section')
  parent.appendChild(section)

  const heading = document.createElement('h3')
  heading.classList.add('wikey-settings-section-header')
  heading.textContent = 'Developer (advanced)'
  section.appendChild(heading)

  const desc = document.createElement('p')
  desc.classList.add('wikey-settings-status-desc')
  desc.textContent =
    '재시작 시 자동 갱신 (network 동의 시). update 있으면 [upgrade] 활성화, 없으면 회색.'
  section.appendChild(desc)

  // Allow upstream update check toggle (default off — opt-in)
  const allowRow = document.createElement('div')
  allowRow.classList.add('wikey-settings-developer-allow-row')
  const allowLabel = document.createElement('label')
  allowLabel.textContent = 'Allow upstream update check (network)'
  allowRow.appendChild(allowLabel)
  const allowInput = document.createElement('input')
  allowInput.type = 'checkbox'
  allowInput.checked = opts.allowUpdateCheck
  allowInput.addEventListener('change', () => opts.onToggleAllow(allowInput.checked))
  allowRow.appendChild(allowInput)
  section.appendChild(allowRow)

  // Update item rows
  for (const item of opts.items) {
    const cached = opts.analyses?.get(item.kind)
    renderUpdateRow(section, item, { onAnalyze: opts.onAnalyze, analysis: cached })
  }

  return section
}
