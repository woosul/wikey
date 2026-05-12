/**
 * §5.19 v0.5 R1~R6 — UX raise (사용자 raise, 2026-05-12).
 *
 * AC mapping:
 *   - R1+R2+R3: Step 1 안내 텍스트 + Apply 흐름 명료화
 *   - R4 (stale-tombstone): Step 2 confirm view 에 stale-tombstone 섹션 + runStaleTombstoneFix 디스패치
 *   - R6 (refactoring): unhealthy summary 에 Execute button + Step 2 archive selection + runRefactoringApply 디스패치
 *   - R5: Help guide 에 Check vs Refactoring 정의 (별 file test — sidebar-chat.openHelp markdown 확인)
 *
 * Invariants:
 *   I-V05-1 (selection): Step 2 unchecked 항목 Apply 시 무영향.
 *   I-V05-2 (English): 모든 신규 UI 텍스트 영문.
 *   I-V05-3 (Surgical): 기존 broken-wikilink + dangling fix 동작 변경 0.
 */

import { describe, it, expect, vi } from 'vitest'
import { App } from 'obsidian'
import { MaintenanceModal } from '../maintenance-modal'

function makeFakePlugin() {
  return {
    app: new App(),
    settings: { basicModel: 'ollama', cloudModel: '', ingestProvider: '', ingestModel: '' },
    saveSettings: vi.fn(),
    chatHistory: [] as unknown[],
    buildConfig: () => ({
      WIKEY_BASIC_MODEL: 'ollama',
      WIKEY_SEARCH_BACKEND: 'basic',
      WIKEY_MODEL: '',
      WIKEY_QMD_TOP_N: 10,
      GEMINI_API_KEY: '',
      ANTHROPIC_API_KEY: '',
      OPENAI_API_KEY: '',
      OLLAMA_URL: 'http://localhost:11434',
      INGEST_PROVIDER: '',
      LINT_PROVIDER: '',
      SUMMARIZE_PROVIDER: '',
      CONTEXTUAL_MODEL: '',
      COST_LIMIT: 0,
    }),
    httpClient: { async request() { return { status: 0, body: '' } } },
  }
}

// ── R1/R2/R3 — Step 1 안내 텍스트 ──

describe('§5.19 v0.5 R1/R2/R3 — Step 1 guidance text', () => {
  it('findings > 0 시 step 1 안내 텍스트 표시 ("Select items to fix" / "Apply fix" guidance, English)', () => {
    const plugin = makeFakePlugin()
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, { mode: 'check' })
    modal.onOpen()
    ;(modal as any).renderFindings?.([
      { kind: 'broken-link', path: 'wiki/a.md', detail: '[[X]]' },
    ])
    const guidance = modal.contentEl.querySelector('.wikey-maintenance-modal-step-1-guidance')
    expect(guidance, 'step 1 guidance text element 미존재').not.toBeNull()
    const text = guidance?.textContent ?? ''
    // English only (system UI policy §5.22)
    expect(text).toMatch(/apply fix|select.*fix/i)
    // 한글 키워드 부재 확증
    expect(text).not.toMatch(/[가-힣]/)
  })

  it('findings 0 (healthy) 시 step 1 guidance 표시 0', () => {
    const plugin = makeFakePlugin()
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, { mode: 'check' })
    modal.onOpen()
    ;(modal as any).renderFindings?.([])
    const guidance = modal.contentEl.querySelector('.wikey-maintenance-modal-step-1-guidance')
    expect(guidance).toBeNull()
  })
})

// ── R4 — Step 2 stale-tombstone section + runStaleTombstoneFix dispatch ──

describe('§5.19 v0.5 R4 — stale-tombstone Step 2 section', () => {
  it('stale-tombstone finding 존재 시 Step 2 에 stale-tombstone section + checkbox row 렌더', async () => {
    const plugin = makeFakePlugin()
    const runStaleTombstoneFix = vi.fn(async () => ({ removedIds: ['sha256:stale-1'] }))
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, {
      mode: 'check',
      runner: {
        runCheck: async () => [
          { kind: 'stale-tombstone', detail: 'sha256:stale-1' },
          { kind: 'stale-tombstone', detail: 'sha256:stale-2 (path-based)' },
        ],
        runStaleTombstoneFix,
      },
    })
    modal.onOpen()
    await new Promise((r) => setTimeout(r, 0))
    await modal.applyFix()

    const list = modal.contentEl.querySelector('.wikey-maintenance-modal-stale-tombstone-list')
    expect(list, 'stale-tombstone Step 2 section 미존재').toBeTruthy()
    const rows = list!.querySelectorAll('input[type=checkbox]')
    expect(rows.length).toBe(2)
  })

  it('R4: stale-tombstone Execute click → runStaleTombstoneFix dispatch with selected ids', async () => {
    const plugin = makeFakePlugin()
    const fixSpy = vi.fn(async () => ({ removedIds: ['sha256:stale-1'] }))
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, {
      mode: 'check',
      runner: {
        runCheck: async () => [
          { kind: 'stale-tombstone', detail: 'sha256:stale-1' },
          { kind: 'stale-tombstone', detail: 'sha256:stale-2' },
        ],
        runStaleTombstoneFix: fixSpy,
      },
    })
    modal.onOpen()
    await new Promise((r) => setTimeout(r, 0))
    await modal.applyFix()

    const checkboxes = Array.from(
      modal.contentEl.querySelectorAll<HTMLInputElement>(
        '.wikey-maintenance-modal-stale-tombstone-list input[type=checkbox]',
      ),
    )
    // Uncheck the second — only first dispatched.
    checkboxes[1]!.checked = false

    const execBtn = Array.from(modal.contentEl.querySelectorAll('button')).find((b) =>
      /Execute/.test(b.textContent ?? ''),
    ) as HTMLButtonElement
    execBtn.click()
    await new Promise((r) => setTimeout(r, 0))

    expect(fixSpy).toHaveBeenCalledTimes(1)
    const payload = fixSpy.mock.calls[0]![1] as { tombstoneIds: readonly string[] }
    expect(payload.tombstoneIds).toEqual(['sha256:stale-1'])
  })

  it('R4: I-V05-3 — stale-tombstone 없는 finding set 에서는 stale-tombstone section 렌더 0', async () => {
    const plugin = makeFakePlugin()
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, {
      mode: 'check',
      runner: {
        runCheck: async () => [
          { kind: 'broken-link', path: 'wiki/a.md', detail: '[[X]]' },
        ],
      },
    })
    modal.onOpen()
    await new Promise((r) => setTimeout(r, 0))
    await modal.applyFix()

    const list = modal.contentEl.querySelector('.wikey-maintenance-modal-stale-tombstone-list')
    expect(list).toBeNull()
  })
})

// ── R6 — Refactoring Execute + archive selection ──

describe('§5.19 v0.5 R6 — Refactoring Execute → archive', () => {
  it('Refactoring unhealthy summary 에 Execute button + click 시 archive Step 2 진입', async () => {
    const plugin = makeFakePlugin()
    const runRefactoring = vi.fn(async () => ({
      duplicates: [{ a: 'foo', b: 'bar', similarity: 0.9 }],
      lowUtility: [{ path: 'wiki/analyses/old.md', lastUpdated: '2026-01-01', backlinkCount: 0 }],
      thresholdUsed: 0.85,
      configFallback: 'default',
    }))
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, {
      mode: 'refactoring',
      runner: { runRefactoring },
    })
    modal.onOpen()
    await new Promise((r) => setTimeout(r, 0))
    await Promise.resolve()

    const execBtn = Array.from(modal.contentEl.querySelectorAll('button')).find((b) =>
      /Execute/.test(b.textContent ?? ''),
    )
    expect(execBtn, 'Refactoring unhealthy Execute button 미존재').toBeTruthy()
    ;(execBtn as HTMLButtonElement).click()
    await new Promise((r) => setTimeout(r, 0))

    // Step 2 — duplicates + lowUtility section 렌더 확인.
    const dupList = modal.contentEl.querySelector('.wikey-maintenance-modal-refactor-duplicates-list')
    const lowUtilList = modal.contentEl.querySelector('.wikey-maintenance-modal-refactor-low-utility-list')
    expect(dupList, 'duplicates archive list 미존재').toBeTruthy()
    expect(lowUtilList, 'lowUtility archive list 미존재').toBeTruthy()
  })

  it('Refactoring Step 2 Execute → runRefactoringApply with selected paths', async () => {
    const plugin = makeFakePlugin()
    const archiveSpy = vi.fn(async () => ({ archived: ['wiki/analyses/old.md'] }))
    const runRefactoring = vi.fn(async () => ({
      duplicates: [{ a: 'foo', b: 'bar', similarity: 0.9 }],
      lowUtility: [{ path: 'wiki/analyses/old.md', lastUpdated: '2026-01-01', backlinkCount: 0 }],
      thresholdUsed: 0.85,
      configFallback: 'default',
    }))
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, {
      mode: 'refactoring',
      runner: { runRefactoring, runRefactoringApply: archiveSpy },
    })
    modal.onOpen()
    await new Promise((r) => setTimeout(r, 0))
    await Promise.resolve()

    const execBtnFooter = Array.from(modal.contentEl.querySelectorAll('button')).find((b) =>
      /Execute/.test(b.textContent ?? ''),
    ) as HTMLButtonElement
    execBtnFooter.click()
    await new Promise((r) => setTimeout(r, 0))

    // Step 2 — Execute (sub-step-3 dispatch). Default: checkboxes checked → all dispatched.
    const allButtons = Array.from(modal.contentEl.querySelectorAll('button'))
    const stepExecBtn = allButtons.find((b) => /Execute/.test(b.textContent ?? '')) as HTMLButtonElement
    expect(stepExecBtn, 'Step 2 Execute button 미존재').toBeTruthy()
    stepExecBtn.click()
    await new Promise((r) => setTimeout(r, 0))

    expect(archiveSpy).toHaveBeenCalledTimes(1)
    const payload = archiveSpy.mock.calls[0]![1] as { archivePaths: readonly string[] }
    // Selection default = all checked → both duplicates target + lowUtility paths.
    expect(payload.archivePaths.length).toBeGreaterThan(0)
  })

  it('R6 / I-V05-1: Step 2 checkbox unchecked → archivePaths 에서 제외', async () => {
    const plugin = makeFakePlugin()
    const archiveSpy = vi.fn(async () => ({ archived: [] }))
    const runRefactoring = vi.fn(async () => ({
      duplicates: [],
      lowUtility: [
        { path: 'wiki/analyses/keep.md', lastUpdated: '2026-01-01', backlinkCount: 0 },
        { path: 'wiki/analyses/drop.md', lastUpdated: '2026-01-01', backlinkCount: 0 },
      ],
      thresholdUsed: 0.85,
      configFallback: 'default',
    }))
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, {
      mode: 'refactoring',
      runner: { runRefactoring, runRefactoringApply: archiveSpy },
    })
    modal.onOpen()
    await new Promise((r) => setTimeout(r, 0))
    await Promise.resolve()

    // Enter step 2.
    const enterStep2 = Array.from(modal.contentEl.querySelectorAll('button')).find((b) =>
      /Execute/.test(b.textContent ?? ''),
    ) as HTMLButtonElement
    enterStep2.click()
    await new Promise((r) => setTimeout(r, 0))

    // Step 2 — uncheck the first lowUtility row (path order preserved).
    const lowUtilCheckboxes = Array.from(
      modal.contentEl.querySelectorAll<HTMLInputElement>(
        '.wikey-maintenance-modal-refactor-low-utility-list input[type=checkbox]',
      ),
    )
    lowUtilCheckboxes[0]!.checked = false

    // Step 2 Execute.
    const stepExecBtn = Array.from(modal.contentEl.querySelectorAll('button')).find((b) =>
      /Execute/.test(b.textContent ?? ''),
    ) as HTMLButtonElement
    stepExecBtn.click()
    await new Promise((r) => setTimeout(r, 0))

    expect(archiveSpy).toHaveBeenCalledTimes(1)
    const payload = archiveSpy.mock.calls[0]![1] as { archivePaths: readonly string[] }
    expect(payload.archivePaths).toEqual(['wiki/analyses/drop.md'])
  })
})
