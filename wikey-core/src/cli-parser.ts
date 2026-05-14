/**
 * §5.6.4 — subscription CLI stdout → clean response body parser.
 *
 * Plan: plan/phase-5/phase-5-todox-5.6.4-llm-subscription.md §4.0.7 (v0.7 #1h H1 marker-based).
 *
 * Strategy per provider:
 *   gemini : strip optional "Loaded cached credentials.\n" header → trim
 *   claude : trim only (no banner / footer)
 *   codex  : marker-based extraction — slice between `\ncodex\n` (response start)
 *            and `\ntokens used` (footer start). Fallback = raw.trim() when either
 *            marker is absent or order inverted (defensive — preserves response
 *            even when CLI output format changes).
 *
 * Why marker-based instead of separator-based:
 *   Past iterations (v0.4 regex / v0.5 single-drop / v0.6 4-segment) all
 *   leaked banner / prompt / footer in some configuration. The marker pair
 *   `\ncodex\n` ↔ `\ntokens used` matches *line-start* markers exactly, so
 *   line-middle occurrences in the body (e.g. "Use model:gemini-pro") never
 *   trigger a false strip.
 */

import type { SubscriptionProvider } from './types.js'

const GEMINI_HEADER_RE = /^Loaded cached credentials\.\n/

const CODEX_RESPONSE_MARKER = '\ncodex\n'
const CODEX_FOOTER_MARKER = '\ntokens used'

export function parseSubscriptionOutput(provider: SubscriptionProvider, raw: string): string {
  switch (provider) {
    case 'gemini': {
      const body = raw.replace(GEMINI_HEADER_RE, '')
      return body.trim()
    }
    case 'anthropic': {
      return raw.trim()
    }
    case 'openai': {
      const codexAt = raw.indexOf(CODEX_RESPONSE_MARKER)
      const tokensAt = raw.indexOf(CODEX_FOOTER_MARKER)
      if (codexAt === -1 || tokensAt === -1 || codexAt >= tokensAt) {
        // Unparseable — preserve raw so caller can surface debug info.
        return raw.trim()
      }
      return raw.slice(codexAt + CODEX_RESPONSE_MARKER.length, tokensAt).trim()
    }
    case 'ollama-cloud':
      // §5.6.5 v0.5 — ollama-cloud subscription path doesn't spawn a CLI
      // for prompt I/O (chat still goes through /api/chat HTTP), so this
      // parser is never invoked for it. Return raw unmodified for safety
      // — covers the TypeScript exhaustiveness check.
      return raw.trim()
  }
}
