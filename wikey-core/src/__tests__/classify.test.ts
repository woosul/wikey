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

  it('PDF with manual/guide keyword → 30_manual', () => {
    expect(classifyFile('SiC_Power_Handbook.pdf', false).destination).toBe('raw/3_resources/30_manual/')
    expect(classifyFile('Raspberry_Pi_Getting_Started.pdf', false).destination).toBe('raw/3_resources/30_manual/')
    expect(classifyFile('User_Manual_v1.pdf', false).destination).toBe('raw/3_resources/30_manual/')
    expect(classifyFile('카메라_사용법.pdf', false).destination).toBe('raw/3_resources/30_manual/')
  })

  it('PDF with report/paper keyword → 20_report', () => {
    expect(classifyFile('Q3_Report_2026.pdf', false).destination).toBe('raw/3_resources/20_report/')
    expect(classifyFile('semiconductor-paper.pdf', false).destination).toBe('raw/3_resources/20_report/')
    expect(classifyFile('기술분석리포트.pdf', false).destination).toBe('raw/3_resources/20_report/')
  })

  it('PDF without keyword → 30_manual as default', () => {
    expect(classifyFile('unknown.pdf', false).destination).toBe('raw/3_resources/30_manual/')
  })

  it('markdown / txt → 60_note', () => {
    expect(classifyFile('my-note.md', false).destination).toBe('raw/3_resources/60_note/')
    expect(classifyFile('thoughts.txt', false).destination).toBe('raw/3_resources/60_note/')
  })

  it('CAD formats → 40_cad', () => {
    expect(classifyFile('gear.stl', false).destination).toBe('raw/3_resources/40_cad/')
    expect(classifyFile('mount.step', false).destination).toBe('raw/3_resources/40_cad/')
    expect(classifyFile('part.3mf', false).destination).toBe('raw/3_resources/40_cad/')
  })

  it('source code → 50_firmware', () => {
    expect(classifyFile('main.c', false).destination).toBe('raw/3_resources/50_firmware/')
    expect(classifyFile('driver.cpp', false).destination).toBe('raw/3_resources/50_firmware/')
    expect(classifyFile('sketch.ino', false).destination).toBe('raw/3_resources/50_firmware/')
    expect(classifyFile('app.py', false).destination).toBe('raw/3_resources/50_firmware/')
  })

  it('binary / firmware → 50_firmware', () => {
    expect(classifyFile('firmware.bin', false).destination).toBe('raw/3_resources/50_firmware/')
    expect(classifyFile('tool.exe', false).destination).toBe('raw/3_resources/50_firmware/')
  })

  it('unknown extension → raw/3_resources/ (safe fallback)', () => {
    expect(classifyFile('weird.xyz', false).destination).toBe('raw/3_resources/')
  })
})
