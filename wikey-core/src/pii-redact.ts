/**
 * pii-redact.ts — Phase 4 D.0 (§4.1 v6).
 *
 * 한국 기업 문서 (사업자등록증, 등기부등본, 계약서) 에서 자주 등장하는
 * PII 3종 (BRN · 법인등록번호 · 대표이사 이름 label) 을 감지·치환한다.
 *
 * 설계:
 *   - **2-layer gate** (§4.1.2):
 *       `guardEnabled` (advanced, default true)  — false = 검사 전체 skip (user-trust)
 *       `allowIngest`  (basic,    default false) — false = PII 감지 시 throw
 *       `mode` (display | mask | hide, default mask) — 치환 방식
 *   - 중앙 wrapper (`applyPiiGate`) 는 ingest/PDF sidecar 양쪽에서 공통 호출.
 *   - 변환 전/후 구분 없음. 본 모듈은 항상 **이미 텍스트로 변환된 markdown** 을 받는다.
 *
 * FP 회피:
 *   - unlabeled \d{13} 은 미감지 (주문번호·전화 등).
 *   - 2~4 한글자까지만 CEO 이름. 5자 이상은 라벨이 아닌 설명일 가능성.
 */

export type PiiRedactionMode = 'display' | 'mask' | 'hide'

export type PiiKind = 'brn' | 'corp-rn' | 'ceo-labeled'

export interface PiiMatch {
  readonly kind: PiiKind
  /** 치환 대상 substring (라벨 제외, 값만). */
  readonly value: string
  /** 원문 markdown 내 start 인덱스 (inclusive). value 시작점. */
  readonly start: number
  /** 원문 markdown 내 end 인덱스 (exclusive). value 종료점. */
  readonly end: number
}

export interface PiiGateOptions {
  readonly guardEnabled: boolean
  readonly allowIngest: boolean
  readonly mode: PiiRedactionMode
}

export interface PiiGateResult {
  readonly content: string
  readonly matches: readonly PiiMatch[]
  readonly redacted: boolean
}

export class PiiIngestBlockedError extends Error {
  readonly matches: readonly PiiMatch[]
  constructor(matches: readonly PiiMatch[]) {
    super(`PII detected (${matches.length} match${matches.length === 1 ? '' : 'es'}) — ingest blocked by policy`)
    this.name = 'PiiIngestBlockedError'
    this.matches = matches
  }
}

const HIDE_MARKER = '[PII 제거]'

// ── 정규식 (plan v6 §4.1.1) ──
// 1. BRN hyphenated (3-2-5)
const RE_BRN_HYPHEN = /\b\d{3}-\d{2}-\d{5}\b/g
// 2. BRN contiguous, 라벨 뒤 (look-behind)
const RE_BRN_CONTIG = /(?<=사업자(?:등록)?번호[\s:：]*)\d{10}(?!\d)/g
// 3. 법인등록번호 (6-7 or 13-digit, 라벨 뒤)
const RE_CORP_RN = /(?<=법인(?:등록)?번호[\s:：]*)\d{6}-?\d{7}\b/g
// 4. CEO 라벨 (값만 capture group 1)
const RE_CEO = /(?:대표이사|대표자|CEO)\s*[:：]\s*([가-힣]{2,4})/g

/**
 * markdown 에서 PII 후보 전부 수집. 매칭 순서는 start 오름차순.
 * 중복 (start 겹침) 제거.
 */
export function detectPii(markdown: string): readonly PiiMatch[] {
  const matches: PiiMatch[] = []

  const pushGlobal = (re: RegExp, kind: PiiKind): void => {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(markdown)) !== null) {
      matches.push({ kind, value: m[0], start: m.index, end: m.index + m[0].length })
    }
  }

  pushGlobal(RE_BRN_HYPHEN, 'brn')
  pushGlobal(RE_BRN_CONTIG, 'brn')
  pushGlobal(RE_CORP_RN, 'corp-rn')

  // CEO 는 capture group 1 만 치환 대상 (라벨 제외).
  RE_CEO.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = RE_CEO.exec(markdown)) !== null) {
    const name = m[1]
    const nameStart = m.index + m[0].indexOf(name, m[0].lastIndexOf(':') !== -1 ? m[0].lastIndexOf(':') : m[0].lastIndexOf('：'))
    // Safer: search within match for the name — capture group is last
    const relIdx = m[0].lastIndexOf(name)
    const absStart = m.index + relIdx
    matches.push({ kind: 'ceo-labeled', value: name, start: absStart, end: absStart + name.length })
    void nameStart // keep variable for clarity even if unused
  }

  // Sort by start, dedupe exact overlaps (same start+end).
  matches.sort((a, b) => a.start - b.start || a.end - b.end)
  const deduped: PiiMatch[] = []
  for (const m of matches) {
    const last = deduped[deduped.length - 1]
    if (last && last.start === m.start && last.end === m.end) continue
    deduped.push(m)
  }
  return deduped
}

/**
 * markdown 에 mode 에 따른 redact 를 적용. matches 는 detectPii 에서 재계산.
 */
export function redactPii(markdown: string, mode: PiiRedactionMode): string {
  if (mode === 'display') return markdown
  const matches = detectPii(markdown)
  if (matches.length === 0) return markdown
  if (mode === 'mask') return applyMask(markdown, matches)
  return applyHide(markdown, matches)
}

function applyMask(markdown: string, matches: readonly PiiMatch[]): string {
  // 뒤에서부터 치환하여 인덱스 무효화 방지.
  let out = markdown
  const sorted = [...matches].sort((a, b) => b.start - a.start)
  for (const m of sorted) {
    const masked = maskValue(m.value, m.kind)
    out = out.slice(0, m.start) + masked + out.slice(m.end)
  }
  return out
}

function maskValue(value: string, kind: PiiKind): string {
  if (kind === 'ceo-labeled') {
    // 한글 이름은 전부 *. 문자 단위 (Korean syllable) 로 셈.
    const chars = [...value]
    return '*'.repeat(chars.length)
  }
  // BRN / corp-rn: digit 만 *, 비-digit (하이픈 등) 은 보존.
  return value.replace(/\d/g, '*')
}

/**
 * hide 3-단 fallback:
 *   1. 문장 경계: 한국어 종결어미 (~다.|~요.|~까?|~죠.|~네.) OR 일반 punctuation (. ? ! …)
 *      → 포함 문장 전체를 `[PII 제거]` 로 치환.
 *   2. 줄 경계: 단일 라인 (\n~\n) 이 너무 길거나 종결부호 없음 → 라인 치환.
 *   3. window ±20 chars: 그 외 모두 실패 시 match 주변 40자를 `[PII 제거]` 로 치환.
 */
function applyHide(markdown: string, matches: readonly PiiMatch[]): string {
  // match 별 hide 범위 결정 (start, end) 계산 후 병합.
  const ranges: Array<{ start: number; end: number }> = []
  for (const m of matches) {
    ranges.push(resolveHideRange(markdown, m))
  }
  // 병합: 인접/겹침 범위 병합.
  ranges.sort((a, b) => a.start - b.start)
  const merged: Array<{ start: number; end: number }> = []
  for (const r of ranges) {
    const last = merged[merged.length - 1]
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end)
    } else {
      merged.push({ ...r })
    }
  }
  // 뒤에서부터 치환.
  let out = markdown
  for (let i = merged.length - 1; i >= 0; i--) {
    const r = merged[i]
    out = out.slice(0, r.start) + HIDE_MARKER + out.slice(r.end)
  }
  return out
}

const MAX_SENTENCE_LEN = 500
const MAX_LINE_LEN = 300
const WINDOW_HALF = 20

function resolveHideRange(text: string, m: PiiMatch): { start: number; end: number } {
  // 1단: 문장 경계 탐색.
  const sentence = findSentenceRange(text, m.start, m.end)
  if (sentence && sentence.end - sentence.start <= MAX_SENTENCE_LEN) {
    // 문장이 종결부호 (다./요././?/! /…) 로 끝나는지 확인.
    // — 끝나지 않으면 (긴 테이블 셀 · 긴 quote) 2단 line fallback.
    const sliced = text.slice(sentence.start, sentence.end)
    if (hasSentenceTerminator(sliced)) {
      return sentence
    }
  }

  // 2단: 라인 경계.
  const line = findLineRange(text, m.start, m.end)
  if (line && line.end - line.start <= MAX_LINE_LEN) {
    return line
  }

  // 3단: window ±20.
  return {
    start: Math.max(0, m.start - WINDOW_HALF),
    end: Math.min(text.length, m.end + WINDOW_HALF),
  }
}

/**
 * match 가 속한 "문장" 범위를 찾는다.
 *   - 왼쪽: 가장 가까운 [종결부호+공백] 또는 \n 직후.
 *   - 오른쪽: 가장 가까운 종결부호 포함 위치 또는 \n 직전.
 * 둘 중 하나라도 못 찾으면 null.
 */
function findSentenceRange(
  text: string,
  matchStart: number,
  matchEnd: number,
): { start: number; end: number } | null {
  // 왼쪽 스캔
  let start = 0
  for (let i = matchStart - 1; i >= 0; i--) {
    const ch = text[i]
    if (ch === '\n') { start = i + 1; break }
    // 한글 종결어미 ~다. / ~요. / ~까? / ~죠. / ~네.
    if ((ch === '.' || ch === '?' || ch === '!' || ch === '…' || ch === '。') && i + 1 <= matchStart) {
      start = i + 1
      // skip leading whitespace
      while (start < matchStart && /\s/.test(text[start])) start++
      break
    }
  }
  // 오른쪽 스캔
  let end = text.length
  for (let i = matchEnd; i < text.length; i++) {
    const ch = text[i]
    if (ch === '\n') { end = i; break }
    if (ch === '.' || ch === '?' || ch === '!' || ch === '…' || ch === '。') {
      end = i + 1
      break
    }
  }
  // trim trailing whitespace
  while (end > matchEnd && /\s/.test(text[end - 1])) end--
  if (end <= matchStart || start >= matchEnd) return null
  return { start, end }
}

function hasSentenceTerminator(segment: string): boolean {
  const trimmed = segment.trimEnd()
  if (trimmed.length === 0) return false
  const last = trimmed[trimmed.length - 1]
  return last === '.' || last === '?' || last === '!' || last === '…' || last === '。'
}

function findLineRange(
  text: string,
  matchStart: number,
  matchEnd: number,
): { start: number; end: number } | null {
  let start = 0
  for (let i = matchStart - 1; i >= 0; i--) {
    if (text[i] === '\n') { start = i + 1; break }
  }
  let end = text.length
  for (let i = matchEnd; i < text.length; i++) {
    if (text[i] === '\n') { end = i; break }
  }
  if (end <= matchStart || start >= matchEnd) return null
  return { start, end }
}

/**
 * 2-layer gate 중앙 진입점.
 *   - guardEnabled=false → skip 전체
 *   - 감지 0건 → pass-through
 *   - 감지 + allowIngest=false → throw PiiIngestBlockedError
 *   - 감지 + allowIngest=true → redact(mode) 후 content 반환
 */
export function applyPiiGate(input: string, opts: PiiGateOptions): PiiGateResult {
  if (!opts.guardEnabled) {
    return { content: input, matches: [], redacted: false }
  }
  const matches = detectPii(input)
  if (matches.length === 0) {
    return { content: input, matches: [], redacted: false }
  }
  if (!opts.allowIngest) {
    throw new PiiIngestBlockedError(matches)
  }
  const content = redactPii(input, opts.mode)
  return { content, matches, redacted: true }
}
