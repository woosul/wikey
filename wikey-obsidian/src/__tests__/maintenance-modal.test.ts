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
// MaintenanceMode = 'status' | 'check' | 'refactoring' (§5.19 v0.4 R9 — recovery
// retired; Check's Fix link multi-mode absorbed the dangling-sha cleanup path).
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

describe('§5.19 UI Spec — AC-UI-1: Help 패널 "Wiki Maintenance" 섹션 + 4 버튼 (v0.4 R9 + §5.20 v0.4)', () => {
  it('AC-UI-1: openHelp() 호출 후 .wikey-maintenance-buttons 영역 + Status/Check/Refactoring/KnowledgeGap 4 버튼', async () => {
    const plugin = makeFakePlugin()
    const leaf = makeFakeLeaf()
    const view = new ChatSidebarView(leaf as any, plugin as any)
    await view.onOpen()
    ;(view as any).selectPanel?.('help')

    const root = (view as any).containerEl as HTMLElement
    const maintenanceSection = root.querySelector('.wikey-maintenance-buttons')
    expect(maintenanceSection, '`.wikey-maintenance-buttons` 섹션 미존재').not.toBeNull()

    const buttons = maintenanceSection?.querySelectorAll('button') ?? []
    expect(buttons.length).toBe(4)
    const labels = Array.from(buttons).map((b) => b.textContent ?? '')
    expect(labels.some((l) => /status/i.test(l))).toBe(true)
    expect(labels.some((l) => /check/i.test(l))).toBe(true)
    expect(labels.some((l) => /refactor/i.test(l))).toBe(true)
    // §5.20 v0.4 — Knowledge gap report 버튼 추가.
    expect(labels.some((l) => /knowledge gap/i.test(l))).toBe(true)
    // v0.4 (R9): Recovery 버튼 폐기 — Check Fix link 가 흡수.
    expect(labels.some((l) => /recovery/i.test(l))).toBe(false)
  })
})

// ── AC-UI-2: MaintenanceModal mode prop 분기 ──

describe('§5.19 UI Spec — AC-UI-2: MaintenanceModal({ mode }) 3 분기 (v0.4 R9)', () => {
  it.each<MaintenanceMode>(['status', 'check', 'refactoring'])(
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

  it('AC-UI-2: 3 mode 모두 동일 컴포넌트 (별 클래스 X) — instanceof MaintenanceModal', () => {
    const plugin = makeFakePlugin()
    const modes: MaintenanceMode[] = ['status', 'check', 'refactoring']
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
    expect(rowText).toMatch(/2\s*pages/)

    const execBtn = Array.from(modal.contentEl.querySelectorAll('button')).find((b) =>
      /Execute/.test(b.textContent ?? ''),
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
      /Execute/.test(b.textContent ?? ''),
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

// ── §5.19 v0.4 R4 — footer Close 버튼 동작 (BUG fix) ──
//
// 사용자 obsidian-cdp 직접 시험에서 healthy-state footer `.wikey-maintenance-modal-close-btn`
// click → modal close 0. 본 cycle 에서 onClick 을 modal.close() 로 wiring.

describe('§5.19 v0.4 R4 — footer Close 버튼 click → modal.close()', () => {
  it('R4: healthy state footer Close click → modal.close() 호출', () => {
    const plugin = makeFakePlugin()
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, { mode: 'check' })
    modal.onOpen()
    ;(modal as any).renderFindings?.([])

    const closeSpy = vi.spyOn(modal, 'close')
    const closeBtn = modal.contentEl.querySelector(
      '.wikey-maintenance-modal-close-btn',
    ) as HTMLButtonElement | null
    expect(closeBtn, 'footer Close 버튼 미존재').not.toBeNull()
    closeBtn!.click()
    expect(closeSpy).toHaveBeenCalledTimes(1)
  })
})

// ── §5.19 v0.4 R6/R10/I-HEALTH-1 — "All healthy" 모순 fix ──

describe('§5.19 v0.4 R6 (Status) — broken > 0 시 "All healthy" 표시 0', () => {
  it('R6: Status mode runner result with brokenLinkCount=6936 → unhealthy summary, NOT "All healthy"', async () => {
    const plugin = makeFakePlugin()
    const runStatus = vi.fn(async () => ({
      pageCount: 215,
      orphanCount: 0,
      brokenLinkCount: 6936,
      staleTombstoneCount: 0,
      danglingCrossLinkCount: 38,
      lastValidateTs: null,
    }))
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, {
      mode: 'status',
      runner: { runStatus },
    })
    modal.onOpen()
    await new Promise((r) => setTimeout(r, 0))
    await Promise.resolve()

    const body = modal.contentEl.textContent ?? ''
    expect(body).not.toMatch(/all healthy/i)
    expect(body).toMatch(/issues found/i)
    expect(body).toMatch(/6936\s*broken/)
    expect(body).toMatch(/38\s*dangling/)
  })

  it('R6: Status mode runner result with all zeros → "All healthy"', async () => {
    const plugin = makeFakePlugin()
    const runStatus = vi.fn(async () => ({
      pageCount: 1,
      orphanCount: 0,
      brokenLinkCount: 0,
      staleTombstoneCount: 0,
      danglingCrossLinkCount: 0,
      lastValidateTs: null,
    }))
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, {
      mode: 'status',
      runner: { runStatus },
    })
    modal.onOpen()
    await new Promise((r) => setTimeout(r, 0))
    await Promise.resolve()

    const body = modal.contentEl.textContent ?? ''
    expect(body).toMatch(/all healthy/i)
  })
})

// ── §5.19 v0.4 Batch 2 (R1/R2/R3/R5) — 3-layer modal structure ──
//
// 사용자 obsidian-cdp 실측: modal 전체 scroll 로 title/buttons 가 화면 밖으로 밀림.
// onOpen() 이 root → header (sticky) / body (scrollable) / footer (sticky, centered)
// 3-layer 를 만들도록 검증.

describe('§5.19 v0.4 Batch 2 — 3-layer modal structure (R1/R2/R3/R5)', () => {
  it('R1/R2/R3: onOpen() 후 header / body / footer 3 element 모두 존재', () => {
    const plugin = makeFakePlugin()
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, { mode: 'status' })
    modal.onOpen()

    const headerEl = modal.contentEl.querySelector('.wikey-maintenance-modal-header')
    const bodyEl = modal.contentEl.querySelector('.wikey-maintenance-modal-body')
    const footerEl = modal.contentEl.querySelector('.wikey-maintenance-modal-footer')

    expect(headerEl, 'header layer 미존재').not.toBeNull()
    expect(bodyEl, 'body layer 미존재').not.toBeNull()
    expect(footerEl, 'footer layer 미존재').not.toBeNull()
  })

  it('R1: header 안 title element + MODE_TITLES mapping (mode 별 정확한 제목)', () => {
    const plugin = makeFakePlugin()
    const cases: Array<[MaintenanceMode, RegExp]> = [
      ['status', /wiki status/i],
      ['check', /wiki check/i],
      ['refactoring', /refactoring suggestions/i],
    ]
    for (const [mode, re] of cases) {
      const modal = new MaintenanceModal(plugin.app as any, plugin as any, { mode })
      modal.onOpen()
      const titleEl = modal.contentEl.querySelector(
        '.wikey-maintenance-modal-header .wikey-maintenance-modal-title',
      )
      expect(titleEl, `title element 미존재 (${mode})`).not.toBeNull()
      expect(titleEl?.textContent ?? '').toMatch(re)
    }
  })

  it('R3: progress 영역이 body 안에 nested (root 직속 X)', () => {
    const plugin = makeFakePlugin()
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, { mode: 'check' })
    modal.onOpen()
    const bodyEl = modal.contentEl.querySelector('.wikey-maintenance-modal-body')
    const progressEl = bodyEl?.querySelector('.wikey-maintenance-modal-progress')
    expect(progressEl, 'progress 가 body 안에 미존재').not.toBeNull()
  })

  it('R2/R5: footer 안에 action element + 모든 action button 이 footer 하위', () => {
    const plugin = makeFakePlugin()
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, { mode: 'check' })
    modal.onOpen()
    ;(modal as any).renderFindings?.([
      { kind: 'dangling-cross-link', path: 'wiki/entities/page-1.md', sha: 'sha256:abc' },
    ])

    const footerEl = modal.contentEl.querySelector('.wikey-maintenance-modal-footer')
    expect(footerEl, 'footer layer 미존재').not.toBeNull()
    const actionEl = footerEl?.querySelector('.wikey-maintenance-modal-action')
    expect(actionEl, 'action element 가 footer 안에 미존재').not.toBeNull()

    // 모든 action button 이 footer 안에 있어야 함 (Apply fix + Cancel)
    const footerButtons = footerEl?.querySelectorAll('button') ?? []
    expect(footerButtons.length).toBeGreaterThanOrEqual(2)
    const labels = Array.from(footerButtons).map((b) => b.textContent ?? '')
    expect(labels.some((l) => /apply fix/i.test(l))).toBe(true)
    expect(labels.some((l) => /cancel/i.test(l))).toBe(true)
  })
})

// ── §5.19 v0.4 Batch 3 (R7 / AC-CHECK-1~3) — finding 분류 accordion ──
//
// 사용자 obsidian-cdp 실측: Check modal finding 7,439건 flat list → 분류 그룹 +
// expand/collapse 필요. 본 cycle 에서 renderFindings 가 kind 별 그룹 accordion 을
// 만들도록 검증.

describe('§5.19 v0.4 Batch 3 R7 — finding accordion (AC-CHECK-1~3)', () => {
  it('AC-CHECK-1: 다중 kind → 각 kind 별 group element 생성 (빈 group 미표시)', () => {
    const plugin = makeFakePlugin()
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, { mode: 'check' })
    modal.onOpen()
    ;(modal as any).renderFindings?.([
      { kind: 'broken-link', path: 'wiki/a.md', detail: '[[missing]]' },
      { kind: 'broken-link', path: 'wiki/b.md', detail: '[[other]]' },
      { kind: 'dangling-cross-link', path: 'wiki/c.md', detail: 'sha256:abc' },
      { kind: 'stale-tombstone', detail: 'id-1' },
    ])

    const groups = modal.contentEl.querySelectorAll(
      '.wikey-maintenance-modal-finding-group',
    )
    expect(groups.length).toBe(3) // 3 distinct kinds, no `paired-sidecar` group
  })

  it('AC-CHECK-2: 그룹 헤더 click → expand (chevron-down + list 표시), 재click → collapse (chevron-right + list 숨김)', () => {
    const plugin = makeFakePlugin()
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, { mode: 'check' })
    modal.onOpen()
    ;(modal as any).renderFindings?.([
      { kind: 'broken-link', path: 'wiki/a.md', detail: '[[x]]' },
    ])

    const groupEl = modal.contentEl.querySelector(
      '.wikey-maintenance-modal-finding-group',
    ) as HTMLElement
    expect(groupEl, 'finding group 미존재').toBeTruthy()
    const headerBtn = groupEl.querySelector(
      '.wikey-maintenance-modal-finding-group-header',
    ) as HTMLButtonElement
    const chevron = groupEl.querySelector('.wikey-maintenance-modal-chevron') as HTMLElement
    const listEl = groupEl.querySelector(
      '.wikey-maintenance-modal-finding-group-list',
    ) as HTMLElement

    // §5.19 Batch 7 (2026-05-12, 사용자 명시 UI) — chevron is a Bootstrap SVG
    // (`viewBox="0 0 16 16"` + `<path d="M4.646..."/>` for right vs
    // `M1.646...` for down). Assert SVG presence + path identity rather than
    // unicode glyph textContent (which is empty for SVG innerHTML).
    const isRight = (el: HTMLElement) =>
      !!el.querySelector('svg path[d^="M4.646"]')
    const isDown = (el: HTMLElement) =>
      !!el.querySelector('svg path[d^="M1.646"]')

    // Initial — collapsed
    expect(headerBtn.getAttribute('aria-expanded')).toBe('false')
    expect(isRight(chevron)).toBe(true)
    expect(listEl.style.display).toBe('none')

    // Click 1 — expand
    headerBtn.click()
    expect(headerBtn.getAttribute('aria-expanded')).toBe('true')
    expect(isDown(chevron)).toBe(true)
    expect(listEl.style.display).not.toBe('none')

    // Click 2 — collapse
    headerBtn.click()
    expect(headerBtn.getAttribute('aria-expanded')).toBe('false')
    expect(isRight(chevron)).toBe(true)
    expect(listEl.style.display).toBe('none')
  })

  it('AC-CHECK-3: 그룹 헤더 label 에 finding 수량 표시 (예: "Broken Wikilink (2)")', () => {
    const plugin = makeFakePlugin()
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, { mode: 'check' })
    modal.onOpen()
    ;(modal as any).renderFindings?.([
      { kind: 'broken-link', path: 'wiki/a.md', detail: '[[x]]' },
      { kind: 'broken-link', path: 'wiki/b.md', detail: '[[y]]' },
      { kind: 'dangling-cross-link', path: 'wiki/c.md', detail: 'sha256:abc' },
    ])

    const headers = Array.from(
      modal.contentEl.querySelectorAll('.wikey-maintenance-modal-finding-group-header'),
    )
    const labelText = headers.map((h) => h.textContent ?? '').join(' | ')
    expect(labelText).toMatch(/Broken Wikilink\s*\(2\)/)
    expect(labelText).toMatch(/Dangling Cross-link\s*\(1\)/)
  })

  it('R7: unknown kind → validate-wiki-other 그룹으로 fallback', () => {
    const plugin = makeFakePlugin()
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, { mode: 'check' })
    modal.onOpen()
    ;(modal as any).renderFindings?.([
      { kind: 'validate-wiki', detail: 'FAIL: some validate-wiki line' },
      { kind: 'totally-unknown-kind', detail: 'fallback me' },
    ])

    const headers = Array.from(
      modal.contentEl.querySelectorAll('.wikey-maintenance-modal-finding-group-header'),
    )
    // Both should collapse into the same `Validate-wiki Other` bucket.
    expect(headers.length).toBe(1)
    expect(headers[0]!.textContent ?? '').toMatch(/Validate-wiki Other\s*\(2\)/)
  })
})

describe('§5.19 v0.4 R10 (Refactoring) — duplicates > 0 시 "All healthy" 표시 0', () => {
  it('R10: Refactoring mode result with duplicates=[{...},{...}] → unhealthy summary', async () => {
    const plugin = makeFakePlugin()
    const runRefactoring = vi.fn(async () => ({
      duplicates: [
        { a: 'foo', b: 'bar', similarity: 0.9 },
        { a: 'baz', b: 'qux', similarity: 0.88 },
      ],
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

    const body = modal.contentEl.textContent ?? ''
    expect(body).not.toMatch(/all healthy/i)
    expect(body).toMatch(/issues found/i)
    expect(body).toMatch(/2\s*duplicates/)
    expect(body).toMatch(/1\s*lowUtility/)
  })

  it('R10: Refactoring mode result with empty arrays → "All healthy"', async () => {
    const plugin = makeFakePlugin()
    const runRefactoring = vi.fn(async () => ({
      duplicates: [],
      lowUtility: [],
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

    const body = modal.contentEl.textContent ?? ''
    expect(body).toMatch(/all healthy/i)
  })
})

// ── §5.19 v0.4 Batch 5 fix (2026-05-12) — validate-wiki broken wikilink wiring ──
//
// 라이브 vault 의 broken wikilink 거의 전부 (10,000+ 중 99%+) 가 collectFindings 의
// standalone `broken-link` path 가 아닌 validate-wiki.sh stdout (`validate-wiki`
// kind) 로 surface 된다. annotateAutoFix 가 이 path 를 무시하면 Step 2 broken
// section 이 0 row 가 되어 사용자가 38+ pages auto-fix 결과를 볼 수 없음
// (master cdp 직접 검증, 2026-05-12).

describe('§5.19 v0.4 Batch 5 fix — parseValidateWikiBrokenLine', () => {
  it('정상 broken wikilink FAIL line → { source, target } 추출', async () => {
    const { parseValidateWikiBrokenLine } = await import('../maintenance-runner')
    const out = parseValidateWikiBrokenLine(
      'wiki/log.md: 깨진 위키링크 [[exchangeable-image-file-format]]',
    )
    expect(out).toEqual({
      source: 'wiki/log.md',
      target: 'exchangeable-image-file-format',
    })
  })

  it('source path + alias 가 있는 broken wikilink → target 만 alias 제외 추출', async () => {
    const { parseValidateWikiBrokenLine } = await import('../maintenance-runner')
    const out = parseValidateWikiBrokenLine(
      'wiki/sources/source-X.md: 깨진 위키링크 [[GPT-4o|GPT 4o]]',
    )
    expect(out).toEqual({ source: 'wiki/sources/source-X.md', target: 'GPT-4o' })
  })

  it('broken wikilink 패턴 미일치 line → null (다른 FAIL 종류는 흡수 X)', async () => {
    const { parseValidateWikiBrokenLine } = await import('../maintenance-runner')
    expect(parseValidateWikiBrokenLine('wiki/log.md: 고아 페이지')).toBeNull()
    expect(parseValidateWikiBrokenLine('plain validate-wiki line')).toBeNull()
  })
})

describe('§5.19 v0.4 Batch 5 fix — annotateAutoFix validate-wiki branch', () => {
  it('validate-wiki broken wikilink + autoFixIndex 히트 → path + autoFixSlug 모두 채움', async () => {
    const { annotateAutoFix } = await import('../maintenance-runner')
    const idx = new Map<string, string>([
      ['wiki/log.md|exchangeable-image-file-format', 'exchangeable-image-file-format'],
    ])
    const f = {
      kind: 'validate-wiki',
      detail: 'wiki/log.md: 깨진 위키링크 [[exchangeable-image-file-format]]',
    }
    const out = annotateAutoFix(f, idx)
    expect(out.kind).toBe('validate-wiki')
    expect(out.path).toBe('wiki/log.md')
    expect(out.autoFixSlug).toBe('exchangeable-image-file-format')
  })

  it('validate-wiki broken wikilink + autoFixIndex 미스 → 원본 그대로 (autoFixSlug 미채움)', async () => {
    const { annotateAutoFix } = await import('../maintenance-runner')
    const idx = new Map<string, string>()
    const f = {
      kind: 'validate-wiki',
      detail: 'wiki/log.md: 깨진 위키링크 [[unknown-page]]',
    }
    const out = annotateAutoFix(f, idx)
    expect(out.autoFixSlug).toBeUndefined()
    // path 도 채우지 않음 (autoFix 가능한 경우에만 path fill — downstream filter 보호)
    expect(out.path).toBeUndefined()
  })

  it('기존 broken-link 분기는 그대로 동작 (회귀 검증)', async () => {
    const { annotateAutoFix } = await import('../maintenance-runner')
    const idx = new Map<string, string>([['wiki/a.md|missing', 'missing-canonical']])
    const f = { kind: 'broken-link', path: 'wiki/a.md', detail: '[[missing]]' }
    const out = annotateAutoFix(f, idx)
    expect(out.autoFixSlug).toBe('missing-canonical')
    expect(out.path).toBe('wiki/a.md')
  })
})

describe('§5.19 v0.4 Batch 5 fix — groupFindingsByKind: validate-wiki + 깨진 위키링크 detail → broken-wikilink bucket', () => {
  it('validate-wiki finding 의 detail 이 "깨진 위키링크 [[X]]" 패턴이면 broken-wikilink group 으로 분류', () => {
    const plugin = makeFakePlugin()
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, { mode: 'check' })
    modal.onOpen()
    ;(modal as any).renderFindings?.([
      {
        kind: 'validate-wiki',
        detail: 'wiki/log.md: 깨진 위키링크 [[exchangeable-image-file-format]]',
      },
      {
        kind: 'validate-wiki',
        detail: 'wiki/foo.md: 깨진 위키링크 [[GPT-4o]]',
      },
      // 일반 validate-wiki line (broken wikilink X) → validate-wiki-other 잔존
      { kind: 'validate-wiki', detail: 'wiki/x.md: 고아 페이지' },
    ])

    const headers = Array.from(
      modal.contentEl.querySelectorAll('.wikey-maintenance-modal-finding-group-header'),
    )
    const labelText = headers.map((h) => h.textContent ?? '').join(' | ')
    expect(labelText).toMatch(/Broken Wikilink\s*\(2\)/)
    expect(labelText).toMatch(/Validate-wiki Other\s*\(1\)/)
  })

  it('broken-link (기존 producer) + validate-wiki broken (라이브 dominant) 혼합 → 동일 broken-wikilink bucket 통합', () => {
    const plugin = makeFakePlugin()
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, { mode: 'check' })
    modal.onOpen()
    ;(modal as any).renderFindings?.([
      { kind: 'broken-link', path: 'wiki/a.md', detail: '[[X]]' },
      {
        kind: 'validate-wiki',
        detail: 'wiki/b.md: 깨진 위키링크 [[Y]]',
      },
    ])

    const headers = Array.from(
      modal.contentEl.querySelectorAll('.wikey-maintenance-modal-finding-group-header'),
    )
    expect(headers.length).toBe(1)
    expect(headers[0]!.textContent ?? '').toMatch(/Broken Wikilink\s*\(2\)/)
  })
})

// ── §5.19 v0.4 Batch 6 (R12 / R13) — Step 2 multi-section render ──
//
// Goals:
//   - fuzzy finding 도 checkbox + <select> 드롭다운으로 surface
//   - no-match finding 도 checkbox 으로 surface (manual review tracking)
//   - section 사이 <hr> divider

describe('§5.19 v0.4 Batch 6 (R12) — Step 2 fuzzy + manual 섹션 render', () => {
  it('fuzzy finding → wikey-maintenance-modal-fuzzy-list 안 row + dropdown', async () => {
    const plugin = makeFakePlugin()
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, { mode: 'check' })
    modal.onOpen()
    ;(modal as any).renderFindings?.([
      {
        kind: 'broken-link',
        path: 'wiki/entities/page-a.md',
        detail: '[[claude-cod]]',
        fixKind: 'fuzzy',
        candidates: [
          { slug: 'claude-code', similarity: 0.9 },
          { slug: 'claude-3-opus', similarity: 0.72 },
        ],
      },
    ])
    await modal.applyFix()

    const fuzzyList = modal.contentEl.querySelector('.wikey-maintenance-modal-fuzzy-list')
    expect(fuzzyList, 'fuzzy section 미존재').toBeTruthy()
    const select = fuzzyList!.querySelector('select.wikey-maintenance-modal-fuzzy-select')
    expect(select, 'fuzzy dropdown 미존재').toBeTruthy()
    const options = Array.from(select!.querySelectorAll('option'))
    expect(options.length).toBe(2)
    expect(options[0]!.textContent ?? '').toMatch(/claude-code/)
  })

  it('no-match finding → wikey-maintenance-modal-no-match-list 안 row + checkbox', async () => {
    const plugin = makeFakePlugin()
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, { mode: 'check' })
    modal.onOpen()
    ;(modal as any).renderFindings?.([
      {
        kind: 'broken-link',
        path: 'wiki/entities/page-a.md',
        detail: '[[microsoft]]',
        fixKind: 'no-match',
        candidates: [],
      },
    ])
    await modal.applyFix()

    const noMatchList = modal.contentEl.querySelector('.wikey-maintenance-modal-no-match-list')
    expect(noMatchList, 'no-match section 미존재').toBeTruthy()
    const checkbox = noMatchList!.querySelector('input[type=checkbox]')
    expect(checkbox, 'no-match checkbox 미존재').toBeTruthy()
  })

  it('R13: 다중 section 시 사이에 <hr> divider 삽입', async () => {
    const plugin = makeFakePlugin()
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, { mode: 'check' })
    modal.onOpen()
    ;(modal as any).renderFindings?.([
      {
        kind: 'broken-link',
        path: 'wiki/a.md',
        detail: '[[GPT-4o]]',
        fixKind: 'case-insensitive',
        autoFixSlug: 'gpt-4o',
      },
      {
        kind: 'broken-link',
        path: 'wiki/b.md',
        detail: '[[microsoft]]',
        fixKind: 'no-match',
        candidates: [],
      },
    ])
    await modal.applyFix()

    const dividers = modal.contentEl.querySelectorAll(
      'hr.wikey-maintenance-modal-section-divider',
    )
    // 2 sections (auto-fix + no-match) → 1 divider 사이
    expect(dividers.length).toBe(1)
  })

  it('R12: fuzzy 체크박스 체크 + dropdown 선택 → [실행] payload 에 replacement 포함', async () => {
    const plugin = makeFakePlugin()
    const fixSpy = vi.fn(async () => ({ changedFiles: 1, changedLinks: 1 }))
    const modal = new MaintenanceModal(plugin.app as any, plugin as any, {
      mode: 'check',
      runner: {
        runCheck: async () => [
          {
            kind: 'broken-link' as const,
            path: 'wiki/entities/page-a.md',
            detail: '[[claude-cod]]',
            fixKind: 'fuzzy' as const,
            candidates: [
              { slug: 'claude-code', similarity: 0.9 },
              { slug: 'claude-3-opus', similarity: 0.72 },
            ],
          },
        ],
        runBrokenLinkFix: fixSpy,
      },
    })
    modal.onOpen()
    await new Promise((r) => setTimeout(r, 0))
    await modal.applyFix()

    const checkbox = modal.contentEl.querySelector(
      '.wikey-maintenance-modal-fuzzy-list input[type=checkbox]',
    ) as HTMLInputElement
    expect(checkbox).toBeTruthy()
    checkbox.checked = true

    const execBtn = Array.from(modal.contentEl.querySelectorAll('button')).find((b) =>
      /Execute/.test(b.textContent ?? ''),
    ) as HTMLButtonElement
    execBtn.click()
    await new Promise((r) => setTimeout(r, 0))
    expect(fixSpy).toHaveBeenCalledTimes(1)
    const payload = fixSpy.mock.calls[0]![1] as { fixes: readonly { source: string; brokenTarget: string; replacement: string }[] }
    expect(payload.fixes.length).toBe(1)
    expect(payload.fixes[0]!.replacement).toBe('claude-code')
    expect(payload.fixes[0]!.brokenTarget).toBe('claude-cod')
  })
})
