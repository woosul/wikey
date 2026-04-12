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
}

export async function query(
  question: string,
  config: WikeyConfig,
  httpClient: HttpClient,
  opts?: QueryOptions,
): Promise<QueryResult> {
  const basePath = opts?.basePath ?? process.cwd()

  // Step 1: Find qmd
  let qmdBin: string
  try {
    qmdBin = await findQmdBin(config, basePath)
  } catch (err: any) {
    throw new Error(`[Step 1/4 qmd 탐색] ${err?.message ?? err}`)
  }

  // Step 2: Search
  let searchResults: readonly SearchResult[]
  try {
    searchResults = await execQmdSearch(qmdBin, question, config, basePath)
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
      : await buildContextFromFS(searchResults, basePath)
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
  question: string,
  config: WikeyConfig,
  basePath: string,
): Promise<readonly SearchResult[]> {
  const topN = String(config.WIKEY_QMD_TOP_N || 5)

  const koreanQuery = await tryKoreanPreprocess(question, basePath)
  const multiQuery = `lex: ${koreanQuery}\nvec: ${question}`

  try {
    console.log('[Wikey] qmd exec:', qmdBin, 'cwd:', basePath)
    console.log('[Wikey] qmd query:', JSON.stringify(multiQuery))
    const { stdout, stderr } = await execFileAsync(qmdBin, [
      'query', multiQuery, '--json', '-n', topN, '-c', QMD_COLLECTION,
    ], { cwd: basePath, timeout: 30000 })
    console.log('[Wikey] qmd stdout length:', stdout.length, 'stderr length:', stderr.length)
    if (stderr) console.log('[Wikey] qmd stderr:', stderr.slice(0, 500))
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
    return raw.map((r) => ({
      path: r.file.replace(`qmd://${QMD_COLLECTION}/`, ''),
      score: r.score,
      snippet: r.snippet ?? '',
    }))
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

async function buildContextFromFS(
  results: readonly SearchResult[],
  basePath: string,
): Promise<string> {
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

function tryKoreanPreprocess(text: string, basePath: string): Promise<string> {
  const { join } = require('node:path') as typeof import('node:path')
  const scriptPath = join(basePath, 'scripts/korean-tokenize.py')

  return new Promise((resolve) => {
    try {
      const proc = spawn('python3', [
        scriptPath, '--mode', 'query',
      ], { stdio: ['pipe', 'pipe', 'pipe'], cwd: basePath })

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

async function findQmdBin(config: WikeyConfig, basePath: string): Promise<string> {
  const { join } = require('node:path') as typeof import('node:path')
  const { accessSync } = require('node:fs') as typeof import('node:fs')

  // 1. 설정값 (사용자가 설정 탭에서 지정)
  if ((config as any).QMD_PATH) {
    return (config as any).QMD_PATH
  }

  // 2. 프로젝트 내 vendored qmd
  const vendoredPath = join(basePath, 'tools/qmd/bin/qmd')
  try {
    accessSync(vendoredPath)
    return vendoredPath
  } catch {
    // pass
  }

  // 3. which qmd
  try {
    const { stdout } = await execFileAsync('which', ['qmd'])
    return stdout.trim()
  } catch {
    throw new Error('qmd를 찾을 수 없습니다 — tools/qmd/bin/qmd가 있는지 확인하세요')
  }
}
