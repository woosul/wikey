import { describe, it, expect } from 'vitest'
import { stripEmbeddedImages, countEmbeddedImages } from '../rag-preprocess.js'

describe('stripEmbeddedImages — data URI (docling/unhwp 공통)', () => {
  it('docling alt="Image" 고정 → [image] 축약 (대소문자 무관)', () => {
    // 정책: "image"(대소문자 무관) 는 의미 없는 기본 라벨 → [image] 축약.
    // 의미 있는 alt (Figure 1, Architecture diagram 등) 만 [image: alt] 로 보존.
    const input = '앞 문장.\n\n![Image](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA1Q)\n\n뒤 문장.'
    const out = stripEmbeddedImages(input)
    expect(out).toBe('앞 문장.\n\n[image]\n\n뒤 문장.')
  })

  it('unhwp alt="image" (소문자) → [image] 축약', () => {
    const input = '제목\n\n![image](data:image/bmp;base64,Qk0KcAEAAAAAADYAAAAoAAAA)\n'
    expect(stripEmbeddedImages(input)).toBe('제목\n\n[image]\n')
  })

  it('data URI 여러 개 + mime 혼재 (png/bmp/jpeg)', () => {
    const input = [
      '![image](data:image/png;base64,AAAA)',
      '본문 1',
      '![image](data:image/bmp;base64,BBBB)',
      '![Figure 1](data:image/jpeg;base64,CCCC)',
    ].join('\n')
    expect(stripEmbeddedImages(input)).toBe(
      ['[image]', '본문 1', '[image]', '[image: Figure 1]'].join('\n'),
    )
  })

  it('alt 비어있으면 [image]', () => {
    expect(stripEmbeddedImages('![](data:image/png;base64,XYZ)')).toBe('[image]')
  })

  it('alt 공백만 있어도 [image]', () => {
    expect(stripEmbeddedImages('![   ](data:image/png;base64,XYZ)')).toBe('[image]')
  })
})

describe('stripEmbeddedImages — 외부 이미지 URL (Obsidian Web Clipper)', () => {
  it('![alt](https://.../foo.svg) → [image: alt]', () => {
    const input = '![Architecture of data lake in manufacturing industry](https://www.goodstream.co.kr/docs/solution/solution-datalake.svg)'
    expect(stripEmbeddedImages(input)).toBe('[image: Architecture of data lake in manufacturing industry]')
  })

  it('쿼리 스트링 포함 외부 URL', () => {
    const input = '![chart](https://cdn.example.com/chart.png?v=2&w=800)'
    expect(stripEmbeddedImages(input)).toBe('[image: chart]')
  })

  it('png/jpg/jpeg/gif/webp/tiff/avif 확장자 매칭', () => {
    const inputs = [
      '![a](https://x/a.png)',
      '![b](https://x/b.jpg)',
      '![c](https://x/c.jpeg)',
      '![d](https://x/d.gif)',
      '![e](https://x/e.webp)',
      '![f](https://x/f.tiff)',
      '![g](https://x/g.avif)',
      '![h](https://x/h.bmp)',
    ]
    const outs = inputs.map(stripEmbeddedImages)
    expect(outs).toEqual([
      '[image: a]', '[image: b]', '[image: c]', '[image: d]',
      '[image: e]', '[image: f]', '[image: g]', '[image: h]',
    ])
  })

  it('alt 없으면 [image]', () => {
    expect(stripEmbeddedImages('![](https://x.example.com/pic.png)')).toBe('[image]')
  })
})

describe('stripEmbeddedImages — 보존 (일반 링크)', () => {
  it('텍스트 링크는 건드리지 않는다', () => {
    const input = '참조: [Finetree AI Layer](https://www.goodstream.co.kr/docs/solution/finetree/index.html) 계층'
    expect(stripEmbeddedImages(input)).toBe(input)
  })

  it('이미지 아닌 확장자(.html/.pdf) 는 보존', () => {
    const input = '![label](https://x/doc.html) ![paper](https://x/paper.pdf)'
    expect(stripEmbeddedImages(input)).toBe(input)
  })

  it('로컬 상대 경로 이미지(assets/)는 보존 — 확장자 매칭 안 하므로 passthrough', () => {
    // 현재 정책: 상대 경로는 LLM 에게 전달해도 무해 (외부 fetch 불가, 단순 라벨).
    // 필요 시 별도 규칙 추가 가능.
    const input = '![local](assets/image.png)'
    expect(stripEmbeddedImages(input)).toBe(input)
  })

  it('프론트매터·위키링크·코드블록 보존', () => {
    const input = [
      '---',
      'title: 테스트',
      '---',
      '',
      '[[wikilink]] 참조',
      '',
      '```ts',
      'const x = "![fake](data:image/png;base64,xxx)"',
      '```',
      '',
      '실제 이미지:',
      '![image](data:image/png;base64,ZZZ)',
    ].join('\n')
    const out = stripEmbeddedImages(input)
    expect(out).toContain('---\ntitle: 테스트\n---')
    expect(out).toContain('[[wikilink]] 참조')
    // 코드블록 내부도 regex 는 단순 치환 — 실제 ingest 에서는 코드블록 내 이미지는 드물고,
    // 치환돼도 의미 손실 없음. 정책: 구분 없이 치환.
    expect(out).toContain('[image]')
  })
})

describe('stripEmbeddedImages — 혼합 시나리오 (샘플 재현)', () => {
  it('docling 패턴 + unhwp 패턴 + Web Clipper 패턴 동시 처리', () => {
    const input = [
      '# 통합 문서',
      '',
      '![Image](data:image/png;base64,DOCLING_PAYLOAD)',
      '',
      '![image](data:image/bmp;base64,UNHWP_PAYLOAD)',
      '',
      '![Architecture diagram](https://example.com/arch.svg)',
      '',
      '참조: [문서](https://example.com/doc.html)',
    ].join('\n')
    const out = stripEmbeddedImages(input)
    expect(out).toBe([
      '# 통합 문서',
      '',
      '[image]',
      '',
      '[image]',
      '',
      '[image: Architecture diagram]',
      '',
      '참조: [문서](https://example.com/doc.html)',
    ].join('\n'))
  })
})

describe('stripEmbeddedImages — inline SVG (Web Clipper / HTML 페이지 클리핑, §5.16)', () => {
  it('AC-1 single inline SVG with alt="..." → [image: alt]', () => {
    const input = '앞 문장.\n<svg width="100" height="50" viewBox="0 0 100 50" alt="시스템 다이어그램" role="img"><path d="M0 0 L100 50"/></svg>\n뒤 문장.'
    expect(stripEmbeddedImages(input)).toBe('앞 문장.\n[image: 시스템 다이어그램]\n뒤 문장.')
  })

  it("AC-1b single inline SVG with alt='...' (single quote) → [image: alt]", () => {
    const input = "<svg alt='Architecture' viewBox='0 0 10 10'><circle cx='5' cy='5' r='4'/></svg>"
    expect(stripEmbeddedImages(input)).toBe('[image: Architecture]')
  })

  it('AC-2 multiple inline SVG blocks (finetree 패턴) — 7개 모두 치환', () => {
    const altLabels = [
      'finetree-OCR 시스템 아키텍처',
      '다채널 문서 수신 및 전처리 파이프라인',
      '고정밀 AI OCR 엔진',
      '문서 레이아웃 인식 (Document AI)',
      '데이터 검증 및 신뢰도 스코어링',
      '자동 분류 및 라우팅',
      '파이프라인 연동 및 자동 적재',
    ]
    const blocks = altLabels.map((alt) =>
      `<svg width="641" height="451" viewBox="0 0 641 451" alt="${alt}" role="img"><path d="M120 80 L150 90 Z"/><circle cx="200" cy="200" r="50"/></svg>`,
    )
    const input = ['# 본문 제목', '', ...blocks, '', '본문 마지막 문단.'].join('\n')
    const out = stripEmbeddedImages(input)
    for (const alt of altLabels) {
      expect(out).toContain(`[image: ${alt}]`)
    }
    expect(out).not.toContain('<svg')
    expect(out).not.toContain('</svg>')
    expect(out).not.toContain('path d=')
    expect(out).toContain('# 본문 제목')
    expect(out).toContain('본문 마지막 문단.')
  })

  it('AC-3 nested SVG children (<g><path/></g>) — 단일 placeholder', () => {
    const input = `<svg viewBox="0 0 100 100" alt="nested">
  <g transform="translate(10,10)">
    <path d="M0 0 L50 50"/>
    <rect x="20" y="20" width="30" height="30"/>
  </g>
</svg>`
    expect(stripEmbeddedImages(input)).toBe('[image: nested]')
  })

  it('AC-4 mixed: data URI + external svg URL + inline svg 동시 처리', () => {
    const input = [
      '![Image](data:image/png;base64,AAAA)',
      '![](https://example.com/diagram.svg)',
      '<svg alt="inline"><path d="M0 0"/></svg>',
      '본문 보존',
    ].join('\n')
    expect(stripEmbeddedImages(input)).toBe(
      ['[image]', '[image]', '[image: inline]', '본문 보존'].join('\n'),
    )
  })

  it('AC-5 inline SVG without alt → [image]', () => {
    const input = '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>'
    expect(stripEmbeddedImages(input)).toBe('[image]')
  })

  it('AC-5b inline SVG with alt="" (빈 문자열) → [image]', () => {
    const input = '<svg alt="" viewBox="0 0 10 10"><circle/></svg>'
    expect(stripEmbeddedImages(input)).toBe('[image]')
  })

  it('AC-6 다른 HTML 태그는 보존 (<div>/<span>/<svg-icon> 등)', () => {
    const input = '<div class="x">텍스트</div> <span>inline</span> <svg-icon>fake</svg-icon>'
    expect(stripEmbeddedImages(input)).toBe(input)
  })

  it('AC-7 SVG 안 alt 가 여러 줄 / 특수문자 — 첫 alt 매칭', () => {
    const input = '<svg width="100" alt="사용자 정의 (한국어 + 영문) — diagram" role="img"><path/></svg>'
    expect(stripEmbeddedImages(input)).toBe('[image: 사용자 정의 (한국어 + 영문) — diagram]')
  })

  it('AC-8 finetree-OCR 회귀 — 95%+ SVG 비중 입력 → 치환 후 LOC 대폭 감소', () => {
    const svgBody = '<path d="M' + 'X'.repeat(50_000) + '"/>'
    const input = `# Title\n\n<svg alt="big" viewBox="0 0 100 100">${svgBody}</svg>\n\n본문`
    const out = stripEmbeddedImages(input)
    expect(out).toBe('# Title\n\n[image: big]\n\n본문')
    expect(out.length).toBeLessThan(100)
  })
})

describe('stripEmbeddedImages — inline HTML media 확장 (§5.16 옵션 3)', () => {
  it('AC-9 inline <img alt="..." src="..."/> → [image: alt]', () => {
    const input = '<img alt="diagram" src="https://x/d.png"/>'
    expect(stripEmbeddedImages(input)).toBe('[image: diagram]')
  })

  it('AC-9b inline <img> with closing tag', () => {
    const input = '<img src="x.png" alt="figure 1"></img>'
    expect(stripEmbeddedImages(input)).toBe('[image: figure 1]')
  })

  it('AC-10 <picture><source/><img/></picture> wrapper → 1 placeholder (picture 매칭 우선)', () => {
    const input = '<picture><source srcset="a.webp"/><img src="a.png" alt="responsive"/></picture>'
    const out = stripEmbeddedImages(input)
    expect(out).toMatch(/^\[image(:|\b)/)
    expect(out).not.toContain('<picture')
    expect(out).not.toContain('<img')
  })

  it('AC-11 <iframe alt="..." src="..."></iframe> → [image: alt]', () => {
    const input = '<iframe alt="embedded video" src="https://www.youtube.com/embed/x"></iframe>'
    expect(stripEmbeddedImages(input)).toBe('[image: embedded video]')
  })

  it('AC-12 <canvas>...</canvas> body → [image] (alt 없을 때)', () => {
    const input = '<canvas width="100" height="50">fallback text</canvas>'
    expect(stripEmbeddedImages(input)).toBe('[image]')
  })

  it('AC-13 <video alt="..."><source/></video> → [image: alt]', () => {
    const input = '<video alt="demo clip" controls><source src="x.mp4"/></video>'
    expect(stripEmbeddedImages(input)).toBe('[image: demo clip]')
  })

  it('AC-14 <embed src="..."/> + <object data="..."></object>', () => {
    const input = '<embed src="x.swf" alt="legacy flash"/>\n<object data="x.pdf" alt="pdf preview"></object>'
    expect(stripEmbeddedImages(input)).toBe('[image: legacy flash]\n[image: pdf preview]')
  })

  it('AC-15 mixed inline SVG + HTML media + markdown image — 모두 치환', () => {
    const input = [
      '![](data:image/png;base64,AAA)',
      '<svg alt="svg-block" viewBox="0 0 10 10"><path/></svg>',
      '<img src="x.png" alt="html-img"/>',
      '<iframe alt="frame" src="x"/>',
      '본문 보존',
    ].join('\n')
    expect(stripEmbeddedImages(input)).toBe(
      ['[image]', '[image: svg-block]', '[image: html-img]', '[image: frame]', '본문 보존'].join('\n'),
    )
  })

  it('AC-16 <img-icon> / <my-svg> 같은 custom element 는 보존 — 정확한 tag name 매칭', () => {
    const input = '<img-icon src="x"/> <my-svg></my-svg> 텍스트'
    expect(stripEmbeddedImages(input)).toBe(input)
  })
})

describe('countEmbeddedImages — 진단 용 (§5.16 schema 확장)', () => {
  it('data URI + 외부 URL + inline SVG + HTML media 각각 집계', () => {
    const md = [
      '![a](data:image/png;base64,1)',
      '![b](data:image/bmp;base64,2)',
      '![c](https://x/c.png)',
      '![d](https://x/d.svg)',
      '![e](https://x/e.html)', // 이미지 아님 — count 제외
      '<svg alt="x"><path/></svg>',
      '<svg alt="y"><circle/></svg>',
      '<img alt="z" src="x.png"/>',
      '<iframe src="x"></iframe>',
    ].join('\n')
    expect(countEmbeddedImages(md)).toEqual({
      dataUri: 2,
      externalUrl: 2,
      inlineSvg: 2,
      inlineHtmlMedia: 2,
    })
  })
})
