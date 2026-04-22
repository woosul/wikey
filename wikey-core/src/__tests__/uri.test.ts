/**
 * uri.ts — Phase 4.2 Stage 1 S1-1 (plan v3).
 *
 * URI 는 저장하지 않고 derive 한다. 저장은 source_id + vault_path 만.
 * 번들 id 는 내부 relative path 기반으로 이동 무관 불변 (codex Critical #2).
 * 64-bit prefix + full-hash verify 루틴 (codex Medium #5).
 */

import { describe, it, expect } from 'vitest'
import {
  computeFileId,
  computeBundleId,
  computeExternalId,
  buildObsidianOpenUri,
  buildFileUri,
  formatDisplayPath,
  verifyFullHash,
  sidecarVaultPath,
  type BundleEntry,
} from '../uri.js'

const enc = new TextEncoder()

describe('computeFileId', () => {
  it('returns sha256:<16 hex> format', () => {
    const id = computeFileId(enc.encode('hello world'))
    expect(id).toMatch(/^sha256:[0-9a-f]{16}$/)
  })

  it('is deterministic: same content → same id', () => {
    const a = computeFileId(enc.encode('same bytes'))
    const b = computeFileId(enc.encode('same bytes'))
    expect(a).toBe(b)
  })

  it('is path-agnostic: content alone determines id', () => {
    // Same bytes produce same id regardless of where file lives in the vault.
    const bytes = enc.encode('PMS 제품소개 R10')
    const id1 = computeFileId(bytes)
    const id2 = computeFileId(bytes)
    expect(id1).toBe(id2)
  })
})

describe('computeBundleId — immutable across PARA moves', () => {
  it('uses bundle-internal relative paths (not vault paths)', () => {
    // Same bundle in two different vault locations must yield the same id.
    const entries1: BundleEntry[] = [
      { relativePath: 'manual.pdf', bytes: enc.encode('pdf-bytes') },
      { relativePath: 'readme.md', bytes: enc.encode('readme-bytes') },
    ]
    const entries2: BundleEntry[] = [
      { relativePath: 'manual.pdf', bytes: enc.encode('pdf-bytes') },
      { relativePath: 'readme.md', bytes: enc.encode('readme-bytes') },
    ]
    expect(computeBundleId(entries1)).toBe(computeBundleId(entries2))
  })

  it('is order-independent (entries sorted internally)', () => {
    const a: BundleEntry[] = [
      { relativePath: 'a.txt', bytes: enc.encode('a') },
      { relativePath: 'b.txt', bytes: enc.encode('b') },
    ]
    const b: BundleEntry[] = [
      { relativePath: 'b.txt', bytes: enc.encode('b') },
      { relativePath: 'a.txt', bytes: enc.encode('a') },
    ]
    expect(computeBundleId(a)).toBe(computeBundleId(b))
  })

  it('changes when internal content changes', () => {
    const a: BundleEntry[] = [{ relativePath: 'x.txt', bytes: enc.encode('v1') }]
    const b: BundleEntry[] = [{ relativePath: 'x.txt', bytes: enc.encode('v2') }]
    expect(computeBundleId(a)).not.toBe(computeBundleId(b))
  })

  it('empty bundle returns deterministic id', () => {
    const id = computeBundleId([])
    expect(id).toMatch(/^sha256:[0-9a-f]{16}$/)
    expect(computeBundleId([])).toBe(id)
  })
})

describe('computeExternalId', () => {
  it('returns uri-hash:<16 hex> for external URIs', () => {
    const id = computeExternalId('https://example.com/doc')
    expect(id).toMatch(/^uri-hash:[0-9a-f]{16}$/)
  })

  it('is deterministic for the same URI', () => {
    const u = 'confluence://space/page-123'
    expect(computeExternalId(u)).toBe(computeExternalId(u))
  })
})

describe('buildObsidianOpenUri', () => {
  it('produces obsidian://open?vault=...&file=... with percent-encoding', () => {
    const uri = buildObsidianOpenUri('Wikey', 'raw/3_resources/x.pdf')
    expect(uri).toBe('obsidian://open?vault=Wikey&file=raw%2F3_resources%2Fx.pdf')
  })

  it('encodes Korean vault path correctly', () => {
    const uri = buildObsidianOpenUri('Wikey', 'raw/0_inbox/사업자등록증.pdf')
    expect(uri).toContain('vault=Wikey')
    expect(uri).toContain('file=')
    // Decoded path must round-trip back to the original.
    const decoded = decodeURIComponent(uri.split('file=')[1]!)
    expect(decoded).toBe('raw/0_inbox/사업자등록증.pdf')
  })
})

describe('buildFileUri', () => {
  it('produces file:/// prefix for absolute paths', () => {
    expect(buildFileUri('/Users/denny/Project/wikey/raw/x.pdf')).toBe(
      'file:///Users/denny/Project/wikey/raw/x.pdf',
    )
  })
})

describe('formatDisplayPath — raw Korean, no encoding', () => {
  it('leaves Korean and spaces untouched', () => {
    const p = 'raw/3_resources/30_manual/PMS 제품소개 R10.pdf'
    expect(formatDisplayPath(p)).toBe(p)
  })
})

describe('verifyFullHash — prefix collision escalation', () => {
  it('returns true when full hash matches prefix and bytes', () => {
    const bytes = enc.encode('abc')
    const id = computeFileId(bytes)
    const prefix = id.slice('sha256:'.length)
    // In practice we'd pre-compute full sha256 hex; here we just verify
    // that a matching prefix + bytes returns true.
    expect(verifyFullHash(prefix, bytes)).toBe(true)
  })

  it('returns false when bytes do not match prefix', () => {
    const bytesA = enc.encode('payload-A')
    const bytesB = enc.encode('payload-B')
    const prefixA = computeFileId(bytesA).slice('sha256:'.length)
    expect(verifyFullHash(prefixA, bytesB)).toBe(false)
  })
})

describe('sidecarVaultPath — paired .md path', () => {
  it('appends .md to the original vault path', () => {
    expect(sidecarVaultPath('raw/3_resources/x.pdf')).toBe('raw/3_resources/x.pdf.md')
  })

  it('works with Korean filenames', () => {
    expect(sidecarVaultPath('raw/0_inbox/사업자등록증.pdf')).toBe(
      'raw/0_inbox/사업자등록증.pdf.md',
    )
  })
})
