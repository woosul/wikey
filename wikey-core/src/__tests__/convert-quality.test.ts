import { describe, it, expect } from 'vitest'
import {
  scoreConvertOutput,
  hasMissingKoreanWhitespace,
  hasKoreanRegression,
  hasBodyRegression,
  countKoreanChars,
  koreanLongTokenRatio,
  isLikelyScanPdf,
  bodyCharsPerPage,
  hasImageOcrPollution,
  hasRedundantEmbeddedImages,
} from '../convert-quality.js'

describe('scoreConvertOutput — accept', () => {
  it('정상 markdown → accept, score 1.0', () => {
    const md = [
      '# 문서 제목',
      '',
      '이것은 충분히 긴 본문 내용입니다. 여러 문장으로 구성되어 있고 문단 구조가 명확합니다.',
      '페이지 내용이 제대로 추출되어 있으며 한국어 공백도 정상입니다.',
      '',
      '## 하위 섹션',
      '',
      '하위 섹션의 본문 역시 충분한 길이로 구성되어 있습니다. 문장들이 공백으로 적절히 나뉘어져 있고 의미 단위가 보존됩니다.',
      '이어지는 설명 문장도 존재하므로 빈 섹션으로 판정되지 않습니다.',
    ].join('\n')
    const r = scoreConvertOutput(md)
    expect(r.decision).toBe('accept')
    expect(r.score).toBeGreaterThan(0.9)
    expect(r.flags).toEqual([])
  })
})

describe('scoreConvertOutput — reject (최소 본문 미만)', () => {
  it('본문 100자 미만 → reject', () => {
    const md = '# 제목\n짧음.'
    const r = scoreConvertOutput(md)
    expect(r.decision).toBe('reject')
    expect(r.flags).toContain('min-body-chars')
    expect(r.score).toBe(0)
  })
})

describe('scoreConvertOutput — 빈 섹션 탐지', () => {
  it('헤딩 다음 본문이 거의 없는 경우 empty-sections flag', () => {
    // 5개 헤딩 중 4개는 빈 섹션, 마지막 하나만 본문 존재 → empty-sections 트리거.
    // 본문 100자 넘기기 위해 충분한 길이의 문장 배치.
    const md = [
      '# A',
      '',
      '# B',
      '',
      '# C',
      '',
      '# D',
      '',
      '# E',
      '',
      '짧은 본문이지만 전체 길이는 충분합니다. 본문 길이는 100자를 넘겨야 합니다. 이렇게 한 문장 더 추가해서 조건을 만족시킵니다. 추가로 설명을 덧붙여서 본문을 더 길게 만들고 정상 섹션 하나로 판정되도록 하겠습니다. 충분한 길이 확보.',
    ].join('\n')
    const r = scoreConvertOutput(md)
    expect(r.flags).toContain('empty-sections')
  })
})

describe('scoreConvertOutput — 테이블 깨짐', () => {
  it('셀 내용 없는 `|` 연속 라인 비율 높으면 broken-tables flag', () => {
    const md = [
      '# 표 테스트',
      '',
      '일반 본문이 여기 있습니다. 충분한 길이의 본문을 제공합니다. 조건 만족을 위해 여러 문장 추가.',
      '',
      '| | | |',
      '|---|---|---|',
      '| | | |',
      '| | | |',
      '| | | |',
    ].join('\n')
    const r = scoreConvertOutput(md)
    expect(r.flags).toContain('broken-tables')
  })
})

describe('hasMissingKoreanWhitespace', () => {
  it('정상 한국어 — false', () => {
    const md = '안녕하세요 반갑습니다. 오늘 날씨가 좋네요. 우리 함께 산책 가요.'
      .repeat(5)
    expect(hasMissingKoreanWhitespace(md)).toBe(false)
  })

  it('공백 소실 한국어 — true (15자+ 토큰이 30% 넘음)', () => {
    // 한국어 글자 수 100+ + 15자+ 토큰이 전체의 30%+ 조건을 동시 만족시켜야 함.
    const md = [
      '이것은정상적인한국어문장이지만공백이없습니다긴토큰',
      '그리고이렇게긴토큰들이계속이어집니다오랫동안지속',
      '공백이사라진블로그프린트같은문제가있습니다연속',
      '단위테스트를위해더많은한국어를추가해서조건달성확인',
      '네이버블로그프린트PDF에서자주발생하는공백소실케이스',
      '짧음 정상',
    ].join(' ')
    expect(hasMissingKoreanWhitespace(md)).toBe(true)
  })

  it('영문 문서 — false (한국어 미존재)', () => {
    const md = 'This is an English document. No Korean text at all. '.repeat(20)
    expect(hasMissingKoreanWhitespace(md)).toBe(false)
  })

  it('이미지 placeholder는 집계 제외', () => {
    const md = '[image: Figure 1] '.repeat(10) + ' 안녕하세요 반갑습니다. '.repeat(10)
    expect(hasMissingKoreanWhitespace(md)).toBe(false)
  })
})

describe('scoreConvertOutput — retry on Korean whitespace loss', () => {
  it('공백 소실 + retryOnKoreanWhitespace=true → retry', () => {
    const md = [
      '# 문서',
      '이것은정상적인한국어문장이지만공백이없습니다',
      '그리고이렇게긴토큰들이계속이어집니다오랫동안',
      '공백이사라진블로그프린트PDF같은문제가있습니다',
      '단위테스트를위해더많은한국어를추가해서조건달성',
      '추가본문을충분히길게만들어서조건을만족시킵니다',
      '빈섹션이나기타결함없이공백소실만trigger되게합니다',
    ].join('\n')
    const r = scoreConvertOutput(md, { retryOnKoreanWhitespace: true })
    expect(r.flags).toContain('korean-whitespace-loss')
    expect(r.decision).toBe('retry')
  })

  it('공백 소실 + retryOnKoreanWhitespace=false → reject (score 하락)', () => {
    const md = [
      '# 문서',
      '이것은정상적인한국어문장이지만공백이없습니다긴토큰',
      '그리고이렇게긴토큰들이계속이어집니다오랫동안지속',
      '공백이사라진블로그프린트같은문제가있습니다연속',
      '단위테스트를위해더많은한국어를추가해서조건달성확인',
      '네이버블로그프린트에서자주발생하는공백소실케이스',
      '추가본문한국어를더늘려서글자수조건을만족시킵니다',
      '빈섹션이나기타결함없이공백소실만trigger되게합니다연속으로작성',
    ].join('\n')
    const r = scoreConvertOutput(md, { retryOnKoreanWhitespace: false })
    expect(r.flags).toContain('korean-whitespace-loss')
    expect(r.decision).toBe('reject')
  })
})

describe('countKoreanChars', () => {
  it('한글 음절만 집계', () => {
    expect(countKoreanChars('hello 안녕 world')).toBe(2)
    expect(countKoreanChars('English only')).toBe(0)
    expect(countKoreanChars('가나다라마')).toBe(5)
  })

  it('이미지 태그 및 placeholder 제외', () => {
    const md = '안녕 ![image](data:image/png;base64,xxx) 반갑 [image] 한국어'
    // 안녕(2) + 반갑(2) + 한국어(3) = 7
    expect(countKoreanChars(md)).toBe(7)
  })
})

describe('koreanLongTokenRatio', () => {
  it('ROHM Wi-SUN 스타일 공백 소실 재현', () => {
    // 실측: textlayer 60.20%, forceocr 0.27%
    const textlayer = [
      '이것은음수kerning으로공백이소실된한국어텍스트입니다긴토큰',
      '네이버블로그프린트PDF또는ROHMWiSUN매뉴얼에서자주나오는패턴',
      '공백이없어서단어경계를찾을수없어긴하나의토큰으로인식됨',
      '추가로한글글자수100자넘기기위한보충문장입니다여기에추가',
    ].join(' ')
    const ratio = koreanLongTokenRatio(textlayer)
    expect(ratio).toBeGreaterThan(0.30)
  })

  it('한글 100자 미만 → 0 반환', () => {
    expect(koreanLongTokenRatio('짧은 한글')).toBe(0)
  })
})

describe('hasKoreanRegression', () => {
  it('PMS 케이스: 15,549자 → 0자 = regression 감지', () => {
    const baseline = '한국어 '.repeat(200) // 약 400자
    const regressed = 'English only text after OCR failure'
    expect(hasKoreanRegression(baseline, regressed)).toBe(true)
  })

  it('ROHM 케이스: 2,021자 → 2,083자 = regression 아님', () => {
    const baseline = '한 국 어 '.repeat(500) // 공백 있는 정상 한글
    const improved = '한 국 어 글 자 수 증 가 '.repeat(500)
    expect(hasKoreanRegression(baseline, improved)).toBe(false)
  })

  it('baseline 한국어 < 100자 → regression 판단 무관 (false)', () => {
    expect(hasKoreanRegression('short 한글', 'no korean at all')).toBe(false)
  })

  it('정확히 50% → regression 아님 (경계 미만만 감지)', () => {
    const baseline = '한'.repeat(200)
    const regressed = '한'.repeat(100) // 정확히 50% = base * 0.5
    expect(hasKoreanRegression(baseline, regressed)).toBe(false)
  })

  it('50% 미만 → regression 감지', () => {
    const baseline = '한'.repeat(200)
    const regressed = '한'.repeat(99)
    expect(hasKoreanRegression(baseline, regressed)).toBe(true)
  })
})

describe('hasBodyRegression (언어 무관 본문 regression)', () => {
  it('영문 전용: baseline 1000자 → 100자 = regression 감지', () => {
    const baseline = 'The quick brown fox jumps over the lazy dog. '.repeat(30) // ~1,350자
    const regressed = 'Short text'
    expect(hasBodyRegression(baseline, regressed)).toBe(true)
  })

  it('영문 전용: baseline 1000자 → 800자 = regression 아님', () => {
    const baseline = 'x'.repeat(1000)
    const regressed = 'x'.repeat(800)
    expect(hasBodyRegression(baseline, regressed)).toBe(false)
  })

  it('baseline 500자 미만 → regression 판단 skip (false)', () => {
    const baseline = 'short 400 chars baseline'
    const regressed = ''
    expect(hasBodyRegression(baseline, regressed)).toBe(false)
  })

  it('이미지 태그 제외 후 비교', () => {
    const baseline = '본문 '.repeat(300) // 600자 이상
    const regressed = '![image](data:image/png;base64,LONG_DATA_URI)'.repeat(100) + '작은 본문'
    expect(hasBodyRegression(baseline, regressed)).toBe(true) // 이미지 strip 후 실제 본문은 작음
  })
})

describe('isLikelyScanPdf', () => {
  it('페이지당 10자 + 한국어 0 → scan PDF 판정', () => {
    const md = 'A B C'.repeat(5) // 매우 짧음
    expect(isLikelyScanPdf(md, 20)).toBe(true)
  })

  it('페이지당 500자 → 정상 텍스트 PDF', () => {
    const md = '본문 내용이 풍부한 페이지 텍스트입니다. '.repeat(100)
    expect(isLikelyScanPdf(md, 5)).toBe(false)
  })

  it('pageCount 0 → false (감지 무관)', () => {
    expect(isLikelyScanPdf('any content', 0)).toBe(false)
  })
})

describe('hasImageOcrPollution — §4.1.3.2 (v2: bodyChars ≥ 2000, markers ≥ 5 필터)', () => {
  // 헬퍼: 긴 정상 본문 (기준 통과용 bodyChars 채우기).
  const filler = Array(20).fill('이것은 정상적인 본문 문장입니다. 여러 단어로 구성되어 있고 일반 paragraph 흐름을 가집니다. 문서가 정상적으로 변환되었을 때 기대되는 본문 형태를 재현합니다.').join('\n')

  it('소규모 문서 (bodyChars < 2000) → false (필터)', () => {
    const md = [
      '# 제목', '', '짧은 본문', '',
      '[image]', '로그인', '메뉴', 'Home',
      '[image]', '버튼', '홈', '설정',
    ].join('\n')
    expect(hasImageOcrPollution(md)).toBe(false) // bodyChars 필터에 걸림
  })

  it('마커 수 < 5 → false (필터)', () => {
    const md = [
      '# 제목', filler, '',
      '[image]', '로그인', '메뉴', '홈',
    ].join('\n')
    expect(hasImageOcrPollution(md)).toBe(false) // markers 1 < 5
  })

  it('마커 없음 → false', () => {
    const md = [
      '# 제목', filler,
    ].join('\n')
    expect(hasImageOcrPollution(md)).toBe(false)
  })

  it('마커 + 정상 본문 (짧은 파편 없음) → false', () => {
    const md = [
      '# 제목', '',
      filler, '',
      '[image]', '',
      '이미지 뒤에 이어지는 캡션과 본문 내용이 정상적으로 이어집니다 충분히 긴 문장.',
      '추가 설명 문장도 충분한 길이를 가지고 있으며 파편으로 오인되지 않습니다.',
      '[image]', '',
      '두 번째 이미지 뒤에도 적절한 설명이 이어집니다 파편 없음.',
      '[image]', '',
      '세 번째도 정상 캡션입니다 설명이 길게 이어집니다.',
      '[image]', '',
      '네 번째도 마찬가지로 정상적입니다 파편 없음.',
      '[image]', '',
      '다섯 번째 이미지 뒤 설명 문장입니다 길게 이어집니다 정상.',
    ].join('\n')
    expect(hasImageOcrPollution(md)).toBe(false)
  })

  it('기준 A — [image] 마커 ±5 윈도우 내 <20자 라인 3연속 → true (5+ markers, 큰 본문)', () => {
    // PMS 실측 패턴 재현: 각 이미지 주변에 짧은 OCR 파편 연속.
    const polluted = Array(5).fill([
      '[image]',
      '로그인',
      '일반 Classic',
      '22A002 참여',
    ].join('\n')).join('\n\n')
    const md = [
      '# 제품 소개',
      filler,
      '',
      polluted,
      '',
      filler,
    ].join('\n')
    expect(hasImageOcrPollution(md)).toBe(true)
  })

  it('기준 A — ![Image](data:image/...) 형태도 감지 (strip 전 원본)', () => {
    const polluted = Array(5).fill([
      '![Image](data:image/png;base64,AAAA)',
      '로그인',
      '메뉴 (6)',
      '업무공유',
    ].join('\n')).join('\n\n')
    const md = [
      '# 문서',
      filler,
      '',
      polluted,
      '',
      filler,
    ].join('\n')
    expect(hasImageOcrPollution(md)).toBe(true)
  })

  it('기준 A — <!-- image --> HTML 주석 형태도 감지', () => {
    const polluted = Array(5).fill([
      '<!-- image -->',
      '메뉴',
      '버튼 A',
      'Home',
    ].join('\n')).join('\n\n')
    const md = [
      '# 문서',
      filler,
      '',
      polluted,
      '',
      filler,
    ].join('\n')
    expect(hasImageOcrPollution(md)).toBe(true)
  })

  it('리스트 아이템 (- A / - B / - C) 은 파편으로 오인하지 않음', () => {
    const withLists = Array(5).fill([
      '[image]',
      '- 항목 A',
      '- 항목 B',
      '- 항목 C',
    ].join('\n')).join('\n\n')
    const md = [
      '# 문서',
      filler,
      '',
      withLists,
      '',
      filler,
      filler, // fragRatio 낮추기 위해 긴 본문 더 삽입
    ].join('\n')
    expect(hasImageOcrPollution(md)).toBe(false)
  })

  it('번호 리스트 (1. A / 2. B / 3. C) 역시 오인 없음', () => {
    const withLists = Array(5).fill([
      '[image]',
      '1. 절차 A',
      '2. 절차 B',
      '3. 절차 C',
    ].join('\n')).join('\n\n')
    const md = [
      '# 문서',
      filler,
      '',
      withLists,
      '',
      filler,
      filler,
    ].join('\n')
    expect(hasImageOcrPollution(md)).toBe(false)
  })

  it('기준 B — 마커 근접 기준 A 미충족이어도 전체 파편 비율 > 50% → true', () => {
    // PMS 실측: 마커 주변에 빈 줄이 많아 <20자 3연속이 성립 안 되지만, 전체 파편 비율이 압도적.
    // 마커 5개 + 각 마커 주변은 긴 본문 (기준 A 차단) + 다른 곳에 파편 대량 (기준 B 잡음).
    const longLine = '정상적인 길이의 본문 문장이 여기에 들어가 paragraph 흐름을 유지합니다.'
    const fragLine = '이건 짧은 파편입니다'   // 12자 (<20)
    const markerBlock = Array(5).fill(['[image]', longLine].join('\n')).join('\n\n')
    const fragBlock = Array(200).fill(fragLine).join('\n')
    const md = [
      '# 문서',
      longLine, longLine, longLine,
      '',
      markerBlock,
      '',
      longLine, longLine,
      '',
      fragBlock,
    ].join('\n')
    expect(hasImageOcrPollution(md)).toBe(true)
  })

  it('기준 A/B 모두 false — 큰 정상 문서 → false', () => {
    // 마커 5개이지만 주변 파편 없고 전체 파편 비율 낮음.
    const md = [
      '# 정상 문서',
      filler, '',
      '[image]', '',
      filler, '',
      '[image]', '',
      filler, '',
      '[image]', '',
      filler, '',
      '[image]', '',
      filler, '',
      '[image]', '',
      filler,
    ].join('\n')
    expect(hasImageOcrPollution(md)).toBe(false)
  })
})

describe('scoreConvertOutput — §4.1.3.2 retry-no-ocr decision', () => {
  const filler = Array(20).fill('이것은 정상적인 본문 문장입니다. 여러 단어로 구성되어 있고 일반 paragraph 흐름을 가집니다. 문서가 정상적으로 변환되었을 때 기대되는 본문 형태를 재현합니다.').join('\n')
  const pollutionBlock = Array(5).fill(['[image]', '로그인', '일반 Classic', '22A002 참여'].join('\n')).join('\n\n')

  it('image-ocr-pollution 감지 + korean whitespace loss 없음 → retry-no-ocr', () => {
    const md = [
      '# 제품 소개 문서',
      filler,
      '',
      pollutionBlock,
      '',
      '이어지는 정상 본문입니다 이미지 이후에도 의미있는 설명이 이어집니다.',
    ].join('\n')
    const r = scoreConvertOutput(md, { retryOnKoreanWhitespace: true })
    expect(r.flags).toContain('image-ocr-pollution')
    expect(r.decision).toBe('retry-no-ocr')
  })

  it('image-ocr-pollution + korean whitespace loss 동시 → retry (koreanLoss 우선)', () => {
    const koreanLossFiller = Array(20).fill([
      '이것은정상적인한국어문장이지만공백이없습니다긴토큰하나로인식됨',
      '그리고이렇게긴토큰들이계속이어집니다오랫동안지속되는패턴입니다',
      '공백이사라진블로그프린트같은문제가있습니다연속해서긴토큰발생',
    ].join('\n')).join('\n')
    const md = [
      '# 문서',
      koreanLossFiller,
      '',
      pollutionBlock,
      '',
      koreanLossFiller,
    ].join('\n')
    const r = scoreConvertOutput(md, { retryOnKoreanWhitespace: true })
    expect(r.flags).toContain('image-ocr-pollution')
    expect(r.flags).toContain('korean-whitespace-loss')
    expect(r.decision).toBe('retry') // korean whitespace loss 우선
  })

  it('image-ocr-pollution 없음 + 정상 → accept', () => {
    const md = [
      '# 문서',
      filler,
      '',
      '## 섹션',
      filler,
    ].join('\n')
    const r = scoreConvertOutput(md)
    expect(r.flags).not.toContain('image-ocr-pollution')
    expect(r.decision).toBe('accept')
  })

  it('pollution 감지 시 score 감점 (-0.4)', () => {
    const clean = [
      '# 문서',
      filler,
      '',
      '[image]', '', filler, '',
      '[image]', '', filler, '',
      '[image]', '', filler, '',
      '[image]', '', filler, '',
      '[image]', '', filler,
    ].join('\n')
    const polluted = [
      '# 문서',
      filler,
      '',
      pollutionBlock,
    ].join('\n')
    const rClean = scoreConvertOutput(clean)
    const rPolluted = scoreConvertOutput(polluted)
    expect(rClean.flags).not.toContain('image-ocr-pollution')
    expect(rPolluted.flags).toContain('image-ocr-pollution')
    expect(rClean.score - rPolluted.score).toBeGreaterThanOrEqual(0.35)
  })
})

describe('hasRedundantEmbeddedImages — §4.1.3 sidecar 이미지 strip 판정', () => {
  it('scan PDF (isLikelyScanPdf=true) → true, tierKey 무관', () => {
    // isLikelyScanPdf: per-page < 100 chars AND korean < 50
    const stripped = 'A B C'.repeat(5)   // 매우 짧음
    const raw = '![Image](data:image/png;base64,XXX)\n' + stripped
    expect(hasRedundantEmbeddedImages(raw, stripped, 20, '1-docling')).toBe(true)
  })

  it("Tier 1b force-ocr-scan (30p 계약서 스캔 스타일) → true (OCR 결과 텍스트 = 이미지 내용)", () => {
    // 대규모 문서 (bodyChars > 2000) 여도 scan origin 이면 strip. 사용자 명시:
    // "소규모가 아니라 스캔이미지로 판정되어 ocr 옵션이 들어가면 이미지가 필요없다"
    const stripped = '본문 추출 결과 텍스트 여러 문단이 이어집니다. '.repeat(200)  // ~8000 chars
    const raw = '![Image](data:image/png;base64,XXX)\n' + stripped
    expect(hasRedundantEmbeddedImages(raw, stripped, 30, '1b-docling-force-ocr-scan')).toBe(true)
  })

  it("Tier 1b force-ocr-kloss (ROHM 한글 공백 소실) → false (vector PDF, diagram 유지)", () => {
    // ROHM 데이터시트: force-ocr 사용했지만 원본이 vector PDF 이고 pinout/diagram 이미지 유지 필요.
    const stripped = 'ROHM Wi-SUN 모듈 사양 정보 여러 문장 '.repeat(150)  // ~4500 chars
    const raw = '![Image](data:image/png;base64,XXX)\n' + stripped
    expect(hasRedundantEmbeddedImages(raw, stripped, 5, '1b-docling-force-ocr-kloss')).toBe(false)
  })

  it("Tier 1a no-ocr (PMS pollution escalation) → false (vector PDF, UI 스크린샷 유지)", () => {
    const stripped = 'PMS 제품소개 본문 여러 문장 이어집니다 '.repeat(200)  // ~7000 chars
    const raw = '![Image](data:image/png;base64,XXX)\n' + stripped
    expect(hasRedundantEmbeddedImages(raw, stripped, 31, '1a-docling-no-ocr')).toBe(false)
  })

  it("Tier 1 accept 대규모 문서 → false (vector PDF, 이미지 의미 있음)", () => {
    const stripped = '충분히 긴 정상 본문 문장입니다 여러 문단이 이어집니다. '.repeat(100)  // ~4000 chars
    const raw = '![Image](data:image/png;base64,XXX)\n' + stripped
    expect(hasRedundantEmbeddedImages(raw, stripped, 30, '1-docling')).toBe(false)
  })

  it("Tier 1 accept 소규모 문서 (GOODSTREAM 기존 OCR 저장본 스타일) → false", () => {
    // 사용자 명시: 문서 규모는 판정 기준이 아님. Tier 1 accept 면 raw 유지.
    // GOODSTREAM 같은 기존 OCR 저장본의 이미지 파편화는 별개 이슈.
    const stripped = '사업자등록번호 상호 대표자 '.repeat(20)  // ~250 chars
    const raw = Array(5).fill('![Image](data:image/png;base64,AAAA)').join('\n') + '\n' + stripped
    expect(hasRedundantEmbeddedImages(raw, stripped, 1, '1-docling')).toBe(false)
  })

  it('이미지 없음 → false (strip 불필요)', () => {
    const stripped = '짧은 본문 내용'
    const raw = stripped
    expect(hasRedundantEmbeddedImages(raw, stripped, 1, '1-docling')).toBe(false)
  })
})

describe('bodyCharsPerPage', () => {
  it('pageCount 0 → Infinity (감지 무효화)', () => {
    expect(bodyCharsPerPage('content', 0)).toBe(Number.POSITIVE_INFINITY)
  })

  it('본문 1000자 / 10페이지 → 100 chars/page', () => {
    const md = 'x'.repeat(1000)
    expect(bodyCharsPerPage(md, 10)).toBe(100)
  })
})
