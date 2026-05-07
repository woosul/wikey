/**
 * Wikilink-safe filename normalization (§5.16 follow-up — whitelist 정책).
 *
 * 사용자 통찰 (2026-05-07): "특정한 캐릭터를 정의하면, 앞으로도 계속 비슷한 에러가
 * 나오겠지...?" — blacklist (지금까지 알려진 reserved char 만 명시) 방식은 새 unicode
 * 특수문자 / 향후 Obsidian syntax 확장 시 같은 패턴 반복. 본 모듈은 **whitelist** 방식
 * — wikilink-safe character set 만 allow, 그 외 (현재 known + 미래 unknown) 모두 `-`
 * 로 normalize.
 *
 * Whitelist 정의:
 *   - ASCII alphanumeric (`a-z`, `A-Z`, `0-9`)
 *   - 한글 음절 + 자모 (`가-힣`, `ㄱ-ㅎ`, `ㅏ-ㅣ`)
 *   - 일본어 히라가나·가타카나·CJK 확장 (`ぁ-ヿ`)
 *   - 한자 (CJK Unified Ideographs 기본 + 확장 A) (`一-龯`, `㐀-䶿`)
 *   - 안전 ASCII 구두점: `-` `_` `.` `(` `)` `'` `!` `~` space
 *   - 그 외 모두 `-` 로 변환 (wikilink syntax 안전 보장)
 *
 * 본 whitelist 는 **filename 만** 대상. path separator (`/`) 는 caller 책임 (별도
 * argument 로 path 컴포넌트 분리 후 본 함수 적용).
 *
 * 정규화 정책 (multi-pass):
 *   1. Whitelist 외 char → `-`
 *   2. `[\s-]+` 그룹 정규화:
 *      - 순수 공백만 (no `-`) → 단일 space
 *      - 순수 `-` 만 (no space) → 단일 `-` (정상 hyphen-joined word — `finetree-OCR`,
 *        `a||||b` → `a-b` 도 동일 분류)
 *      - mixed (space + `-`) → ` - ` (사용자 기대 — `주의 - 제목 - 끝`)
 *   3. 양 끝 `-` / whitespace trim
 *
 * 주요 차단 대상 (자동 normalize):
 *   - Obsidian wikilink syntax: `|` `[` `]` `#` `^` `\`
 *   - Filesystem reserved (참고): `*` `?` `:` `<` `>` `"`
 *   - Unicode 특수문자: `※` `「」` `『』` `…` `·` `•` etc.
 *   - 이모지 / 향후 Obsidian syntax 확장 (자동 cover — whitelist 라 list 업데이트 불필요)
 *
 * Reference: https://help.obsidian.md/Linking+notes+and+files/Internal+links
 */

/**
 * Wikilink target 으로 *직접 사용 가능* 한 character set (whitelist) — group 본문.
 * `RegExp` 생성 시 `g` flag 와 함께 사용 (replace) 또는 flag 없이 (test) 분리.
 */
const WIKILINK_UNSAFE_GROUP =
  "[^a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣぁ-ヿ一-龯㐀-䶿\\-_.()'!~ ]"

/**
 * Filename 을 wikilink-safe 형태로 normalize.
 *
 * @example
 *   sanitizeWikilinkTarget('AI 기반  |  finetree-OCR.md')
 *     → 'AI 기반 - finetree-OCR.md'  (multi-space + `|` → ` - `, hyphen 보존)
 *   sanitizeWikilinkTarget('주의 ※ 「제목」 끝.md')
 *     → '주의 - 제목 - 끝.md'        (Unicode 특수문자 → `-`, 양쪽 공백 정규화)
 *   sanitizeWikilinkTarget('pmbok-overview.md')
 *     → 'pmbok-overview.md'         (no-op — 이미 whitelist 안)
 */
export function sanitizeWikilinkTarget(filename: string): string {
  // (1) Whitelist 외 char → `-`
  let s = filename.replace(new RegExp(WIKILINK_UNSAFE_GROUP, 'g'), '-')
  // (2) [\s-]+ 그룹 정규화
  s = s.replace(/[\s-]+/g, (m) => {
    const hasDash = m.includes('-')
    const hasSpace = /\s/.test(m)
    if (!hasDash) return ' ' // pure space → single space
    if (!hasSpace) return '-' // pure dashes → single dash (`finetree-OCR`, `a----b`)
    return ' - ' // mixed → ` - ` (사용자 기대)
  })
  // (3) 양 끝 trim — `-` / whitespace
  s = s.replace(/^[-\s]+|[-\s]+$/g, '')
  return s
}

/**
 * Filename 에 wikilink-unsafe character 가 있는지 검사. caller 가 vault rename
 * 필요 여부 결정 시 사용. `g` flag stateful 회피 위해 별도 regex.
 */
export function needsWikilinkSanitize(filename: string): boolean {
  return new RegExp(WIKILINK_UNSAFE_GROUP).test(filename)
}
