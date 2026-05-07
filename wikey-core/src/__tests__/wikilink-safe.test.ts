import { describe, it, expect } from 'vitest'
import {
  sanitizeWikilinkTarget,
  needsWikilinkSanitize,
} from '../wikilink-safe.js'

describe('sanitizeWikilinkTarget — §5.16 whitelist 기반', () => {
  describe('Obsidian wikilink reserved chars (현재 알려진 6 종)', () => {
    it("`|` (alias 구분자) → `-`", () => {
      expect(sanitizeWikilinkTarget('AI 기반 | finetree-OCR.md')).toBe(
        'AI 기반 - finetree-OCR.md',
      )
    })

    it('`[` `]` (link wrapper) → `-`', () => {
      // `[v2]` → `-v2-` 후 `[\s-]+` 그룹 정규화:
      //   `파일 -` (space + dash, mixed) → ` - ` 으로 ` 파일 - `
      //   `v2`
      //   `-.md` 의 `-`: 단일 hyphen (no space) → 보존 → `v2-.md`
      //   (단일 `-` 는 ASCII separator 로 valid — 정책 §2)
      expect(sanitizeWikilinkTarget('파일 [v2].md')).toBe('파일 - v2-.md')
    })

    it('`#` (heading anchor) → `-`', () => {
      expect(sanitizeWikilinkTarget('chapter#1.md')).toBe('chapter-1.md')
    })

    it('`^` (block id) → `-`', () => {
      expect(sanitizeWikilinkTarget('note^abc.md')).toBe('note-abc.md')
    })

    it('`\\` (escape) → `-`', () => {
      expect(sanitizeWikilinkTarget('path\\to.md')).toBe('path-to.md')
    })
  })

  describe('Filesystem reserved + Unicode 특수문자 (whitelist 차단 cover)', () => {
    it('`*` `?` `:` `<` `>` `"` 자동 normalize (filesystem reserved)', () => {
      expect(sanitizeWikilinkTarget('a*b?c:d<e>f"g.md')).toBe('a-b-c-d-e-f-g.md')
    })

    it('Unicode 특수문자 `※` `「」` `…` 자동 normalize (whitelist 외)', () => {
      expect(sanitizeWikilinkTarget('주의 ※ 「제목」 … 끝.md')).toBe(
        '주의 - 제목 - 끝.md',
      )
    })

    it('이모지 자동 normalize', () => {
      expect(sanitizeWikilinkTarget('done ✅ test.md')).toBe('done - test.md')
    })

    it('미래 Obsidian syntax 확장 (가설 — `@` `&` 등 추가 reserved 도입 시 자동 cover)', () => {
      // 현재 whitelist 외 → 모두 `-` (사용자 통찰 — blacklist 라면 매번 수동 추가 필요)
      expect(sanitizeWikilinkTarget('user@host&query.md')).toBe(
        'user-host-query.md',
      )
    })
  })

  describe('Whitelist allow 영역 — 회귀 0 (no-op)', () => {
    it('ASCII alphanumeric + 안전 구두점 보존', () => {
      const safe = "ALPHA-num_test.v2 (final) 'name'!~end.md"
      expect(sanitizeWikilinkTarget(safe)).toBe(safe)
    })

    it('한글 음절 + 자모 보존', () => {
      expect(sanitizeWikilinkTarget('한글-파일명.md')).toBe('한글-파일명.md')
    })

    it('일본어 히라가나·가타카나 보존', () => {
      expect(sanitizeWikilinkTarget('ひらがな-カタカナ.md')).toBe(
        'ひらがな-カタカナ.md',
      )
    })

    it('CJK 한자 보존', () => {
      expect(sanitizeWikilinkTarget('項目-名前.md')).toBe('項目-名前.md')
    })

    it('mixed 다국어 보존', () => {
      expect(sanitizeWikilinkTarget('한국어 mixed 日本語.md')).toBe(
        '한국어 mixed 日本語.md',
      )
    })

    it('공백 보존 (내부 single space)', () => {
      expect(sanitizeWikilinkTarget('two word file.md')).toBe('two word file.md')
    })

    it('이미 wikilink-safe → no-op', () => {
      expect(sanitizeWikilinkTarget('pmbok-overview.md')).toBe('pmbok-overview.md')
    })
  })

  describe('연속 `-` 압축 + 양 끝 trim', () => {
    it('연속 `-` 압축 → 단일 `-`', () => {
      expect(sanitizeWikilinkTarget('a||||b.md')).toBe('a-b.md')
    })

    it('양 끝 `-` / whitespace trim', () => {
      expect(sanitizeWikilinkTarget('  ※ start ※  ')).toBe('start')
    })

    it('finetree 실제 케이스 (사용자 raise)', () => {
      expect(
        sanitizeWikilinkTarget(
          'AI 기반 다채널 비정형 문서의 데이터화  |  finetree-OCR.md',
        ),
      ).toBe('AI 기반 다채널 비정형 문서의 데이터화 - finetree-OCR.md')
    })
  })
})

describe('needsWikilinkSanitize', () => {
  it('safe filename → false', () => {
    expect(needsWikilinkSanitize('pmbok-overview.md')).toBe(false)
    expect(needsWikilinkSanitize('한글-파일.md')).toBe(false)
  })

  it('unsafe filename → true', () => {
    expect(needsWikilinkSanitize('AI | finetree.md')).toBe(true)
    expect(needsWikilinkSanitize('주의 ※ 끝.md')).toBe(true)
  })

  it('finetree 실제 케이스 → true', () => {
    expect(
      needsWikilinkSanitize('AI 기반 ...  |  finetree-OCR.md'),
    ).toBe(true)
  })
})
