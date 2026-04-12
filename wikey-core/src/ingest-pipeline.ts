import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type {
  HttpClient,
  IngestProgressCallback,
  IngestResult,
  WikiFS,
  WikiPage,
  WikeyConfig,
} from './types.js'
import { LLMClient } from './llm-client.js'
import { resolveProvider } from './config.js'
import { createPage, updateIndex, appendLog } from './wiki-ops.js'

const execFileAsync = promisify(execFile)

const MAX_JSON_RETRIES = 2

export interface IngestOptions {
  readonly basePath?: string
  readonly execEnv?: Record<string, string>
}

export async function ingest(
  sourcePath: string,
  wikiFS: WikiFS,
  config: WikeyConfig,
  httpClient: HttpClient,
  onProgress?: IngestProgressCallback,
  opts?: IngestOptions,
): Promise<IngestResult> {
  // Step 1: Read source
  onProgress?.({ step: 1, total: 4, message: '소스 읽기...' })
  const sourceFilename = sourcePath.split('/').pop() ?? sourcePath
  const isPdf = sourceFilename.toLowerCase().endsWith('.pdf')

  let sourceContent: string
  if (isPdf) {
    onProgress?.({ step: 1, total: 4, message: 'PDF 텍스트 추출...' })
    sourceContent = await extractPdfText(sourcePath, opts?.basePath, opts?.execEnv)
    if (!sourceContent || sourceContent.trim().length < 50) {
      throw new Error(`PDF 텍스트 추출 실패: ${sourceFilename} — pdftotext가 설치되어 있는지 확인하세요 (brew install poppler)`)
    }
  } else {
    sourceContent = await wikiFS.read(sourcePath)
  }

  const indexContent = await wikiFS.read('wiki/index.md').catch(() => '')

  // Step 2: Call LLM
  onProgress?.({ step: 2, total: 4, message: 'LLM 호출...' })
  const prompt = buildIngestPrompt(sourceContent, sourceFilename, indexContent)
  const { provider, model } = resolveProvider('ingest', config)
  const llm = new LLMClient(httpClient, config)

  let parsed: IngestRawResult | null = null
  for (let attempt = 0; attempt <= MAX_JSON_RETRIES; attempt++) {
    const llmOpts = provider === 'gemini'
      ? { provider, model, responseMimeType: 'application/json' as const }
      : { provider, model }
    const response = await llm.call(prompt, llmOpts)
    parsed = extractJsonBlock(response)
    if (parsed) break
  }

  if (!parsed) {
    throw new Error('LLM JSON 파싱 실패 — 최대 재시도 초과')
  }

  // Step 3: Create/update wiki pages
  onProgress?.({ step: 3, total: 4, message: '파일 생성...' })
  const createdPages: string[] = []
  const updatedPages: string[] = []

  const sourcePage: WikiPage = {
    filename: parsed.source_page.filename,
    content: parsed.source_page.content,
    category: 'sources',
  }
  const exists = await wikiFS.exists(`wiki/sources/${sourcePage.filename}`)
  await createPage(wikiFS, sourcePage)
  ;(exists ? updatedPages : createdPages).push(sourcePage.filename)

  for (const entity of parsed.entities ?? []) {
    const page: WikiPage = { filename: entity.filename, content: entity.content, category: 'entities' }
    const entityExists = await wikiFS.exists(`wiki/entities/${entity.filename}`)
    await createPage(wikiFS, page)
    ;(entityExists ? updatedPages : createdPages).push(entity.filename)
  }

  for (const concept of parsed.concepts ?? []) {
    const page: WikiPage = { filename: concept.filename, content: concept.content, category: 'concepts' }
    const conceptExists = await wikiFS.exists(`wiki/concepts/${concept.filename}`)
    await createPage(wikiFS, page)
    ;(conceptExists ? updatedPages : createdPages).push(concept.filename)
  }

  if (parsed.index_additions?.length) {
    await updateIndex(wikiFS, parsed.index_additions)
  }

  if (parsed.log_entry) {
    const today = new Date().toISOString().slice(0, 10)
    await appendLog(wikiFS, `## ${today}\n\n${parsed.log_entry}`)
  }

  // Step 4: Reindex
  onProgress?.({ step: 4, total: 4, message: '인덱싱...' })
  triggerReindex(opts?.basePath)

  return {
    sourcePage,
    entities: (parsed.entities ?? []).map((e) => ({
      filename: e.filename,
      content: e.content,
      category: 'entities' as const,
    })),
    concepts: (parsed.concepts ?? []).map((c) => ({
      filename: c.filename,
      content: c.content,
      category: 'concepts' as const,
    })),
    indexAdditions: parsed.index_additions ?? [],
    logEntry: parsed.log_entry ?? '',
  }
}

interface IngestRawResult {
  source_page: { filename: string; content: string }
  entities?: Array<{ filename: string; content: string }>
  concepts?: Array<{ filename: string; content: string }>
  index_additions?: string[]
  log_entry?: string
}

export function extractJsonBlock(text: string): IngestRawResult | null {
  // Try ```json ... ``` block first
  const codeBlockMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/)
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1]) as IngestRawResult
    } catch {
      // fall through
    }
  }

  // Try bare JSON object
  const braceMatch = text.match(/\{[\s\S]*\}/)
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]) as IngestRawResult
    } catch {
      // fall through
    }
  }

  return null
}

export function buildIngestPrompt(
  sourceContent: string,
  sourceFilename: string,
  indexContent: string,
): string {
  const today = new Date().toISOString().slice(0, 10)
  return loadPromptTemplate()
    .replace('{{TODAY}}', today)
    .replaceAll('{{TODAY}}', today)
    .replace('{{INDEX_CONTENT}}', indexContent)
    .replace('{{SOURCE_FILENAME}}', sourceFilename)
    .replace('{{SOURCE_CONTENT}}', sourceContent)
}

let cachedTemplate: string | null = null

function loadPromptTemplate(): string {
  if (cachedTemplate) return cachedTemplate

  // Inline the template (same as prompts/ingest.txt) to avoid fs dependency in tests
  cachedTemplate = `당신은 wikey LLM Wiki의 인제스트 에이전트입니다.
아래 소스를 분석하여 위키 페이지를 생성하세요.

## 컨벤션

### 프론트매터 (모든 페이지 필수)
\`\`\`yaml
---
title: 페이지 제목
type: entity | concept | source
created: {{TODAY}}
updated: {{TODAY}}
sources: [source-name.md]
tags: [태그1, 태그2]
---
\`\`\`

### 파일명 규칙
- 소문자, 하이픈 구분 (예: my-page-name.md)
- 소스 페이지: source-{name}.md
- 엔티티: 고유명사/제품/인물 → wiki/entities/
- 개념: 추상적 아이디어/패턴 → wiki/concepts/

### 위키링크
- \`[[page-name]]\` 형식
- 이미 존재하는 페이지와 연결하세요

### 현재 인덱스 (이미 존재하는 페이지)
{{INDEX_CONTENT}}

## 소스 파일
파일명: {{SOURCE_FILENAME}}

{{SOURCE_CONTENT}}

## 출력 형식

반드시 아래 JSON 형식으로 출력하세요. JSON만 출력하고, 다른 텍스트는 포함하지 마세요.

\`\`\`json
{
  "source_page": {
    "filename": "source-example.md",
    "content": "---\\ntitle: ...\\n---\\n\\n# 제목\\n\\n내용..."
  },
  "entities": [
    {
      "filename": "entity-name.md",
      "content": "---\\ntitle: ...\\n---\\n\\n# 제목\\n\\n내용..."
    }
  ],
  "concepts": [
    {
      "filename": "concept-name.md",
      "content": "---\\ntitle: ...\\n---\\n\\n# 제목\\n\\n내용..."
    }
  ],
  "index_additions": [
    "- [[page-name]] — 한 줄 설명 (소스: 1개)"
  ],
  "log_entry": "- 소스 요약 생성: [[source-name]]\\n- 엔티티 생성: [[entity1]]\\n- 개념 생성: [[concept1]]\\n- 인덱스 갱신"
}
\`\`\``

  return cachedTemplate
}

async function extractPdfText(sourcePath: string, basePath?: string, execEnv?: Record<string, string>): Promise<string> {
  const { join } = require('node:path') as typeof import('node:path')
  const cwd = basePath ?? process.cwd()
  const fullPath = join(cwd, sourcePath)

  // PATH 보강 (Electron 환경에서 homebrew 등 누락 방지)
  const env = execEnv ? { ...execEnv } : { ...process.env } as Record<string, string>
  const extraPaths = ['/opt/homebrew/bin', '/usr/local/bin']
  env.PATH = [...extraPaths, env.PATH ?? ''].join(':')

  // 1. pdftotext (poppler)
  try {
    const { stdout } = await execFileAsync('pdftotext', [fullPath, '-'], {
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
      env,
    })
    if (stdout.trim().length > 50) return stdout.trim()
  } catch {
    // pdftotext not available — fall through
  }

  // 2. macOS textutil (basic extraction)
  try {
    const { stdout } = await execFileAsync('mdimport', ['-d1', fullPath], { timeout: 10000, env })
    if (stdout.trim().length > 50) return stdout.trim()
  } catch {
    // fall through
  }

  // 3. python3 PyPDF2/pymupdf fallback
  try {
    const { stdout } = await execFileAsync('python3', [
      '-c',
      `
import sys
try:
    import fitz  # pymupdf
    doc = fitz.open(sys.argv[1])
    text = "\\n".join(page.get_text() for page in doc)
    print(text[:200000])
except ImportError:
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(sys.argv[1])
        text = "\\n".join(page.extract_text() or "" for page in reader.pages)
        print(text[:200000])
    except ImportError:
        print("")
`,
      fullPath,
    ], { timeout: 30000, maxBuffer: 10 * 1024 * 1024, env })
    if (stdout.trim().length > 50) return stdout.trim()
  } catch {
    // fall through
  }

  return ''
}

function triggerReindex(basePath?: string): void {
  const { join } = require('node:path') as typeof import('node:path')
  const cwd = basePath ?? process.cwd()
  const script = join(cwd, 'scripts/reindex.sh')

  // Fire-and-forget background reindex
  try {
    const env = { ...process.env } as Record<string, string>
    const extraPaths = ['/usr/local/bin', '/opt/homebrew/bin', `${process.env.HOME}/.nvm/versions/node/v22.17.0/bin`]
    env.PATH = [...extraPaths, env.PATH ?? ''].join(':')
    execFile(script, ['--quick'], { cwd, env }, () => {
      // Reindex failure is non-fatal
    })
  } catch {
    // reindex.sh not found — non-fatal
  }
}
