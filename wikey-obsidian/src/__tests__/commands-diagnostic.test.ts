/**
 * §5.18 Step B (RED) — Spec 3 diagnostic command + MismatchDiagnosticModal
 *
 * Spec: docs/planning/phase-5/phase-5-spec-5.18-query-citation-ux.md v0.2 §1 Spec 3
 *
 * Invariants under test:
 *   - I8: 신규 command `wikey-diagnose-citation-mismatches` registerCommands 등록.
 *   - I9a: 모든 wiki page frontmatter provenance.ref 스캔 → registry cross-check → mismatch list.
 *   - I9b: 결과 출력 = MismatchDiagnosticModal (summary + per-mismatch block).
 *
 * Test 는 신규 export 2종에 의존 (commands.ts GREEN 단계 구현 예정):
 *   - scanCitationMismatches(pageContents, registry): pure mismatch scan helper
 *   - MismatchDiagnosticModal: Obsidian Modal class
 */

import { describe, it, expect } from 'vitest'
import { App } from 'obsidian'
// 신규 export 2종 — GREEN 단계에서 commands.ts 에 추가될 예정
import { scanCitationMismatches, MismatchDiagnosticModal } from '../commands'

describe('§5.18 Spec 3 — scanCitationMismatches (provenance scan + registry cross-check)', () => {
  // T12 ↔ I9a — diagnostic scan helper 정확성 + I9b summary shape
  it('T12: I9a — mismatch sourceId list + affected page list 정확 추출', () => {
    const ID_REG = 'sha256:reg11111111111111'
    const ID_MISS = 'sha256:679cf2dd6db75e3a' // 실측 mismatch
    // wiki page contents (frontmatter provenance.ref 형식)
    const pageContents = new Map<string, string>([
      [
        'wiki/entities/lotus-pms.md',
        `---\ntitle: Lotus PMS\nprovenance:\n  - type: source\n    ref: sources/${ID_REG}\n---\n\n# Lotus PMS`,
      ],
      [
        'wiki/entities/claude-code.md',
        `---\ntitle: Claude Code\nprovenance:\n  - type: source\n    ref: sources/${ID_MISS}\n---\n\n# Claude Code`,
      ],
      [
        'wiki/entities/anthropic.md',
        `---\ntitle: Anthropic\nprovenance:\n  - type: source\n    ref: sources/${ID_MISS}\n---\n\n# Anthropic`,
      ],
    ])
    // registry 에 ID_REG 만 등록 (ID_MISS 누락 → mismatch trigger)
    const registry = {
      [ID_REG]: {
        vault_path: 'raw/2_areas/lotus.md',
        hash: 'a'.repeat(64),
        size: 100,
        first_seen: '2026-05-12T00:00:00Z',
        ingested_pages: [],
        path_history: [],
        tombstone: false,
      },
    }
    const result = scanCitationMismatches(pageContents, registry)
    // summary: totalSourceIds = 2 (REG + MISS unique), mismatchCount = 1, affectedPageCount = 2
    expect(result.totalSourceIds).toBe(2)
    expect(result.mismatchCount).toBe(1)
    expect(result.affectedPageCount).toBe(2)
    // mismatch entry: sourceId + pages
    expect(result.mismatches).toHaveLength(1)
    expect(result.mismatches[0].sourceId).toBe(ID_MISS)
    expect(result.mismatches[0].pages.sort()).toEqual([
      'wiki/entities/anthropic.md',
      'wiki/entities/claude-code.md',
    ])
  })

  // T12b — Diagnostic command clean (no mismatch)
  it('T12b: Diagnostic — clean state (모두 registry 일치) → mismatchCount=0', () => {
    const ID_OK = 'sha256:ok000000000000000'
    const pageContents = new Map<string, string>([
      [
        'wiki/entities/a.md',
        `---\ntitle: A\nprovenance:\n  - type: source\n    ref: sources/${ID_OK}\n---\n\n# A`,
      ],
    ])
    const registry = {
      [ID_OK]: {
        vault_path: 'raw/2_areas/a.md',
        hash: 'b'.repeat(64),
        size: 100,
        first_seen: '2026-05-12T00:00:00Z',
        ingested_pages: [],
        path_history: [],
        tombstone: false,
      },
    }
    const result = scanCitationMismatches(pageContents, registry)
    expect(result.totalSourceIds).toBe(1)
    expect(result.mismatchCount).toBe(0)
    expect(result.affectedPageCount).toBe(0)
    expect(result.mismatches).toEqual([])
  })

  // T13 ↔ I9b — MismatchDiagnosticModal class 존재 + body render 정확성
  it('T13: I9b — MismatchDiagnosticModal export + open 시 modal body 에 summary 출력', () => {
    // class existence (RED: import 실패 → 본 test 자체가 module load error)
    expect(typeof MismatchDiagnosticModal).toBe('function')
    // mock App (vitest alias → obsidian mock)
    const app = new App()
    const scanResult = {
      totalSourceIds: 14,
      mismatchCount: 1,
      affectedPageCount: 38,
      mismatches: [
        {
          // §5.18 Spec 3 I9b — 64-hex sha256 full form (slice(0, 24) effect 검증)
          sourceId: 'sha256:679cf2dd6db75e3a0123456789abcdef0123456789abcdef0123',
          pages: Array.from({ length: 38 }, (_, i) => `wiki/entities/p${i}.md`),
        },
      ],
    }
    const modal = new MismatchDiagnosticModal(app, scanResult)
    // open → onOpen 실행 → contentEl 에 summary 텍스트 출현
    modal.onOpen()
    const txt = modal.contentEl.textContent ?? ''
    // summary line: "1 mismatch / 14 sourceIds, 38 pages affected"
    expect(txt).toMatch(/1\s*mismatch/i)
    expect(txt).toMatch(/14\s*sourceIds/i)
    expect(txt).toMatch(/38\s*pages/i)
    // §5.18 Spec 3 I9b — sourceId 단축 (앞 24 자) 검증
    expect(txt).toContain('sha256:679cf2dd6db75')
    // 앞 24자 = 'sha256:679cf2dd6db75e3a0' — 25자 이후 (`123...`) 는 modal h3 에 노출 X
    expect(txt).not.toContain('sha256:679cf2dd6db75e3a0123456789abcdef')
  })
})
