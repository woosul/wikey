/**
 * capability-map.test.ts — Phase 4 D.0.d (§4.2.6).
 *
 * Coverage:
 *   1. hasDocling=true + hasUnhwp=true → supported 총 17종 (md/txt + docling 12 + unhwp 2)
 *   2. hasDocling=false → docling-only 포맷이 unsupported 로 이동
 *   3. hasUnhwp=false → hwp/hwpx 가 unsupported
 *   4. 항상 unsupported 인 레거시 확장자 (.doc/.ppt/.xls)
 *   5. dumpCapabilityMap 이 유효한 JSON 파일 작성 (roundtrip)
 */

import { describe, it, expect } from 'vitest'
import {
  buildCapabilityMap,
  dumpCapabilityMap,
} from '../capability-map.js'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('buildCapabilityMap', () => {
  it('전부 설치됨 — md/txt/pdf/docx/... + hwp/hwpx 모두 supported', () => {
    const map = buildCapabilityMap({ hasDocling: true, hasUnhwp: true })
    expect(map.supported).toContain('.md')
    expect(map.supported).toContain('.txt')
    expect(map.supported).toContain('.pdf')
    expect(map.supported).toContain('.docx')
    expect(map.supported).toContain('.hwp')
    expect(map.supported).toContain('.hwpx')
    // 모든 supported ext 소문자 + dot prefix + 정렬
    for (const ext of map.supported) {
      expect(ext.startsWith('.')).toBe(true)
      expect(ext).toBe(ext.toLowerCase())
    }
    expect([...map.supported]).toEqual([...map.supported].sort())
    expect(map.doclingInstalled).toBe(true)
    expect(map.unhwpInstalled).toBe(true)
  })

  it('hasDocling=false → pdf/docx/pptx/xlsx/html/csv/image 가 unsupported 로 이동', () => {
    const map = buildCapabilityMap({ hasDocling: false, hasUnhwp: true })
    expect(map.supported).not.toContain('.pdf')
    expect(map.supported).not.toContain('.docx')
    expect(map.unsupported).toContain('.pdf')
    expect(map.unsupported).toContain('.docx')
    expect(map.unsupported).toContain('.pptx')
    expect(map.unsupported).toContain('.xlsx')
    // hwp 는 여전히 supported (unhwp 는 true)
    expect(map.supported).toContain('.hwp')
    expect(map.supported).toContain('.hwpx')
    expect(map.doclingInstalled).toBe(false)
  })

  it('hasUnhwp=false → hwp/hwpx 가 unsupported', () => {
    const map = buildCapabilityMap({ hasDocling: true, hasUnhwp: false })
    expect(map.supported).not.toContain('.hwp')
    expect(map.supported).not.toContain('.hwpx')
    expect(map.unsupported).toContain('.hwp')
    expect(map.unsupported).toContain('.hwpx')
    // docling 포맷은 여전히 supported
    expect(map.supported).toContain('.pdf')
    expect(map.unhwpInstalled).toBe(false)
  })

  it('레거시 OLE 확장자 (.doc/.ppt/.xls) 는 항상 unsupported', () => {
    for (const cfg of [
      { hasDocling: true, hasUnhwp: true },
      { hasDocling: false, hasUnhwp: false },
    ]) {
      const map = buildCapabilityMap(cfg)
      expect(map.unsupported).toContain('.doc')
      expect(map.unsupported).toContain('.ppt')
      expect(map.unsupported).toContain('.xls')
      // supported 에 절대 없어야 함
      expect(map.supported).not.toContain('.doc')
      expect(map.supported).not.toContain('.ppt')
      expect(map.supported).not.toContain('.xls')
    }
  })
})

describe('dumpCapabilityMap', () => {
  it('JSON 파일을 작성하고 필드 읽어오면 입력과 동일한 값 유지 (roundtrip)', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wikey-cap-'))
    try {
      const cachePath = join(tmp, 'capabilities.json')
      const fixedDate = new Date('2026-04-24T00:00:00.000Z')
      const map = buildCapabilityMap({ hasDocling: true, hasUnhwp: false, now: fixedDate })
      await dumpCapabilityMap(map, cachePath)
      const raw = readFileSync(cachePath, 'utf-8')
      const parsed = JSON.parse(raw)
      expect(parsed.supported).toEqual([...map.supported])
      expect(parsed.unsupported).toEqual([...map.unsupported])
      expect(parsed.doclingInstalled).toBe(true)
      expect(parsed.unhwpInstalled).toBe(false)
      expect(parsed.generatedAt).toBe('2026-04-24T00:00:00.000Z')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})
