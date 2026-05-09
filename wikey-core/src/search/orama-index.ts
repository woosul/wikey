/**
 * §5.7.4 — Orama in-process 인덱스 lifecycle wrapper.
 *
 * 단일 collection 'wikey-wiki'. PoC commands.ts 의 schema / search 호출 동등.
 *
 * Spec: phase-5-spec-5.7.4-orama-migration.md §3.2.
 *
 * Lifecycle:
 *  - createOramaIndex(opts) → restore() (cache 있으면) 또는 빈 db
 *  - ingestAll(wikiDir) → walk *.md + frontmatter parse + insertMultiple
 *  - search(query, { topN }) → SearchResult[]
 *  - persist() → JSON serialize → ~/.cache/wikey/orama/wikey-wiki.json
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  statSync,
  readdirSync,
  renameSync,
  unlinkSync,
} from 'node:fs'
import { dirname, join, relative, basename } from 'node:path'
import {
  create as oramaCreate,
  insertMultiple as oramaInsertMultiple,
  insert as oramaInsert,
  search as oramaSearch,
  load as oramaLoad,
  save as oramaSave,
  count as oramaCount,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type AnyOrama,
} from '@orama/orama'
import type { SearchResult } from '../types.js'
import type { KoreanTokenizerHandle } from './orama-korean-tokenizer.js'

// Re-export production tokenizer handle (single canonical type identity).
export type { KoreanTokenizerHandle }

export interface OramaWikiDoc {
  /** wiki/ 상대 경로 (예: `concepts/orama.md`). */
  readonly id: string
  readonly title: string
  readonly body: string
  /** 768D Qwen3-Embedding (벡터 ingest 시점에서 주입; 본 cycle 안 BM25-only path 우선). */
  readonly embedding?: number[]
}

export interface OramaSearchOptions {
  readonly topN: number
  readonly mode?: 'fulltext' | 'hybrid'
}

export interface OramaIngestResult {
  readonly docCount: number
  readonly ms: number
}

export interface OramaPersistOptions {
  /** §5.7.5 LOW #14 — abort signal: aborted 시 final write skip + tmp cleanup. */
  readonly signal?: AbortSignal
}

export interface OramaIndexHandle {
  /** BM25 단일 또는 hybrid (벡터 포함) search. */
  search(question: string, opts: OramaSearchOptions): Promise<readonly SearchResult[]>
  /**
   * §5.7.5 LOW #14 — atomic persist via tmp + rename (POSIX atomic) +
   * abort signal honored before each fs side-effect.
   */
  persist(opts?: OramaPersistOptions): Promise<void>
  /** 인덱스 파일 로드 (없으면 빈 인덱스 — 신규 사용자). */
  restore(): Promise<void>
  /** 모든 wiki/*.md 를 frontmatter 파싱 + insertMultiple. */
  ingestAll(wikiDir: string): Promise<OramaIngestResult>
  /** §5.7.4 AC-V1 — 768D vector 직접 upsert (hybrid mode 사전 검증용). */
  upsertWithEmbedding(doc: OramaWikiDoc): Promise<boolean>
  /**
   * §5.7.4 codex cycle #1 MED-4 fix — index 문서 수 직접 조회. query path 의 empty
   * detection 이 임의 search term 대신 본 method 호출 (zero-cost lookup).
   */
  docCount(): Promise<number>
}

export interface OramaIndexFactoryOptions {
  /** 인덱스 영속 cache 파일 경로 (예: `~/.cache/wikey/orama/wikey-wiki.json`). */
  readonly cachePath: string
  /** Korean tokenizer (production: createKoreanTokenizer; test: mock). */
  readonly tokenizer: KoreanTokenizerHandle
}

interface FrontmatterAndBody {
  readonly title: string
  readonly body: string
}

/**
 * Strip YAML frontmatter (`---\n...\n---\n`) from raw markdown body.
 * Returns body sans frontmatter + extracted title (default = filename basename).
 */
function parseFrontmatter(raw: string, fallbackTitle: string): FrontmatterAndBody {
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!fmMatch) return { title: fallbackTitle, body: raw }
  const yaml = fmMatch[1]
  let title = fallbackTitle
  const titleMatch = yaml.match(/^title:\s*(.+)$/m)
  if (titleMatch) {
    title = titleMatch[1].trim().replace(/^["'](.*)["']$/u, '$1')
  }
  return { title, body: fmMatch[2] }
}

/** Recursive walk for *.md files. */
function* walkMarkdownFiles(dir: string): Generator<string> {
  let entries: import('node:fs').Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true }) as unknown as import('node:fs').Dirent[]
  } catch {
    return
  }
  for (const entry of entries) {
    const name: string = String(entry.name)
    const full = join(dir, name)
    if (entry.isDirectory()) yield* walkMarkdownFiles(full)
    else if (entry.isFile() && name.endsWith('.md')) yield full
  }
}

function buildSnippet(body: string, maxLen = 240): string {
  const cleaned = body.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= maxLen) return cleaned
  return cleaned.slice(0, maxLen) + '…'
}

/** Convert Orama hit → SearchResult (path = `wiki/<rel>`, snippet from body). */
function hitToSearchResult(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hit: any,
): SearchResult {
  // hit.document or hit.doc depending on Orama version. v3 = `hit.document`.
  const doc = hit.document ?? hit.doc ?? {}
  const id: string = doc.id ?? hit.id ?? ''
  const body: string = doc.body ?? ''
  const path = id.startsWith('wiki/') ? id : `wiki/${id}`
  return {
    path,
    score: typeof hit.score === 'number' ? hit.score : 0,
    snippet: buildSnippet(body),
  }
}

/**
 * §5.7.4 — Orama 인덱스 factory.
 */
export async function createOramaIndex(
  opts: OramaIndexFactoryOptions,
): Promise<OramaIndexHandle> {
  const tokenizer = opts.tokenizer

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buildDb = async (): Promise<any> => {
    return oramaCreate({
      schema: {
        id: 'string',
        title: 'string',
        body: 'string',
        embedding: 'vector[768]',
      },
      components: {
        tokenizer: {
          language: 'korean',
          normalizationCache: new Map(),
          tokenize: (text: string) => tokenizer.tokenize(text),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      },
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any = await buildDb()

  return {
    async search(question, searchOpts) {
      const r = await oramaSearch(db, {
        term: question,
        properties: ['title', 'body'],
        limit: searchOpts.topN,
      })
      const hits = r.hits ?? []
      return hits.map(hitToSearchResult)
    },

    async persist(persistOpts?: OramaPersistOptions) {
      // §5.7.5 LOW #14 — atomic write: serialize → tmp → renameSync (POSIX atomic).
      // signal aborted 시 tmp 잔존 X (cleanup) + final write skip.
      const signal = persistOpts?.signal
      if (signal?.aborted) return
      const data = await oramaSave(db)
      if (signal?.aborted) return
      mkdirSync(dirname(opts.cachePath), { recursive: true })
      const tmpPath = `${opts.cachePath}.tmp`
      try {
        writeFileSync(tmpPath, JSON.stringify(data), 'utf-8')
        if (signal?.aborted) {
          // Cleanup tmp if abort raced after write but before rename.
          try { unlinkSync(tmpPath) } catch { /* ignore */ }
          return
        }
        renameSync(tmpPath, opts.cachePath)
      } catch (err) {
        try { if (existsSync(tmpPath)) unlinkSync(tmpPath) } catch { /* ignore */ }
        throw err
      }
    },

    async restore() {
      if (!existsSync(opts.cachePath)) return
      try {
        const stat = statSync(opts.cachePath)
        if (stat.size === 0) return
        const json = readFileSync(opts.cachePath, 'utf-8')
        const parsed = JSON.parse(json)
        db = await buildDb()
        await oramaLoad(db, parsed)
      } catch (err) {
        // Corrupt cache — re-build empty db. Log to console for debug.
        // eslint-disable-next-line no-console
        console.warn('[wikey] Orama cache restore failed, rebuilding empty:', err)
        db = await buildDb()
      }
    },

    async ingestAll(wikiDir) {
      const t0 = Date.now()
      const docs: OramaWikiDoc[] = []
      for (const full of walkMarkdownFiles(wikiDir)) {
        const rel = relative(wikiDir, full).split('\\').join('/')
        const raw = readFileSync(full, 'utf-8')
        const { title, body } = parseFrontmatter(raw, basename(full, '.md'))
        docs.push({ id: rel, title, body })
      }
      // Re-create db before bulk insert (idempotent ingest — clears prior index).
      db = await buildDb()
      if (docs.length > 0) {
        await oramaInsertMultiple(db, docs)
      }
      const ms = Date.now() - t0
      return { docCount: docs.length, ms }
    },

    async upsertWithEmbedding(doc) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inputDoc: any = { ...doc }
      // Orama expects Float32Array-like for vector; arrays accepted in v3.
      await oramaInsert(db, inputDoc)
      return true
    },

    async docCount() {
      const n = await oramaCount(db)
      return typeof n === 'number' ? n : 0
    },
  }
}
