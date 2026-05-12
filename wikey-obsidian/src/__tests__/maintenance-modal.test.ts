/**
 * §5.19 Step B (RED) — UI flow Spec (`MaintenanceModal` + Help 패널 섹션).
 *
 * Spec: plan/phase-5/phase-5-spec-5.19-wiki-maintenance-suite.md v0.2 §1.5 UI flow
 *
 * AC mapping (1:1):
 *   - AC-UI-1 → Help 패널 안 "Wiki Maintenance" 섹션 + 4 버튼
 *   - AC-UI-2 → 버튼 클릭 → MaintenanceModal({ mode }).open() 호출 (4 mode 분기)
 *   - AC-UI-3 → Modal `onOpen` 후 progress 영역 + stdout line stream tail
 *   - AC-UI-4 → finding > 0 시 "Apply fix" 버튼 출현 / finding 0 시 "All healthy" + Close
 *   - AC-UI-5 → Apply fix 클릭 시 in-modal step 진행 (별 modal X)
 *   - AC-UI-6 → close 시 abort signal + 5s timeout 후 SIGKILL spy + confirm dialog
 *
 * RED 의도:
 *   - `wikey-obsidian/src/maintenance-modal.ts` 미존재 → import-time RED.
 *   - `sidebar-chat.ts` 의 Help 패널 안 "Wiki Maintenance" 섹션 미존재 → DOM assertion RED.
 *
 * NOTE: 본 test 는 happy-dom 환경 + Obsidian mock layer 사용 (vitest.config.ts alias).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { App, Vault } from 'obsidian'
// TODO(developer GREEN): create wikey-obsidian/src/maintenance-modal.ts exporting:
//   - MaintenanceModal extends Modal { constructor(app, plugin, opts: { mode, ... }); onOpen(); ... }
//   - MaintenanceMode = 'status' | 'check' | 'recovery' | 'refactoring'
import { MaintenanceModal, type MaintenanceMode } from '../maintenance-modal'
// sidebar-chat 안 openHelp() 의 신규 "Wiki Maintenance" 섹션 (4 버튼) — GREEN 시 sidebar-chat.ts 에 추가.
// 본 test 는 ChatSidebarView 인스턴스 mount 후 help 패널 DOM 을 assert.
import { ChatSidebarView } from '../sidebar-chat'

// Minimal stub for ChatSidebarView constructor deps. onOpen() reads
// plugin.buildConfig() + plugin.settings.cloudModel + chatHistory; loadModelList()
// fetches the provider model list but is async + non-blocking so a stub returning
// [] is sufficient for DOM assertions on the help panel.
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

function makeFakeLeaf() {
  return { view: null as any }
}

// ── AC-UI-1: Help 패널 섹션 ──

describe('§5.19 UI Spec — AC-UI-1: Help 패널 "Wiki Maintenance" 섹션 + 4 버튼', () => {
  it('AC-UI-1: openHelp() 호출 후 .wikey-maintenance-buttons 영역 + Status/Check/Recovery/Refactoring 4 버튼', async () => {
    const plugin = makeFakePlugin()
    const leaf = makeFakeLeaf()
    // ChatSidebarView 의 정확한 constructor signature 는 sidebar-chat.ts 정의에 의존.
    // Cycle 의 GREEN 단계에서 view 인스턴스 생성 + help 패널 mount path 가 변경될 수 있으므로
    // 본 test 는 *최소 contract* — view.openHelpForTest() (test exposure) 또는 selectPanel('help')
    // 후 DOM 안 4 버튼 textContent 확인.
    const view = new ChatSidebarView(leaf as any, plugin as any)
    // Lifecycle — onOpen + select help panel
    await view.onOpen()
    // Test-helper or production method to open help; GREEN 단계에서 production method 사용.
    ;(view as any).selectPanel?.('help')

    const root = (view as any).containerEl as HTMLElement
    const maintenanceSection = root.querySelector('.wikey-maintenance-buttons')
    expect(maintenanceSection, '`.wikey-maintenance-buttons` 섹션 미존재').not.toBeNull()

    const buttons = maintenanceSection?.querySelectorAll('button') ?? []
    expect(buttons.length).toBe(4)
    const labels = Array.from(buttons).map((b) => b.textContent ?? '')
    expect(labels.some((l) => /status/i.test(l))).toBe(true)
    expect(labels.some((l) => /check/i.test(l))).toBe(true)
    expect(labels.some((l) => /recovery/i.test(l))).toBe(true)
    expect(labels.some((l) => /refactor/i.test(l))).toBe(true)
  })
})

// ── AC-UI-2: MaintenanceModal mode prop 분기 ──

describe('§5.19 UI Spec — AC-UI-2: MaintenanceModal({ mode }) 4 분기', () => {
  it.each<MaintenanceMode>(['status', 'check', 'recovery', 'refactoring'])(
    'AC-UI-2: new MaintenanceModal(app, plugin, { mode: "%s" }).open() — modal 1회 생성 + open() 호출',
    async (mode) => {
      const plugin = makeFakePlugin()
      const modal = new MaintenanceModal(plugin.app as any, plugin as any, { mode })
      const openSpy = vi.spyOn(modal, 'open')
      modal.open()
      expect(openSpy).toHaveBeenCalledTimes(1)
      // modal mode prop 보존
      expect((modal as any).mode).toBe(mode)
    },
  )

  it('AC-UI-2: 4 mode 모두 동일 컴포넌트 (별 클래스 X) — instanceof MaintenanceModal', () => {
    const plugin = makeFakePlugin()
    const modes: MaintenanceMode[] = ['status', 'check', 'recovery', 'refactoring']
    for (const mode of modes) {
      const modal = new MaintenanceModal(plugin.app as any, plugin as any, { mode })
      expect(modal).toBeInstanceOf(MaintenanceModal)
    }
  })
})

// ── AC-UI-3: progress 영역 + stdout stream tail ──

describe('§5.19 UI Spec — AC-UI-3: Modal progress + stdout line stream', () => {
  it('AC-UI-3: onOpen() 후 .wikey-maintenance-modal-progress 영역 존재 + appendProgressLine() N line render', async () => {
    const plugin = makeFakePlugin()
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, { mode: 'check' })
    modal.onOpen()

    const progressEl = modal.contentEl.querySelector('.wikey-maintenance-modal-progress')
    expect(progressEl, '`.wikey-maintenance-modal-progress` 영역 미존재').not.toBeNull()

    // append 3 stdout lines via public test method (or production method)
    ;(modal as any).appendProgressLine?.('[wiki-check] validate-wiki running…')
    ;(modal as any).appendProgressLine?.('[wiki-check] paired-sidecar audit…')
    ;(modal as any).appendProgressLine?.('[wiki-check] reconcile dry-run…')

    const lines = progressEl?.querySelectorAll('.wikey-maintenance-modal-log-line') ?? []
    expect(lines.length).toBeGreaterThanOrEqual(3)
  })
})

// ── AC-UI-4: finding action 분기 ──

describe('§5.19 UI Spec — AC-UI-4: finding > 0 → "Apply fix" / finding 0 → "All healthy"', () => {
  it('AC-UI-4 (finding > 0): renderFindings([{...}]) → .wikey-maintenance-modal-action 안 "Apply fix" 버튼', () => {
    const plugin = makeFakePlugin()
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, { mode: 'check' })
    modal.onOpen()

    ;(modal as any).renderFindings?.([
      { kind: 'dangling-cross-link', path: 'wiki/entities/page-1.md', detail: '38-page dangling' },
    ])

    const actionEl = modal.contentEl.querySelector('.wikey-maintenance-modal-action')
    expect(actionEl, '`.wikey-maintenance-modal-action` 영역 미존재').not.toBeNull()
    const applyBtn = Array.from(actionEl?.querySelectorAll('button') ?? []).find((b) =>
      /apply fix/i.test(b.textContent ?? ''),
    )
    expect(applyBtn, '"Apply fix" 버튼 미존재 (finding>0)').toBeTruthy()
  })

  it('AC-UI-4 (finding 0): renderFindings([]) → "All healthy" + Close 만, "Apply fix" 부재', () => {
    const plugin = makeFakePlugin()
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, { mode: 'check' })
    modal.onOpen()
    ;(modal as any).renderFindings?.([])

    const body = modal.contentEl.textContent ?? ''
    expect(body).toMatch(/all healthy|이상 없음/i)
    const applyBtn = Array.from(modal.contentEl.querySelectorAll('button')).find((b) =>
      /apply fix/i.test(b.textContent ?? ''),
    )
    expect(applyBtn).toBeFalsy()
  })
})

// ── AC-UI-5: in-modal step 진행 (별 modal X) ──

describe('§5.19 UI Spec — AC-UI-5: Apply fix → 같은 modal 안 step 2 진행 (별 modal X)', () => {
  it('AC-UI-5: applyFix() 호출 후 modal.contentEl 재사용 (동일 element) — 별 Modal 인스턴스 생성 0', async () => {
    const plugin = makeFakePlugin()
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, { mode: 'check' })
    modal.onOpen()
    const initialContentEl = modal.contentEl

    ;(modal as any).renderFindings?.([
      { kind: 'dangling-cross-link', path: 'wiki/entities/page-1.md' },
    ])
    // applyFix 호출 (사용자 button click 모사)
    await (modal as any).applyFix?.()

    // 동일 modal — 같은 contentEl
    expect(modal.contentEl).toBe(initialContentEl)
    // step 2 / step 3 marker
    const body = modal.contentEl.textContent ?? ''
    expect(body).toMatch(/step\s*2|진행 중|fixing|적용/i)
  })
})

// ── AC-UI-6: abort signal + SIGKILL + confirm dialog ──

describe('§5.19 UI Spec — AC-UI-6: modal close 시 abort + 5s timeout → SIGKILL', () => {
  it('AC-UI-6: close() 호출 시 abortController.signal.aborted === true', () => {
    const plugin = makeFakePlugin()
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, { mode: 'check' })
    modal.onOpen()
    // production: subprocess start → modal owns AbortController
    const ac: AbortController = (modal as any).abortController
    expect(ac, 'modal 이 AbortController 미보유').toBeTruthy()
    modal.close()
    expect(ac.signal.aborted).toBe(true)
  })

  it('AC-UI-6: 진행 중 close → confirm dialog mock prompt 호출 + cancel 시 close 중단', () => {
    const plugin = makeFakePlugin()
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, { mode: 'check' })
    modal.onOpen()
    ;(modal as any).markRunning?.(true) // mark as in-progress

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    modal.close()
    expect(confirmSpy).toHaveBeenCalled()
    // 사용자 cancel → modal still open (production: not destroyed)
    confirmSpy.mockRestore()
  })

  it('AC-UI-6: subprocess 5s timeout 후 SIGKILL — onClose flow 가 killTimer 등록', () => {
    vi.useFakeTimers()
    const plugin = makeFakePlugin()
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, { mode: 'check' })
    modal.onOpen()
    ;(modal as any).markRunning?.(true)
    const sigKillSpy = vi.fn()
    ;(modal as any).onSigKill = sigKillSpy

    // accept close (window.confirm true 가정 — runtime 환경에 따라 confirm 우회 path)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    modal.close()
    vi.advanceTimersByTime(5500)
    expect(sigKillSpy).toHaveBeenCalled()
    confirmSpy.mockRestore()
    vi.useRealTimers()
  })
})

// ── Finding 1 + 6 (cycle #2) — runner injection + abort signal propagation ──

describe('§5.19 UI Spec — Runner injection (Finding 1, 6)', () => {
  it('runner.runStatus is invoked on onOpen for mode=status and receives the abort signal', async () => {
    const plugin = makeFakePlugin()
    const seenSignals: AbortSignal[] = []
    const runStatus = vi.fn(async (signal: AbortSignal) => {
      seenSignals.push(signal)
      return { pageCount: 215, danglingCrossLinkCount: 38 }
    })
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, {
      mode: 'status',
      runner: { runStatus },
    })
    modal.onOpen()
    await Promise.resolve()
    await Promise.resolve()
    expect(runStatus).toHaveBeenCalledTimes(1)
    expect(seenSignals[0]).toBe(modal.abortController.signal)
  })

  it('runner.runCheck → applyFix opens step-2 sha-grouped confirm; runRecovery fires only on [실행] click (Finding 3 cycle #4)', async () => {
    const plugin = makeFakePlugin()
    // 2 findings sharing 1 dangling sha — sha-grouped row count = 1 (NOT 2).
    const findings = [
      { kind: 'dangling-cross-link', path: 'wiki/entities/page-1.md', sha: 'sha256:679cf2dd6db75e3a' },
      { kind: 'dangling-cross-link', path: 'wiki/entities/page-2.md', sha: 'sha256:679cf2dd6db75e3a' },
    ]
    const runCheck = vi.fn(async () => findings)
    const runRecovery = vi.fn(async (_signal: AbortSignal, payload: { danglingShas: readonly string[] }) => ({
      changedPages: ['wiki/entities/page-1.md', 'wiki/entities/page-2.md'],
      _seenShas: payload.danglingShas,
    } as any))
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, {
      mode: 'check',
      runner: { runCheck, runRecovery },
    })
    modal.onOpen()
    // Let runCheck resolve.
    await new Promise((r) => setTimeout(r, 0))

    // applyFix opens step-2 confirm — runRecovery must NOT have been called yet (Spec I7 silent fix 0).
    await modal.applyFix()
    expect(runRecovery).not.toHaveBeenCalled()

    // Step-2 confirm UI (Finding 3 cycle #4): rows grouped by sha — 38-page batch
    // sharing 1 sha = 1 checkbox. Page count is surfaced in the label.
    const checkboxes = modal.contentEl.querySelectorAll(
      '.wikey-maintenance-modal-confirm-list input[type=checkbox]',
    )
    expect(checkboxes.length).toBe(1)
    const rowText = modal.contentEl.querySelector('.wikey-maintenance-modal-confirm-list')?.textContent ?? ''
    expect(rowText).toContain('sha256:679cf2dd6db75e3a')
    expect(rowText).toMatch(/2\s*페이지/)

    const execBtn = Array.from(modal.contentEl.querySelectorAll('button')).find((b) =>
      /실행/.test(b.textContent ?? ''),
    )
    expect(execBtn, '[실행] 버튼 미존재').toBeTruthy()

    // User clicks [실행] → runRecovery fires with the sha-level selection.
    ;(execBtn as HTMLButtonElement).click()
    await new Promise((r) => setTimeout(r, 0))
    expect(runRecovery).toHaveBeenCalledTimes(1)
    const payload = runRecovery.mock.calls[0]![1]
    // sha-level granularity: 1 row checked → 1 sha routed (every page bearing it scrubbed downstream).
    expect(payload.danglingShas).toEqual(['sha256:679cf2dd6db75e3a'])
  })

  it('step-2 sha-grouped: 2 distinct shas → 2 checkboxes; unchecking 1 routes only the other (Finding 3 cycle #4)', async () => {
    const plugin = makeFakePlugin()
    const findings = [
      { kind: 'dangling-cross-link', path: 'wiki/entities/a.md', sha: 'sha256:111aaa' },
      { kind: 'dangling-cross-link', path: 'wiki/entities/b.md', sha: 'sha256:111aaa' },
      { kind: 'dangling-cross-link', path: 'wiki/entities/c.md', sha: 'sha256:222bbb' },
    ]
    const runCheck = vi.fn(async () => findings)
    const runRecovery = vi.fn(async () => ({ changedPages: [] }))
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, {
      mode: 'check',
      runner: { runCheck, runRecovery },
    })
    modal.onOpen()
    await new Promise((r) => setTimeout(r, 0))
    await modal.applyFix()

    const checkboxes = Array.from(
      modal.contentEl.querySelectorAll<HTMLInputElement>(
        '.wikey-maintenance-modal-confirm-list input[type=checkbox]',
      ),
    )
    expect(checkboxes.length).toBe(2)

    // Uncheck the first sha row (sha256:111aaa) — second (sha256:222bbb) stays checked.
    checkboxes[0]!.checked = false

    const execBtn = Array.from(modal.contentEl.querySelectorAll('button')).find((b) =>
      /실행/.test(b.textContent ?? ''),
    )
    ;(execBtn as HTMLButtonElement).click()
    await new Promise((r) => setTimeout(r, 0))
    expect(runRecovery).toHaveBeenCalledTimes(1)
    const payload = runRecovery.mock.calls[0]![1]
    expect(payload.danglingShas).toEqual(['sha256:222bbb'])
  })

  it('step-2 [취소] 버튼 → runRecovery 호출 0 (Spec I7 silent fix 0)', async () => {
    const plugin = makeFakePlugin()
    const findings = [{ kind: 'dangling-cross-link', path: 'wiki/entities/page-1.md', sha: 'sha256:abc' }]
    const runCheck = vi.fn(async () => findings)
    const runRecovery = vi.fn(async () => ({ changedPages: [] }))
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, {
      mode: 'check',
      runner: { runCheck, runRecovery },
    })
    modal.onOpen()
    await new Promise((r) => setTimeout(r, 0))
    await modal.applyFix()
    const cancelBtn = Array.from(modal.contentEl.querySelectorAll('button')).find((b) =>
      /취소|cancel/i.test(b.textContent ?? ''),
    )
    expect(cancelBtn).toBeTruthy()
    ;(cancelBtn as HTMLButtonElement).click()
    await new Promise((r) => setTimeout(r, 0))
    expect(runRecovery).not.toHaveBeenCalled()
  })

  it('close mid-run → runner-injected child_process.kill SIGTERM spy fires (Finding 4 cycle #3)', async () => {
    const plugin = makeFakePlugin()
    const killSpy = vi.fn()
    // Simulated subprocess-aware runner: registers a SIGTERM hook on the modal's
    // abort signal, mirroring the production wiring of `validate-wiki` via
    // `child_process.spawn` + `child.kill('SIGTERM')` on abort.
    const runStatus = vi.fn(async (signal: AbortSignal) => {
      signal.addEventListener('abort', () => killSpy('SIGTERM'), { once: true })
      // Promise that resolves only when the test forces it — leaves the modal
      // in the running state long enough for close() to fire.
      return await new Promise<Record<string, unknown>>((resolve) => {
        signal.addEventListener('abort', () => resolve({}), { once: true })
      })
    })
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, {
      mode: 'status',
      runner: { runStatus },
    })
    modal.onOpen()
    // Let the runner attach its abort listener.
    await new Promise((r) => setTimeout(r, 0))
    // markRunning is set internally by runKeyValueMode; force-set here so the
    // close() prompt fires + scheduleSigKill registers (mirrors production
    // long-running subprocess).
    ;(modal as any).markRunning?.(true)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    modal.close()
    expect(killSpy).toHaveBeenCalledWith('SIGTERM')
    confirmSpy.mockRestore()
  })

  it('close() abort propagates into runner — signal.aborted = true after close', async () => {
    const plugin = makeFakePlugin()
    let observed: AbortSignal | null = null
    const runStatus = vi.fn(async (signal: AbortSignal) => {
      observed = signal
      return { ok: true }
    })
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, {
      mode: 'status',
      runner: { runStatus },
    })
    modal.onOpen()
    await Promise.resolve()
    modal.close()
    expect(observed).not.toBeNull()
    expect(observed!.aborted).toBe(true)
  })
})
