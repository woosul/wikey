import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import type { Citation, HttpClient, QueryResult, SearchResult, WikiFS, WikeyConfig } from './types.js'
import { LLMClient } from './llm-client.js'
import { resolveProvider } from './config.js'
import { PROVIDER_CHAT_DEFAULTS } from './provider-defaults.js'
import { resolveSource } from './source-resolver.js'
import { loadRegistry } from './source-registry.js'

const execFileAsync = promisify(execFile)

const QMD_COLLECTION = 'wikey-wiki'

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
}

export async function query(
  question: string,
  config: WikeyConfig,
  httpClient: HttpClient,
  opts?: QueryOptions,
): Promise<QueryResult> {
  const basePath = opts?.basePath ?? process.cwd()
  const execEnv = opts?.execEnv ?? (process.env as Record<string, string>)

  // Step 1: Find qmd
  let qmdBin: string
  let qmdIsJs = false
  try {
    const result = findQmdBin(config, basePath)
    qmdBin = result.bin
    qmdIsJs = result.isJs
  } catch (err: any) {
    throw new Error(`[Step 1/4 qmd 탐색] ${err?.message ?? err}`)
  }

  // Step 2: Search
  let searchResults: readonly SearchResult[]
  try {
    searchResults = await execQmdSearch(qmdBin, qmdIsJs, question, config, basePath, execEnv, opts?.nodePath, httpClient)
  } catch (err: any) {
    throw new Error(`[Step 2/4 qmd 검색] ${err?.message ?? err}`)
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
 * - 일부 resolve 성공: `원본: [[<path>]], ...`
 *   • mode='raw'     → record.vault_path
 *   • mode='sidecar' → deriveSidecarPath(record.vault_path) — `<vault_path>.md`
 *     (단독 md 면 vault_path 자체)
 *
 * rawVaultPath 는 current vault_path 우선, fallback 으로 path_history 마지막 유효 entry.
 * 둘 다 없으면 resolve 실패로 간주.
 */
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
        if (!resolved || !resolved.rawVaultPath) continue
        const target =
          mode === 'sidecar' ? deriveSidecarPath(resolved.rawVaultPath) : resolved.rawVaultPath
        if (seen.has(target)) continue
        seen.add(target)
        // §5.3 follow-up — display 는 raw basename without ext (디렉토리/확장자 숨김).
        // link target 은 full vault path → Obsidian rollover 시 tooltip 으로 노출됨.
        const display = basenameWithoutExt(resolved.rawVaultPath)
        links.push(`[[${target}|${display}]]`)
      } catch {
        // single citation resolve 실패는 건너뜀 — 전체가 실패해야 WARN 처리.
      }
    }
  }
  if (links.length === 0) {
    return `${trimmed}\n\n원본: (해석 실패 — registry 점검 필요)`
  }
  return `${trimmed}\n\n원본: ${links.join(', ')}`
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

async function execQmdSearch(
  qmdBin: string,
  isJs: boolean,
  question: string,
  config: WikeyConfig,
  basePath: string,
  execEnv: Record<string, string>,
  nodePath?: string,
  httpClient?: HttpClient,
): Promise<readonly SearchResult[]> {
  const topN = String(config.WIKEY_QMD_TOP_N || 8)

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
  return `당신은 wikey 위키 전문가입니다. 아래 위키 페이지 내용을 종합하여 확정적으로 답변하세요.

핵심 규칙:
- 위키에 있는 정보를 최대한 활용하여 확정적으로 설명하세요 ("~입니다", "~해요").
- "~에 언급되었습니다", "~에서 확인할 수 있습니다" 같은 소극적 표현은 금지. 직접 설명하세요.
- 여러 페이지에 흩어진 정보를 종합하여 하나의 완성된 답변을 만드세요.
- 해요체(존댓말)를 사용하세요.
- 답변 끝에 "참고: [[페이지명]], [[페이지명]]" 형식으로 출처를 나열하세요.
- 위키에 해당 정보가 전혀 없을 때만 "위키에 아직 관련 내용이 없어요"라고 말하세요. 부분적으로라도 있으면 그 내용을 활용하세요.
- 검색된 페이지 본문에 [[wikilink]] 로 언급된 다른 wiki 페이지가 있으면, 그 페이지의 정보도 가능한 활용해 답변에 포함하세요.
- 답변에 등장한 모든 entity/concept 은 첫 등장 시 [[페이지명]] 으로 링크하세요.
- 답변 끝 "참고:" 블록에는 직접 인용한 페이지 + 1-hop link target 페이지를 모두 나열하세요.
- 답변은 충분히 풍부하게 작성하세요. 단순 정의에 머무르지 말고 관련 개념·구성·용도·예시를 함께 설명해 한 단락 이상의 완성된 설명을 만드세요.

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
  const expanded = await expandWithOneHopWikilinks(base, reader, 5)

  return [...base, ...expanded]
    .map(({ path, content }) => {
      const name = path.split('/').pop()?.replace('.md', '') ?? path
      return `--- ${name}.md ---\n${content}\n`
    })
    .join('\n')
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

  // Sync expansion for FS path — used in non-wikiFS code path. We mirror the async
  // helper logic but resolve via existsSync to avoid awaiting in a sync function.
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
    if (expanded.length >= 5) break
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

  return [...base, ...expanded]
    .map(({ path, content }) => {
      const name = path.split('/').pop()?.replace('.md', '') ?? path
      return `--- ${name}.md ---\n${content}\n`
    })
    .join('\n')
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

  // 1. 설정값
  if ((config as any).QMD_PATH) {
    return { bin: (config as any).QMD_PATH, isJs: false }
  }

  // 2. vendored qmd.js (직접 node로 실행 — ABI 불일치 방지)
  const vendoredJs = join(basePath, 'tools/qmd/dist/cli/qmd.js')
  try {
    accessSync(vendoredJs)
    return { bin: vendoredJs, isJs: true }
  } catch {
    // pass
  }

  // 3. vendored bin
  const vendoredBin = join(basePath, 'tools/qmd/bin/qmd')
  try {
    accessSync(vendoredBin)
    return { bin: vendoredBin, isJs: false }
  } catch {
    // pass
  }

  throw new Error('qmd를 찾을 수 없습니다 — tools/qmd/가 있는지 확인하세요')
}
