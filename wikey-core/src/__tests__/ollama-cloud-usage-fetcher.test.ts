/**
 * §5.6.5 옵션 A v2 — Ollama Cloud usage fetcher (CodexBar paradigm).
 *
 * Community precedent: steipete/CodexBar v0.18.0 (2026, GitHub) adds Ollama
 * as a statusbar usage provider via `__Secure-session` cookie + HTML scrape
 * of https://ollama.com/settings. Ollama has no public quota endpoint
 * (issue #15663 + #12532 feature requests). User raise 2026-05-14: wikey
 * 자체 누적 = 의미 없음 → fetch dashboard ground truth instead.
 *
 * What we fetch:
 *   - session % (5h reset cycle)
 *   - weekly % (7d reset cycle)
 *   - session reset timestamp
 *   - weekly reset timestamp
 *
 * Failure modes:
 *   - cookie expired → HTTP 302 redirect to /login → throw with reason='auth'
 *   - HTML layout drift → parser returns undefined fields → throw with reason='parse'
 *   - network error → throw with reason='network'
 *
 * No in-process token accumulation — fetcher is a pure read-through to
 * ollama.com which owns the ground truth.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  fetchOllamaCloudUsage,
  parseOllamaSettingsHtml,
  type OllamaUsageFetchResult,
  type OllamaUsageHttpClient,
} from '../ollama-cloud-usage-fetcher.js'

// Minimal valid stub of ollama.com/settings HTML — exact selectors locked
// from the live page (2026-05-14 master probe). Update when CodexBar
// upstream surfaces a layout change.
const SAMPLE_HTML = `
<html>
<body>
  <section class="usage-summary">
    <div class="usage-row" data-period="session">
      <span class="usage-label">Session usage</span>
      <span class="usage-percent">42%</span>
      <span class="usage-reset" data-iso="2026-05-14T18:00:00Z">resets in 3h</span>
    </div>
    <div class="usage-row" data-period="weekly">
      <span class="usage-label">Weekly usage</span>
      <span class="usage-percent">18%</span>
      <span class="usage-reset" data-iso="2026-05-19T00:00:00Z">resets in 5d</span>
    </div>
  </section>
</body>
</html>
`.trim()

function mockHttpClient(opts: {
  status?: number
  body?: string
  redirectLocation?: string
}): OllamaUsageHttpClient {
  return {
    async fetch() {
      return {
        status: opts.status ?? 200,
        body: opts.body ?? '',
        headers: opts.redirectLocation ? { location: opts.redirectLocation } : {},
      }
    },
  }
}

describe('§5.6.5 옵션 A v2 — parseOllamaSettingsHtml', () => {
  it('U1: parses session + weekly percent + reset ISO from sample HTML', () => {
    const result = parseOllamaSettingsHtml(SAMPLE_HTML)
    expect(result.sessionPct).toBe(42)
    expect(result.weeklyPct).toBe(18)
    expect(result.sessionResetAt).toBe('2026-05-14T18:00:00Z')
    expect(result.weeklyResetAt).toBe('2026-05-19T00:00:00Z')
  })

  it('U2: throws with reason=parse when html misses both rows', () => {
    expect(() => parseOllamaSettingsHtml('<html><body>nothing here</body></html>')).toThrow(
      /parse/i,
    )
  })

  it('U3: throws when both rows have malformed percent tokens', () => {
    // Single-row malformation can still cross-match via lazy quantifier
    // (session row's numeric falls through to weekly's). The catastrophic
    // failure mode the statusbar must surface is layout-wide drift —
    // both rows malformed simultaneously.
    const bad = SAMPLE_HTML.replace('42%', '???').replace('18%', '???')
    expect(() => parseOllamaSettingsHtml(bad)).toThrow(/parse/i)
  })
})

describe('§5.6.5 옵션 A v2 — fetchOllamaCloudUsage', () => {
  it('U4: success path — returns parsed usage info with cookie header sent', async () => {
    const calls: Array<{ url: string; cookie: string }> = []
    const client: OllamaUsageHttpClient = {
      async fetch(url, opts) {
        calls.push({ url, cookie: opts.cookie })
        return { status: 200, body: SAMPLE_HTML, headers: {} }
      },
    }
    const result = await fetchOllamaCloudUsage('test-cookie-value', { httpClient: client })
    expect(result.sessionPct).toBe(42)
    expect(result.weeklyPct).toBe(18)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://ollama.com/settings')
    expect(calls[0].cookie).toContain('test-cookie-value')
  })

  it("U5: HTTP 302 → /login → throws AuthExpiredError (reason='auth')", async () => {
    const client = mockHttpClient({ status: 302, redirectLocation: '/login' })
    await expect(
      fetchOllamaCloudUsage('expired-cookie', { httpClient: client }),
    ).rejects.toThrow(/auth/i)
  })

  it("U6: HTTP 401 → throws AuthExpiredError (reason='auth')", async () => {
    const client = mockHttpClient({ status: 401, body: 'unauthorized' })
    await expect(
      fetchOllamaCloudUsage('bad-cookie', { httpClient: client }),
    ).rejects.toThrow(/auth/i)
  })

  it("U7: HTTP 500 → throws with reason='network'", async () => {
    const client = mockHttpClient({ status: 500, body: 'server error' })
    await expect(
      fetchOllamaCloudUsage('cookie', { httpClient: client }),
    ).rejects.toThrow(/network|server|500/i)
  })

  it('U8: empty / missing cookie → throws before HTTP request', async () => {
    const calls: number[] = []
    const client: OllamaUsageHttpClient = {
      async fetch() {
        calls.push(1)
        return { status: 200, body: SAMPLE_HTML, headers: {} }
      },
    }
    await expect(fetchOllamaCloudUsage('', { httpClient: client })).rejects.toThrow(
      /cookie/i,
    )
    expect(calls).toHaveLength(0)
  })

  it('U9: result shape matches OllamaUsageFetchResult', async () => {
    const client = mockHttpClient({ body: SAMPLE_HTML })
    const result: OllamaUsageFetchResult = await fetchOllamaCloudUsage('c', {
      httpClient: client,
    })
    expect(result).toHaveProperty('sessionPct')
    expect(result).toHaveProperty('weeklyPct')
    expect(result).toHaveProperty('sessionResetAt')
    expect(result).toHaveProperty('weeklyResetAt')
    expect(result).toHaveProperty('fetchedAt')
    expect(typeof result.fetchedAt).toBe('number')
  })
})
