/**
 * 변환 결과 영속 캐시 (Phase 4.1.1.4 + §4.1.1.8)
 *
 * PDF/HWP/DOCX → Markdown 변환은 비용이 큼 (docling 수초~수십초, Vision OCR 수분+$).
 * 같은 파일+옵션은 재변환 없이 재사용. 키는 `sha256(원본바이트) + converter tier
 * + major options` 로 정의하여 옵션 차이도 구분.
 *
 * 저장 경로: ~/.cache/wikey/convert/<hash>.md
 * 인덱스:   ~/.cache/wikey/convert/index.json  (관찰성·cleanup용)
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, unlinkSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const DEFAULT_TTL_DAYS = 30

function cacheDir(): string {
  const dir = join(homedir(), '.cache', 'wikey', 'convert')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function indexPath(): string {
  return join(cacheDir(), 'index.json')
}

function loadIndex(): Record<string, CacheIndexEntry> {
  try {
    return JSON.parse(readFileSync(indexPath(), 'utf-8'))
  } catch {
    return {}
  }
}

function saveIndex(idx: Record<string, CacheIndexEntry>): void {
  try {
    writeFileSync(indexPath(), JSON.stringify(idx, null, 2))
  } catch (err) {
    console.warn(`[Wikey convert-cache] index save failed: ${err}`)
  }
}

export interface CacheIndexEntry {
  readonly source: string       // 원본 파일 경로 (관찰성 용도, 실제 키는 아님)
  readonly converter: string    // 'docling' | 'unhwp' | 'markitdown' | …
  readonly writtenAt: number    // epoch ms
  readonly bytes: number        // 캐시 파일 크기
}

export interface CacheKeyInput {
  readonly sourceBytes: Buffer
  readonly converter: string               // tier 식별자
  readonly majorOptions?: Record<string, unknown>
}

/**
 * 캐시 키 계산 — sha256(sourceBytes) + converter + JSON.stringify(sortedOptions).
 */
export function computeCacheKey(input: CacheKeyInput): string {
  const h = createHash('sha256')
  h.update(input.sourceBytes)
  h.update('|')
  h.update(input.converter)
  if (input.majorOptions) {
    const sorted = Object.keys(input.majorOptions).sort()
    for (const k of sorted) {
      h.update(`|${k}=${JSON.stringify(input.majorOptions[k])}`)
    }
  }
  return h.digest('hex')
}

function keyToPath(key: string): string {
  return join(cacheDir(), `${key}.md`)
}

/**
 * Phase 5 §5.10.1.9 AC-C1.7: cache file 의 새 schema.
 *   - 변환 결과 markdown (`content`) + 선택적 sidecar 후보 (`sidecarCandidate`).
 *   - vector PDF 면 sidecarCandidate 가 raw (이미지 포함) 으로 stripped 와 distinct.
 *   - scan PDF / 비-PDF 면 sidecarCandidate 가 content 와 동일 또는 omit.
 */
export interface CachedConversion {
  readonly content: string
  readonly sidecarCandidate?: string
}

/**
 * 캐시 조회 — TTL 만료된 항목은 null 반환 + 파일 삭제.
 *
 * Phase 5 §5.10.1.9 AC-C1.7: return type `string` → `CachedConversion`.
 * Backward compat: legacy file (string only, JSON.parse 실패) 은 `{ content: rawString,
 * sidecarCandidate: rawString }` 으로 폴백 — 기존 cache 자동 호환.
 */
export function getCached(key: string, ttlDays = DEFAULT_TTL_DAYS): CachedConversion | null {
  const p = keyToPath(key)
  if (!existsSync(p)) return null
  try {
    const st = statSync(p)
    const ageMs = Date.now() - st.mtimeMs
    if (ageMs > ttlDays * 24 * 3600 * 1000) {
      try { unlinkSync(p) } catch { /* ignore */ }
      return null
    }
    const raw = readFileSync(p, 'utf-8')
    // Try new JSON schema first.
    if (raw.startsWith('{')) {
      try {
        const parsed = JSON.parse(raw) as Partial<CachedConversion>
        if (typeof parsed.content === 'string') {
          return {
            content: parsed.content,
            sidecarCandidate: typeof parsed.sidecarCandidate === 'string' ? parsed.sidecarCandidate : undefined,
          }
        }
      } catch {
        // fallthrough to legacy fallback
      }
    }
    // Legacy string file (Phase 4 schema) — fallback. sidecarCandidate = rawString
    // (caller 가 vector PDF 면 결함 b 가 발생; 새 cache write 후 자연 회복).
    return { content: raw, sidecarCandidate: raw }
  } catch {
    return null
  }
}

/**
 * 캐시 저장 — index 도 함께 갱신.
 *
 * Phase 5 §5.10.1.9 AC-C1.7: meta 에 `sidecarCandidate` 추가. PDF vector 의 raw
 * 이미지 보존 (결함 b fix). cache file = JSON `{ content, sidecarCandidate? }`.
 */
export function setCached(
  key: string,
  content: string,
  meta: { readonly source: string; readonly converter: string; readonly sidecarCandidate?: string },
): void {
  const p = keyToPath(key)
  const payload: CachedConversion = meta.sidecarCandidate !== undefined
    ? { content, sidecarCandidate: meta.sidecarCandidate }
    : { content }
  const serialized = JSON.stringify(payload)
  try {
    writeFileSync(p, serialized)
    const idx = loadIndex()
    idx[key] = {
      source: meta.source,
      converter: meta.converter,
      writtenAt: Date.now(),
      bytes: Buffer.byteLength(serialized, 'utf-8'),
    }
    saveIndex(idx)
  } catch (err) {
    console.warn(`[Wikey convert-cache] setCached failed: ${err}`)
  }
}

/**
 * 캐시 무효화 — 특정 key 삭제.
 */
export function invalidate(key: string): boolean {
  const p = keyToPath(key)
  let removed = false
  try { unlinkSync(p); removed = true } catch { /* missing is OK */ }
  try {
    const idx = loadIndex()
    if (idx[key]) { delete idx[key]; saveIndex(idx) }
  } catch { /* ignore */ }
  return removed
}

/**
 * 전체 캐시 정리 — 만료된 항목 + orphan 파일 제거.
 * 반환: 제거된 파일 수.
 */
export function cleanup(ttlDays = DEFAULT_TTL_DAYS): number {
  let removed = 0
  const now = Date.now()
  const idx = loadIndex()
  for (const key of Object.keys(idx)) {
    const entry = idx[key]
    if (now - entry.writtenAt > ttlDays * 24 * 3600 * 1000) {
      if (invalidate(key)) removed++
    }
  }
  // orphan 파일 (index 에 없지만 디스크에 존재)
  try {
    const files = readdirSync(cacheDir())
    for (const f of files) {
      if (!f.endsWith('.md')) continue
      const key = f.replace(/\.md$/, '')
      if (!idx[key]) {
        try { unlinkSync(join(cacheDir(), f)); removed++ } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
  return removed
}

/**
 * 통계 — 항목 수 + 총 바이트.
 */
export function stats(): { count: number; totalBytes: number } {
  const idx = loadIndex()
  const entries = Object.values(idx)
  return {
    count: entries.length,
    totalBytes: entries.reduce((s, e) => s + e.bytes, 0),
  }
}
