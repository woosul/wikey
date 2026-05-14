/**
 * §5.6.5 Step B — Settings UI 4th subsection (Ollama Cloud) tests.
 *
 * RED phase tests (todox B1~B6, PoC §0 §3 paradigm LOCK):
 *   - B1: 4th subsection renders inside LLM Model Authentication section.
 *   - B2: heading text = 'Ollama Cloud' (English, system language LOCK).
 *   - B3: Auth Mode dropdown ABSENT (ollama-cloud = SSH+signin only, no
 *         subscription/api split).
 *   - B4: NO Endpoint URL row (PoC §0 §2 — same localhost:11434 as local).
 *   - B5: NO API Key row (PoC §0 §3 — no apiKey field, SSH+signin only).
 *   - B6: CLI install status badge + Signin status badge + Sign in/Sign out button.
 *         Signin button shell command = 'ollama signin' / 'ollama signout'.
 *
 * Q2=d LOCK — separate `renderOllamaCloudSubsection` helper rather than
 * extending ProviderSubsectionSpec with optional fields (Karpathy "no
 * speculative flexibility").
 */

import 'obsidian' // side-effect: applies HTMLElement.prototype.createDiv polyfill
import { describe, it, expect } from 'vitest'
import { renderOllamaCloudSubsection } from '../settings-tab-ollama-cloud.js'

interface FakeDeps {
  readonly ollamaCliInstalled: boolean
  readonly signinDetected: boolean
  signinClicks: number
  signoutClicks: number
}

function createDeps(overrides?: Partial<FakeDeps>): FakeDeps {
  return {
    ollamaCliInstalled: false,
    signinDetected: false,
    signinClicks: 0,
    signoutClicks: 0,
    ...overrides,
  }
}

describe('§5.6.5 Step B — renderOllamaCloudSubsection', () => {
  it("B1+B2: emits an Ollama Cloud heading inside the host element", () => {
    const host = document.createElement('div')
    renderOllamaCloudSubsection(host, {
      ollamaCliInstalled: false,
      signinDetected: false,
      onSignin: () => undefined,
      onSignout: () => undefined,
    })
    const heading = host.querySelector('.wikey-auth-provider-heading')
    expect(heading).not.toBeNull()
    expect(heading!.textContent).toBe('Ollama Cloud')
  })

  it('B3: no Auth Mode dropdown row (ollama-cloud has no subscription/api split)', () => {
    const host = document.createElement('div')
    renderOllamaCloudSubsection(host, {
      ollamaCliInstalled: true,
      signinDetected: true,
      onSignin: () => undefined,
      onSignout: () => undefined,
    })
    expect(host.querySelector('.wikey-auth-mode-select')).toBeNull()
    expect(host.textContent ?? '').not.toContain('Auth Mode')
  })

  it('B4+B5: no Endpoint URL row, no API Key row', () => {
    const host = document.createElement('div')
    renderOllamaCloudSubsection(host, {
      ollamaCliInstalled: true,
      signinDetected: true,
      onSignin: () => undefined,
      onSignout: () => undefined,
    })
    expect(host.textContent ?? '').not.toContain('Endpoint URL')
    expect(host.textContent ?? '').not.toContain('API Key')
    expect(host.querySelector('input[type="password"]')).toBeNull()
  })

  it('B6: CLI install badge shows "installed" when ollama CLI is detected', () => {
    const host = document.createElement('div')
    renderOllamaCloudSubsection(host, {
      ollamaCliInstalled: true,
      signinDetected: false,
      onSignin: () => undefined,
      onSignout: () => undefined,
    })
    const badge = host.querySelector('.wikey-cli-status-badge')
    expect(badge).not.toBeNull()
    expect(badge!.textContent).toBe('installed')
    expect(badge!.classList.contains('wikey-cli-status-installed')).toBe(true)
  })

  it('B6: CLI install badge shows "not detected" when ollama CLI is absent', () => {
    const host = document.createElement('div')
    renderOllamaCloudSubsection(host, {
      ollamaCliInstalled: false,
      signinDetected: false,
      onSignin: () => undefined,
      onSignout: () => undefined,
    })
    const badge = host.querySelector('.wikey-cli-status-badge')
    expect(badge).not.toBeNull()
    expect(badge!.textContent).toBe('not detected')
    expect(badge!.classList.contains('wikey-cli-status-not-detected')).toBe(true)
  })

  it('B6: signin badge "signed-in" + button "Sign out" when signin detected', () => {
    const host = document.createElement('div')
    const deps = createDeps({ ollamaCliInstalled: true, signinDetected: true })
    renderOllamaCloudSubsection(host, {
      ollamaCliInstalled: deps.ollamaCliInstalled,
      signinDetected: deps.signinDetected,
      onSignin: () => {
        deps.signinClicks += 1
      },
      onSignout: () => {
        deps.signoutClicks += 1
      },
    })
    const signinBadge = host.querySelector('.wikey-auth-status-badge')
    expect(signinBadge).not.toBeNull()
    expect(signinBadge!.textContent).toBe('signed-in')

    const button = host.querySelector('.wikey-auth-block-btn') as HTMLButtonElement | null
    expect(button).not.toBeNull()
    expect(button!.textContent).toBe('Sign out')

    button!.click()
    expect(deps.signoutClicks).toBe(1)
    expect(deps.signinClicks).toBe(0)
  })

  it('B6: signin badge "not-detected" + button "Sign in" when signin absent', () => {
    const host = document.createElement('div')
    const deps = createDeps()
    renderOllamaCloudSubsection(host, {
      ollamaCliInstalled: deps.ollamaCliInstalled,
      signinDetected: deps.signinDetected,
      onSignin: () => {
        deps.signinClicks += 1
      },
      onSignout: () => {
        deps.signoutClicks += 1
      },
    })
    const signinBadge = host.querySelector('.wikey-auth-status-badge')
    expect(signinBadge!.textContent).toBe('not-detected')
    expect(signinBadge!.classList.contains('wikey-auth-status-not-detected')).toBe(true)

    const button = host.querySelector('.wikey-auth-block-btn') as HTMLButtonElement | null
    expect(button!.textContent).toBe('Sign in')
    button!.click()
    expect(deps.signinClicks).toBe(1)
    expect(deps.signoutClicks).toBe(0)
  })
})
