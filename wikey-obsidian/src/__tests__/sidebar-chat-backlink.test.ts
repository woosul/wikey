/**
 * §5.18 Step B (RED) — Spec 2 wiki backlink section
 *
 * Spec: plan/phase-5/phase-5-spec-5.18-query-citation-ux.md v0.2 §1 Spec 2
 *
 * Invariants under test:
 *   - I4: backlink 조회는 resolvedLinks 역방향 lookup (pure function on map).
 *   - I5: 표시 위치 / section header `참조 페이지:` (HTML <details>).
 *   - I5a: default collapse — <details> 에 open attribute 없음.
 *   - I6: backlink 0 개 → section 미출력.
 *   - I7: list ≤ 5, 초과 시 truncation 안내 텍스트.
 *   - I7a: self-reference 회피 — 답변 본문 안 mention 된 wiki page 는 backlink list 에서 제외.
 *
 * Test 는 신규 helper export 2종에 의존 (sidebar-chat.ts GREEN 단계 구현 예정):
 *   - collectBacklinks(resolvedLinks, mentioned): pure backlink reverse lookup
 *   - buildBacklinkSection(backlinks): HTML <details> markup string
 */

import { describe, it, expect } from 'vitest'
import { collectBacklinks, buildBacklinkSection } from '../sidebar-chat'

describe('§5.18 Spec 2 — collectBacklinks (resolvedLinks 역방향 lookup)', () => {
  // T8 ↔ Spec 2 Happy (3 backlinks via resolvedLinks)
  it('T8: Happy — 답변에 [[lotus-pms]] mention → 3 backlink page 반환 (resolvedLinks 역방향)', () => {
    // resolvedLinks: source path → target path map → count
    const resolvedLinks: Record<string, Record<string, number>> = {
      'wiki/entities/jeff-smith.md': { 'wiki/entities/lotus-pms.md': 1 },
      'wiki/concepts/pid-loop.md': { 'wiki/entities/lotus-pms.md': 2 },
      'wiki/entities/mary-chen.md': { 'wiki/entities/lotus-pms.md': 1 },
      // unrelated entry
      'wiki/entities/anthropic.md': { 'wiki/entities/claude-code.md': 1 },
    }
    const mentioned = new Set<string>(['wiki/entities/lotus-pms.md'])
    const backlinks = collectBacklinks(resolvedLinks, mentioned)
    expect(backlinks).toHaveLength(3)
    expect(backlinks).toEqual(
      expect.arrayContaining([
        'wiki/entities/jeff-smith.md',
        'wiki/concepts/pid-loop.md',
        'wiki/entities/mary-chen.md',
      ]),
    )
  })

  // T9 ↔ I4 — resolvedLinks 역방향 lookup 정확성 (Obsidian shape)
  it('T9: I4 — resolvedLinks shape (source→{target:count}) 정확 역방향 처리', () => {
    const resolvedLinks: Record<string, Record<string, number>> = {
      'wiki/concepts/a.md': { 'wiki/entities/x.md': 1, 'wiki/entities/y.md': 1 },
      'wiki/concepts/b.md': { 'wiki/entities/x.md': 1 },
    }
    const mentioned = new Set<string>(['wiki/entities/x.md'])
    const backlinks = collectBacklinks(resolvedLinks, mentioned)
    // x 를 ref 하는 source = a, b (count > 0)
    expect(backlinks.sort()).toEqual(['wiki/concepts/a.md', 'wiki/concepts/b.md'])
  })

  // T11 ↔ I6 — zero backlink → 빈 array
  it('T11: I6 — backlink 0 → 빈 array (section 미출력 trigger)', () => {
    const resolvedLinks: Record<string, Record<string, number>> = {
      'wiki/entities/a.md': { 'wiki/entities/b.md': 1 },
    }
    const mentioned = new Set<string>(['wiki/entities/orphan.md'])
    const backlinks = collectBacklinks(resolvedLinks, mentioned)
    expect(backlinks).toEqual([])
  })

  // T13a ↔ I7a — self-reference 회피
  it('T13a (I7a): self-reference 회피 — 답변에 [[A]],[[B]] mention 시 A 는 B 의 backlink list 에서 제외', () => {
    const resolvedLinks: Record<string, Record<string, number>> = {
      'wiki/entities/a.md': { 'wiki/entities/b.md': 1 }, // A → B
      'wiki/entities/c.md': { 'wiki/entities/b.md': 1 }, // C → B (외부, 유지)
    }
    const mentioned = new Set<string>([
      'wiki/entities/a.md',
      'wiki/entities/b.md',
    ])
    const backlinks = collectBacklinks(resolvedLinks, mentioned)
    // A 는 mention 셋에 포함이므로 self-ref 회피 (B 의 backlink 에서 제외)
    expect(backlinks).not.toContain('wiki/entities/a.md')
    expect(backlinks).toContain('wiki/entities/c.md')
  })

  // T14 ↔ Spec 2 I4a (v0.4) — default wiki/ scope filter
  it('T14: I4a default wiki/ scope — raw/ + plan/ + .obsidian/ source 는 backlink 제외', () => {
    const resolvedLinks: Record<string, Record<string, number>> = {
      'wiki/entities/jeff.md': { 'wiki/entities/lotus-pms.md': 1 }, // wiki/ → ✓
      'raw/3_resources/legacy.md': { 'wiki/entities/lotus-pms.md': 1 }, // raw/ → ✗
      'plan/phase-5/phase-5-todo.md': { 'wiki/entities/lotus-pms.md': 1 }, // plan/ → ✗
      '.obsidian/widgets/foo.md': { 'wiki/entities/lotus-pms.md': 1 }, // .obsidian/ → ✗
      'activity/phase-5/note.md': { 'wiki/entities/lotus-pms.md': 1 }, // activity/ → ✗
    }
    const mentioned = new Set<string>(['wiki/entities/lotus-pms.md'])
    const backlinks = collectBacklinks(resolvedLinks, mentioned)
    // default scope='wiki' — wiki/ 하나만
    expect(backlinks).toEqual(['wiki/entities/jeff.md'])
  })

  // T15 ↔ Spec 2 I4a (v0.4) — opt-in vault scope (사용자 결정 2026-05-12)
  it('T15: I4a vault scope opt-in — 모든 source 포함 (raw/sidebar 사용 vault 케이스)', () => {
    const resolvedLinks: Record<string, Record<string, number>> = {
      'wiki/entities/jeff.md': { 'wiki/entities/lotus-pms.md': 1 },
      'raw/3_resources/legacy.md': { 'wiki/entities/lotus-pms.md': 1 },
      'plan/phase-5/phase-5-todo.md': { 'wiki/entities/lotus-pms.md': 1 },
    }
    const mentioned = new Set<string>(['wiki/entities/lotus-pms.md'])
    const backlinks = collectBacklinks(resolvedLinks, mentioned, { scope: 'vault' })
    expect(backlinks).toHaveLength(3)
    expect(backlinks).toEqual(
      expect.arrayContaining([
        'wiki/entities/jeff.md',
        'raw/3_resources/legacy.md',
        'plan/phase-5/phase-5-todo.md',
      ]),
    )
  })
})

describe('§5.18 Spec 2 — buildBacklinkSection (HTML <details> markup)', () => {
  // T10 ↔ I5a — default collapse: <details> 에 open attribute 없음
  it('T10: I5a — default collapse → <details> 태그 + open attribute 없음', () => {
    const markup = buildBacklinkSection([
      'wiki/entities/a.md',
      'wiki/entities/b.md',
      'wiki/entities/c.md',
    ])
    expect(markup).toMatch(/<details>/)
    expect(markup).toMatch(/<summary>참조 페이지/)
    // 'open' attr 검증 — <details ...open...> 형식 출현 X
    expect(markup).not.toMatch(/<details\s+[^>]*\bopen\b/)
  })

  // T10b ↔ I5 — section header = `참조 페이지 (N)`
  it('T10b: I5 — summary 에 backlink count N 표시', () => {
    const markup = buildBacklinkSection([
      'wiki/entities/a.md',
      'wiki/entities/b.md',
      'wiki/entities/c.md',
    ])
    // count = 3 표시
    expect(markup).toMatch(/참조 페이지\s*\(3\)/)
  })

  // T10c ↔ I7 — truncation: 8 backlink → 5 list + 안내 텍스트
  it('T10c: I7 — 8 backlink → 5 list 줄 + "총 8 개" truncation 안내', () => {
    const links = [
      'wiki/entities/a.md',
      'wiki/entities/b.md',
      'wiki/entities/c.md',
      'wiki/entities/d.md',
      'wiki/entities/e.md',
      'wiki/entities/f.md',
      'wiki/entities/g.md',
      'wiki/entities/h.md',
    ]
    const markup = buildBacklinkSection(links)
    // 처음 5 만 wikilink 줄
    expect(markup).toMatch(/\[\[wiki\/entities\/a\.md\]\]/)
    expect(markup).toMatch(/\[\[wiki\/entities\/e\.md\]\]/)
    // 6~8 은 list line 으로 출력 X
    expect(markup).not.toMatch(/\[\[wiki\/entities\/f\.md\]\]/)
    expect(markup).not.toMatch(/\[\[wiki\/entities\/h\.md\]\]/)
    // truncation 안내 텍스트
    expect(markup).toMatch(/총 8\s*개/)
    expect(markup).toMatch(/Obsidian backlink panel/)
  })

  // T11b ↔ I6 — backlink 0 → 빈 string (section 미출력)
  it('T11b: I6 — backlink 0 → buildBacklinkSection 반환 빈 string', () => {
    const markup = buildBacklinkSection([])
    expect(markup).toBe('')
  })
})
