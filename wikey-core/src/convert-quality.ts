/**
 * 변환 품질 스코어링 (Phase 4.1.1.6 초안 + §4.1.3.2 확장).
 *
 * Docling tier 1 출력이 특정 실패 패턴에 해당하면 tier 1a (no-ocr) / 1b (force-ocr) 재시도 또는
 * tier 2 (markitdown-ocr) 폴스루를 트리거한다. 판단 기준 signal:
 *
 *   1. brokenTableRatio : `|` 만 연속되는 행의 비율 (TableFormer 실패)
 *   2. emptySectionRatio : 헤딩 직후 본문 50자 미만 비율 (섹션 추출 실패)
 *   3. minBodyChars : 전체 본문 최소 문자 수 (아예 추출 실패)
 *   4. koreanWhitespaceLoss : 15자+ 한글 토큰 비율 > 30% (text-layer 공백 소실)
 *   5. imageOcrPollution (§4.1.3.2): image placeholder 근접에 짧은 파편 클러스터
 *      (UI 스크린샷 내 OCR 텍스트가 본문에 interleave 된 경우)
 *
 * 결과 `decision`:
 *   - `accept`       : score ≥ DOCLING_QUALITY_MIN_SCORE (기본 0.6)
 *   - `retry`        : 한국어 공백 소실 감지 — docling --force-ocr 로 재시도 (Tier 1b)
 *   - `retry-no-ocr` : image OCR 파편 감지 — docling --no-ocr 로 재시도 (Tier 1a, §4.1.3.2)
 *   - `reject`       : 그 외 품질 미달 — 다음 tier 폴스루
 *
 * 우선순위 (동시 감지 시): koreanLoss > pollution > score-based.
 */

export interface QualityResult {
  readonly score: number           // 0.0 ~ 1.0
  readonly flags: string[]         // 발견된 결함 라벨들
  readonly decision: 'accept' | 'retry' | 'retry-no-ocr' | 'reject'
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

  // 5. image OCR 파편 오염 (§4.1.3.2) — bitmap OCR 이 UI 스크린샷 텍스트를 본문에 interleave.
  //    docling CLI 기본 --ocr 에서 발생. 감지 시 --no-ocr 재시도 (Tier 1a) 유도.
  const pollution = hasImageOcrPollution(md)
  if (pollution) flags.push('image-ocr-pollution')

  // score 계산 — signal 없을수록 높음
  let score = 1.0
  score -= brokenTableRatio * 0.3
  score -= emptySectionRatio * 0.3
  score -= koreanLoss ? 0.4 : 0
  score -= pollution ? 0.4 : 0
  score = Math.max(0, Math.min(1, score))

  // 결정 — 우선순위: koreanLoss > pollution > score-based.
  // 한국어 공백 소실이나 이미지 OCR 오염은 score 가 minScore 이상이어도 재시도/폴스루 유도.
  let decision: QualityResult['decision']
  if (koreanLoss) {
    decision = retryKr ? 'retry' : 'reject'
  } else if (pollution) {
    decision = 'retry-no-ocr'
  } else if (score >= minScore) {
    decision = 'accept'
  } else {
    decision = 'reject'
  }

  return { score, flags, decision }
}

/**
 * 이미지 OCR 파편 감지 (§4.1.3.2 — v2, 실측 기반 보강).
 *
 * docling CLI 기본 `--ocr` 은 PDF 내 bitmap 이미지 (UI 스크린샷·대시보드 목업 등) 를 OCR 처리해
 * 본문 흐름에 파편 텍스트를 interleave 한다. 예 (PMS 제품소개 실측):
 *   ```
 *   [image]
 *   로그인
 *   일반 Classic
 *   22A002 참여
 *   ```
 * 이 파편들은 LLM 파이프라인에서 legit content 로 오해되어 false entity/concept 생성을 유발.
 *
 * 필수 필터 (둘 다 만족해야 평가 진행 — false positive 방어):
 *   - bodyChars ≥ 2000 : 1-2 페이지 폼/등록증 (GOODSTREAM 스타일 짧은 필드) 은 pollution 개념 무의미.
 *   - markerCount ≥ 5  : 마커 개수가 적으면 pollution 패턴 신호 부족.
 *
 * 두 가지 판정 기준 (OR — 하나라도 만족 시 pollution):
 *   기준 A (마커 근접 클러스터): 각 마커의 ±5 라인 window 내 <20자 비어있지 않은 라인이 3개 이상 연속.
 *     - 리스트 마커 (`-`, `*`, `+`, `\d+.`) 가 붙은 라인은 정상 리스트로 간주하여 제외.
 *   기준 B (대규모 파편 비율): 전체 비어있지 않은 라인 중 <20자 파편 (마커/리스트 제외) 비율 > 50%.
 *     - 실측 (4 코퍼스): PMS 62.5% (pollution), ROHM 42.7%, RP1 14.0%, GOODSTREAM 60.0%(제외: bodyChars 필터).
 *
 * 추후 후보 (실측 확장 — §4.1.3.4 결과 따라):
 *   - 기준 C: 연속 라인 간 한국어/영어/숫자 혼재 비율의 Z-score 변동.
 */
export function hasImageOcrPollution(md: string): boolean {
  const bodyCharsTotal = md.trim().length
  if (bodyCharsTotal < 2000) return false   // 소규모 문서 (폼·등록증 등) 는 pollution 평가 제외

  const lines = md.split('\n')
  const imgMarker = /(<!--\s*image\s*-->)|(!\[[^\]]*\]\([^)]*\))|(\[image(?::[^\]]*)?\])/i
  const listMarker = /^\s*([-*+]\s|\d+\.\s)/

  const imgLines: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (imgMarker.test(lines[i])) imgLines.push(i)
  }
  if (imgLines.length < 5) return false     // 마커 개수 부족 → 신호 불충분

  const WINDOW = 5
  const SHORT_CHAR_LIMIT = 20
  const MIN_CLUSTER = 3

  // 기준 A: marker ±5 window 내 <20자 라인 3연속.
  for (const imgLine of imgLines) {
    const start = Math.max(0, imgLine - WINDOW)
    const end = Math.min(lines.length - 1, imgLine + WINDOW)
    let consecutive = 0
    for (let i = start; i <= end; i++) {
      if (i === imgLine) { consecutive = 0; continue }
      const l = lines[i].trim()
      if (l.length === 0) continue               // 빈 라인 skip (reset 안 함)
      if (imgMarker.test(l)) { consecutive = 0; continue }
      if (listMarker.test(l)) { consecutive = 0; continue }
      if (l.length < SHORT_CHAR_LIMIT) {
        consecutive++
        if (consecutive >= MIN_CLUSTER) return true
      } else {
        consecutive = 0
      }
    }
  }

  // 기준 B: 전체 비어있지 않은 라인 중 <20자 파편 비율 > 50%.
  const nonEmpty = lines.filter((l) => l.trim().length > 0)
  if (nonEmpty.length === 0) return false
  const fragLines = nonEmpty.filter((l) => {
    const t = l.trim()
    return t.length > 0 && t.length < SHORT_CHAR_LIMIT && !imgMarker.test(l) && !listMarker.test(l)
  }).length
  const fragRatio = fragLines / nonEmpty.length
  return fragRatio > 0.50
}

/**
 * 본문 문자 밀도 — 페이지당 평균 본문 문자 수.
 * 이미지 태그·placeholder·markdown 메타문자 제거 후 실제 텍스트 길이를 페이지 수로 나눔.
 * 스캔 PDF (이미지 only, text-layer 거의 없음) 감지에 사용.
 *
 * 실증 기준 (PMS 31p → 83KB stripped → ~2.7KB/page):
 *   - 정상 텍스트 PDF: > 500 chars/page (본문 밀집)
 *   - 스캔 PDF: < 50 chars/page (text-layer 흔적만, 실제 정보는 이미지)
 *   - 임계: 100 chars/page → 미만이면 force-ocr 필요
 */
export function bodyCharsPerPage(md: string, pageCount: number): number {
  if (pageCount <= 0) return Number.POSITIVE_INFINITY // 페이지 수 모르면 감지 불가
  const clean = md
    .replace(/!\[.*?\]\([^)]+\)/g, '')
    .replace(/\[image(?::[^\]]*)?\]/g, '')
    .replace(/[#>*`|\-]/g, '') // markdown 메타문자 제거
    .replace(/\s+/g, ' ')
    .trim()
  return clean.length / pageCount
}

/**
 * 스캔 PDF 감지 — text-layer 가 거의 없어 force-ocr 이 필요한 경우.
 * 임계: 페이지당 본문 100자 미만 + 한국어 50자 미만.
 *
 * 이중 조건인 이유: 영문 전용 단일 페이지 포스터 등 일부는 100 chars/page 미만이어도
 * 정상일 수 있어 한국어 fallback 까지 요구.
 */
export function isLikelyScanPdf(md: string, pageCount: number): boolean {
  if (pageCount <= 0) return false
  const perPage = bodyCharsPerPage(md, pageCount)
  const koreanTotal = countKoreanChars(md)
  return perPage < 100 && koreanTotal < 50
}

/**
 * 한글 음절 글자 수 — 이미지 placeholder 제외한 본문 기준.
 * force-ocr 전후 regression 비교·공백 소실 임계 체크 공용.
 */
export function countKoreanChars(md: string): number {
  const clean = md
    .replace(/!\[.*?\]\([^)]+\)/g, '')
    .replace(/\[image(?::[^\]]*)?\]/g, '')
  return [...clean].filter((c) => c >= '가' && c <= '힯').length
}

/**
 * force-ocr 재시도 결과가 한국어를 크게 잃었는지 감지.
 * ocrmac 이 벡터 PDF 를 래스터화하면서 한글 글리프 인식에 실패하는 케이스
 * (실측: PMS PDF 에서 textlayer 15,549자 → force-ocr 0자) 를 잡아 tier 1 으로 롤백한다.
 *
 * 기준: baseline(>=100자) 대비 regressed 가 50% 미만 → regression 판정.
 */
export function hasKoreanRegression(baselineMd: string, regressedMd: string): boolean {
  const base = countKoreanChars(baselineMd)
  const reg = countKoreanChars(regressedMd)
  if (base < 100) return false // baseline 에 한국어 없으면 무관
  return reg < base * 0.5
}

/** 본문 문자 수 — 이미지·markdown 메타문자·공백 정규화 후 순수 글자. */
function bodyChars(md: string): number {
  return md
    .replace(/!\[.*?\]\([^)]+\)/g, '')
    .replace(/\[image(?::[^\]]*)?\]/g, '')
    .replace(/[#>*`|\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim().length
}

/**
 * 본문 전반 regression 감지 — 언어 무관.
 * 한국어 regression(hasKoreanRegression) 이 못 잡는 영문·숫자 전용 문서의 force-ocr 실패 케이스 보완.
 * 기준: baseline(>=500자) 대비 regressed 가 50% 미만 → regression 판정.
 */
export function hasBodyRegression(baselineMd: string, regressedMd: string): boolean {
  const base = bodyChars(baselineMd)
  const reg = bodyChars(regressedMd)
  if (base < 500) return false // baseline 이 너무 작으면 비교 무의미
  return reg < base * 0.5
}

/**
 * 한국어 공백 소실 감지.
 * 네이버 블로그 프린트 PDF·ROHM Wi-SUN 매뉴얼 등이 음수 kerning 으로만 간격을 표현
 * → text-layer 에 공백 없음. 15자 이상 한글 토큰의 비율이 30% 초과면 공백 소실로 판단.
 *
 * 실측 (2026-04-21):
 *   - ROHM Wi-SUN textlayer:  60.20% (감지 O, force-ocr 재시도가 정답)
 *   - ROHM Wi-SUN force-ocr:  0.27% (정상)
 *   - PMS 제품소개 textlayer: 4.93% (감지 X, force-ocr 스킵이 정답)
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

/**
 * Sidecar MD 저장 시 embedded 이미지를 제거할지 판단 (§4.1.3 확장).
 *
 * 사용자 설계 원칙:
 *   - 원본.md 는 "사람이 볼 때 의미 있는" 이미지만 포함한다.
 *   - "스캔이미지로 판정되어 OCR 옵션이 들어간 경우" → 이미지 내용이 OCR 로 텍스트화 되었으므로
 *     base64 embedded 를 중복 저장하면 파편 + 파일 어지러움.
 *   - vector PDF (PMS UI 스크린샷 · ROHM 데이터시트 · RP1 매뉴얼) 는 diagram/chart 가
 *     text 와 별도 의미를 가지므로 유지.
 *
 * 판정 (OR):
 *   1. `isLikelyScanPdf` (본문 <100/page AND 한국어 <50) — MD 기반 fallback 확정 스캔.
 *   2. tierKey 에 `-scan` suffix — source PDF 이미지 덮힘률 기반으로 scan 감지된 경우.
 *      `1-docling-scan` (Tier 1 accept 이어도 source 가 scan — GOODSTREAM 사업자등록증),
 *      `1b-docling-force-ocr-scan` (scan 감지로 force-ocr 로 전환).
 *
 * 포함하지 않는 케이스:
 *   - `1b-docling-force-ocr-kloss` (한국어 공백 소실 원인) — ROHM 데이터시트처럼 vector PDF 의
 *     pinout/diagram 이미지는 여전히 의미 있음. 유지.
 *   - `1a-docling-no-ocr` — pollution escalation. bitmap OCR 억제 후에도 다이어그램·스크린샷
 *     자체는 의미 있음.
 *   - `1-docling` accept (non-scan) — vector PDF 기본 경로, 이미지 유지.
 *
 * 문서 규모(bodyChars) 는 판정 기준이 아님 — 사용자 명시:
 *   "소규모가 아니라 스캔이미지로 판정되어 ocr 옵션이 들어가면 이미지가 필요없다".
 */
export function hasRedundantEmbeddedImages(
  rawMd: string,
  strippedMd: string,
  pageCount: number,
  tierKey: string,
): boolean {
  // 이미지가 없으면 판정 자체가 무의미 (raw == stripped).
  const hadImages = rawMd.length > strippedMd.length
  if (!hadImages) return false
  // 1. Scan PDF 감지 — text-layer 거의 없어 페이지 전체가 이미지인 경우.
  if (isLikelyScanPdf(strippedMd, pageCount)) return true
  // 2. Tier 1b force-ocr-scan — scan 감지되어 force-ocr 전환된 케이스.
  //    korean-loss (ROHM) 는 제외 — diagram 유지.
  if (tierKey === '1b-docling-force-ocr-scan') return true
  // 3. Tier 1 accept 이지만 source PDF 가 scan — GOODSTREAM 사업자등록증처럼
  //    Tier 1 default 의 bitmap OCR 로 본문은 나왔지만 원본이 이미지 기반.
  //    `extractPdfText` 가 pymupdf 이미지 덮힘률로 감지 후 tierKey suffix 부여.
  if (tierKey === '1-docling-scan') return true
  return false
}

/** 한국어 토큰 중 15자 이상 비율 (0.0 ~ 1.0). 임계 판정 + 로그 용. */
export function koreanLongTokenRatio(md: string): number {
  const clean = md
    .replace(/!\[.*?\]\([^)]+\)/g, '')
    .replace(/\[image(?::[^\]]*)?\]/g, '')
  const korean = [...clean].filter((c) => c >= '가' && c <= '힯').length
  if (korean < 100) return 0
  const tokens = clean.split(/\s+/).filter((t) => [...t].some((c) => c >= '가' && c <= '힯'))
  if (tokens.length === 0) return 0
  return tokens.filter((t) => t.length >= 15).length / tokens.length
}
