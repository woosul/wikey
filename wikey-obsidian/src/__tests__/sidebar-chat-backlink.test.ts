/**
 * §5.18 Step B (RED) — Spec 2 wiki backlink section
 *
 * Spec: docs/planning/phase-5/phase-5-spec-5.18-query-citation-ux.md v0.6 §1 Spec 2
 *
 * Invariants under test:
 *   - I4: backlink 조회는 resolvedLinks 역방향 lookup (pure function on map).
 *   - I4a (v0.6): scope filter — 'wiki' (default) / 'extended' (opt-in), raw/ 항상 제외.
 *     collectBacklinks 반환 = `{ wiki: string[], external: string[] }` (BacklinkResult).
 *   - I5: 2 section 분리 — `참고 (N)` (wiki/) + `확장 (M)` (external, extended scope only).
 *   - I5a: default collapse — <details> 에 open attribute 없음.
 *   - I6: 빈 section 미출력 (wiki 0 → 참고 생략, external 0 → 확장 생략).
 *   - I7: list ≤ 5, 초과 시 truncation 안내 텍스트.
 *   - I7a: self-reference 회피 — 답변 본문 안 mention 된 wiki page 는 backlink list 에서 제외.
 */

import { describe, it, expect } from 'vitest'
import { collectBacklinks, buildBacklinkSection } from '../sidebar-chat'

describe('§5.18 Spec 2 — collectBacklinks (resolvedLinks 역방향 lookup)', () => {
  // T8 ↔ Spec 2 Happy (3 backlinks via resolvedLinks)
  it('T8: Happy — 답변에 [[lotus-pms]] mention → 3 wiki backlink 반환 (resolvedLinks 역방향)', () => {
    const resolvedLinks: Record<string, Record<string, number>> = {
      'wiki/entities/jeff-smith.md': { 'wiki/entities/lotus-pms.md': 1 },
      'wiki/concepts/pid-loop.md': { 'wiki/entities/lotus-pms.md': 2 },
      'wiki/entities/mary-chen.md': { 'wiki/entities/lotus-pms.md': 1 },
      'wiki/entities/anthropic.md': { 'wiki/entities/claude-code.md': 1 }, // unrelated
    }
    const mentioned = new Set<string>(['wiki/entities/lotus-pms.md'])
    const backlinks = collectBacklinks(resolvedLinks, mentioned)
    expect(backlinks.wiki).toHaveLength(3)
    expect(backlinks.wiki).toEqual(
      expect.arrayContaining([
        'wiki/entities/jeff-smith.md',
        'wiki/concepts/pid-loop.md',
        'wiki/entities/mary-chen.md',
      ]),
    )
    expect(backlinks.external).toEqual([])
  })

  // T9 ↔ I4 — resolvedLinks 역방향 lookup 정확성 (Obsidian shape)
  it('T9: I4 — resolvedLinks shape (source→{target:count}) 정확 역방향 처리', () => {
    const resolvedLinks: Record<string, Record<string, number>> = {
      'wiki/concepts/a.md': { 'wiki/entities/x.md': 1, 'wiki/entities/y.md': 1 },
      'wiki/concepts/b.md': { 'wiki/entities/x.md': 1 },
    }
    const mentioned = new Set<string>(['wiki/entities/x.md'])
    const backlinks = collectBacklinks(resolvedLinks, mentioned)
    expect(backlinks.wiki).toEqual(['wiki/concepts/a.md', 'wiki/concepts/b.md'])
    expect(backlinks.external).toEqual([])
  })

  // T11 ↔ I6 — zero backlink → 빈 array
  it('T11: I6 — backlink 0 → 빈 array 양쪽 (section 미출력 trigger)', () => {
    const resolvedLinks: Record<string, Record<string, number>> = {
      'wiki/entities/a.md': { 'wiki/entities/b.md': 1 },
    }
    const mentioned = new Set<string>(['wiki/entities/orphan.md'])
    const backlinks = collectBacklinks(resolvedLinks, mentioned)
    expect(backlinks.wiki).toEqual([])
    expect(backlinks.external).toEqual([])
  })

  // T13a ↔ I7a — self-reference 회피
  it('T13a (I7a): self-reference 회피 — 답변에 [[A]],[[B]] mention 시 A 는 B 의 backlink 에서 제외', () => {
    const resolvedLinks: Record<string, Record<string, number>> = {
      'wiki/entities/a.md': { 'wiki/entities/b.md': 1 }, // A → B
      'wiki/entities/c.md': { 'wiki/entities/b.md': 1 }, // C → B
    }
    const mentioned = new Set<string>(['wiki/entities/a.md', 'wiki/entities/b.md'])
    const backlinks = collectBacklinks(resolvedLinks, mentioned)
    expect(backlinks.wiki).not.toContain('wiki/entities/a.md')
    expect(backlinks.wiki).toContain('wiki/entities/c.md')
  })

  // T14 ↔ Spec 2 I4a — default wiki/ scope filter
  it('T14: I4a default wiki/ scope — external 빈 array, raw/ + plan/ + .obsidian/ 제외', () => {
    const resolvedLinks: Record<string, Record<string, number>> = {
      'wiki/entities/jeff.md': { 'wiki/entities/lotus-pms.md': 1 }, // wiki/ ✓
      'raw/3_resources/legacy.md': { 'wiki/entities/lotus-pms.md': 1 }, // raw/ ✗
      'docs/planning/phase-5/phase-5-todo.md': { 'wiki/entities/lotus-pms.md': 1 }, // plan/ ✗ (scope=wiki)
      '.obsidian/widgets/foo.md': { 'wiki/entities/lotus-pms.md': 1 }, // .obsidian/ ✗
      'docs/sessions/phase-5/note.md': { 'wiki/entities/lotus-pms.md': 1 }, // activity/ ✗
    }
    const mentioned = new Set<string>(['wiki/entities/lotus-pms.md'])
    const backlinks = collectBacklinks(resolvedLinks, mentioned)
    // default scope='wiki' — wiki/ 하나만, external 비어있음
    expect(backlinks.wiki).toEqual(['wiki/entities/jeff.md'])
    expect(backlinks.external).toEqual([])
  })

  // T15 ↔ Spec 2 I4a — extended scope opt-in: raw/ 제외, wiki/ + 외부 분리
  it('T15: I4a extended scope — raw/ 항상 제외, wiki/ ↔ external 분리', () => {
    const resolvedLinks: Record<string, Record<string, number>> = {
      'wiki/entities/jeff.md': { 'wiki/entities/lotus-pms.md': 1 },
      'raw/3_resources/legacy.md': { 'wiki/entities/lotus-pms.md': 1 }, // raw/ → 항상 제외
      'docs/planning/phase-5/phase-5-todo.md': { 'wiki/entities/lotus-pms.md': 1 },
      'docs/sessions/phase-5/note.md': { 'wiki/entities/lotus-pms.md': 1 },
    }
    const mentioned = new Set<string>(['wiki/entities/lotus-pms.md'])
    const backlinks = collectBacklinks(resolvedLinks, mentioned, { scope: 'extended' })
    expect(backlinks.wiki).toEqual(['wiki/entities/jeff.md'])
    expect(backlinks.external).toEqual(
      expect.arrayContaining(['docs/planning/phase-5/phase-5-todo.md', 'docs/sessions/phase-5/note.md']),
    )
    expect(backlinks.external).toHaveLength(2)
    // raw/ 는 어디에도 없음
    const all = [...backlinks.wiki, ...backlinks.external]
    expect(all).not.toContain('raw/3_resources/legacy.md')
  })
})

describe('§5.18 Spec 2 — buildBacklinkSection (HTML <details> 2 section 분리, v0.6)', () => {
  // T10 ↔ I5a — default collapse: <details> 에 open attribute 없음
  it('T10: I5a — default collapse → <details> + Referenced summary + open attribute 없음', () => {
    const markup = buildBacklinkSection({
      wiki: ['wiki/entities/a.md', 'wiki/entities/b.md', 'wiki/entities/c.md'],
      external: [],
    })
    expect(markup).toMatch(/<details>/)
    expect(markup).toMatch(/<summary>Referenced/)
    expect(markup).not.toMatch(/<details\s+[^>]*\bopen\b/)
  })

  // T10b ↔ I5 — section header = `Referenced (N)`
  it('T10b: I5 — `Referenced` summary 에 wiki backlink count N 표시', () => {
    const markup = buildBacklinkSection({
      wiki: ['wiki/entities/a.md', 'wiki/entities/b.md', 'wiki/entities/c.md'],
      external: [],
    })
    expect(markup).toMatch(/Referenced\s*\(3\)/)
  })

  // T10c ↔ I7 — truncation: 8 backlink → 5 list + 안내 텍스트
  it('T10c: I7 — 8 wiki backlink → 5 list 줄 + "8 total" truncation 안내', () => {
    const wiki = [
      'wiki/entities/a.md', 'wiki/entities/b.md', 'wiki/entities/c.md',
      'wiki/entities/d.md', 'wiki/entities/e.md', 'wiki/entities/f.md',
      'wiki/entities/g.md', 'wiki/entities/h.md',
    ]
    const markup = buildBacklinkSection({ wiki, external: [] })
    expect(markup).toMatch(/\[\[wiki\/entities\/a\.md\]\]/)
    expect(markup).toMatch(/\[\[wiki\/entities\/e\.md\]\]/)
    expect(markup).not.toMatch(/\[\[wiki\/entities\/f\.md\]\]/)
    expect(markup).not.toMatch(/\[\[wiki\/entities\/h\.md\]\]/)
    expect(markup).toMatch(/8 total/)
    expect(markup).toMatch(/Obsidian backlink panel/)
  })

  // T11b ↔ I6 — 양쪽 0 → 빈 string
  it('T11b: I6 — wiki=0 + external=0 → buildBacklinkSection 빈 string', () => {
    const markup = buildBacklinkSection({ wiki: [], external: [] })
    expect(markup).toBe('')
  })

  // T16 ↔ Spec 2 I5 (v0.6) — 2 section 분리: `Referenced` (wiki) + `Extended` (external)
  it('T16: I5 (v0.6) — wiki + external 모두 있으면 `Referenced` + `Extended` 두 section 분리 출현', () => {
    const markup = buildBacklinkSection({
      wiki: ['wiki/entities/jeff.md'],
      external: ['docs/planning/phase-5/phase-5-todo.md', 'docs/sessions/phase-5/note.md'],
    })
    expect(markup).toMatch(/<summary>Referenced\s*\(1\)/)
    expect(markup).toMatch(/<summary>Extended\s*\(2\)/)
    // (+) badge 폐기 — section 자체로 구분
    expect(markup).not.toMatch(/\(\+\)/)
    // 각 section 안 entry 정확
    expect(markup).toMatch(/\[\[wiki\/entities\/jeff\.md\]\]/)
    expect(markup).toMatch(/\[\[docs\/planning\/phase-5\/phase-5-todo\.md\]\]/)
    expect(markup).toMatch(/\[\[docs\/sessions\/phase-5\/note\.md\]\]/)
  })

  // T17 ↔ Spec 2 I6 (v0.6) — wiki=0 + external>0 → `Extended` 만 출현
  it('T17: I6 — wiki=0 + external>0 → `Referenced` 미출력, `Extended` 만 출현', () => {
    const markup = buildBacklinkSection({
      wiki: [],
      external: ['docs/planning/phase-5/phase-5-todo.md'],
    })
    expect(markup).not.toMatch(/<summary>Referenced/)
    expect(markup).toMatch(/<summary>Extended\s*\(1\)/)
  })

  // T18 ↔ Spec 2 I6 (v0.6) — wiki>0 + external=0 → `Referenced` 만 출현 (wiki scope default 케이스)
  it('T18: I6 — wiki>0 + external=0 → `Referenced` 만 출현 (scope=wiki default 케이스)', () => {
    const markup = buildBacklinkSection({
      wiki: ['wiki/entities/jeff.md'],
      external: [],
    })
    expect(markup).toMatch(/<summary>Referenced\s*\(1\)/)
    expect(markup).not.toMatch(/<summary>Extended/)
  })
})
