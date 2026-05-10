/**
 * §5.7.8 — small utilities shared by filter / rewriter / expander / analyzer:
 *  - `extractJsonObject` parses an LLM response that may wrap JSON in a markdown fence
 *    (```json ... ```) or emit a bare object. Mirrors the algorithm in
 *    `ingest-pipeline.ts:1242` (extractJsonBlock) but is generic over the value type.
 *  - `callWithTimeout` races a promise against a setTimeout reject so callers can
 *    distinguish "timeout" from other errors via the synthetic `Error('timeout …')`.
 *
 * Centralising these here removes 4 near-identical copies (one per layer module).
 */

export function extractJsonObject<T = Record<string, unknown>>(text: string): T | null {
  if (!text) return null
  const fence = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/)
  if (fence) {
    try { return JSON.parse(fence[1]) as T } catch { /* fall through */ }
  }
  const brace = text.match(/\{[\s\S]*\}/)
  if (brace) {
    try { return JSON.parse(brace[0]) as T } catch { /* fall through */ }
  }
  return null
}

export async function callWithTimeout<T>(
  work: () => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`timeout after ${timeoutMs}ms`))
    }, timeoutMs)
    work().then(
      (value) => { clearTimeout(timer); resolve(value) },
      (err) => { clearTimeout(timer); reject(err) },
    )
  })
}
