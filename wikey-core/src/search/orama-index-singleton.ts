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
  type EmbedderFn,
} from './orama-index.js'

let cached: OramaIndexHandle | null = null
// §5.7.4 codex cycle #5 MED-13 fix — cross-process invalidation key.
// 별 process (./scripts/reindex.sh CLI) 가 같은 cache 파일을 rewrite 시 in-process query 가
// stale handle 을 반환하던 회귀 회피. mtime + size 둘 다 비교 — same-second reset 도 detect.
//
// §5.7.7 cycle #3 codex HIGH #1 fix — embedder identity 도 invalidation key 의 일부.
// BM25 first query 후 사용자가 Settings 에서 Hybrid ON 하면 caller (query-pipeline) 가
// embedder 를 새로 주입. 이전 cached handle 은 embedder closure 가 없어 mode='hybrid' inert.
// §5.7.7 cycle #4 codex HIGH #1 fix — boolean (presence) 만 비교 시 ollamaUrl 변경 감지
// 못하던 hole. caller 가 stable string key 전달 — `qwen3:${ollamaUrl}` 패턴.
// 미주입 ('') = BM25-only path.
let cachedKey: {
  cachePath: string
  mtimeMs: number
  size: number
  embedderKey: string
} | null = null

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
  /**
   * §5.7.7 cycle #2 codex HIGH #1 fix — hybrid wiring. embedder 주입 시 search() 의
   * `mode: 'hybrid'` path 활성. embedder 미주입 → 기존 BM25-only path (I6 backward compat).
   * Plugin onload 1회 inject (lazy createQwen3Loader 후 () => loader.embed(text, {signal}) 형태).
   */
  readonly embedder?: EmbedderFn
  /**
   * §5.7.7 cycle #4 codex HIGH #1 fix — stable string key for invalidation.
   * caller 가 backend identity 결정 (예: `qwen3:${ollamaUrl}`). 미지정 + embedder 있음
   * 시 default key = 'embedder' (legacy). embedder 없으면 빈 문자열 ''.
   */
  readonly embedderKey?: string
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
  const embedderKey = opts.embedderKey ?? (opts.embedder ? 'embedder' : '')
  if (
    cached &&
    cachedKey &&
    cachedKey.cachePath === cp &&
    cachedKey.mtimeMs === cur.mtimeMs &&
    cachedKey.size === cur.size &&
    cachedKey.embedderKey === embedderKey
  ) {
    return cached
  }
  const handle = await createOramaIndex({
    cachePath: cp,
    tokenizer: opts.tokenizer,
    embedder: opts.embedder,
  })
  await handle.restore()
  cached = handle
  cachedKey = { cachePath: cp, ...cur, embedderKey }
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
