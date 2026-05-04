// Phase 5 §5.10.1 — Pure conversion entry.
//
// `convertSourceToMarkdown` 은 5 분기 (PDF / HWP/HWPX / DOCX-Docling / PPTX-Docling /
// md/txt) 를 통합한 단일 변환 entry. 보조 plan §10.4 (line 401~437) + §10.5 AC-C1.1
// 의 spec 따름.
//
// 책임 (pure):
//   - sourcePath + ext → ConversionResult { content, sidecarCandidate, ext, converter }
//   - cache layer 통합 (~/.cache/wikey/convert/, vault 외부 ephemeral, 30일 TTL)
//
// 비책임 (절대 호출 X):
//   - vault write (raw/, wiki/, .wikey/ 변경 0)
//   - PII gate (sanitize / redact)
//   - sidecar 저장 (canonical / .new[.N])
//   - registry diff / source-registry update
//
// 위 책임은 ingest-pipeline.ts 의 ingest() 내부 (decideReingest 후) 에 그대로 잔존.
import {
  DOCLING_DOC_FORMATS,
  extractHwpText,
  extractDocumentText,
  extractPdfText,
  doclingMajorOptions,
} from './ingest-pipeline.js'
import { stripEmbeddedImages } from './rag-preprocess.js'
import { computeCacheKey, getCached } from './convert-cache.js'
import type { WikiFS, WikeyConfig } from './types.js'

/**
 * Pure conversion 결과 — `convertSourceToMarkdown` 가 반환.
 *
 *   - `content`: LLM 투입용 markdown (PDF stripped 동등; embedded images 제거됨)
 *   - `sidecarCandidate`: 파일시스템 sidecar 후보. PDF 만 raw vs stripped 분기 (vector PDF 면
 *     raw 이미지 보존). 다른 포맷은 content 자체. md/txt 는 null (sidecar write 대상이 아님).
 *   - `ext`: 원본 확장자 (소문자)
 *   - `converter`: 변환 tier 식별자 (`'pdf:1-docling'`, `'unhwp'`, `'docling-doc'`, `'plain'`)
 */
export interface ConversionResult {
  readonly content: string
  readonly sidecarCandidate: string | null
  readonly ext: string
  readonly converter: string
}

export interface ConvertOpts {
  readonly basePath?: string
  readonly execEnv?: Record<string, string>
  readonly config?: WikeyConfig
  /** md/txt 분기에서 wikiFS.read 로 vault 안 source 읽기. 다른 분기는 fs 직접 read. */
  readonly wikiFS?: WikiFS
}

/**
 * 5 분기 단일 변환 entry. ingest-pipeline.ts:357~375 의 분기 코드와 generateBrief 의
 * extract* 호출이 *모두 이 함수 1 곳* 으로 통합된다.
 *
 * cache hit 시 외부 process (docling/unhwp/python) 호출 0 — vault write 0 자연 보장.
 * cache miss 시 helper (extractPdfText / extractHwpText / extractDocumentText) 가 cache write.
 *
 * @throws when sourcePath 가 vault 안에서 read 실패 (md/txt) 또는 ext 가 미지원.
 */
export async function convertSourceToMarkdown(
  sourcePath: string,
  ext: string,
  opts?: ConvertOpts,
): Promise<ConversionResult> {
  const lower = (ext ?? '').toLowerCase()
  const { basePath, execEnv, config, wikiFS } = opts ?? {}

  if (lower === 'md' || lower === 'txt') {
    if (!wikiFS) {
      throw new Error(`convertSourceToMarkdown: wikiFS required for ext=${lower}`)
    }
    const raw = await wikiFS.read(sourcePath)
    return {
      content: stripEmbeddedImages(raw),
      sidecarCandidate: null,
      ext: lower,
      converter: 'plain',
    }
  }

  if (lower === 'hwp' || lower === 'hwpx') {
    const content = await extractHwpText(sourcePath, basePath, execEnv)
    if (!content || content.trim().length < 1) {
      throw new Error(`HWP/HWPX extraction returned empty: ${sourcePath}`)
    }
    return {
      content,
      sidecarCandidate: content,
      ext: lower,
      converter: 'unhwp',
    }
  }

  if (lower === 'pdf') {
    const result = await extractPdfText(sourcePath, basePath, execEnv, config)
    const cached = readPdfCacheTier(sourcePath, basePath, config)
    return {
      content: result.stripped,
      sidecarCandidate: result.sidecarCandidate,
      ext: lower,
      converter: cached ?? 'pdf:1-docling',
    }
  }

  if (DOCLING_DOC_FORMATS.has(lower)) {
    const content = await extractDocumentText(sourcePath, basePath, execEnv, config)
    if (!content || content.trim().length < 1) {
      throw new Error(`Document extraction returned empty: ${sourcePath}`)
    }
    return {
      content,
      sidecarCandidate: content,
      ext: lower,
      converter: 'docling-doc',
    }
  }

  throw new Error(`convertSourceToMarkdown: unsupported ext '${lower}' for ${sourcePath}`)
}

/**
 * PDF cache 의 어느 tier 가 hit 했는지 식별 (관찰성 — converter 필드 채움).
 * cache file 자체는 extractPdfText 안 finalize() 에서 tierKey 별로 set 된다.
 * 가장 흔한 tier 1-docling 만 우선 조회 — 다른 tier 는 default 'pdf:1-docling' 표기.
 */
function readPdfCacheTier(
  sourcePath: string,
  basePath: string | undefined,
  config: WikeyConfig | undefined,
): string | null {
  const fs = require('node:fs') as typeof import('node:fs')
  const path = require('node:path') as typeof import('node:path')
  try {
    const cwd = basePath ?? process.cwd()
    const sourceBytes = fs.readFileSync(path.join(cwd, sourcePath))
    const key = computeCacheKey({
      sourceBytes,
      converter: 'pdf:1-docling',
      majorOptions: doclingMajorOptions(config),
    })
    // Phase 5 §5.10.1.9 AC-C1.7: getCached return type → CachedConversion | null
    return getCached(key) !== null ? 'pdf:1-docling' : null
  } catch {
    return null
  }
}
