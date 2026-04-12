import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import type { HttpClient, QueryResult, SearchResult, WikiFS, WikeyConfig } from './types.js'
import { LLMClient } from './llm-client.js'
import { resolveProvider } from './config.js'

const execFileAsync = promisify(execFile)

const QMD_COLLECTION = 'wikey-wiki'

export interface QueryOptions {
  readonly basePath?: string
  readonly wikiFS?: WikiFS
  /** 로그인 셸에서 탐지된 환경변수 (PATH 포함) */
  readonly execEnv?: Record<string, string>
  /** 탐지된 node 바이너리 경로 */
  readonly nodePath?: string
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
    searchResults = await execQmdSearch(qmdBin, qmdIsJs, question, config, basePath, execEnv, opts?.nodePath)
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
    const answer = await llm.call(prompt, { provider, model })
    return { answer, sources: searchResults }
  } catch (err: any) {
    throw new Error(`[Step 4/4 LLM 합성] provider=${provider} model=${model}\n${err?.message ?? err}`)
  }
}

async function execQmdSearch(
  qmdBin: string,
  isJs: boolean,
  question: string,
  config: WikeyConfig,
  basePath: string,
  execEnv: Record<string, string>,
  nodePath?: string,
): Promise<readonly SearchResult[]> {
  const topN = String(config.WIKEY_QMD_TOP_N || 5)

  const koreanQuery = await tryKoreanPreprocess(question, basePath, execEnv)
  const multiQuery = `lex: ${koreanQuery}\nvec: ${question}`

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
  return `아래는 wikey 위키의 관련 페이지 내용입니다.

${context}
---
질문: ${question}

위키 내용을 기반으로 답변하세요. 출처는 [[페이지명]] 형식으로 인용하세요.`
}

async function buildContextWithWikiFS(
  results: readonly SearchResult[],
  wikiFS: WikiFS,
): Promise<string> {
  const parts: string[] = []

  for (const result of results) {
    try {
      const content = await wikiFS.read(result.path)
      const basename = result.path.split('/').pop()?.replace('.md', '') ?? result.path
      parts.push(`--- ${basename}.md ---\n${content}\n`)
    } catch {
      // file not found — skip
    }
  }

  return parts.join('\n')
}

function buildContextFromFS(
  results: readonly SearchResult[],
  basePath: string,
): string {
  const { readFileSync } = require('node:fs') as typeof import('node:fs')
  const { join } = require('node:path') as typeof import('node:path')
  const parts: string[] = []

  for (const result of results) {
    try {
      const fullPath = join(basePath, result.path)
      const content = readFileSync(fullPath, 'utf-8')
      const basename = result.path.split('/').pop()?.replace('.md', '') ?? result.path
      parts.push(`--- ${basename}.md ---\n${content}\n`)
    } catch {
      // file not found — skip
    }
  }

  return parts.join('\n')
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
