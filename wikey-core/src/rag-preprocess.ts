/**
 * RAG 전처리 — LLM·임베딩 투입 직전 토큰 폭증 차단.
 *
 * docling `--image-export-mode embedded` (기본), unhwp `convert.py`,
 * Obsidian Web Clipper 출력 md 공통으로 적용. 다음 표현을 모두 덮는다:
 *
 *   1. base64 data URI embed: `![alt](data:image/png;base64,...)`
 *   2. 외부 이미지 URL: `![alt](https://.../foo.svg)`
 *   3. inline SVG block: `<svg ... alt="..."><path/>...</svg>` (§5.16)
 *   4. inline HTML img/picture/iframe/canvas: `<img alt="..." src="..."/>` 등 (§5.16 확장)
 *
 *   alt 가 비어있거나 고정 `"image"` 인 경우 → `[image]` (중복 라벨 축약)
 *   그 외 → `[image: {alt}]`
 *
 * 외부 텍스트 링크 `[텍스트](https://...)` 는 보존 (이미지 확장자만 매칭).
 * 다른 HTML 태그 (`<div>`, `<span>` 등) 는 보존 — 본 모듈은 *이미지/미디어 임베드* 만 대상.
 */

const DATA_URI_IMG = /!\[([^\]]*)\]\(data:[^)]+\)/g

// 외부 이미지 URL — 쿼리 스트링 / 앵커 허용.
// 확장자 기반 매칭으로 텍스트 링크는 건드리지 않는다.
const EXTERNAL_IMG =
  /!\[([^\]]*)\]\((https?:\/\/[^)\s]+?\.(?:svg|png|jpe?g|gif|webp|bmp|tiff?|avif)(?:[?#][^)]*)?)\)/gi

// §5.16: inline SVG block (multiline). open tag attributes 자유, body 임의.
//   매칭: `<svg ...>...</svg>`. self-closing `<svg/>` 도 cover (보기 드물지만 안전).
//   alt 추출은 별도 — open tag attribute 안 alt="..." 또는 alt='...' (첫 매칭).
const INLINE_SVG = /<svg\b[^>]*(?:\/>|>[\s\S]*?<\/svg>)/gi

// §5.16 확장: inline HTML img/picture/iframe/canvas/video/audio + embed/object.
//   self-closing 또는 closing tag 양식 모두 cover. tag name 직후 lookahead 로
//   `<img-icon>` 같은 custom element false positive 차단 (regex word boundary `\b` 는
//   hyphen 을 word break 로 인식 — `<img\b` 이 `<img-icon` 도 매치하므로 명시 lookahead).
const INLINE_HTML_MEDIA = /<(img|picture|iframe|canvas|video|audio|embed|object)(?=[\s/>])[^>]*(?:\/>|>(?:[\s\S]*?<\/\1>)?)/gi

const ALT_ATTR = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/i

function placeholderFor(alt: string | undefined | null): string {
  const a = (alt ?? '').trim()
  if (!a || a.toLowerCase() === 'image') return '[image]'
  return `[image: ${a}]`
}

/** §5.16: HTML tag 본문에서 alt 속성 추출 (없으면 null). */
function extractAlt(tag: string): string | null {
  const m = tag.match(ALT_ATTR)
  return m ? (m[1] ?? m[2] ?? '') : null
}

/**
 * base64 data URI 이미지 + 외부 이미지 URL + inline SVG/HTML media 을
 * `[image]` / `[image: alt]` 로 치환. 일반 텍스트 링크는 보존.
 */
export function stripEmbeddedImages(md: string): string {
  return md
    .replace(DATA_URI_IMG, (_m, alt) => placeholderFor(alt))
    .replace(EXTERNAL_IMG, (_m, alt) => placeholderFor(alt))
    .replace(INLINE_SVG, (m) => placeholderFor(extractAlt(m)))
    .replace(INLINE_HTML_MEDIA, (m) => placeholderFor(extractAlt(m)))
}

/** 추출된 이미지 수 — 진단·로그용. */
export function countEmbeddedImages(md: string): {
  dataUri: number
  externalUrl: number
  inlineSvg: number
  inlineHtmlMedia: number
} {
  return {
    dataUri: (md.match(DATA_URI_IMG) ?? []).length,
    externalUrl: (md.match(EXTERNAL_IMG) ?? []).length,
    inlineSvg: (md.match(INLINE_SVG) ?? []).length,
    inlineHtmlMedia: (md.match(INLINE_HTML_MEDIA) ?? []).length,
  }
}
