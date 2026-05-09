/**
 * §5.7.4 — Orama 인덱스 module-scope singleton + helpers.
 *
 * Plugin onload 시 1회 restore 후 query-pipeline.execOramaSearch 가 본 singleton 의
 * search() 호출. Test 에서는 resetOramaIndexForTest() 로 reset 가능.
 *
 * Spec: phase-5-spec-5.7.4-orama-migration.md §3.4 (singleton 보존).
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import { statSync } from 'node:fs'
import {
  createOramaIndex,
  type OramaIndexHandle,
  type KoreanTokenizerHandle,
} from './orama-index.js'

let cached: OramaIndexHandle | null = null
// §5.7.4 codex cycle #5 MED-13 fix — cross-process invalidation key.
// 별 process (./scripts/reindex.sh CLI) 가 같은 cache 파일을 rewrite 시 in-process query 가
// stale handle 을 반환하던 회귀 회피. mtime + size 둘 다 비교 — same-second reset 도 detect.
let cachedKey: { cachePath: string; mtimeMs: number; size: number } | null = null

function statCacheKey(cachePath: string): { mtimeMs: number; size: number } {
  try {
    const s = statSync(cachePath)
    return { mtimeMs: s.mtimeMs, size: s.size }
  } catch {
    return { mtimeMs: 0, size: 0 }
  }
}

export function defaultOramaCachePath(): string {
  return join(homedir(), '.cache', 'wikey', 'orama', 'wikey-wiki.json')
}

export interface OramaSingletonOptions {
  readonly cachePath?: string
  readonly tokenizer: KoreanTokenizerHandle
}

/**
 * Singleton accessor. cache miss 또는 cache 파일 mtime/size 변경 detect 시
 * createOramaIndex + restore() 호출 후 새 handle 으로 교체.
 */
export async function getOramaIndex(
  opts: OramaSingletonOptions,
): Promise<OramaIndexHandle> {
  const cp = opts.cachePath ?? defaultOramaCachePath()
  const cur = statCacheKey(cp)
  if (
    cached &&
    cachedKey &&
    cachedKey.cachePath === cp &&
    cachedKey.mtimeMs === cur.mtimeMs &&
    cachedKey.size === cur.size
  ) {
    return cached
  }
  const handle = await createOramaIndex({
    cachePath: cp,
    tokenizer: opts.tokenizer,
  })
  await handle.restore()
  cached = handle
  cachedKey = { cachePath: cp, ...cur }
  return handle
}

/** Test/reset hook — clear singleton. */
export function resetOramaIndexForTest(): void {
  cached = null
  cachedKey = null
}

/**
 * §5.7.4 codex cycle #2 LOW-9 fix — production reset/dispose hook. plugin onunload 시 호출
 * 의무 — singleton handle 의 tokenizer closure 가 closed tokenizer 를 reference 하면
 * stale handle 회귀. 본 호출은 cache 만 clear (handle 자체는 GC 대상으로 release).
 */
export function disposeOramaIndex(): void {
  cached = null
  cachedKey = null
}
