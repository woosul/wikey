import { describe, it, expect } from 'vitest'
import {
  parseSections,
  buildSectionIndex,
  computeHeuristicPriority,
  formatPeerContext,
  formatSourceTOC,
} from '../section-index.js'

// ── §1 Phase A — 결정적 섹션 파서 (LLM 호출 0) ──
// RED 테스트들. 모든 기대값은 결정적 (같은 입력 → 같은 출력).

describe('parseSections — 결정성', () => {
  it('같은 입력에 대해 3회 호출이 identical 출력을 낸다', () => {
    const md = '## 서두\n\n내용입니다.\n\n## 기술 스택\n\n- mqtt\n- postgresql\n'
    const a = parseSections(md)
    const b = parseSections(md)
    const c = parseSections(md)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(JSON.stringify(b)).toBe(JSON.stringify(c))
  })
})

describe('parseSections — heading 패턴', () => {
  it('heading 0개 문서는 단일 pseudo-section 을 반환한다', () => {
    const md = '이 문서는 heading 이 없습니다.\n\n그냥 본문만 있어요. 충분한 길이를 만들기 위해 더 씁니다.'
    const sections = parseSections(md)
    expect(sections).toHaveLength(1)
    expect(sections[0].idx).toBe(0)
    expect(sections[0].warnings).toContain('no-headings')
  })

  it('단일 ## heading 문서는 1개 섹션을 낸다', () => {
    const md = '## Introduction\n\n여기는 서두입니다. 충분한 본문 길이.'
    const sections = parseSections(md)
    expect(sections).toHaveLength(1)
    expect(sections[0].title).toBe('Introduction')
    expect(sections[0].level).toBe(2)
  })

  it('mixed level (## + ###) 를 flat list 로 level 기록하여 반환한다', () => {
    const md = [
      '## Top',
      '',
      '본문입니다. 본문입니다. 본문입니다. 본문입니다.',
      '',
      '### Sub',
      '',
      '서브 본문입니다. 서브 본문입니다. 서브 본문입니다.',
      '',
      '## Next',
      '',
      '다음 섹션 본문입니다. 다음 섹션 본문입니다.',
    ].join('\n')
    const sections = parseSections(md)
    expect(sections).toHaveLength(3)
    expect(sections.map((s) => s.level)).toEqual([2, 3, 2])
    expect(sections.some((s) => s.warnings.includes('mixed-level'))).toBe(true)
  })

  it('공백 없는 `##기술스택` heading 을 인식한다', () => {
    const md = '##기술스택\n\n내용이 여기 있어요. 본문이 조금 길어져야 합니다.'
    const sections = parseSections(md)
    expect(sections).toHaveLength(1)
    expect(sections[0].title).toBe('기술스택')
  })

  it('코드블록 펜스(``` ~ ```) 내부의 `#` 은 heading 으로 인식하지 않는다', () => {
    const md = [
      '## Real Heading',
      '',
      '```',
      '# this is a comment, not a heading',
      '## also not a heading',
      '```',
      '',
      '본문입니다. 본문입니다.',
    ].join('\n')
    const sections = parseSections(md)
    expect(sections).toHaveLength(1)
    expect(sections[0].title).toBe('Real Heading')
  })

  it('첫 heading 이전의 preamble 을 pseudo-section idx=0 으로 기록한다', () => {
    const md = [
      '첫 heading 이전에 쓰인 본문입니다. 충분한 길이를 만들기 위한 긴 문장입니다.',
      '',
      '## First Heading',
      '',
      '첫 번째 섹션 본문입니다. 이곳도 충분히 길게 씁니다.',
    ].join('\n')
    const sections = parseSections(md)
    expect(sections.length).toBeGreaterThanOrEqual(2)
    expect(sections[0].warnings).toContain('preamble')
    expect(sections[1].title).toBe('First Heading')
  })
})

describe('parseSections — 병합/감지', () => {
  it('빈 섹션(bodyChars<50)은 이전 섹션에 병합되고 merged-empty warning 을 갖는다', () => {
    const md = [
      '## First',
      '',
      '이 섹션은 본문이 충분합니다. 이 섹션은 본문이 충분합니다. 길게 씁니다.',
      '',
      '## Tiny',
      '',
      'x',
      '',
      '## Third',
      '',
      '세 번째 섹션 본문입니다. 세 번째 섹션 본문입니다.',
    ].join('\n')
    const sections = parseSections(md)
    // Tiny 가 First 에 병합되거나 Third 에 병합되지 않고 별도 유지 (구현 정책에 따라 다름).
    // 공통 조건: merged-empty 경고가 섹션 목록에 존재하거나, Tiny 섹션 자체가 병합되어 사라짐.
    const flat = sections.flatMap((s) => s.warnings)
    const hasMerge = flat.includes('merged-empty') || !sections.some((s) => s.title === 'Tiny')
    expect(hasMerge).toBe(true)
  })

  it('같은 title 이 3회+ 반복되고 body<100 이면 suspicious-heading warning', () => {
    const repeated = Array.from({ length: 4 }, () =>
      '## Page 1\n\nshort.\n'
    ).join('\n')
    const md = `## Real Intro\n\n본문입니다. 본문입니다. 본문입니다.\n\n${repeated}\n\n## Real End\n\n끝 섹션 본문.`
    const sections = parseSections(md)
    const flat = sections.flatMap((s) => s.warnings)
    expect(flat).toContain('suspicious-heading')
  })
})

describe('parseSections — 메타 계산', () => {
  it('hasTable=true 는 파이프 3개+ 라인이 있을 때만', () => {
    const md = [
      '## With Table',
      '',
      '| a | b | c |',
      '| - | - | - |',
      '| 1 | 2 | 3 |',
      '',
    ].join('\n')
    const sections = parseSections(md)
    expect(sections[0].hasTable).toBe(true)
    expect(sections[0].tableRows).toBeGreaterThanOrEqual(3)
  })

  it('acronymDensity 는 대문자 2-6자 토큰 비율', () => {
    const md = '## Tech\n\nMQTT RESTful API PMS 가 포함되어 있습니다.'
    const sections = parseSections(md)
    expect(sections[0].acronymDensity).toBeGreaterThan(0)
  })

  it('koreanCharCount 는 한글 음절 수를 센다', () => {
    const md = '## 한글\n\n안녕하세요 한국어 섹션입니다.'
    const sections = parseSections(md)
    expect(sections[0].koreanCharCount).toBeGreaterThan(0)
  })

  it('headingPattern 이 toc/appendix/contact/copyright 같은 경우 skip', () => {
    const cases: Array<{ title: string; expected: string }> = [
      { title: '목차', expected: 'toc' },
      { title: 'Appendix A', expected: 'appendix' },
      { title: 'Contact Us', expected: 'contact' },
      { title: 'Copyright Notice', expected: 'copyright' },
      { title: 'Revision History', expected: 'revision' },
    ]
    for (const c of cases) {
      const md = `## ${c.title}\n\n짧은 본문.\n`
      const s = parseSections(md)
      expect(s[0].headingPattern).toBe(c.expected)
    }
  })
})

describe('computeHeuristicPriority — skip/core/support 분기', () => {
  it('headingPattern !== normal 이면 skip', () => {
    const md = '## 목차\n\n1. 서론\n2. 본론\n3. 결론\n'
    const s = parseSections(md)
    expect(computeHeuristicPriority(s[0])).toBe('skip')
  })

  it('bodyChars < 100 이면 skip', () => {
    const md = '## Short\n\n짧음.'
    const s = parseSections(md)
    expect(computeHeuristicPriority(s[0])).toBe('skip')
  })

  it('bodyChars>200 + hasTable 또는 acronymDensity>0.05 → core', () => {
    const md = [
      '## Tech Stack',
      '',
      '이 섹션은 기술 스택을 다룹니다. MQTT, REST, PMS, MES, SCM 등 여러 약어가 등장합니다.',
      '상세 내용: 우리 시스템은 MQTT 를 사용하고 REST API 를 제공하며 PMS 와 MES 와 연동합니다.',
      '또한 SCM 과도 결합되어 있습니다. 긴 본문이 이어집니다. 매우 긴 본문이 이어집니다.',
      '',
      '| tool | version |',
      '| - | - |',
      '| mqtt | 5.0 |',
      '',
    ].join('\n')
    const s = parseSections(md)
    expect(computeHeuristicPriority(s[0])).toBe('core')
  })

  it('bodyChars>100 지만 acronym/table 조건 미달 → support', () => {
    const md = [
      '## Background',
      '',
      '이 문서는 배경 설명을 담고 있습니다. 일반적인 문장만 이어집니다.',
      '특별한 약어나 표는 포함되지 않습니다. 계속 본문이 이어지는데 일반 자연어 위주입니다.',
      '이 섹션은 acronym 도 없고 table 도 없지만 본문은 충분히 길게 작성되어 있습니다.',
      '따라서 skip 도 아니고 core 도 아닌 support 로 분류되어야 합니다. 계속 이어지는 문장들.',
      '',
    ].join('\n')
    const s = parseSections(md)
    expect(s[0].bodyChars).toBeGreaterThan(100)
    expect(computeHeuristicPriority(s[0])).toBe('support')
  })
})

describe('buildSectionIndex — globalRepeaters 결정성', () => {
  it('3회+ 반복 토큰을 빈도 내림차순 상위 10개 반환', () => {
    const md = [
      '## S1',
      '',
      'MQTT 는 IoT 에서 많이 씁니다. MQTT 는 가볍습니다. MQTT 는 표준입니다.',
      '',
      '## S2',
      '',
      'PMS 는 제품관리시스템. PMS 와 MES, PMS 시스템, PMS 제품군.',
      '',
      '## S3',
      '',
      'MQTT 는 MQTT 클라이언트로 연결. REST 는 한 번만 언급.',
    ].join('\n')
    const index = buildSectionIndex(md)
    const tokens = index.globalRepeaters.map((r) => r.token.toUpperCase())
    expect(tokens).toContain('MQTT')
    expect(tokens).toContain('PMS')
    expect(tokens).not.toContain('REST') // 1회만 언급
  })

  it('같은 입력 2회 호출 → globalRepeaters 동일', () => {
    const md = '## A\n\nFOO FOO FOO BAR BAR BAR BAZ BAZ BAZ.\n'
    const a = buildSectionIndex(md)
    const b = buildSectionIndex(md)
    expect(JSON.stringify(a.globalRepeaters)).toBe(JSON.stringify(b.globalRepeaters))
  })
})

describe('formatPeerContext — token cap + 필수 필드', () => {
  it('결과 문자열에 DOC_OVERVIEW, CURRENT_SECTION, LOCAL_NEIGHBORS 마커를 포함', () => {
    const md = [
      '## A',
      '',
      '본문입니다. MQTT PMS MES 가 등장합니다. 긴 본문을 만들어봅시다.',
      '',
      '## B',
      '',
      '두 번째 섹션. PMS 에 대한 설명이 더 상세히. 긴 본문을 만들어봅시다.',
      '',
      '## C',
      '',
      '세 번째 섹션. REST API 언급. 긴 본문을 만들어봅시다.',
    ].join('\n')
    const index = buildSectionIndex(md)
    const ctx = formatPeerContext(index, 1)
    expect(ctx).toMatch(/DOC_OVERVIEW/)
    expect(ctx).toMatch(/CURRENT_SECTION/)
    expect(ctx).toMatch(/LOCAL_NEIGHBORS/)
    expect(ctx).toMatch(/idx.*1/)
  })

  it('tokenCap 을 주면 결과 길이가 상한을 심하게 초과하지 않는다 (±30% 허용)', () => {
    const bigMd = Array.from(
      { length: 30 },
      (_, i) =>
        `## Section ${i}\n\n본문 본문 본문 본문 본문 MQTT PMS MES SCM REST 다양한 약어가 포함됩니다.\n`
    ).join('\n')
    const index = buildSectionIndex(bigMd)
    const ctx = formatPeerContext(index, 15, 300)
    // tokenCap 300 ≈ chars 900 (한국어 영어 혼합 대략치), 30% margin 까지 허용
    expect(ctx.length).toBeLessThan(900 * 1.3 + 500) // header 고정 영역 여유
  })
})

describe('formatSourceTOC — 마크다운 표 출력', () => {
  it('섹션 목록을 markdown 표 형태로 반환', () => {
    const md = [
      '## 서두',
      '',
      '이 섹션은 서두입니다. 본문이 여러 줄 이어집니다. 본문이 이어집니다.',
      '',
      '## 기술 스택',
      '',
      '| tool | version |',
      '| - | - |',
      '| mqtt | 5.0 |',
      '',
      '## 목차',
      '',
      'TOC 항목들',
    ].join('\n')
    const index = buildSectionIndex(md)
    const toc = formatSourceTOC(index)
    expect(toc).toMatch(/## 섹션 인덱스/)
    expect(toc).toMatch(/\| § \|/)
    expect(toc).toMatch(/기술 스택/)
    expect(toc).toMatch(/목차/)
  })
})
