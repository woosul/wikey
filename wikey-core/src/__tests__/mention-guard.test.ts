/**
 * §5.21 Ingest pipeline mention guard — RED test suite (Step B).
 *
 * Spec source: `plan/phase-5/phase-5-spec-5.21-ingest-mention-guard.md` v0.3.
 * 7 acceptance criteria 1:1 mapping (AC-S1-1~4 + AC-S2-1~3).
 *
 * 현재 Step B 단계 — applyMentionGuard / parseWikilinksWithRanges 는 stub throw.
 * 모든 test FAIL 확증 → developer Step C 구현 후 GREEN.
 *
 * Spec → Test mapping:
 *   AC-S1-1: 'extension wikilinks become plain text and produce zero wikilinks'
 *   AC-S1-2: 'extension wikilinks preserve their filename word in body text'
 *   AC-S1-3: 'mention-guard log entries follow the spec JSON shape'
 *   AC-S1-4: '§5.13 source link `## 출처` `[[X.pdf|원문]]` is exempt and untouched'
 *   AC-S2-1: 'mixed-case wikilink target without alias is lowercased to canonical slug'
 *   AC-S2-2: 'mixed-case wikilink with alias lowercases target only, preserves alias'
 *   AC-S2-3: 'mention-guard is idempotent — same input twice yields byte-identical output'
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  applyMentionGuard,
  filterBasenameCollisions,
  preFilterMentionsByOccurrence,
  type MentionGuardLogEntry,
} from '../wiki/mention-guard.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE_DIR = join(__dirname, 'fixtures', 'mention-guard')

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURE_DIR, name), 'utf-8')
}

// WIKILINK_RE mirrors `wiki-ops.ts:4` — used purely for assertion (count wikilinks in result).
const WIKILINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g

function countWikilinks(content: string): number {
  WIKILINK_RE.lastIndex = 0
  let n = 0
  while (WIKILINK_RE.exec(content) !== null) n += 1
  return n
}

describe('§5.21 mention-guard — Spec 1 (raw filename → plain text + log)', () => {
  it('AC-S1-1: extension wikilinks become plain text and produce zero extension wikilinks', () => {
    // 근본 원인 1 (33%, 195건) — `.md` / `.pdf` / `.docx` extension wikilink → plain text.
    const inputMd = loadFixture('raw-filename-md.md')
    const inputPdf = loadFixture('raw-filename-pdf.md')

    const resMd = applyMentionGuard(inputMd, { sourceSha: 'sha-md', page: 'concepts/sample-md' })
    const resPdf = applyMentionGuard(inputPdf, { sourceSha: 'sha-pdf', page: 'concepts/sample-pdf' })

    // After guard: no wikilink target ends with a known extension.
    const extRe = /\[\[[^\]]*\.(?:md|pdf|hwp|docx|pptx|txt)(?:\|[^\]]+)?\]\]/g
    expect(resMd.content.match(extRe) ?? []).toEqual([])
    expect(resPdf.content.match(extRe) ?? []).toEqual([])
  })

  it('AC-S1-2: extension wikilinks preserve the filename word as plain text in body', () => {
    // 정보 보존 — `[[whitepaper.pdf]]` → `whitepaper.pdf` (사용자 인지 가능).
    const input = loadFixture('raw-filename-pdf.md')

    const res = applyMentionGuard(input, { sourceSha: 'sha-pdf', page: 'concepts/sample-pdf' })

    expect(res.content).toContain('whitepaper.pdf')
    expect(res.content).toContain('report.docx')
    // And the original wikilink form is gone.
    expect(res.content).not.toContain('[[whitepaper.pdf]]')
    expect(res.content).not.toContain('[[report.docx]]')
  })

  it('AC-S1-3: log entries follow spec JSON shape { phase, sourceSha, page, original, transformed, reason }', () => {
    // log entry per variation. reason ∈ { 'extension' | 'raw-filename' | 'case-normalize' }.
    const input = loadFixture('raw-filename-pdf.md')

    const res = applyMentionGuard(input, { sourceSha: 'sha-pdf', page: 'concepts/sample-pdf' })

    expect(res.log.length).toBeGreaterThanOrEqual(1)
    for (const entry of res.log as readonly MentionGuardLogEntry[]) {
      expect(entry.phase).toBe('ingest')
      expect(entry.sourceSha).toBe('sha-pdf')
      expect(entry.page).toBe('concepts/sample-pdf')
      expect(typeof entry.original).toBe('string')
      expect(typeof entry.transformed).toBe('string')
      expect(['extension', 'raw-filename', 'case-normalize', 'mention-only']).toContain(entry.reason)
    }
    // At least one entry corresponds to the .pdf transformation.
    const pdfEntry = res.log.find((e) => e.original === '[[whitepaper.pdf]]')
    expect(pdfEntry).toBeDefined()
    expect(pdfEntry?.transformed).toBe('whitepaper.pdf')
    expect(pdfEntry?.reason).toBe('extension')
  })

  it('AC-S1-4: §5.13 `## 출처` raw source link `[[X|원문]]` is exempt (variation 0)', () => {
    // Spec 1 I7 — `## 출처` 영역 + alias === '원문' = scope exempt.
    // 본문 `[[sample.pdf]]` 만 plain text 로 변환되고,
    // `## 출처` 의 `[[sample.pdf|원문]]` + `[[source-sample|sample.pdf]]` 는 그대로 유지.
    const input = loadFixture('source-link-exempt.md')

    const res = applyMentionGuard(input, { sourceSha: 'sha-exempt', page: 'concepts/sample-exempt' })

    // Body `[[sample.pdf]]` is converted to plain text (no longer in content).
    expect(res.content).not.toMatch(/\[\[sample\.pdf\]\]/)
    // But the `## 출처` wikilinks survive unchanged (idempotent for source links).
    expect(res.content).toContain('[[sample.pdf|원문]]')
    expect(res.content).toContain('[[source-sample|sample.pdf]]')

    // No log entry should reference the exempt `## 출처` wikilinks.
    const exemptOriginals = ['[[sample.pdf|원문]]', '[[source-sample|sample.pdf]]']
    for (const exempt of exemptOriginals) {
      expect(res.log.some((e) => e.original === exempt)).toBe(false)
    }
  })
})

describe('§5.21 mention-guard — Spec 2 (canonicalize target, preserve alias, idempotent)', () => {
  it('AC-S2-1: mixed-case wikilink target without alias is lowercased to canonical slug', () => {
    // 근본 원인 3 (20%, 116건) — `[[GPT-4o]]` → `[[gpt-4o]]`.
    const input = loadFixture('mixed-case-no-alias.md')

    const res = applyMentionGuard(input, { sourceSha: 'sha-case', page: 'concepts/llm-models' })

    expect(res.content).toContain('[[gpt-4o]]')
    expect(res.content).toContain('[[anthropic]]')
    // No uppercased target survives.
    expect(res.content).not.toContain('[[GPT-4o]]')
    expect(res.content).not.toContain('[[Anthropic]]')
    // Wikilink count is preserved (case-normalize, not removal).
    expect(countWikilinks(res.content)).toBe(countWikilinks(input))
  })

  it('AC-S2-2: mixed-case with alias lowercases target only, preserves alias original casing', () => {
    // I5 alias preserve — `[[GPT-4o|GPT-4o]]` → `[[gpt-4o|GPT-4o]]`.
    const input = loadFixture('mixed-case-with-alias.md')

    const res = applyMentionGuard(input, { sourceSha: 'sha-alias', page: 'concepts/llm-models' })

    // Target lowercased, alias preserved as-is.
    expect(res.content).toContain('[[gpt-4o|GPT-4o]]')
    expect(res.content).toContain('[[claude-opus|Claude Opus]]')
    // Original mixed-case targets are gone.
    expect(res.content).not.toContain('[[GPT-4o|')
    expect(res.content).not.toContain('[[Claude-Opus|')
  })

  it('AC-S2-3: idempotent — applying mention-guard twice yields byte-identical content', () => {
    // I6 idempotent — same source re-ingest = stable output.
    const input = loadFixture('mixed-case-with-alias.md')

    const first = applyMentionGuard(input, { sourceSha: 'sha-idem', page: 'concepts/llm-models' })
    const second = applyMentionGuard(first.content, {
      sourceSha: 'sha-idem',
      page: 'concepts/llm-models',
    })

    // Byte-identical content after second pass.
    expect(second.content).toBe(first.content)
    // Second pass log is empty (nothing left to transform).
    expect(second.log.length).toBe(0)
  })
})

describe('§5.21 mention-guard — Spec 3 (vault membership, mention-only fallback)', () => {
  // existingBases mirrors mentionGuardBases from ingest-pipeline (this-ingest ∪ vault).
  const existingBases = new Set<string>(['claude', 'source-existing'])

  it('AC-S3-1: vault-absent wikilink target degrades to plain text with reason mention-only', () => {
    // 근본 원인 2 (67%, 390건) — page 미존재 wikilink → plain text.
    const input = loadFixture('mention-only.md')

    const res = applyMentionGuard(input, {
      sourceSha: 'sha-mo',
      page: 'concepts/mention-only',
      existingBases,
    })

    // `[[unknown-entity]]` is degraded (not in existingBases).
    expect(res.content).not.toContain('[[unknown-entity]]')
    expect(res.content).toContain('unknown-entity')
    // `[[ghost-concept|Ghost Concept]]` degrades to its alias (display text).
    expect(res.content).not.toContain('[[ghost-concept|Ghost Concept]]')
    expect(res.content).toContain('Ghost Concept')
    // `[[mythical-tool|레전드 도구]]` degrades to its alias.
    expect(res.content).not.toContain('[[mythical-tool|')
    expect(res.content).toContain('레전드 도구')

    // log entries reference the missing-page wikilinks with reason 'mention-only'.
    const missing = ['[[unknown-entity]]', '[[ghost-concept|Ghost Concept]]', '[[mythical-tool|레전드 도구]]']
    for (const original of missing) {
      const entry = res.log.find((e) => e.original === original)
      expect(entry, `log entry for ${original}`).toBeDefined()
      expect(entry?.reason).toBe('mention-only')
    }
  })

  it('AC-S3-2: vault-present wikilink target is preserved (no-op)', () => {
    // `[[claude]]` matches existingBases — no transformation, no log entry.
    const input = loadFixture('mention-only.md')

    const res = applyMentionGuard(input, {
      sourceSha: 'sha-mo',
      page: 'concepts/mention-only',
      existingBases,
    })

    // [[claude]] survives because it is in existingBases.
    expect(res.content).toContain('[[claude]]')
    // No log entry references [[claude]] (matched, no transform).
    expect(res.log.some((e) => e.original === '[[claude]]')).toBe(false)
  })

  it('AC-S3-3: this-ingest pages count as members of the existingBases set', () => {
    // new page being created in this ingest should match too (caller composes the set).
    const baseSet = new Set<string>(['claude', 'source-existing', 'unknown-entity'])
    const input = loadFixture('mention-only.md')

    const res = applyMentionGuard(input, {
      sourceSha: 'sha-mo',
      page: 'concepts/mention-only',
      existingBases: baseSet,
    })

    // Now [[unknown-entity]] should survive (it is registered as a this-ingest page).
    expect(res.content).toContain('[[unknown-entity]]')
    expect(res.log.some((e) => e.original === '[[unknown-entity]]')).toBe(false)
    // ghost-concept and mythical-tool remain missing → still degraded.
    expect(res.log.some((e) => e.reason === 'mention-only')).toBe(true)
  })
})

describe('§5.21 v0.5 — preFilterMentionsByOccurrence (Stage 2 pre-filter)', () => {
  it('drops mentions with sourceBody substring count below threshold', () => {
    const sourceBody = 'GPT-4o is a model. Claude is another model. GPT-4o appears twice. Once-only.'
    const mentions = [
      { name: 'GPT-4o', evidence: 'GPT-4o is a model' },
      { name: 'Claude', evidence: 'Claude is another model' },
      { name: 'Once-only', evidence: 'mentioned once' },
    ]
    const result = preFilterMentionsByOccurrence(mentions, sourceBody, 2)
    expect(result.kept.map((m) => m.name)).toEqual(['GPT-4o'])
    expect(result.dropped.map((d) => d.mention.name).sort()).toEqual(['Claude', 'Once-only'])
  })

  it('empty mention name is dropped with occurrences=0', () => {
    const result = preFilterMentionsByOccurrence([{ name: '', evidence: 'x' }], 'body', 1)
    expect(result.kept).toEqual([])
    expect(result.dropped[0].occurrences).toBe(0)
  })
})

describe('§5.21 v0.5 — filterBasenameCollisions (basename guard)', () => {
  it('drops candidates whose filename collides with raw inbox basenames', () => {
    const raw = new Set<string>(['llm-wiki.md', 'overview.pdf', 'note.md'])
    const candidates = [
      { filename: 'llm-wiki' }, // collides (raw `llm-wiki.md`)
      { filename: 'overview' }, // collides (raw `overview.pdf` not — only .md mapped; but normalizeBase strips .md)
      { filename: 'unique-entity' },
    ]
    const result = filterBasenameCollisions(candidates, raw)
    expect(result.kept.map((c) => c.filename)).toContain('unique-entity')
    expect(result.dropped.map((c) => c.filename)).toContain('llm-wiki')
  })

  it('empty rawBasenames set returns all candidates as kept', () => {
    const result = filterBasenameCollisions([{ filename: 'x' }], new Set())
    expect(result.kept.length).toBe(1)
    expect(result.dropped.length).toBe(0)
  })
})

