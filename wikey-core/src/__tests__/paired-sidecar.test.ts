/**
 * paired-sidecar.ts — Phase 5 §5.2.0
 *
 * Detect `<base>.<ext>.md` sidecar pairs (mirrors ingest-pipeline.ts:1870
 * `hasSidecar` rule: ext != md/txt + sibling `<sourcePath>.md` exists).
 *
 * Used by Ingest/Audit panels to hide derived sidecar rows + show [md] badge
 * on the original source row + correct file counts.
 */

import { describe, it, expect } from 'vitest'
import {
  pairedSidecarSet,
  hasSidecar,
  filterOutPairedSidecars,
  recountAuditAfterPairedExclude,
} from '../paired-sidecar.js'

describe('pairedSidecarSet', () => {
  it('detects a.pdf.md as paired sidecar of a.pdf', () => {
    const files = ['raw/0_inbox/a.pdf', 'raw/0_inbox/a.pdf.md']
    const paired = pairedSidecarSet(files)
    expect(paired.has('raw/0_inbox/a.pdf.md')).toBe(true)
    expect(paired.has('raw/0_inbox/a.pdf')).toBe(false)
  })

  it('treats standalone b.md (no convertible sibling) as NOT paired', () => {
    const files = ['raw/0_inbox/b.md']
    const paired = pairedSidecarSet(files)
    expect(paired.size).toBe(0)
  })

  it('does not pair a.txt.md (txt is not a converted source)', () => {
    const files = ['raw/0_inbox/a.txt', 'raw/0_inbox/a.txt.md']
    const paired = pairedSidecarSet(files)
    expect(paired.has('raw/0_inbox/a.txt.md')).toBe(false)
  })

  it('does not pair a.md.md (md is not a converted source)', () => {
    const files = ['raw/0_inbox/a.md', 'raw/0_inbox/a.md.md']
    const paired = pairedSidecarSet(files)
    expect(paired.has('raw/0_inbox/a.md.md')).toBe(false)
  })

  it('handles all docling formats (pdf, hwp, hwpx, docx, pptx, xlsx, csv, html, htm, png, jpg, jpeg, tiff, tif)', () => {
    const exts = ['pdf', 'hwp', 'hwpx', 'docx', 'pptx', 'xlsx', 'csv', 'html', 'htm', 'png', 'jpg', 'jpeg', 'tiff', 'tif']
    for (const ext of exts) {
      const files = [`raw/x.${ext}`, `raw/x.${ext}.md`]
      const paired = pairedSidecarSet(files)
      expect(paired.has(`raw/x.${ext}.md`)).toBe(true)
    }
  })

  it('orphan sidecar (no original) is NOT marked paired', () => {
    const files = ['raw/0_inbox/orphan.pdf.md']
    const paired = pairedSidecarSet(files)
    expect(paired.size).toBe(0)
  })

  it('different directories do not pair across dirs', () => {
    const files = ['raw/a/x.pdf', 'raw/b/x.pdf.md']
    const paired = pairedSidecarSet(files)
    expect(paired.size).toBe(0)
  })

  it('case-insensitive extension matching (A.PDF + A.PDF.md)', () => {
    const files = ['raw/A.PDF', 'raw/A.PDF.md']
    const paired = pairedSidecarSet(files)
    expect(paired.has('raw/A.PDF.md')).toBe(true)
  })

  it('mixed fixture from §5.2.0 spec', () => {
    const files = [
      'raw/a.pdf',
      'raw/a.pdf.md',
      'raw/b.md',
      'raw/c.docx',
      'raw/c.docx.md',
    ]
    const paired = pairedSidecarSet(files)
    expect(paired.size).toBe(2)
    expect(paired.has('raw/a.pdf.md')).toBe(true)
    expect(paired.has('raw/c.docx.md')).toBe(true)
    expect(paired.has('raw/b.md')).toBe(false)
  })
})

describe('hasSidecar', () => {
  it('returns true when convertible source has a sibling .md', () => {
    const all = new Set(['raw/a.pdf', 'raw/a.pdf.md'])
    expect(hasSidecar('raw/a.pdf', all)).toBe(true)
  })

  it('returns false when convertible source has no sibling .md', () => {
    const all = new Set(['raw/a.pdf'])
    expect(hasSidecar('raw/a.pdf', all)).toBe(false)
  })

  it('returns false for standalone .md file', () => {
    const all = new Set(['raw/b.md'])
    expect(hasSidecar('raw/b.md', all)).toBe(false)
  })

  it('returns false for unknown extension (not convertible)', () => {
    const all = new Set(['raw/a.zip', 'raw/a.zip.md'])
    expect(hasSidecar('raw/a.zip', all)).toBe(false)
  })

  it('returns false for txt (not converted)', () => {
    const all = new Set(['raw/a.txt', 'raw/a.txt.md'])
    expect(hasSidecar('raw/a.txt', all)).toBe(false)
  })
})

describe('recountAuditAfterPairedExclude (§5.2.0 v4 dashboard sync)', () => {
  it('excludes paired sidecar from totals + per-folder counts', () => {
    const r = recountAuditAfterPairedExclude({
      ingested: ['raw/0_inbox/a.pdf', 'raw/0_inbox/a.pdf.md'],
      missing: ['raw/3_resources/b.docx', 'raw/3_resources/b.docx.md'],
      unsupported: [],
    })
    expect(r.totalFiles).toBe(2)
    expect(r.ingested).toEqual(['raw/0_inbox/a.pdf'])
    expect(r.missing).toEqual(['raw/3_resources/b.docx'])
    expect(r.folders['0_inbox']).toEqual({ total: 1, ingested: 1, missing: 0 })
    expect(r.folders['3_resources']).toEqual({ total: 1, ingested: 0, missing: 1 })
  })

  it('preserves standalone .md and standalone originals', () => {
    const r = recountAuditAfterPairedExclude({
      ingested: ['raw/0_inbox/note.md'],
      missing: ['raw/0_inbox/standalone.pdf'],
    })
    expect(r.totalFiles).toBe(2)
    expect(r.ingested).toEqual(['raw/0_inbox/note.md'])
    expect(r.missing).toEqual(['raw/0_inbox/standalone.pdf'])
    expect(r.folders['0_inbox']).toEqual({ total: 2, ingested: 1, missing: 1 })
  })

  it('counts unsupported into total but NOT into missing (audit-ingest.py mirror)', () => {
    const r = recountAuditAfterPairedExclude({
      ingested: [],
      missing: [],
      unsupported: ['raw/0_inbox/legacy.doc'],
    })
    expect(r.totalFiles).toBe(1)
    expect(r.ingested).toEqual([])
    expect(r.missing).toEqual([])
    expect(r.folders['0_inbox']).toEqual({ total: 1, ingested: 0, missing: 0 })
  })

  it('handles empty input', () => {
    const r = recountAuditAfterPairedExclude({ ingested: [], missing: [] })
    expect(r.totalFiles).toBe(0)
    expect(r.folders).toEqual({})
  })

  it('mixed fixture mirrors §5.2.0 audit panel result for dashboard parity', () => {
    const r = recountAuditAfterPairedExclude({
      ingested: ['raw/0_inbox/a.pdf', 'raw/0_inbox/a.pdf.md', 'raw/3_resources/30_manual/x.md'],
      missing: ['raw/1_projects/p.docx', 'raw/1_projects/p.docx.md', 'raw/0_inbox/orphan.pdf.md'],
      unsupported: ['raw/0_inbox/legacy.doc'],
    })
    // paired = a.pdf.md, p.docx.md (orphan.pdf.md stays — no sibling original)
    expect(r.ingested).toEqual(['raw/0_inbox/a.pdf', 'raw/3_resources/30_manual/x.md'])
    expect(r.missing).toEqual(['raw/1_projects/p.docx', 'raw/0_inbox/orphan.pdf.md'])
    expect(r.unsupported).toEqual(['raw/0_inbox/legacy.doc'])
    expect(r.totalFiles).toBe(5)
    expect(r.folders['0_inbox']).toEqual({ total: 3, ingested: 1, missing: 1 })
    expect(r.folders['1_projects']).toEqual({ total: 1, ingested: 0, missing: 1 })
    expect(r.folders['3_resources']).toEqual({ total: 1, ingested: 1, missing: 0 })
  })

  it('does not mutate input arrays', () => {
    const ingested = ['raw/a.pdf', 'raw/a.pdf.md']
    const missing = ['raw/b.docx']
    const before = [...ingested, ...missing]
    recountAuditAfterPairedExclude({ ingested, missing })
    expect([...ingested, ...missing]).toEqual(before)
  })
})

describe('filterOutPairedSidecars', () => {
  it('removes paired sidecars but keeps originals + standalone .md', () => {
    const files = [
      'raw/a.pdf',
      'raw/a.pdf.md',
      'raw/b.md',
      'raw/c.docx',
      'raw/c.docx.md',
    ]
    const filtered = filterOutPairedSidecars(files)
    expect(filtered).toEqual(['raw/a.pdf', 'raw/b.md', 'raw/c.docx'])
  })

  it('preserves order', () => {
    const files = ['raw/z.pdf.md', 'raw/z.pdf', 'raw/a.md']
    const filtered = filterOutPairedSidecars(files)
    expect(filtered).toEqual(['raw/z.pdf', 'raw/a.md'])
  })

  it('empty input returns empty', () => {
    expect(filterOutPairedSidecars([])).toEqual([])
  })
})
