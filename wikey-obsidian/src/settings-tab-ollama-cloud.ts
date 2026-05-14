/**
 * §5.6.5 Step B — Settings UI 4th subsection for Ollama Cloud.
 *
 * PoC §0 §3 paradigm LOCK (2026-05-14):
 *   - Ollama Cloud auth = SSH key (`~/.ollama/id_ed25519`) + `ollama signin`
 *     OAuth browser flow. No API key, no subscription/api split.
 *   - Endpoint identical to local Ollama (`localhost:11434`), so no Endpoint
 *     URL row either.
 *
 * Q2=d LOCK — dedicated helper instead of extending ProviderSubsectionSpec
 * with optional Auth Mode / API Key / Endpoint URL fields. Karpathy
 * "no speculative flexibility": gemini/anthropic/openai share three rows
 * (Auth Mode + Subscription + API Key); ollama-cloud has *one* row.
 * Bolting it onto the shared spec would introduce 3 optional fields the
 * shared helper never reads on the cloud path.
 *
 * Block layout:
 *   <div class="wikey-auth-provider-row">
 *     <h3 class="wikey-auth-provider-heading">Ollama Cloud</h3>
 *     <span class="wikey-cli-status-badge wikey-cli-status-{installed|not-detected}">
 *       {installed|not detected}
 *     </span>
 *   </div>
 *   <div class="wikey-auth-block">
 *     <div class="wikey-auth-block-row">
 *       <span class="wikey-auth-block-label">Signin</span>
 *       <div class="wikey-auth-block-controls">
 *         <span class="wikey-auth-status-badge wikey-auth-status-{signed-in|not-detected}">
 *           {signed-in|not-detected}
 *         </span>
 *         <button class="wikey-auth-block-btn">{Sign out|Sign in}</button>
 *       </div>
 *     </div>
 *   </div>
 */

export interface OllamaCloudSubsectionDeps {
  /** True when `ollama` CLI binary resolves on PATH (or env override). */
  readonly ollamaCliInstalled: boolean
  /**
   * True when `~/.ollama/id_ed25519` exists (PoC §0 §3 — signin generates the
   * SSH key; absence = user has not signed in via `ollama signin`).
   */
  readonly signinDetected: boolean
  /** Invoked when user clicks the [Sign in] button (signinDetected=false). */
  readonly onSignin: () => void
  /** Invoked when user clicks the [Sign out] button (signinDetected=true). */
  readonly onSignout: () => void
  /**
   * §5.6.5 옵션 A v2 — current `__Secure-session` cookie from ollama.com/settings.
   * Empty string when user has not pasted yet. Stored in credentials.json.
   */
  readonly sessionCookie?: string
  /** Invoked when user updates the cookie input. Caller persists via saveCredentials. */
  readonly onCookieChange?: (value: string) => void
  /** Invoked when user clicks [Open Dashboard] — opens ollama.com/settings in browser. */
  readonly onOpenDashboard?: () => void
}

export function renderOllamaCloudSubsection(
  host: HTMLElement,
  deps: OllamaCloudSubsectionDeps,
): void {
  // Heading row — title + CLI install status badge (mirrors the
  // §5.6.4 provider-centric layout used by gemini/anthropic/openai).
  const headingRow = host.createDiv({ cls: 'wikey-auth-provider-row' })
  headingRow.createEl('h3', {
    text: 'Ollama Cloud',
    cls: 'wikey-auth-provider-heading',
  })
  headingRow.createEl('span', {
    text: deps.ollamaCliInstalled ? 'installed' : 'not detected',
    cls: `wikey-cli-status-badge ${
      deps.ollamaCliInstalled
        ? 'wikey-cli-status-installed'
        : 'wikey-cli-status-not-detected'
    }`,
  })

  // Single Signin row — badge sits immediately before the action button.
  const block = host.createDiv({ cls: 'wikey-auth-block' })
  const row = block.createDiv({ cls: 'wikey-auth-block-row' })
  row.createSpan({ cls: 'wikey-auth-block-label', text: 'Signin' })
  const controls = row.createDiv({ cls: 'wikey-auth-block-controls' })

  controls.createSpan({
    cls: `wikey-auth-status-badge ${
      deps.signinDetected
        ? 'wikey-auth-status-signed-in'
        : 'wikey-auth-status-not-detected'
    }`,
    text: deps.signinDetected ? 'signed-in' : 'not-detected',
  })

  const btn = controls.createEl('button', {
    text: deps.signinDetected ? 'Sign out' : 'Sign in',
    cls: 'wikey-auth-block-btn',
  })
  btn.addEventListener('click', () => {
    if (deps.signinDetected) deps.onSignout()
    else deps.onSignin()
  })

  // §5.6.5 옵션 A v2 — Session Cookie row (CodexBar paradigm).
  // ollama.com has no quota API yet (issue #15663). Pasting the
  // `__Secure-session` cookie lets wikey poll ollama.com/settings to show
  // session% / weekly% in the statusbar. Empty = statusbar chip hides
  // cloud quota figures (still shows local-model name).
  if (deps.onCookieChange !== undefined) {
    const cookieRow = block.createDiv({ cls: 'wikey-auth-block-row' })
    cookieRow.createSpan({ cls: 'wikey-auth-block-label', text: 'Session Cookie' })
    const cookieControls = cookieRow.createDiv({ cls: 'wikey-auth-block-controls' })

    const cookieInput = cookieControls.createEl('input', {
      cls: 'wikey-api-key-input',
      attr: { type: 'password', placeholder: '__Secure-session=...' },
    })
    cookieInput.value = deps.sessionCookie ?? ''
    cookieInput.addEventListener('change', () => {
      deps.onCookieChange?.(cookieInput.value)
    })

    if (deps.onOpenDashboard !== undefined) {
      const dashBtn = cookieControls.createEl('button', {
        text: 'Open Dashboard',
        cls: 'wikey-auth-block-btn',
      })
      dashBtn.addEventListener('click', () => deps.onOpenDashboard?.())
    }
  }
}
