import { describe, it, expect } from 'vitest'
import { scoreConvertOutput, hasMissingKoreanWhitespace } from '../convert-quality.js'

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
