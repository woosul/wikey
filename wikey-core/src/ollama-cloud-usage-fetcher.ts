/**
 * §5.6.5 옵션 A v2 — Ollama Cloud usage fetcher (CodexBar paradigm mirror).
 *
 * Why HTML scrape: Ollama has no public quota API yet (issue #15663 +
 * #12532 = feature requests). steipete/CodexBar precedent uses
 * `__Secure-session` cookie + scrape of https://ollama.com/settings to
 * extract session % + weekly % + reset timestamps. wikey follows the
 * same path so the statusbar shows the same ground truth a user would
 * see by visiting ollama.com/settings directly.
 *
 * Why a separate file (not inline in callOllama): network egress to
 * ollama.com is *not* part of the LLM request path — it's a settings UI
 * concern. Keeping it isolated lets the statusbar poll on its own cadence
 * (5min default) without coupling to canonicalize / mention / brief
 * dispatches.
 *
 * Fragility note: ollama.com/settings is server-rendered HTML, not a
 * stable API. CodexBar v0.21 had to chase a cookie-name change. The
 * parser uses defensive selectors but layout drift will require manual
 * sweep — wired so a single regex update covers it.
 */

const OLLAMA_SETTINGS_URL = 'https://ollama.com/settings'

export interface OllamaUsageFetchResult {
  /** 0–100 integer percent of the 5h session quota used. */
  readonly sessionPct: number
  /** 0–100 integer percent of the 7d weekly quota used. */
  readonly weeklyPct: number
  /** ISO-8601 timestamp when the 5h session window resets. */
  readonly sessionResetAt: string
  /** ISO-8601 timestamp when the 7d weekly window resets. */
  readonly weeklyResetAt: string
  /** Local wall-clock ms when this fetch resolved (Date.now()). */
  readonly fetchedAt: number
}

export interface OllamaUsageHttpResponse {
  readonly status: number
  readonly body: string
  readonly headers: Record<string, string>
}

export interface OllamaUsageHttpClient {
  /** Issue an HTTP GET to `url` with the session cookie attached. */
  fetch(
    url: string,
    opts: { cookie: string; timeoutMs?: number },
  ): Promise<OllamaUsageHttpResponse>
}

export class OllamaUsageFetchError extends Error {
  constructor(
    message: string,
    readonly reason: 'cookie-missing' | 'auth' | 'network' | 'parse',
  ) {
    super(message)
    this.name = 'OllamaUsageFetchError'
  }
}

export interface FetchOptions {
  readonly httpClient: OllamaUsageHttpClient
  readonly timeoutMs?: number
}

export async function fetchOllamaCloudUsage(
  cookie: string,
  opts: FetchOptions,
): Promise<OllamaUsageFetchResult> {
  if (!cookie || cookie.length === 0) {
    throw new OllamaUsageFetchError(
      'Ollama Cloud session cookie missing — paste __Secure-session value in Settings.',
      'cookie-missing',
    )
  }

  let resp: OllamaUsageHttpResponse
  try {
    resp = await opts.httpClient.fetch(OLLAMA_SETTINGS_URL, {
      cookie,
      timeoutMs: opts.timeoutMs ?? 10_000,
    })
  } catch (err) {
    throw new OllamaUsageFetchError(
      `network error fetching ${OLLAMA_SETTINGS_URL}: ${(err as Error).message}`,
      'network',
    )
  }

  // CodexBar v0.21 mirror — auth expiry surfaces as 302 → /login OR direct 401.
  if (resp.status === 302) {
    const loc = resp.headers.location ?? ''
    if (loc.startsWith('/login') || loc.includes('login')) {
      throw new OllamaUsageFetchError(
        'Ollama Cloud auth expired — session cookie invalid; re-paste __Secure-session from ollama.com/settings.',
        'auth',
      )
    }
  }
  if (resp.status === 401 || resp.status === 403) {
    throw new OllamaUsageFetchError(
      `Ollama Cloud auth failure (status=${resp.status}) — re-paste session cookie.`,
      'auth',
    )
  }
  if (resp.status < 200 || resp.status >= 300) {
    throw new OllamaUsageFetchError(
      `Ollama Cloud settings fetch failed (status=${resp.status}, network/server error).`,
      'network',
    )
  }

  const parsed = parseOllamaSettingsHtml(resp.body)
  return { ...parsed, fetchedAt: Date.now() }
}

/**
 * Parse the four fields wikey displays out of ollama.com/settings HTML.
 *
 * The selectors mirror CodexBar's docs/ollama.md (2026-05-14). When
 * ollama.com changes layout, update both the regex and the SAMPLE_HTML
 * in ollama-cloud-usage-fetcher.test.ts so the unit test catches drift.
 */
export function parseOllamaSettingsHtml(html: string): Omit<OllamaUsageFetchResult, 'fetchedAt'> {
  const rowRegex = (period: 'session' | 'weekly'): RegExp =>
    new RegExp(
      `data-period="${period}"[\\s\\S]*?` +
        `class="usage-percent"[^>]*>\\s*([0-9]+)%\\s*<[\\s\\S]*?` +
        `class="usage-reset"[^>]*data-iso="([^"]+)"`,
      'i',
    )

  const sessionMatch = html.match(rowRegex('session'))
  const weeklyMatch = html.match(rowRegex('weekly'))
  if (!sessionMatch || !weeklyMatch) {
    throw new OllamaUsageFetchError(
      'parse error — ollama.com/settings layout drifted; selector miss for session or weekly row.',
      'parse',
    )
  }

  const sessionPct = Number(sessionMatch[1])
  const weeklyPct = Number(weeklyMatch[1])
  if (!Number.isFinite(sessionPct) || !Number.isFinite(weeklyPct)) {
    throw new OllamaUsageFetchError(
      `parse error — non-numeric usage percent (session='${sessionMatch[1]}', weekly='${weeklyMatch[1]}').`,
      'parse',
    )
  }

  return {
    sessionPct,
    weeklyPct,
    sessionResetAt: sessionMatch[2],
    weeklyResetAt: weeklyMatch[2],
  }
}
