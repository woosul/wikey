/**
 * 변환 품질 스코어링 (Phase 4.1.1.6).
 *
 * Docling tier 1 출력이 특정 실패 패턴에 해당하면 tier 1b (force-ocr) 재시도 또는
 * tier 2 (markitdown-ocr) 폴스루를 트리거한다. 판단 기준은 4가지 결함 signal:
 *
 *   1. brokenTableRatio : `|` 만 연속되는 행의 비율 (TableFormer 실패)
 *   2. emptySectionRatio : 헤딩 직후 본문 50자 미만 비율 (섹션 추출 실패)
 *   3. minBodyChars : 전체 본문 최소 문자 수 (아예 추출 실패)
 *   4. koreanWhitespaceLoss : 15자+ 한글 토큰 비율 > 30% (text-layer 공백 소실)
 *
 * 결과 `decision`:
 *   - `accept`: score ≥ DOCLING_QUALITY_MIN_SCORE (기본 0.6)
 *   - `retry` : 한국어 공백 소실 감지 — docling --force-ocr 로 재시도
 *   - `reject`: 그 외 품질 미달 — 다음 tier 폴스루
 */

export interface QualityResult {
  readonly score: number           // 0.0 ~ 1.0
  readonly flags: string[]         // 발견된 결함 라벨들
  readonly decision: 'accept' | 'retry' | 'reject'
}

export interface QualityOptions {
  readonly minScore?: number                 // 기본 0.6
  readonly retryOnKoreanWhitespace?: boolean // 기본 true
}

export function scoreConvertOutput(md: string, opts?: QualityOptions): QualityResult {
  const minScore = opts?.minScore ?? 0.6
  const retryKr = opts?.retryOnKoreanWhitespace ?? true
  const flags: string[] = []

  // 1. 최소 본문
  const bodyChars = md.trim().length
  if (bodyChars < 100) {
    flags.push('min-body-chars')
    return { score: 0, flags, decision: 'reject' }
  }

  // 2. 테이블 깨짐 — `|` 3개 이상 연속되는 라인 중 실제 내용 0인 비율
  const lines = md.split('\n')
  const pipeLines = lines.filter((l) => (l.match(/\|/g) ?? []).length >= 3)
  const brokenTables = pipeLines.filter((l) => {
    const content = l.replace(/\|/g, '').replace(/\s+/g, '')
    return content.length < 3 // 셀 내용이 거의 없음
  })
  const brokenTableRatio = pipeLines.length === 0 ? 0 : brokenTables.length / pipeLines.length
  if (brokenTableRatio > 0.5) flags.push('broken-tables')

  // 3. 빈 섹션 — 헤딩 직후 50자 미만
  const headingIndices: number[] = []
  lines.forEach((l, i) => { if (/^#{1,6}\s/.test(l)) headingIndices.push(i) })
  let emptySections = 0
  for (let k = 0; k < headingIndices.length; k++) {
    const start = headingIndices[k] + 1
    const end = k + 1 < headingIndices.length ? headingIndices[k + 1] : lines.length
    const body = lines.slice(start, end).join(' ').trim()
    if (body.length < 50) emptySections++
  }
  const emptySectionRatio = headingIndices.length === 0 ? 0 : emptySections / headingIndices.length
  if (emptySectionRatio > 0.5) flags.push('empty-sections')

  // 4. 한국어 공백 소실 (docling SKILL.md reference/korean-ocr-advanced.md)
  const koreanLoss = hasMissingKoreanWhitespace(md)
  if (koreanLoss) flags.push('korean-whitespace-loss')

  // score 계산 — signal 없을수록 높음
  let score = 1.0
  score -= brokenTableRatio * 0.3
  score -= emptySectionRatio * 0.3
  score -= koreanLoss ? 0.4 : 0
  score = Math.max(0, Math.min(1, score))

  // 결정
  // 한국어 공백 소실은 결과가 사실상 불사용 가능 — retry 가능하면 retry, 아니면 reject
  // (score 가 minScore 이상이어도 다음 tier 폴스루 유도).
  let decision: QualityResult['decision']
  if (koreanLoss) {
    decision = retryKr ? 'retry' : 'reject'
  } else if (score >= minScore) {
    decision = 'accept'
  } else {
    decision = 'reject'
  }

  return { score, flags, decision }
}

/**
 * 한국어 공백 소실 감지.
 * 네이버 블로그 프린트 PDF 등이 음수 kerning 으로만 간격을 표현 → text-layer 에 공백 없음.
 * 15자 이상 한글 토큰의 비율이 30% 초과면 공백 소실로 판단.
 */
export function hasMissingKoreanWhitespace(md: string): boolean {
  // 이미지 태그 제거 (placeholder 도)
  const clean = md
    .replace(/!\[.*?\]\([^)]+\)/g, '')
    .replace(/\[image(?::[^\]]*)?\]/g, '')

  const korean = [...clean].filter((c) => c >= '가' && c <= '힯').length
  if (korean < 100) return false // 한국어 문서가 아님

  const tokens = clean
    .split(/\s+/)
    .filter((t) => [...t].some((c) => c >= '가' && c <= '힯'))
  if (tokens.length === 0) return false

  const longTokens = tokens.filter((t) => t.length >= 15).length
  return longTokens / tokens.length > 0.30
}
