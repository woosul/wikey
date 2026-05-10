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
import type { QueryIntentFilter, FilterDecision } from './query-intent-filter.js'
import type { QueryRewriter, RewriteDecision } from './query-rewriter.js'
import type { QueryExpander, ExpandDecision } from './query-expander.js'
import type { VaultQueryHint } from '../config/vault-query-config.js'
import { EMBEDDING_DIM } from '../embeddings/embedding-config.js'
import { rrfFuse } from './rrf-fusion.js'

/** §5.7.7 Spec 1 — query / ingest embedder (text → 1024D Float32Array). */
export type EmbedderFn = (text: string) => Promise<Float32Array>

// Re-export production tokenizer handle (single canonical type identity).
export type { KoreanTokenizerHandle }

export interface OramaWikiDoc {
  /** wiki/ 상대 경로 (예: `concepts/orama.md`). */
  readonly id: string
  readonly title: string
  readonly body: string
  /** 1024D Qwen3-Embedding (§5.7.7 Inew dimension lock — `EMBEDDING_DIM` constant). */
  readonly embedding?: number[]
}

export interface OramaSearchOptions {
  readonly topN: number
  readonly mode?: 'fulltext' | 'hybrid'
  /**
   * §5.7.7 cycle #2 codex HIGH #1 fix — caller-supplied RRF k override. mode='hybrid'
   * 일 때 사용. 미지정 시 factory option `rrfK` (default 60). settings UI customizable
   * (Spec invariant I12 — k externalized).
   */
  readonly rrfK?: number
  /**
   * §5.7.8 Spec 2 — optional query intent filter wrapper. When omitted the search call
   * runs through the legacy code path (Spec invariant I7 — backward compat).
   */
  readonly filter?: QueryIntentFilter
  /** §5.7.8 Spec 5 — optional rewriter (synonym substitution). Requires filter. */
  readonly rewriter?: QueryRewriter
  /** §5.7.8 Spec 5 — optional expander (HyDE / multi-query). Independent of rewriter. */
  readonly expander?: QueryExpander
  /** §5.7.8 Spec 6 — vault-supplied hint forwarded to the filter. */
  readonly vaultHint?: VaultQueryHint
}

/**
 * §5.7.8 — `SearchResult` returned from `OramaIndexHandle.search` may carry the per-layer
 * decisions for UI metadata (search-result panel keep/drop badges). The base
 * `SearchResult` shape is preserved; new fields are optional.
 */
export interface SearchResultWithMetadata extends SearchResult {
  readonly filterDecision?: FilterDecision
  readonly rewriteDecision?: RewriteDecision
  readonly expandDecision?: ExpandDecision
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
  /** §5.7.7 — 1024D vector 직접 upsert. body 미지정 시 embedder 가 `${title}\n\n${body}` 호출 (Q4). */
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
  /**
   * §5.7.7 Spec 2 — optional Qwen3-Embedding query/ingest embedder. When present:
   *  - ingestAll() pre-computes embeddings for every doc (Q4 — `${title}\n\n${body}`).
   *  - search({ mode: 'hybrid' }) runs BM25 + vector concurrently and fuses via RRF.
   * Absent → BM25-only path preserved (Spec I6 backward compat).
   */
  readonly embedder?: EmbedderFn
  /** §5.7.7 — RRF k constant (default 60, Q3 LOCKED). */
  readonly rrfK?: number
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
 * §5.7.8 — query layer pipeline result. Returned by {@link runQueryLayers} and consumed by
 * {@link attachLayerMetadata}. Keeping the intermediate state in one shape lets the search
 * call read like a small saga rather than three nested try blocks.
 */
interface QueryLayerPipeline {
  readonly effectiveQuery: string
  readonly multiQueries: readonly string[]
  readonly filterDecision?: FilterDecision
  readonly rewriteDecision?: RewriteDecision
  readonly expandDecision?: ExpandDecision
}

/**
 * Run the optional filter → rewrite → expand chain. Each layer is fail-open: any throw
 * is logged + the upstream query is preserved (Spec invariants I1 / I8 / I23).
 */
async function runQueryLayers(
  question: string,
  searchOpts: OramaSearchOptions,
): Promise<QueryLayerPipeline> {
  let effectiveQuery = question
  let filterDecision: FilterDecision | undefined
  let rewriteDecision: RewriteDecision | undefined
  let expandDecision: ExpandDecision | undefined
  let multiQueries: string[] = []

  if (searchOpts.filter) {
    try {
      filterDecision = await searchOpts.filter.filter(question, searchOpts.vaultHint)
      if (filterDecision.filtered.length > 0) {
        effectiveQuery = filterDecision.filtered.join(' ')
      }
    } catch (err) {
      console.warn('[orama-index] filter layer failed, falling back to original query:', err)
    }
  }

  if (searchOpts.rewriter && filterDecision) {
    try {
      rewriteDecision = await searchOpts.rewriter.rewrite(filterDecision.filtered, question)
      if (rewriteDecision.fallback === 'none' && rewriteDecision.rewrittenQuery) {
        effectiveQuery = rewriteDecision.rewrittenQuery
      }
    } catch (err) {
      console.warn('[orama-index] rewrite layer failed, keeping filtered query:', err)
    }
  }

  if (searchOpts.expander) {
    try {
      const upstreamTokens = filterDecision?.filtered ?? question.split(/\s+/u)
      expandDecision = await searchOpts.expander.expand(upstreamTokens, question)
      if (expandDecision.multiQueries) {
        multiQueries = [...expandDecision.multiQueries]
      }
    } catch (err) {
      console.warn('[orama-index] expand layer failed, keeping upstream query:', err)
    }
  }

  return { effectiveQuery, multiQueries, filterDecision, rewriteDecision, expandDecision }
}

/** Deduplicate the union of `[effectiveQuery, ...multiQueries]` while preserving order. */
function uniqueQueries(effectiveQuery: string, multiQueries: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const q of [effectiveQuery, ...multiQueries]) {
    if (!q) continue
    if (seen.has(q)) continue
    seen.add(q)
    out.push(q)
  }
  return out
}

/** Attach decision metadata only when at least one layer was active (legacy shape preserved). */
function attachLayerMetadata(
  ordered: readonly SearchResult[],
  pipeline: QueryLayerPipeline,
): readonly SearchResult[] {
  if (!pipeline.filterDecision && !pipeline.rewriteDecision && !pipeline.expandDecision) {
    return ordered
  }
  return ordered.map((r) => Object.assign({}, r, {
    filterDecision: pipeline.filterDecision,
    rewriteDecision: pipeline.rewriteDecision,
    expandDecision: pipeline.expandDecision,
  }))
}

/**
 * §5.7.4 — Orama 인덱스 factory.
 */
export async function createOramaIndex(
  opts: OramaIndexFactoryOptions,
): Promise<OramaIndexHandle> {
  const tokenizer = opts.tokenizer
  const embedder = opts.embedder
  const rrfK = opts.rrfK ?? 60

  // §5.7.7 Inew (dimension lock) — Orama schema string literal must be `vector[N]`.
  // EMBEDDING_DIM imported from embeddings/embedding-config.ts (single source).
  const VECTOR_FIELD = `vector[${EMBEDDING_DIM}]` as `vector[${number}]`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buildDb = async (): Promise<any> => {
    return oramaCreate({
      schema: {
        id: 'string',
        title: 'string',
        body: 'string',
        embedding: VECTOR_FIELD,
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
      // §5.7.8 — optional 3-layer wrapper (filter → rewrite → expand). Each layer is
      // fail-open; absence of all layers preserves the legacy single-query BM25 path.
      const pipeline = await runQueryLayers(question, searchOpts)
      // Spec invariant I22 (Finding 7 fix) — when the expand layer is active, the raw
      // user question must remain in the BM25 union: expand *augments*, never *replaces*.
      // When only filter/rewrite ran, the effective query already represents intent and
      // injecting the noisy original would dilute scores, so we keep the legacy shape.
      const queries = pipeline.expandDecision
        ? uniqueQueries(question, [pipeline.effectiveQuery, ...pipeline.multiQueries])
        : uniqueQueries(pipeline.effectiveQuery, pipeline.multiQueries)

      // BM25 union (multi-query) — same shape across fulltext + hybrid.
      const seen = new Map<string, ReturnType<typeof hitToSearchResult>>()
      for (const q of queries) {
        const r = await oramaSearch(db, {
          term: q,
          properties: ['title', 'body'],
          limit: searchOpts.topN,
        })
        for (const hit of r.hits ?? []) {
          const sr = hitToSearchResult(hit)
          // Multi-query union: keep the highest score per path.
          const prev = seen.get(sr.path)
          if (!prev || sr.score > prev.score) seen.set(sr.path, sr)
        }
      }
      const bm25Ordered = Array.from(seen.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, searchOpts.topN)

      // §5.7.7 Spec 2 — hybrid path. Vector single embed source = `effectiveQuery` only
      // (Spec 1.2 Inputs Finding 2 v1.1: multi-queries → BM25 union 전용). I7 fail-open:
      // embedder throw → BM25-only fallback + console warn.
      const effectiveRrfK = searchOpts.rrfK ?? rrfK
      if (searchOpts.mode === 'hybrid' && embedder) {
        let queryVec: Float32Array | undefined
        try {
          queryVec = await embedder(pipeline.effectiveQuery)
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[orama-index] hybrid query embed failed, falling back to BM25-only:', err)
          return attachLayerMetadata(bm25Ordered, pipeline)
        }
        if (!queryVec || queryVec.length !== EMBEDDING_DIM) {
          // eslint-disable-next-line no-console
          console.warn('[orama-index] hybrid query vector dim mismatch — BM25-only fallback')
          return attachLayerMetadata(bm25Ordered, pipeline)
        }
        let vectorOrdered: SearchResult[] = []
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const vRes: any = await oramaSearch(db, {
            mode: 'vector',
            vector: { value: Array.from(queryVec), property: 'embedding' },
            similarity: 0,
            limit: searchOpts.topN,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any)
          for (const hit of vRes.hits ?? []) vectorOrdered.push(hitToSearchResult(hit))
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[orama-index] vector search threw, falling back to BM25-only:', err)
          vectorOrdered = []
        }
        const fused = rrfFuse(bm25Ordered, vectorOrdered, {
          k: effectiveRrfK,
          topN: searchOpts.topN,
        })
        return attachLayerMetadata(fused, pipeline)
      }

      return attachLayerMetadata(bm25Ordered, pipeline)
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
      // Walk + frontmatter parse first (cheap, sync).
      const docs: OramaWikiDoc[] = []
      for (const full of walkMarkdownFiles(wikiDir)) {
        const rel = relative(wikiDir, full).split('\\').join('/')
        const raw = readFileSync(full, 'utf-8')
        const { title, body } = parseFrontmatter(raw, basename(full, '.md'))
        docs.push({ id: rel, title, body })
      }
      // §5.7.7 Spec 2 I9 — embedder 가 있으면 page-level embedding pre-compute.
      // Q4 LOCKED v1.1: source text = `${title}\n\n${body}` union (BM25 source mirror,
      // frontmatter 미포함 — PII surface 회피, markdown H1 패턴).
      // I10 dim consistency — dim ≠ EMBEDDING_DIM 시 해당 page hybrid skip + BM25 정상
      // insert (페이지별 fail-open). embedder throw → 동일.
      const embeddedDocs: OramaWikiDoc[] = []
      if (embedder) {
        for (const d of docs) {
          const sourceText = `${d.title}\n\n${d.body}`
          try {
            const vec = await embedder(sourceText)
            if (vec && vec.length === EMBEDDING_DIM) {
              embeddedDocs.push({ ...d, embedding: Array.from(vec) })
            } else {
              // eslint-disable-next-line no-console
              console.warn(
                `[orama-index] page ${d.id} embedding dim mismatch (got ${vec?.length ?? 'undefined'}) — hybrid skip, BM25-only`,
              )
              embeddedDocs.push(d)
            }
          } catch (err) {
            // eslint-disable-next-line no-console
            console.warn(`[orama-index] page ${d.id} embed failed — hybrid skip, BM25-only:`, err)
            embeddedDocs.push(d)
          }
        }
      } else {
        embeddedDocs.push(...docs)
      }
      // Re-create db before bulk insert (idempotent ingest — clears prior index).
      db = await buildDb()
      if (embeddedDocs.length > 0) {
        await oramaInsertMultiple(db, embeddedDocs)
      }
      const ms = Date.now() - t0
      return { docCount: embeddedDocs.length, ms }
    },

    async upsertWithEmbedding(doc) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inputDoc: any = { ...doc }
      // §5.7.7 Spec 2 I9 — embedding 미지정 + embedder 가 있으면 자동 생성 (Q4 union source).
      if (!inputDoc.embedding && embedder) {
        const sourceText = `${doc.title}\n\n${doc.body}`
        try {
          const vec = await embedder(sourceText)
          if (vec && vec.length === EMBEDDING_DIM) {
            inputDoc.embedding = Array.from(vec)
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn(`[orama-index] upsert ${doc.id} embed failed — BM25-only insert:`, err)
        }
      }
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
