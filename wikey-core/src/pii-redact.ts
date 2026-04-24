/**
 * pii-redact.ts — Phase 4 D.0 (§4.1 v6) + Phase 5 §5.8 (2026-04-24, session 8).
 *
 * 한국 기업 문서 (사업자등록증, 등기부등본, 계약서) 에서 자주 등장하는
 * PII 를 감지·치환한다. **패턴은 하드코딩되지 않는다** — `pii-patterns.ts` 의
 * DEFAULT_PATTERNS 또는 `~/.config/wikey/pii-patterns.yaml` / `<basePath>/.wikey/pii-patterns.yaml`
 * 에서 로드된 사용자 정의 패턴을 사용.
 *
 * 설계:
 *   - **2-layer gate** (§4.1.2):
 *       `guardEnabled` (advanced, default true)  — false = 검사 전체 skip (user-trust)
 *       `allowIngest`  (basic,    default false) — false = PII 감지 시 throw
 *       `mode` (display | mask | hide, default mask) — 치환 방식
 *   - 중앙 wrapper (`applyPiiGate`) 는 ingest/PDF sidecar 양쪽에서 공통 호출.
 *   - `sanitizeForLlmPrompt` 은 body 외 filename/metadata 같은 **LLM 가시성 있는 임의 텍스트**
 *     에 동일 패턴을 mask 로 적용하는 단일 진입점 (Phase 5 §5.8.1 C-A1 filename leak 대응).
 *   - 본 모듈은 항상 **이미 텍스트로 변환된 markdown 또는 plain text** 를 받는다.
 *
 * FP 회피는 패턴 수준에서 관리 (DEFAULT_PATTERNS 의 look-behind + 한글자 수 제한).
 * 사용자가 YAML 에서 패턴을 추가·override 하면 그 즉시 엔진이 반영.
 */

import {
  compileDefaults,
  loadPiiPatterns,
  type CompiledPiiPattern,
  type PiiKind as PatternPiiKind,
} from './pii-patterns.js'

export type PiiRedactionMode = 'display' | 'mask' | 'hide'

/**
 * 기존 3개 kind 호환 유지. 사용자 패턴이 새 kind 문자열을 선언하면 그대로 통과
 * (CompiledPiiPattern.kind = string 으로 확장 가능).
 */
export type PiiKind = 'brn' | 'corp-rn' | 'ceo-labeled' | string

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

/**
 * 내부에서 사용할 패턴 세트. 인자 미지정 시 DEFAULT_PATTERNS 컴파일 결과 캐시 재사용.
 * 사용자가 yaml 을 수정하면 새 ingest 호출에서 `loadPiiPatterns` 를 다시 호출하므로 최신화.
 */
let _cachedDefaultCompiled: readonly CompiledPiiPattern[] | null = null

function getCompiledDefaults(): readonly CompiledPiiPattern[] {
  if (!_cachedDefaultCompiled) _cachedDefaultCompiled = compileDefaults()
  return _cachedDefaultCompiled
}

/** 각 PII 매치의 mask 전략을 복원하기 위해 kind 과 별도로 보존 필요. */
interface PiiMatchInternal extends PiiMatch {
  readonly mask: 'digits' | 'full'
}

/**
 * markdown 에서 PII 후보 전부 수집. 매칭 순서는 start 오름차순.
 * 중복 (start 겹침) 제거.
 *
 * @param markdown 검사 대상 텍스트
 * @param patterns 사용자 패턴 (미지정 시 DEFAULT_PATTERNS)
 */
export function detectPii(
  markdown: string,
  patterns?: readonly CompiledPiiPattern[],
): readonly PiiMatch[] {
  return detectPiiInternal(markdown, patterns).map((m) => ({
    kind: m.kind,
    value: m.value,
    start: m.start,
    end: m.end,
  }))
}

function detectPiiInternal(
  markdown: string,
  patterns?: readonly CompiledPiiPattern[],
): readonly PiiMatchInternal[] {
  const effective = patterns ?? getCompiledDefaults()
  const matches: PiiMatchInternal[] = []

  for (const p of effective) {
    p.regex.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = p.regex.exec(markdown)) !== null) {
      if (p.captureGroup !== undefined && p.captureGroup > 0) {
        const captured = m[p.captureGroup]
        if (captured == null) continue
        const relIdx = m[0].lastIndexOf(captured)
        const absStart = m.index + relIdx
        matches.push({
          kind: p.kind as PatternPiiKind,
          value: captured,
          start: absStart,
          end: absStart + captured.length,
          mask: p.mask,
        })
      } else {
        matches.push({
          kind: p.kind as PatternPiiKind,
          value: m[0],
          start: m.index,
          end: m.index + m[0].length,
          mask: p.mask,
        })
      }
      // Zero-width regex 방어
      if (m.index === p.regex.lastIndex) p.regex.lastIndex++
    }
  }

  matches.sort((a, b) => a.start - b.start || a.end - b.end)
  const deduped: PiiMatchInternal[] = []
  for (const m of matches) {
    const last = deduped[deduped.length - 1]
    if (last && last.start === m.start && last.end === m.end) continue
    deduped.push(m)
  }
  return deduped
}

/**
 * markdown 에 mode 에 따른 redact 를 적용. matches 는 detectPii 에서 재계산.
 *
 * @param patterns 사용자 패턴 (미지정 시 DEFAULT_PATTERNS)
 */
export function redactPii(
  markdown: string,
  mode: PiiRedactionMode,
  patterns?: readonly CompiledPiiPattern[],
): string {
  if (mode === 'display') return markdown
  const matches = detectPiiInternal(markdown, patterns)
  if (matches.length === 0) return markdown
  if (mode === 'mask') return applyMask(markdown, matches)
  return applyHide(markdown, matches)
}

function applyMask(markdown: string, matches: readonly PiiMatchInternal[]): string {
  // 뒤에서부터 치환하여 인덱스 무효화 방지.
  let out = markdown
  const sorted = [...matches].sort((a, b) => b.start - a.start)
  for (const m of sorted) {
    const masked = maskByStrategy(m.value, m.mask)
    out = out.slice(0, m.start) + masked + out.slice(m.end)
  }
  return out
}

/**
 * 패턴별 mask 전략 실행:
 *   - `digits`: digit 만 `*` 치환, 비-digit (하이픈·공백·문자) 보존. BRN 류.
 *   - `full`:   capture 전체를 문자수 만큼 `*` 반복. 한글 이름 / 공백 포함 변형.
 */
function maskByStrategy(value: string, strategy: 'digits' | 'full'): string {
  if (strategy === 'full') {
    const chars = [...value]
    return '*'.repeat(chars.length)
  }
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
 *
 * @param patterns 사용자 패턴 (미지정 시 DEFAULT_PATTERNS). ingest-pipeline 에서 `loadPiiPatterns(basePath)` 로 로드해 주입.
 */
export function applyPiiGate(
  input: string,
  opts: PiiGateOptions,
  patterns?: readonly CompiledPiiPattern[],
): PiiGateResult {
  if (!opts.guardEnabled) {
    return { content: input, matches: [], redacted: false }
  }
  const matches = detectPii(input, patterns)
  if (matches.length === 0) {
    return { content: input, matches: [], redacted: false }
  }
  if (!opts.allowIngest) {
    throw new PiiIngestBlockedError(matches)
  }
  const content = redactPii(input, opts.mode, patterns)
  return { content, matches, redacted: true }
}

/**
 * LLM 프롬프트·filename metadata·frontmatter 같은 **body 외 LLM 가시 텍스트** 에 PII
 * 패턴 mask 를 한 번에 적용하는 단일 진입점 (Phase 5 §5.8.1 C-A1 filename leak 대응).
 *
 * body 용 `applyPiiGate` 와의 차이:
 *   - 2-layer gate 를 거치지 않음 (filename 은 user 가 원본 파일을 준 시점에 이미 PII 존재 인지).
 *   - `guardEnabled=false` 에서도 mask 는 선택 적용 (옵션) — 본체 PII gate 가 off 여도 LLM 에 원문 전달은
 *     별도 판단.
 *   - mode 는 항상 mask (hide 는 filename 전부 사라져서 의미 불명, display 는 보호 없음).
 *
 * 기본 동작:
 *   - guardEnabled=false → 원문 그대로 (호출자가 ingest gate 와 일관 유지).
 *   - guardEnabled=true → detectPii → mask 치환.
 */
export function sanitizeForLlmPrompt(
  input: string,
  opts: { readonly guardEnabled: boolean },
  patterns?: readonly CompiledPiiPattern[],
): string {
  if (!opts.guardEnabled) return input
  const matches = detectPiiInternal(input, patterns)
  if (matches.length === 0) return input
  return applyMask(input, matches)
}

// re-export pattern engine surface for callers that need to pre-load patterns.
export { loadPiiPatterns, DEFAULT_PATTERNS, compileDefaults } from './pii-patterns.js'
export type { PiiPattern, CompiledPiiPattern } from './pii-patterns.js'
