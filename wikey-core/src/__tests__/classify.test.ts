import { describe, it, expect } from 'vitest'
import { classifyFile } from '../classify.js'

describe('classifyFile — 2차 서브폴더 라우팅 (CLASSIFY.md 기준)', () => {
  it('.meta.yaml → empty destination (URI reference)', () => {
    const r = classifyFile('api-spec.meta.yaml', false)
    expect(r.destination).toBe('')
  })

  it('folder → raw/3_resources/ (LLM judgment needed)', () => {
    const r = classifyFile('product-bundle', true)
    expect(r.destination).toBe('raw/3_resources/')
  })

  it('PDF with manual/guide keyword → 30_manual (when 3차 키워드 없음)', () => {
    expect(classifyFile('User-Guide-v1.pdf', false).destination).toBe('raw/3_resources/30_manual/')
    expect(classifyFile('Generic-Handbook.pdf', false).destination).toBe('raw/3_resources/30_manual/')
    expect(classifyFile('일반사용법.pdf', false).destination).toBe('raw/3_resources/30_manual/')
  })

  it('PDF with report/paper keyword → 20_report (when 3차 키워드 없음)', () => {
    expect(classifyFile('Q3-Report-2026.pdf', false).destination).toBe('raw/3_resources/20_report/')
    expect(classifyFile('annual-analysis.pdf', false).destination).toBe('raw/3_resources/20_report/')
    expect(classifyFile('분기리포트.pdf', false).destination).toBe('raw/3_resources/20_report/')
  })

  it('PDF without manual/report keyword → empty destination (LLM fallback)', () => {
    const r = classifyFile('unknown-document.pdf', false)
    expect(r.destination).toBe('')
    expect(r.needsThirdLevel).toBe(true)
  })

  it('PDF with report keyword but no Dewey match → 2차 only + needsThirdLevel', () => {
    const r = classifyFile('Q3-Report-ambiguous.pdf', false)
    expect(r.destination).toBe('raw/3_resources/20_report/')
    expect(r.needsThirdLevel).toBe(true)
  })

  it('DEWEY expansion — 10 categories cover social/philosophy/religion/language/literature/history', () => {
    // DDC 300 social — 사업자등록증 style (report keyword triggers 2차)
    expect(classifyFile('corporate-registration-report.pdf', false).destination).toBe('raw/3_resources/20_report/300_social_sciences/')
    // DDC 100 philosophy
    expect(classifyFile('philosophy-ethics-paper.pdf', false).destination).toBe('raw/3_resources/20_report/100_philosophy_psychology/')
    // DDC 200 religion
    expect(classifyFile('buddhism-scripture-report.pdf', false).destination).toBe('raw/3_resources/20_report/200_religion/')
    // DDC 400 language
    expect(classifyFile('linguistic-grammar-analysis.pdf', false).destination).toBe('raw/3_resources/20_report/400_language/')
    // DDC 800 literature
    expect(classifyFile('novel-literature-analysis.pdf', false).destination).toBe('raw/3_resources/20_report/800_literature/')
    // DDC 900 history
    expect(classifyFile('history-biography-report.pdf', false).destination).toBe('raw/3_resources/20_report/900_history_geography/')
  })

  it('markdown / txt → 60_note (when 3차 키워드 없음)', () => {
    expect(classifyFile('diary.md', false).destination).toBe('raw/3_resources/60_note/')
    expect(classifyFile('thoughts.txt', false).destination).toBe('raw/3_resources/60_note/')
  })

  it('CAD format default (ext matches 3차 keyword list via stl/step/3mf, but bare filename has no other keyword)', () => {
    // stl/step/3mf are both 확장자 AND 3차 keywords → always routed to 600_technology (DDC applied sciences)
    expect(classifyFile('part.stl', false).destination).toBe('raw/3_resources/40_cad/600_technology/')
    expect(classifyFile('mount.step', false).destination).toBe('raw/3_resources/40_cad/600_technology/')
    expect(classifyFile('widget.3mf', false).destination).toBe('raw/3_resources/40_cad/600_technology/')
  })

  it('source code → 50_firmware (keyword-free names)', () => {
    expect(classifyFile('helper.c', false).destination).toBe('raw/3_resources/50_firmware/')
    expect(classifyFile('parser.cpp', false).destination).toBe('raw/3_resources/50_firmware/')
    expect(classifyFile('blink.ino', false).destination).toBe('raw/3_resources/50_firmware/')
    expect(classifyFile('util.py', false).destination).toBe('raw/3_resources/50_firmware/')
  })

  it('binary .bin/.exe → 50_firmware (keyword-free; firmware keyword matches 500_technology)', () => {
    expect(classifyFile('image.bin', false).destination).toBe('raw/3_resources/50_firmware/')
    expect(classifyFile('installer.exe', false).destination).toBe('raw/3_resources/50_firmware/')
  })

  it('unknown extension → empty destination (LLM fallback)', () => {
    const r = classifyFile('weird.xyz', false)
    expect(r.destination).toBe('')
    expect(r.needsThirdLevel).toBe(true)
  })
})

describe('classifyFile — 3차 Dewey Decimal (DDC 표준 10대분류)', () => {
  it('AI/LLM/임베디드/컴퓨팅 → 000_computer_science', () => {
    expect(classifyFile('Raspberry_Pi_Getting_Started.pdf', false).destination)
      .toBe('raw/3_resources/30_manual/000_computer_science/')
    expect(classifyFile('llm-research-note.md', false).destination)
      .toBe('raw/3_resources/60_note/000_computer_science/')
    expect(classifyFile('arduino-programming-guide.pdf', false).destination)
      .toBe('raw/3_resources/30_manual/000_computer_science/')
  })

  it('물리/화학/수학/반도체 → 500_natural_science', () => {
    expect(classifyFile('SiC-physics-handbook.pdf', false).destination)
      .toBe('raw/3_resources/30_manual/500_natural_science/')
    expect(classifyFile('quantum-mechanics-note.md', false).destination)
      .toBe('raw/3_resources/60_note/500_natural_science/')
    expect(classifyFile('반도체-이론-매뉴얼.pdf', false).destination)
      .toBe('raw/3_resources/30_manual/500_natural_science/')
  })

  it('회로/CAD/기계/통신/RF → 600_technology', () => {
    expect(classifyFile('pcb-layout-guide.pdf', false).destination)
      .toBe('raw/3_resources/30_manual/600_technology/')
    expect(classifyFile('chassis.stl', false).destination)
      .toBe('raw/3_resources/40_cad/600_technology/')
    expect(classifyFile('bldc-motor-design-guide.pdf', false).destination)
      .toBe('raw/3_resources/30_manual/600_technology/')
    expect(classifyFile('DJI_O3_Air_Unit_Manual.pdf', false).destination)
      .toBe('raw/3_resources/30_manual/600_technology/')
    expect(classifyFile('nanovna-v2-user-guide.pdf', false).destination)
      .toBe('raw/3_resources/30_manual/600_technology/')
    expect(classifyFile('malahit-dsp-review.md', false).destination)
      .toBe('raw/3_resources/60_note/600_technology/')
  })

  it('취미/여가/오디오/키보드 → 700_arts_recreation', () => {
    expect(classifyFile('Kyosho-MR-04-Manual.pdf', false).destination)
      .toBe('raw/3_resources/30_manual/700_arts_recreation/')
    expect(classifyFile('hotas-setup.md', false).destination)
      .toBe('raw/3_resources/60_note/700_arts_recreation/')
  })

  it('PDF with no manual/report keyword → empty destination (LLM fallback)', () => {
    const r = classifyFile('random-document.pdf', false)
    expect(r.destination).toBe('')
    expect(r.needsThirdLevel).toBe(true)
  })

  it('md/txt with no keyword match → 2차 only + needsThirdLevel', () => {
    const r = classifyFile('meeting-2026.md', false)
    expect(r.destination).toBe('raw/3_resources/60_note/')
    expect(r.needsThirdLevel).toBe(true)
  })

  it('우선순위: sic 키워드 매칭 시 500_natural_science (반도체 물성)', () => {
    expect(classifyFile('sic-datasheet.pdf', false).destination)
      .toBe('raw/3_resources/30_manual/500_natural_science/')
  })
})
