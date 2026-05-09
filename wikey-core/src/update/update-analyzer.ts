/**
 * §5.7.5 — [분석] 버튼 backend.
 *
 * upstream changelog / diff fetch + LLM 요약 + devRequired heuristic.
 * UI row 1개당 1회 cache 권장 (UI layer 책임).
 */

import type { UpdateItemDescriptor } from './upstream-checker.js'

export interface UpdateAnalysis {
  readonly summary: string
  readonly devRequired: boolean
  readonly devRequiredReason?: string
}

export interface AnalyzeUpdateOptions {
  readonly item: UpdateItemDescriptor
  readonly llm: { generate: (prompt: string) => Promise<string> }
  readonly fetch: (url: string) => Promise<string>
  /** Optional max chars of changelog passed into the LLM prompt. */
  readonly maxChangelogChars?: number
}

const DEFAULT_MAX_CHARS = 4000

const PROMPT_TEMPLATE = (
  item: UpdateItemDescriptor,
  changelog: string,
): string => `당신은 wikey 의 dependency upgrade 검토를 돕는 한국어 어시스턴트입니다.

## 항목
- displayName: ${item.displayName}
- kind: ${item.kind}
- currentVersion: ${item.currentVersion}
- upstreamVersion: ${item.upstreamVersion ?? '(unknown)'}
- diffSource: ${item.diffSource}

## upstream changelog / release note (truncated)
${changelog}

## wikey 측 vendor 수정분 (해당 시)
${item.kind === 'kiwi-nlp' ? '본 항목은 vendor (sparse) — VENDOR.md 안 patch list 와 충돌 가능성 검토.' : '없음.'}

## 요청 (JSON 만 반환)
{
  "summary": "3~5 문장 한국어 요약",
  "devRequired": true|false,
  "devRequiredReason": "devRequired=true 시 1줄 근거"
}
`

function safeParseAnalysis(raw: string, fallbackSummary: string): UpdateAnalysis {
  try {
    const parsed = JSON.parse(raw) as Partial<UpdateAnalysis>
    if (typeof parsed.summary !== 'string' || typeof parsed.devRequired !== 'boolean') {
      return { summary: fallbackSummary, devRequired: false }
    }
    const out: UpdateAnalysis = parsed.devRequired
      ? {
          summary: parsed.summary,
          devRequired: true,
          devRequiredReason:
            typeof parsed.devRequiredReason === 'string' && parsed.devRequiredReason.length > 0
              ? parsed.devRequiredReason
              : '근거 미상',
        }
      : { summary: parsed.summary, devRequired: false }
    return out
  } catch {
    // Fallback — LLM 응답이 plain text 인 경우. devRequired heuristic 보수적으로 false.
    return { summary: raw.length > 0 ? raw : fallbackSummary, devRequired: false }
  }
}

export async function analyzeUpdate(opts: AnalyzeUpdateOptions): Promise<UpdateAnalysis> {
  const maxChars = opts.maxChangelogChars ?? DEFAULT_MAX_CHARS
  let changelog = ''
  try {
    const text = await opts.fetch(opts.item.diffSource)
    changelog = text.slice(0, maxChars)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      summary: `changelog fetch 실패: ${msg}`,
      devRequired: false,
    }
  }

  const prompt = PROMPT_TEMPLATE(opts.item, changelog)
  const raw = await opts.llm.generate(prompt)
  return safeParseAnalysis(raw, '요약 생성 실패')
}
