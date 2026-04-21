/**
 * RAG 전처리 — LLM·임베딩 투입 직전 토큰 폭증 차단.
 *
 * docling `--image-export-mode embedded` (기본), unhwp `convert.py`,
 * Obsidian Web Clipper 출력 md 공통으로 적용. 세 가지 이미지 표현을 모두 덮는다:
 *
 *   1. base64 data URI embed: `![alt](data:image/png;base64,...)`
 *   2. 외부 이미지 URL: `![alt](https://.../foo.svg)`
 *   3. alt 가 비어있거나 고정 `"image"` 인 경우 → `[image]` (중복 라벨 축약)
 *      그 외 → `[image: {alt}]`
 *
 * 외부 텍스트 링크 `[텍스트](https://...)` 는 보존 (이미지 확장자만 매칭).
 */

const DATA_URI_IMG = /!\[([^\]]*)\]\(data:[^)]+\)/g

// 외부 이미지 URL — 쿼리 스트링 / 앵커 허용.
// 확장자 기반 매칭으로 텍스트 링크는 건드리지 않는다.
const EXTERNAL_IMG =
  /!\[([^\]]*)\]\((https?:\/\/[^)\s]+?\.(?:svg|png|jpe?g|gif|webp|bmp|tiff?|avif)(?:[?#][^)]*)?)\)/gi

function placeholderFor(alt: string | undefined | null): string {
  const a = (alt ?? '').trim()
  if (!a || a.toLowerCase() === 'image') return '[image]'
  return `[image: ${a}]`
}

/**
 * base64 data URI 이미지 + 외부 이미지 URL 을 `[image]` / `[image: alt]` 로 치환.
 * 일반 텍스트 링크(`[텍스트](https://...)`) 는 보존.
 */
export function stripEmbeddedImages(md: string): string {
  return md
    .replace(DATA_URI_IMG, (_m, alt) => placeholderFor(alt))
    .replace(EXTERNAL_IMG, (_m, alt) => placeholderFor(alt))
}

/** 추출된 이미지 수 — 진단·로그용. */
export function countEmbeddedImages(md: string): { dataUri: number; externalUrl: number } {
  return {
    dataUri: (md.match(DATA_URI_IMG) ?? []).length,
    externalUrl: (md.match(EXTERNAL_IMG) ?? []).length,
  }
}
