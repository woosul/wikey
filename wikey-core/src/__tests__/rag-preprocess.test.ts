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

describe('countEmbeddedImages — 진단 용', () => {
  it('data URI + 외부 URL 각각 집계', () => {
    const md = [
      '![a](data:image/png;base64,1)',
      '![b](data:image/bmp;base64,2)',
      '![c](https://x/c.png)',
      '![d](https://x/d.svg)',
      '![e](https://x/e.html)', // 이미지 아님 — count 제외
    ].join('\n')
    expect(countEmbeddedImages(md)).toEqual({ dataUri: 2, externalUrl: 2 })
  })
})
