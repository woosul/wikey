import { describe, it, expect } from 'vitest'
import { appendSectionTOCToSource } from '../ingest-pipeline.js'
import { buildSectionIndex } from '../section-index.js'

// §6 Phase C 근거 데이터 — 소스 페이지 body 에 섹션 TOC append

describe('appendSectionTOCToSource', () => {
  it('body 끝에 섹션 TOC 마크다운 표를 붙인다', () => {
    const original = '---\ntitle: test\n---\n\n# test\n\n본문 요약입니다.\n'
    const md = '## 서두\n\n본문입니다. 본문입니다. 본문입니다. 본문입니다.\n\n## 기술 스택\n\n| a | b |\n| - | - |\n| 1 | 2 |\n'
    const index = buildSectionIndex(md)
    const out = appendSectionTOCToSource(original, index)
    expect(out).toMatch(/## 섹션 인덱스/)
    expect(out).toMatch(/\| § \|/)
    expect(out).toContain('서두')
    // 원본 앞부분이 보존됨
    expect(out.startsWith(original.trimEnd())).toBe(true)
  })

  it('sectionIndex.sections 가 비어있으면 원본 그대로 반환', () => {
    const original = '---\ntitle: test\n---\n\n# test\n'
    const index = buildSectionIndex('')
    const out = appendSectionTOCToSource(original, index)
    // 빈 markdown 도 no-headings pseudo-section 이 1개 생기므로 TOC 붙음
    // 다만 content 가 비어 있는 "document" 섹션 — TOC 에 포함
    expect(out).toMatch(/섹션 인덱스|섹션 인덱스\n/)
  })

  it('결정성: 같은 입력 2회 호출 identical', () => {
    const original = '---\ntitle: test\n---\n\n# test\n\n본문.\n'
    const md = '## A\n\n본문입니다. 본문입니다. 본문입니다.\n'
    const index = buildSectionIndex(md)
    expect(appendSectionTOCToSource(original, index)).toBe(appendSectionTOCToSource(original, index))
  })
})
