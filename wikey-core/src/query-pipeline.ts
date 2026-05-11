import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { join as pathJoin } from 'node:path'
import type { Citation, HttpClient, QueryResult, SearchResult, WikiFS, WikeyConfig } from './types.js'
import { LLMClient } from './llm-client.js'
import { resolveProvider, getSearchTopN } from './config.js'
import { PROVIDER_CHAT_DEFAULTS } from './provider-defaults.js'
import { resolveSource } from './source-resolver.js'
import { loadRegistry } from './source-registry.js'
import {
  getOramaIndex,
  defaultOramaCachePath,
} from './search/orama-index-singleton.js'
import type { KoreanTokenizerHandle, EmbedderFn } from './search/orama-index.js'
import { createQwen3Loader, type Qwen3Loader } from './embeddings/qwen3-loader.js'
import type { QueryIntentFilter } from './search/query-intent-filter.js'
import type { QueryRewriter } from './search/query-rewriter.js'
import type { QueryExpander } from './search/query-expander.js'
import type { VaultQueryHint } from './config/vault-query-config.js'

const execFileAsync = promisify(execFile)

const QMD_COLLECTION = 'wikey-wiki'

// §5.7.7 cycle #2 — module-scope cached Qwen3 loader. createQwen3Loader 자체는 lazy
// connect (factory call 시 endpoint 미호출, 첫 embed() 호출 시 1회 health check).
// OLLAMA_URL 변경 시 reset 필요 — 현재 single-user 가정으로 process lifetime 내 1 URL.
let cachedQwen3Loader: Qwen3Loader | null = null
let cachedQwen3Url: string | null = null

function getQwen3Embedder(ollamaUrl?: string): EmbedderFn {
  const url = ollamaUrl ?? 'http://localhost:11434'
  if (!cachedQwen3Loader || cachedQwen3Url !== url) {
    cachedQwen3Loader = createQwen3Loader({ ollamaUrl: url })
    cachedQwen3Url = url
  }
  const loader = cachedQwen3Loader
  // I3 graceful disconnect: loader.embed returns undefined when ollama unavailable.
  // EmbedderFn signature requires Float32Array (non-undefined) — caller (orama-index)
  // wraps in try/catch + fail-open. We throw on undefined to trigger that path.
  return async (text: string) => {
    const vec = await loader.embed(text)
    if (!vec) throw new Error('Qwen3 embed unavailable (ollama disconnected)')
    return vec
  }
}

/** §5.7.7 cycle #2 — test/reset hook. */
export function resetQwen3EmbedderForTest(): void {
  cachedQwen3Loader = null
  cachedQwen3Url = null
}

export interface QueryOptions {
  readonly basePath?: string
  readonly wikiFS?: WikiFS
  /** 로그인 셸에서 탐지된 환경변수 (PATH 포함) */
  readonly execEnv?: Record<string, string>
  /** 탐지된 node 바이너리 경로 */
  readonly nodePath?: string
  /**
   * §5.3 follow-up — 답변 끝 "원본:" footer 표시 모드.
   *   - 'raw' (default) : 입력 원본 (vault_path) — pdf 면 pdf, md 면 md
   *   - 'sidecar'       : `<vault_path>.md` derive — paired 면 sidecar, 단독 md 면 자체
   *   - 'hidden'        : "원본:" footer 출력 안 함
   */
  readonly originalLinkMode?: OriginalLinkMode
  /**
   * §5.7.4 — Orama 인덱스 cache 파일 override (test 또는 사용자 환경).
   *  default = `~/.cache/wikey/orama/wikey-wiki.json`.
   */
  readonly oramaCachePath?: string
  /**
   * §5.7.4 — Korean tokenizer override (test 환경에서 mock 주입). production 은 plugin
   * onload 시 createKoreanTokenizer + 본 옵션 forward.
   */
  readonly tokenizerOverride?: KoreanTokenizerHandle
  /**
   * §5.7.8 Spec 2 — optional query intent filter. When present, the Orama search call
   * runs the LLM-driven token role classifier before BM25. Absent → legacy path
   * (Spec invariant I7 backward compat).
   */
  readonly filter?: QueryIntentFilter
  /** §5.7.8 Spec 5 — optional rewriter (synonym substitution). Requires `filter`. */
  readonly rewriter?: QueryRewriter
  /** §5.7.8 Spec 5 — optional expander (HyDE / multi-query). Independent of rewriter. */
  readonly expander?: QueryExpander
  /** §5.7.8 Spec 6 — vault-supplied hint forwarded to the filter LLM. */
  readonly vaultHint?: VaultQueryHint
}

export async function query(
  question: string,
  config: WikeyConfig,
  httpClient: HttpClient,
  opts?: QueryOptions,
): Promise<QueryResult> {
  const basePath = opts?.basePath ?? process.cwd()
  const execEnv = opts?.execEnv ?? (process.env as Record<string, string>)

  // §5.7.4 — engine 판정 최상단. orama (default) 시 qmd 탐색 skip — qmd 부재 환경에서도 동작.
  const engine: 'orama' | 'qmd' = config.WIKEY_SEARCH_ENGINE ?? 'orama'

  let searchResults: readonly SearchResult[]
  if (engine === 'qmd') {
    // 회귀 path — 기존 qmd 탐색 + execQmdSearchLegacy.
    let qmdBin: string
    let qmdIsJs = false
    try {
      const result = findQmdBin(config, basePath)
      qmdBin = result.bin
      qmdIsJs = result.isJs
    } catch (err: any) {
      throw new Error(`[Step 1/4 qmd 탐색] ${err?.message ?? err}`)
    }
    try {
      searchResults = await execQmdSearchLegacy(
        qmdBin, qmdIsJs, question, config, basePath, execEnv, opts?.nodePath, httpClient,
      )
    } catch (err: any) {
      throw new Error(`[Step 2/4 qmd 검색] ${err?.message ?? err}`)
    }
  } else {
    // engine === 'orama' — in-process Orama 검색 (default post-§5.7.4).
    try {
      searchResults = await execOramaSearch(question, config, basePath, opts, httpClient)
    } catch (err: any) {
      throw new Error(`[Step 2/4 Orama 검색] ${err?.message ?? err}`)
    }
  }

  // Step 3: LLM call
  const { provider, model } = resolveProvider('default', config)
  const llm = new LLMClient(httpClient, config)

  if (searchResults.length === 0) {
    try {
      const directAnswer = await llm.call(
        `당신은 wikey 위키 어시스턴트입니다. 위키 검색 결과가 없었습니다.\n\n질문: ${question}\n\n위키에 관련 내용이 없다면 솔직히 말하고, 일반적인 질문이면 간단히 답변하세요.`,
        { provider, model },
      )
      return { answer: directAnswer, sources: [] }
    } catch (err: any) {
      throw new Error(`[Step 3/4 LLM 호출 (fallback)] provider=${provider} model=${model}\n${err?.message ?? err}`)
    }
  }

  // Step 3b: Build context
  let context: string
  try {
    context = opts?.wikiFS
      ? await buildContextWithWikiFS(searchResults, opts.wikiFS)
      : buildContextFromFS(searchResults, basePath)
  } catch (err: any) {
    throw new Error(`[Step 3/4 컨텍스트 구성] ${err?.message ?? err}`)
  }

  // Step 4: LLM synthesis
  try {
    const prompt = buildSynthesisPrompt(context, question)
    const rawAnswer = await llm.call(prompt, { provider, model })
    const citations = opts?.wikiFS
      ? await collectCitationsWithWikiFS(searchResults, opts.wikiFS)
      : collectCitationsFromFS(searchResults, basePath)
    // Phase 4 D.0.h (v6 §4.5.2): citation 기반 원본 링크 자동 append.
    // wikiFS 없으면 LLM prompt 가 이미 출처 지시하므로 answer 그대로 반환.
    const answer = opts?.wikiFS
      ? await appendOriginalLinks(rawAnswer, citations, {
          wikiFS: opts.wikiFS,
          mode: opts.originalLinkMode,
        })
      : rawAnswer
    return { answer, sources: searchResults, citations }
  } catch (err: any) {
    throw new Error(`[Step 4/4 LLM 합성] provider=${provider} model=${model}\n${err?.message ?? err}`)
  }
}

/**
 * §4.3.2 Part B — page frontmatter 에서 provenance refs 를 추출하여 Citation 배열 생성.
 * 결과 순서는 searchResults 와 동일 (score desc). provenance 없는 페이지는 skip.
 * public export — bash CLI / tests / 다른 pipeline 에서도 재사용.
 */
export async function collectCitationsWithWikiFS(
  results: readonly SearchResult[],
  wikiFS: WikiFS,
): Promise<readonly Citation[]> {
  const out: Citation[] = []
  for (const r of results) {
    try {
      const content = await wikiFS.read(r.path)
      const citation = buildCitationFromContent(r, content)
      if (citation) out.push(citation)
    } catch {
      // Missing page — skip citation entry; `sources` array already includes the hit.
    }
  }
  return out
}

export function collectCitationsFromFS(
  results: readonly SearchResult[],
  basePath: string,
): readonly Citation[] {
  const { readFileSync } = require('node:fs') as typeof import('node:fs')
  const { join } = require('node:path') as typeof import('node:path')
  const out: Citation[] = []
  for (const r of results) {
    try {
      const content = readFileSync(join(basePath, r.path), 'utf-8') as string
      const citation = buildCitationFromContent(r, content)
      if (citation) out.push(citation)
    } catch {
      // skip
    }
  }
  return out
}

// ── Phase 4 D.0.h (v6 §4.5.2) — citation 기반 원본 링크 자동 append ──

/**
 * 원본 표시 모드 (사용자 설정).
 *   - 'raw'     : 입력 원본 (pdf 면 pdf, md 면 md). 기본값. registry.vault_path.
 *   - 'sidecar' : sidecar 파일 규칙 derive — `<vault_path>.md` (단, vault_path 가
 *                 이미 .md 면 그대로). 즉 paired pdf/hwp/... 면 `.md` sidecar,
 *                 단독 md 면 자체. registry sidecar_vault_path 필드 의존 X
 *                 (legacy record 도 동일 규칙으로 derive).
 *   - 'hidden'  : "원본:" footer 자체 출력 안 함.
 */
export type OriginalLinkMode = 'raw' | 'sidecar' | 'hidden'

export interface AppendOriginalLinksOptions {
  readonly wikiFS: WikiFS
  readonly vaultName?: string
  /** Default 'raw' — 기존 동작 유지 (backwards compat). */
  readonly mode?: OriginalLinkMode
}

/**
 * Derive sidecar path from raw vault_path using the `<vault_path>.md` rule.
 * 단독 md/txt 는 vault_path 자체 반환 (sidecar 미생성 정책과 정합).
 */
function deriveSidecarPath(vaultPath: string): string {
  const lower = vaultPath.toLowerCase()
  if (lower.endsWith('.md') || lower.endsWith('.txt')) return vaultPath
  return `${vaultPath}.md`
}

/**
 * Display name = basename without final extension.
 *   raw/2_areas/foo.pdf      → foo
 *   raw/3_resources/note.md  → note
 *   raw/.../doc.pdf.md       → doc.pdf  (sidecar 도 raw basename 기준이 더 직관적이지만,
 *                                         alias display 는 link target 의 basename 사용)
 */
function basenameWithoutExt(path: string): string {
  const filename = path.split('/').pop() ?? path
  const dotIdx = filename.lastIndexOf('.')
  if (dotIdx <= 0) return filename
  return filename.slice(0, dotIdx)
}

/**
 * LLM 답변 (`answer`) 끝에 citation 에서 해석한 원본 파일 wikilink 를 추가한다.
 *
 * - mode='hidden': footer 미출력 (answer 그대로 trimEnd 만)
 * - citation 0개: `원본: (없음 — 외부 근거 없음)` (fail closed)
 * - citation 있지만 resolve 전부 실패: `원본: (해석 실패 — registry 점검 필요)`
 * - 일부 resolve 성공: `원본: [[<path>|<display>]], ...`
 *   • mode='raw'     → record.vault_path
 *   • mode='sidecar' → deriveSidecarPath(record.vault_path) — `<vault_path>.md`
 *     (단독 md 면 vault_path 자체)
 *   • display = `basenameWithoutExt(rawVaultPath)` — *raw 파일명 basename* (한국어 보존
 *     §5.15.D vault rename 적용 후. wiki/sources/source-* 의 영문 slug 이 아닌, 사용자
 *     vault 안 raw 파일의 실제 파일명 그대로). frontmatter title 은 LLM 이 추출한 부제일
 *     수 있어 *원문 제목* 으로 부적절하므로 raw basename 만 사용 (사용자 raise 2026-05-07).
 *
 * rawVaultPath 는 current vault_path 우선, fallback 으로 path_history 마지막 유효 entry.
 * 둘 다 없으면 resolve 실패로 간주.
 */
/**
 * §5.18 Spec 1 I2 — extension badge dynamic derive (hardcoded mapping 0건).
 * 마지막 '.' 위치가 마지막 '/' 또는 '\\' 보다 뒤일 때만 ext 인정 (path/.dotfile 회피).
 * 빈 ext → 'file' fallback. lowercase 일관 매칭.
 */
function deriveExtBadge(vaultPath: string): string {
  const dotIdx = vaultPath.lastIndexOf('.')
  const slashIdx = Math.max(vaultPath.lastIndexOf('/'), vaultPath.lastIndexOf('\\'))
  const ext = dotIdx > slashIdx && dotIdx >= 0 ? vaultPath.slice(dotIdx + 1).toLowerCase() : ''
  return ext || 'file'
}

export async function appendOriginalLinks(
  answer: string,
  citations: readonly Citation[],
  opts: AppendOriginalLinksOptions,
): Promise<string> {
  const trimmed = answer.trimEnd()
  const mode: OriginalLinkMode = opts.mode ?? 'raw'
  if (mode === 'hidden') {
    return trimmed
  }
  if (citations.length === 0) {
    return `${trimmed}\n\n원본: (없음 — 외부 근거 없음)`
  }
  const registry = await loadRegistry(opts.wikiFS).catch(() => ({}))
  const links: string[] = []
  const seen = new Set<string>()
  for (const citation of citations) {
    for (const sourceId of citation.sourceIds) {
      try {
        const resolved = await resolveSource(opts.wikiFS, sourceId, {
          vaultName: opts.vaultName ?? '',
          registry,
        })
        if (!resolved || !resolved.rawVaultPath) {
          // §5.18 Spec 3 I8 — registry mismatch WARN log (sensitive content X).
          // 포함: sourceId raw form + wiki page path. 제외: raw vault path, 답변 본문, query.
          console.warn(
            `[wikey citation] sourceId=${sourceId} not found in registry (page=${citation.wikiPagePath})`,
          )
          continue
        }
        const target =
          mode === 'sidecar' ? deriveSidecarPath(resolved.rawVaultPath) : resolved.rawVaultPath
        if (seen.has(target)) continue
        seen.add(target)
        // display = raw 파일명 basename (한국어 보존, §5.15.D vault rename 후).
        const display = basenameWithoutExt(resolved.rawVaultPath)
        const badge = deriveExtBadge(resolved.rawVaultPath)
        links.push(`- [[${target}|${display}]] (${badge})`)
      } catch {
        // single citation resolve 실패는 건너뜀 — 전체가 실패해야 fallback 발화.
      }
    }
  }
  if (links.length === 0) {
    return `${trimmed}\n\n원본: (해석 실패 — registry 점검 필요)`
  }
  // §5.18 Spec 1 I3 — 답변 본문 ≤ 1줄 공백 후 `원본:` heading + 줄바꿈 list.
  return `${trimmed}\n\n원본:\n${links.join('\n')}`
}

/** Extract provenance refs from a single page's frontmatter. Public for unit testing. */
export function buildCitationFromContent(result: SearchResult, content: string): Citation | null {
  const refs = extractProvenanceRefs(content)
  if (refs.length === 0) return null
  const sourceIds: string[] = []
  const seen = new Set<string>()
  for (const ref of refs) {
    const id = ref.startsWith('sources/') ? ref.slice('sources/'.length) : ref
    if (!id) continue
    if (seen.has(id)) continue
    seen.add(id)
    sourceIds.push(id)
  }
  if (sourceIds.length === 0) return null
  return {
    wikiPagePath: result.path,
    sourceIds,
    excerpt: result.snippet || undefined,
  }
}

/**
 * Regex-driven provenance extractor. Covers the block scalar form emitted by
 * wiki-ops::injectProvenance (`provenance:` → list of `- type:` items with
 * indented `ref:` fields). Ignores unrelated frontmatter keys.
 *
 * Accepts both standard (`ref: sources/...`) and quoted (`ref: "sources/..."`) forms.
 */
function extractProvenanceRefs(content: string): readonly string[] {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!fmMatch) return []
  const yaml = fmMatch[1]
  const lines = yaml.split('\n')
  const out: string[] = []
  let inProvenance = false
  for (const raw of lines) {
    if (/^provenance\s*:/.test(raw)) { inProvenance = true; continue }
    if (!inProvenance) continue
    // Top-level key breaks out of the block
    if (/^[A-Za-z0-9_]+\s*:/.test(raw)) { inProvenance = false; continue }
    const refMatch = raw.match(/^\s+ref\s*:\s*(.+?)\s*$/)
    if (refMatch) {
      const rawVal = refMatch[1].replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
      if (rawVal) out.push(rawVal)
    }
  }
  return out
}

async function execQmdSearchLegacy(
  qmdBin: string,
  isJs: boolean,
  question: string,
  config: WikeyConfig,
  basePath: string,
  execEnv: Record<string, string>,
  nodePath?: string,
  httpClient?: HttpClient,
): Promise<readonly SearchResult[]> {
  const topN = String(getSearchTopN(config))

  const koreanQuery = await tryKoreanPreprocess(question, basePath, execEnv)

  // Cross-lingual: 한국어 질문이면 영문 키워드도 추출.
  // §5.2.9: qmd 의 vec/hyde query parser 가 `-` prefix 를 negation 으로 해석 →
  // hyphenated 단어 (예: `NanoVNA-V2`) 가 query parse 단계에서 reject 됨
  // ("Negation (-term) is not supported in vec/hyde queries"). vec line 에 한해
  // hyphen → space 치환으로 negation 오인 차단. lex 는 negation 정상 지원이라 보존.
  const vecQuestion = question.replace(/-/g, ' ')
  const queryLines: string[] = [`lex: ${koreanQuery}`, `vec: ${vecQuestion}`]

  if (containsKorean(question) && httpClient) {
    const englishKeywords = await extractEnglishKeywords(question, config, httpClient)
    if (englishKeywords) {
      queryLines.push(`lex: ${englishKeywords}`)
      console.log('[Wikey] cross-lingual lex added:', englishKeywords)
    }
  }

  const multiQuery = queryLines.join('\n')

  // qmd.js를 시스템 node로 직접 실행 (Electron node ABI 불일치 방지)
  const cmd = isJs ? (nodePath || 'node') : qmdBin
  const args = isJs
    ? [qmdBin, 'query', multiQuery, '--json', '-n', topN, '-c', QMD_COLLECTION]
    : ['query', multiQuery, '--json', '-n', topN, '-c', QMD_COLLECTION]

  try {
    console.log('[Wikey] qmd exec:', cmd, isJs ? '(node+js)' : '(bin)', 'cwd:', basePath)
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      cwd: basePath,
      timeout: 30000,
      env: execEnv,
    })
    console.log('[Wikey] qmd stdout length:', stdout.length, 'results parsing...')
    if (stderr) console.log('[Wikey] qmd stderr:', stderr.slice(0, 300))
    const results = parseQmdOutput(stdout)
    console.log('[Wikey] qmd results:', results.length)
    return results
  } catch (err: any) {
    const msg = err?.stderr ?? err?.message ?? String(err)
    console.error('[Wikey] qmd exec FAILED:', msg.slice(0, 500))
    return []
  }
}

/**
 * §5.7.4 — Orama in-process 검색 entry. execQmdSearchLegacy 와 동등한 한국어 preprocess
 * + cross-lingual extraction (Ollama 영문 keyword) 보존. qmd subprocess 호출만 Orama
 * search() 로 교체.
 *
 * Spec: phase-5-spec-5.7.4-orama-migration.md §3.4.
 */
export async function execOramaSearch(
  question: string,
  config: WikeyConfig,
  basePath: string,
  opts: QueryOptions | undefined,
  httpClient: HttpClient,
): Promise<readonly SearchResult[]> {
  const topN = getSearchTopN(config)

  // Cross-lingual extraction — 한국어 질문이면 Ollama 영문 keyword 추출 (qmd path 와 동일).
  let englishKeywords = ''
  if (containsKorean(question)) {
    englishKeywords = await extractEnglishKeywords(question, config, httpClient)
    if (englishKeywords) {
      // eslint-disable-next-line no-console
      console.log('[Wikey] cross-lingual lex added (orama):', englishKeywords)
    }
  }

  // Compose search term: original question + English keywords (Orama BM25 union).
  // qmd 의 multi-line `lex:` / `vec:` 는 Orama 의 단일 term 으로 통합.
  const term = englishKeywords ? `${question} ${englishKeywords}` : question

  // Resolve tokenizer + index handle (singleton).
  const tokenizer = opts?.tokenizerOverride
  if (!tokenizer) {
    // production 환경에서는 plugin 진입점이 createKoreanTokenizer 를 주입해야 한다.
    // 본 fallback 은 test / 회귀 시 의미없는 검색 회피용.
    // eslint-disable-next-line no-console
    console.warn('[Wikey] execOramaSearch: tokenizer not provided — returning empty results')
    return []
  }
  // §5.7.7 cycle #2 codex HIGH #1 fix — hybrid wiring. WIKEY_HYBRID_MODE=on 시 lazy
  // module-scope cached Qwen3 embedder 주입 (I17 lazy load). I7 fail-open: embedder
  // throw → BM25-only fallback (orama-index.ts internal). I3 graceful disconnect:
  // ollama 미동작 → embedder return undefined → fallback.
  const hybridOn = config.WIKEY_HYBRID_MODE === 'on'
  const rrfK = config.WIKEY_RRF_K ?? 60
  const ollamaUrl = config.OLLAMA_URL ?? 'http://localhost:11434'
  const embedder = hybridOn ? getQwen3Embedder(ollamaUrl) : undefined
  const handle = await getOramaIndex({
    cachePath: opts?.oramaCachePath ?? defaultOramaCachePath(),
    tokenizer,
    embedder,
    // §5.7.7 cycle #4 codex HIGH #1 — stable embedder key for singleton invalidation.
    // ollamaUrl 변경 시 cache invalidate (이전 cycle 의 boolean key 미감지 hole).
    embedderKey: hybridOn ? `qwen3:${ollamaUrl}` : '',
  })

  // §5.7.4 codex cycle #1 MED-4 fix — empty cache detection via docCount() (zero-cost
  // lookup), NOT arbitrary search term. Korean-only index can have zero hits for 'a'.
  if ((await handle.docCount()) === 0) {
    const wikiDir = pathJoin(basePath, 'wiki')
    try {
      await handle.ingestAll(wikiDir)
    } catch {
      /* ignore — wiki dir may not exist in tests */
    }
  }

  // §5.7.8 — propagate optional filter / rewriter / expander / vaultHint when supplied.
  // Absent → legacy single-query path (Spec invariant I7). Each layer is fail-open inside
  // `orama-index.search` (Spec invariant I8).
  // §5.7.7 cycle #2 — pass mode='hybrid' + rrfK when WIKEY_HYBRID_MODE=on. embedder absence
  // (handle creation 시 결정) 시에도 mode='hybrid' 는 inert (I6 backward compat).
  return handle.search(term, {
    topN,
    mode: hybridOn ? 'hybrid' : 'fulltext',
    rrfK,
    filter: opts?.filter,
    rewriter: opts?.rewriter,
    expander: opts?.expander,
    vaultHint: opts?.vaultHint,
  })
}

export function parseQmdOutput(stdout: string): readonly SearchResult[] {
  if (!stdout || stdout.trim() === '') return []

  try {
    const raw = JSON.parse(stdout.trim()) as Array<{
      file: string
      score: number
      snippet?: string
    }>
    return raw.map((r) => {
      let path = r.file.replace(`qmd://${QMD_COLLECTION}/`, '')
      // qmd 컬렉션 루트가 wiki/ → 경로에 wiki/ 접두사 추가
      if (!path.startsWith('wiki/')) {
        path = `wiki/${path}`
      }
      return { path, score: r.score, snippet: r.snippet ?? '' }
    })
  } catch {
    return []
  }
}

export function buildSynthesisPrompt(context: string, question: string): string {
  // Phase 5 §5.10.2.1 AC-C5.1: context 의 page section (`--- <basename>.md ---`) 으로부터
  // available page basename 자동 추출. LLM 이 *실제 존재* 페이지만 [[wikilink]] 처리 가능
  // 하도록 명시 → broken wikilink 자동 페이지 생성 차단.
  const PAGE_HEADER_RE = /^--- (.+?)\.md ---$/gm
  const availablePages: string[] = []
  for (const match of context.matchAll(PAGE_HEADER_RE)) {
    const base = match[1].trim()
    if (base && !availablePages.includes(base)) availablePages.push(base)
  }
  const availableBlock = availablePages.length > 0
    ? `[Available pages]: ${availablePages.join(', ')}`
    : '[Available pages]: (none)'

  return `당신은 wikey 위키 전문가입니다. 아래 위키 페이지 내용을 종합하여 확정적으로 답변하세요.

핵심 규칙:
- 위키에 있는 정보를 최대한 활용하여 확정적으로 설명하세요 ("~입니다", "~해요").
- "~에 언급되었습니다", "~에서 확인할 수 있습니다" 같은 소극적 표현은 금지. 직접 설명하세요.
- 여러 페이지에 흩어진 정보를 종합하여 하나의 완성된 답변을 만드세요.
- 해요체(존댓말)를 사용하세요.
- 답변 끝에 "참고: [[페이지명]], [[페이지명]]" 형식으로 출처를 나열하세요.
- 위키에 해당 정보가 전혀 없을 때만 "위키에 아직 관련 내용이 없어요"라고 말하세요. 부분적으로라도 있으면 그 내용을 활용하세요.
- 검색된 페이지 본문의 [[wikilink]] 중 \`expandWithOneHopWikilinks\` 로 실제 read 된 페이지의 정보만 활용하세요. read 실패 (wiki/ 에 없는) wikilink 는 답변에 [[link]] 로 포함하지 마세요.
- 답변에 등장한 entity/concept 중 위 페이지 base name 목록에 있는 것만 첫 등장 시 [[페이지명]] 으로 링크하세요. 목록에 없는 entity/concept 은 plain text 로 표기하세요 (broken link 차단).
- 답변 끝 "참고:" 블록에는 직접 인용한 페이지 + 1-hop link target 페이지를 모두 나열하세요.
- 답변은 충분히 풍부하게 작성하세요. 단순 정의에 머무르지 말고 관련 개념·구성·용도·예시를 함께 설명해 한 단락 이상의 완성된 설명을 만드세요.

${availableBlock}

---
위키 페이지:

${context}
---
질문: ${question}`
}

// §5.2.3 — 1-hop wikilink graph expansion.
// Captures the wikilink target (no alias `|`, no anchor `#`) and reduces path-style
// links (`[[concepts/smith-chart]]`) to the trailing basename so wiki/<cat>/<base>.md
// resolution works uniformly.
const WIKILINK_RE = /\[\[([^\]\n]+?)\]\]/g

export function extractWikilinkBasenames(content: string): readonly string[] {
  const seen = new Set<string>()
  const order: string[] = []
  for (const m of content.matchAll(WIKILINK_RE)) {
    const raw = m[1].split('|')[0].split('#')[0].trim()
    if (!raw) continue
    const basename = raw.split('/').pop() ?? raw
    if (seen.has(basename)) continue
    seen.add(basename)
    order.push(basename)
  }
  return order
}

export interface ExpandedPage {
  readonly path: string
  readonly content: string
}

/**
 * §5.2.3 — given top-N base results (with content), parse `[[wikilink]]` from each
 * body and fetch up to `cap` unique 1-hop targets via `reader(basename)`.
 *
 * Priority: frequency desc, then first-seen order. Targets already in baseResults
 * are skipped. Unresolvable basenames (reader returns null) are skipped.
 */
export async function expandWithOneHopWikilinks(
  baseResults: readonly { path: string; content: string }[],
  reader: (basename: string) => Promise<ExpandedPage | null>,
  cap: number,
): Promise<readonly ExpandedPage[]> {
  const basePaths = new Set(baseResults.map((r) => r.path))
  const freq = new Map<string, number>()
  const firstSeen = new Map<string, number>()
  let order = 0
  for (const result of baseResults) {
    for (const basename of extractWikilinkBasenames(result.content)) {
      freq.set(basename, (freq.get(basename) ?? 0) + 1)
      if (!firstSeen.has(basename)) firstSeen.set(basename, order++)
    }
  }
  const sorted = [...freq.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return (firstSeen.get(a[0]) ?? 0) - (firstSeen.get(b[0]) ?? 0)
  })
  const out: ExpandedPage[] = []
  for (const [basename] of sorted) {
    if (out.length >= cap) break
    const page = await reader(basename)
    if (!page) continue
    if (basePaths.has(page.path)) continue
    out.push(page)
  }
  return out
}

const WIKI_CATEGORIES = ['entities', 'concepts', 'sources', 'analyses'] as const
const ONE_HOP_CAP = 5

/** Render base + 1-hop expansion as `--- <basename>.md ---` delimited text. */
function renderContextPages(pages: readonly { path: string; content: string }[]): string {
  return pages
    .map(({ path, content }) => {
      const name = path.split('/').pop()?.replace('.md', '') ?? path
      return `--- ${name}.md ---\n${content}\n`
    })
    .join('\n')
}

async function buildContextWithWikiFS(
  results: readonly SearchResult[],
  wikiFS: WikiFS,
): Promise<string> {
  const base: Array<{ path: string; content: string }> = []
  for (const result of results) {
    try {
      const content = await wikiFS.read(result.path)
      base.push({ path: result.path, content })
    } catch { /* file not found — skip */ }
  }

  const reader = async (basename: string): Promise<ExpandedPage | null> => {
    for (const cat of WIKI_CATEGORIES) {
      const path = `wiki/${cat}/${basename}.md`
      try {
        const content = await wikiFS.read(path)
        return { path, content }
      } catch { /* try next category */ }
    }
    return null
  }
  const expanded = await expandWithOneHopWikilinks(base, reader, ONE_HOP_CAP)
  return renderContextPages([...base, ...expanded])
}

function buildContextFromFS(
  results: readonly SearchResult[],
  basePath: string,
): string {
  const { readFileSync, existsSync } = require('node:fs') as typeof import('node:fs')
  const { join } = require('node:path') as typeof import('node:path')
  const base: Array<{ path: string; content: string }> = []
  for (const result of results) {
    try {
      const fullPath = join(basePath, result.path)
      const content = readFileSync(fullPath, 'utf-8')
      base.push({ path: result.path, content })
    } catch { /* skip */ }
  }

  // Sync mirror of expandWithOneHopWikilinks — resolve via existsSync (no await).
  const basePaths = new Set(base.map((r) => r.path))
  const freq = new Map<string, number>()
  const firstSeen = new Map<string, number>()
  let order = 0
  for (const result of base) {
    for (const basename of extractWikilinkBasenames(result.content)) {
      freq.set(basename, (freq.get(basename) ?? 0) + 1)
      if (!firstSeen.has(basename)) firstSeen.set(basename, order++)
    }
  }
  const sorted = [...freq.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return (firstSeen.get(a[0]) ?? 0) - (firstSeen.get(b[0]) ?? 0)
  })
  const expanded: ExpandedPage[] = []
  for (const [basename] of sorted) {
    if (expanded.length >= ONE_HOP_CAP) break
    let resolved: ExpandedPage | null = null
    for (const cat of WIKI_CATEGORIES) {
      const path = `wiki/${cat}/${basename}.md`
      const fullPath = join(basePath, path)
      if (existsSync(fullPath)) {
        try {
          resolved = { path, content: readFileSync(fullPath, 'utf-8') }
          break
        } catch { /* skip */ }
      }
    }
    if (!resolved) continue
    if (basePaths.has(resolved.path)) continue
    expanded.push(resolved)
  }

  return renderContextPages([...base, ...expanded])
}

function tryKoreanPreprocess(
  text: string,
  basePath: string,
  execEnv: Record<string, string>,
): Promise<string> {
  const { join } = require('node:path') as typeof import('node:path')
  const scriptPath = join(basePath, 'scripts/korean-tokenize.py')

  return new Promise((resolve) => {
    try {
      const proc = spawn('python3', [
        scriptPath, '--mode', 'query',
      ], { stdio: ['pipe', 'pipe', 'pipe'], cwd: basePath, env: execEnv })

      let stdout = ''
      proc.stdout.on('data', (data: Buffer) => { stdout += data.toString() })
      proc.on('close', () => resolve(stdout.trim() || text))
      proc.on('error', () => resolve(text))
      proc.stdin.write(text)
      proc.stdin.end()
    } catch {
      resolve(text)
    }
  })
}

function containsKorean(text: string): boolean {
  return /[\uAC00-\uD7AF\u1100-\u11FF]/.test(text)
}

async function extractEnglishKeywords(
  koreanQuestion: string,
  config: WikeyConfig,
  httpClient: HttpClient,
): Promise<string> {
  // Ollama 로컬 우선 (빠르고 무료), 없으면 기본 provider
  const ollamaAvailable = config.OLLAMA_URL && config.OLLAMA_URL !== ''
  const provider = ollamaAvailable ? 'ollama' as const : resolveProvider('default', config).provider
  const model = ollamaAvailable ? (config.WIKEY_MODEL || PROVIDER_CHAT_DEFAULTS.ollama) : resolveProvider('default', config).model

  const llm = new LLMClient(httpClient, config)

  const prompt = `Extract English search keywords from this Korean question. Return ONLY space-separated English keywords, nothing else. No explanation.

Question: ${koreanQuestion}
Keywords:`

  try {
    const result = await llm.call(prompt, {
      provider,
      model,
      maxTokens: 50,
      temperature: 0,
      timeout: 15000,
    })
    const cleaned = result.replace(/[^a-zA-Z0-9\s\-]/g, ' ').replace(/\s+/g, ' ').trim()
    return cleaned.length > 2 ? cleaned : ''
  } catch (err: any) {
    console.log('[Wikey] cross-lingual extraction failed:', err?.message ?? err)
    return ''
  }
}

function findQmdBin(
  config: WikeyConfig,
  basePath: string,
): { bin: string; isJs: boolean } {
  const { join } = require('node:path') as typeof import('node:path')
  const { accessSync } = require('node:fs') as typeof import('node:fs')

  const vendoredJs = join(basePath, 'tools/qmd/dist/cli/qmd.js')
  const vendoredBin = join(basePath, 'tools/qmd/bin/qmd')
  const userQmdPath = (config as any).QMD_PATH as string | undefined

  // §5.14 (2026-05-06) — 우선순위 재배치:
  //   (1) vendored qmd.js (isJs=true, plugin 의 nodePath 로 직접 실행 → ABI mismatch 회피)
  //   (2) 사용자 명시 override — 단 자동 감지된 vendored bin 이면 (1) 결과 사용
  //   (3) vendored bin (wrapper script — 마지막 fallback)
  // 변경 전: config.QMD_PATH 가 1순위였는데, env-detect 가 vendored bin 을 자동 set
  // 하므로 wrapper script 가 항상 우선 → wrapper 가 PATH 첫 node 호출 → ABI mismatch.
  try {
    accessSync(vendoredJs)
    if (!userQmdPath || userQmdPath === vendoredBin) {
      return { bin: vendoredJs, isJs: true }
    }
  } catch { /* vendoredJs 없음 — fallback */ }

  if (userQmdPath) {
    return { bin: userQmdPath, isJs: false }
  }

  try {
    accessSync(vendoredBin)
    return { bin: vendoredBin, isJs: false }
  } catch { /* pass */ }

  throw new Error('qmd를 찾을 수 없습니다 — tools/qmd/가 있는지 확인하세요')
}
