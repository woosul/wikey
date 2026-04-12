import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import type { HttpClient, QueryResult, SearchResult, WikeyConfig } from './types.js'
import { LLMClient } from './llm-client.js'
import { resolveProvider } from './config.js'

const execFileAsync = promisify(execFile)

const QMD_COLLECTION = 'wikey-wiki'

export async function query(
  question: string,
  config: WikeyConfig,
  httpClient: HttpClient,
): Promise<QueryResult> {
  const qmdBin = await findQmdBin(config)

  const searchResults = await execQmdSearch(qmdBin, question, config)

  if (searchResults.length === 0) {
    return { answer: '검색 결과가 없습니다.', sources: [] }
  }

  const context = await buildContextFromResults(searchResults)

  const prompt = buildSynthesisPrompt(context, question)
  const { provider, model } = resolveProvider('default', config)
  const llm = new LLMClient(httpClient, config)
  const answer = await llm.call(prompt, { provider, model })

  return { answer, sources: searchResults }
}

async function execQmdSearch(
  qmdBin: string,
  question: string,
  config: WikeyConfig,
): Promise<readonly SearchResult[]> {
  const topN = String(config.WIKEY_QMD_TOP_N || 5)

  const koreanQuery = await tryKoreanPreprocess(question)
  const multiQuery = `lex: ${koreanQuery}\nvec: ${question}`

  try {
    const { stdout } = await execFileAsync(qmdBin, [
      'query', multiQuery, '--json', '-n', topN, '-c', QMD_COLLECTION,
    ])
    return parseQmdOutput(stdout)
  } catch {
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

async function buildContextFromResults(
  results: readonly SearchResult[],
): Promise<string> {
  const { readFile } = await import('node:fs/promises')
  const parts: string[] = []

  for (const result of results) {
    try {
      const content = await readFile(result.path, 'utf-8')
      const basename = result.path.split('/').pop()?.replace('.md', '') ?? result.path
      parts.push(`--- ${basename}.md ---\n${content}\n`)
    } catch {
      // file not found — skip
    }
  }

  return parts.join('\n')
}

function tryKoreanPreprocess(text: string): Promise<string> {
  return new Promise((resolve) => {
    try {
      const proc = spawn('python3', [
        'scripts/korean-tokenize.py', '--mode', 'query',
      ], { stdio: ['pipe', 'pipe', 'pipe'] })

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

async function findQmdBin(config: WikeyConfig): Promise<string> {
  // 1. 설정값 (향후 config에서 읽기)
  // 2. 프로젝트 내 vendored qmd
  const vendoredPath = 'tools/qmd/bin/qmd'
  try {
    const { accessSync } = await import('node:fs')
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
