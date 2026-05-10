// Phase 5 §5.10.1.3 AC-C1.1 — `convertSourceToMarkdown` pure conversion entry.
//
// Spec: plan/phase-5/phase-5-todox-5.10-graph-emergent-ontology.md §10.4 (line 401~437) + §10.5 AC-C1.1.
// 5 분기 (PDF / HWP / DOCX-Docling / PPTX-Docling / md/txt) 통합. vault write 0 보장.
// External process (docling / unhwp / python) 호출은 cache hit 시나리오로 우회 — pre-set 후 호출.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  convertSourceToMarkdown,
  type ConversionResult,
} from '../conversion.js'
import { generateBrief } from '../ingest-pipeline.js'
import { computeCacheKey, setCached } from '../convert-cache.js'
import { LLMClient } from '../llm-client.js'
import type { WikiFS, WikeyConfig, HttpClient } from '../types.js'

let tmpVault: string
let tmpHome: string
let originalHome: string | undefined

beforeEach(() => {
  tmpVault = mkdtempSync(join(tmpdir(), 'wikey-conversion-vault-'))
  mkdirSync(join(tmpVault, 'raw'), { recursive: true })
  originalHome = process.env.HOME
  tmpHome = mkdtempSync(join(tmpdir(), 'wikey-conversion-home-'))
  process.env.HOME = tmpHome
})

afterEach(() => {
  if (originalHome) process.env.HOME = originalHome
  try { rmSync(tmpVault, { recursive: true, force: true }) } catch { /* ignore */ }
  try { rmSync(tmpHome, { recursive: true, force: true }) } catch { /* ignore */ }
})

function makeFakeWikiFS(content: string): WikiFS {
  return {
    read: vi.fn().mockResolvedValue(content),
    write: vi.fn(async () => { throw new Error('vault write forbidden in pure conversion') }),
    exists: vi.fn().mockResolvedValue(true),
    list: vi.fn().mockResolvedValue([]),
  } as unknown as WikiFS
}

function doclingMajorOptionsForTest(config?: WikeyConfig, mode: string = 'default') {
  const engine = config?.DOCLING_OCR_ENGINE ?? (process.platform === 'darwin' ? 'ocrmac' : 'rapidocr')
  const langDefault = engine === 'ocrmac' ? 'ko-KR,en-US'
    : engine === 'rapidocr' ? 'korean,english'
    : engine === 'easyocr' ? 'ko,en'
    : 'kor,eng'
  return {
    mode,
    table_mode: config?.DOCLING_TABLE_MODE ?? 'accurate',
    ocr_engine: engine,
    ocr_lang: config?.DOCLING_OCR_LANG ?? langDefault,
    image_export_mode: 'embedded',
  }
}

describe('convertSourceToMarkdown — md/txt passthrough (5 분기 중 plain)', () => {
  it('returns ConversionResult for md (passthrough, sidecarCandidate=null)', async () => {
    const wikiFS = makeFakeWikiFS('# hello md\nbody')
    const result = await convertSourceToMarkdown('raw/test.md', 'md', { wikiFS, basePath: tmpVault })
    expect(result.content).toBe('# hello md\nbody')
    expect(result.sidecarCandidate).toBeNull()
    expect(result.ext).toBe('md')
    expect(result.converter).toBe('plain')
  })

  it('returns ConversionResult for txt (passthrough)', async () => {
    const wikiFS = makeFakeWikiFS('plain text content')
    const result = await convertSourceToMarkdown('raw/notes.txt', 'txt', { wikiFS, basePath: tmpVault })
    expect(result.content).toBe('plain text content')
    expect(result.sidecarCandidate).toBeNull()
    expect(result.ext).toBe('txt')
    expect(result.converter).toBe('plain')
  })

  it('strips embedded images from md content (rag-preprocess)', async () => {
    const md = 'before\n![alt](data:image/png;base64,QUFB)\nafter'
    const wikiFS = makeFakeWikiFS(md)
    const result = await convertSourceToMarkdown('raw/img.md', 'md', { wikiFS, basePath: tmpVault })
    expect(result.content).not.toContain('QUFB')
    expect(result.content).toContain('before')
    expect(result.content).toContain('after')
  })
})

describe('convertSourceToMarkdown — HWP cache hit', () => {
  it('returns ConversionResult for HWP (cache hit, no external process)', async () => {
    const sourceBytes = Buffer.from('fake hwp bytes — content unique 1')
    const sourcePath = 'raw/test.hwp'
    writeFileSync(join(tmpVault, sourcePath), sourceBytes)

    const cacheKey = computeCacheKey({ sourceBytes, converter: 'unhwp' })
    setCached(cacheKey, '# Extracted HWP content', { source: sourcePath, converter: 'unhwp' })

    const wikiFS = makeFakeWikiFS('SHOULD NOT BE READ')
    const result = await convertSourceToMarkdown(sourcePath, 'hwp', { wikiFS, basePath: tmpVault })
    expect(result.content).toBe('# Extracted HWP content')
    expect(result.ext).toBe('hwp')
    expect(result.converter).toBe('unhwp')
    expect(result.sidecarCandidate).toBe('# Extracted HWP content')  // for non-PDF, sidecar = content
  })

  it('returns ConversionResult for HWPX (cache hit, unhwp converter)', async () => {
    const sourceBytes = Buffer.from('fake hwpx bytes — unique 2')
    const sourcePath = 'raw/test.hwpx'
    writeFileSync(join(tmpVault, sourcePath), sourceBytes)

    const cacheKey = computeCacheKey({ sourceBytes, converter: 'unhwp' })
    setCached(cacheKey, '# HWPX cached', { source: sourcePath, converter: 'unhwp' })

    const wikiFS = makeFakeWikiFS('SHOULD NOT BE READ')
    const result = await convertSourceToMarkdown(sourcePath, 'hwpx', { wikiFS, basePath: tmpVault })
    expect(result.content).toBe('# HWPX cached')
    expect(result.ext).toBe('hwpx')
    expect(result.converter).toBe('unhwp')
  })
})

describe('convertSourceToMarkdown — DOCLING_DOC_FORMATS cache hit', () => {
  it('returns ConversionResult for DOCX (Docling cache hit)', async () => {
    const sourceBytes = Buffer.from('fake docx bytes — unique 3')
    const sourcePath = 'raw/test.docx'
    writeFileSync(join(tmpVault, sourcePath), sourceBytes)

    const cacheKey = computeCacheKey({
      sourceBytes,
      converter: 'docling',
      majorOptions: doclingMajorOptionsForTest(),
    })
    setCached(cacheKey, '# DOCX content', { source: sourcePath, converter: 'docling' })

    const wikiFS = makeFakeWikiFS('SHOULD NOT BE READ')
    const result = await convertSourceToMarkdown(sourcePath, 'docx', { wikiFS, basePath: tmpVault })
    expect(result.content).toBe('# DOCX content')
    expect(result.ext).toBe('docx')
    expect(result.converter).toBe('docling-doc')
  })

  it('returns ConversionResult for PPTX (Docling cache hit)', async () => {
    const sourceBytes = Buffer.from('fake pptx bytes — unique 4')
    const sourcePath = 'raw/slides.pptx'
    writeFileSync(join(tmpVault, sourcePath), sourceBytes)

    const cacheKey = computeCacheKey({
      sourceBytes,
      converter: 'docling',
      majorOptions: doclingMajorOptionsForTest(),
    })
    setCached(cacheKey, '# PPTX slides', { source: sourcePath, converter: 'docling' })

    const wikiFS = makeFakeWikiFS('SHOULD NOT BE READ')
    const result = await convertSourceToMarkdown(sourcePath, 'pptx', { wikiFS, basePath: tmpVault })
    expect(result.content).toBe('# PPTX slides')
    expect(result.ext).toBe('pptx')
    expect(result.converter).toBe('docling-doc')
  })
})

describe('convertSourceToMarkdown — PDF cache hit', () => {
  it('returns ConversionResult for PDF (cache hit pdf:1-docling)', async () => {
    const sourceBytes = Buffer.from('fake pdf bytes — unique 5')
    const sourcePath = 'raw/test.pdf'
    writeFileSync(join(tmpVault, sourcePath), sourceBytes)

    const cacheKey = computeCacheKey({
      sourceBytes,
      converter: 'pdf:1-docling',
      majorOptions: doclingMajorOptionsForTest(),
    })
    setCached(cacheKey, '# PDF extracted', { source: sourcePath, converter: 'pdf:1-docling' })

    const wikiFS = makeFakeWikiFS('SHOULD NOT BE READ')
    const result = await convertSourceToMarkdown(sourcePath, 'pdf', { wikiFS, basePath: tmpVault })
    expect(result.content).toBe('# PDF extracted')
    expect(result.ext).toBe('pdf')
    expect(result.converter).toBe('pdf:1-docling')
    // Cache stores stripped only (legacy); sidecarCandidate falls back to content.
    expect(result.sidecarCandidate).toBe('# PDF extracted')
  })
})

describe('convertSourceToMarkdown — pure invariant (vault write 0)', () => {
  it('does not call wikiFS.write anywhere (md branch)', async () => {
    const wikiFS = makeFakeWikiFS('# nothing to write')
    await convertSourceToMarkdown('raw/x.md', 'md', { wikiFS, basePath: tmpVault })
    expect(wikiFS.write).not.toHaveBeenCalled()
  })

  it('does not call wikiFS.write on cache-hit PDF branch', async () => {
    const sourceBytes = Buffer.from('pdf for write-spy test')
    const sourcePath = 'raw/spy.pdf'
    writeFileSync(join(tmpVault, sourcePath), sourceBytes)

    const cacheKey = computeCacheKey({
      sourceBytes,
      converter: 'pdf:1-docling',
      majorOptions: doclingMajorOptionsForTest(),
    })
    setCached(cacheKey, '# pdf', { source: sourcePath, converter: 'pdf:1-docling' })

    const wikiFS = makeFakeWikiFS('IRRELEVANT')
    await convertSourceToMarkdown(sourcePath, 'pdf', { wikiFS, basePath: tmpVault })
    expect(wikiFS.write).not.toHaveBeenCalled()
  })
})

describe('generateBrief — AC-C1.2 시그니처 변경 (content 입력, 변환 책임 0)', () => {
  function makeFakeHttp(): HttpClient {
    return {
      request: vi.fn().mockResolvedValue({ status: 200, body: '{}' }),
    }
  }

  function makeConfig(): WikeyConfig {
    return {
      WIKEY_BASIC_MODEL: 'gemini-2.5-flash',
      WIKEY_SEARCH_BACKEND: 'basic',
      WIKEY_MODEL: 'gemini-2.5-flash',
      WIKEY_QMD_TOP_N: 10,
      GEMINI_API_KEY: 'test-key',
      ANTHROPIC_API_KEY: '',
      OPENAI_API_KEY: '',
      OLLAMA_URL: '',
      INGEST_PROVIDER: 'gemini',
      LINT_PROVIDER: 'gemini',
      SUMMARIZE_PROVIDER: 'gemini',
      CONTEXTUAL_MODEL: 'gemini-2.5-flash',
      COST_LIMIT: 100,
    } as WikeyConfig
  }

  it('generateBrief receives content (string), not sourcePath — accepts string content', async () => {
    const callSpy = vi.spyOn(LLMClient.prototype, 'call').mockResolvedValue('mocked brief 결과')
    try {
      const result = await generateBrief('# pre-converted content', 'test.md', makeConfig(), makeFakeHttp())
      expect(result).toBe('mocked brief 결과')
      const prompt = callSpy.mock.calls[0][0] as string
      expect(prompt).toContain('# pre-converted content')
      expect(prompt).toContain('test.md')
    } finally { callSpy.mockRestore() }
  })

  it('generateBrief PDF brief works without extractPdfText call (content already converted)', async () => {
    const callSpy = vi.spyOn(LLMClient.prototype, 'call').mockResolvedValue('PDF brief')
    try {
      const result = await generateBrief('# Pre-extracted PDF markdown', 'paper.pdf', makeConfig(), makeFakeHttp())
      expect(result).toBe('PDF brief')
      const prompt = callSpy.mock.calls[0][0] as string
      expect(prompt).toContain('# Pre-extracted PDF markdown')
    } finally { callSpy.mockRestore() }
  })

  it('generateBrief HWP brief works (no binary sent to LLM — content is markdown)', async () => {
    const callSpy = vi.spyOn(LLMClient.prototype, 'call').mockResolvedValue('HWP brief')
    try {
      const markdownContent = '# 회의록\n\n참석자: 홍길동, 김철수\n\n안건: 분기 보고'
      const result = await generateBrief(markdownContent, 'meeting.hwp', makeConfig(), makeFakeHttp())
      expect(result).toBe('HWP brief')
      const prompt = callSpy.mock.calls[0][0] as string
      expect(prompt).toContain('회의록')
      // HWP binary signature 같은 raw bytes 가 prompt 에 포함 안 됨
      expect(prompt).not.toContain('HWP Document File')
    } finally { callSpy.mockRestore() }
  })

  it('generateBrief DOCX brief works (already-converted markdown)', async () => {
    const callSpy = vi.spyOn(LLMClient.prototype, 'call').mockResolvedValue('DOCX brief')
    try {
      const result = await generateBrief('# Spec\n\nv1.0 release', 'spec.docx', makeConfig(), makeFakeHttp())
      expect(result).toBe('DOCX brief')
      const prompt = callSpy.mock.calls[0][0] as string
      expect(prompt).toContain('Spec')
      expect(prompt).toContain('spec.docx')
    } finally { callSpy.mockRestore() }
  })

  it('generateBrief md/txt brief works (passthrough content)', async () => {
    const callSpy = vi.spyOn(LLMClient.prototype, 'call').mockResolvedValue('plain brief')
    try {
      const result = await generateBrief('plain text notes', 'notes.txt', makeConfig(), makeFakeHttp())
      expect(result).toBe('plain brief')
      const prompt = callSpy.mock.calls[0][0] as string
      expect(prompt).toContain('plain text notes')
    } finally { callSpy.mockRestore() }
  })
})

describe('convertSourceToMarkdown — error cases', () => {
  it('throws on missing file (md branch via wikiFS)', async () => {
    const wikiFS: WikiFS = {
      read: vi.fn().mockRejectedValue(new Error('ENOENT: file not found')),
      write: vi.fn(),
      exists: vi.fn().mockResolvedValue(false),
      list: vi.fn().mockResolvedValue([]),
    } as unknown as WikiFS
    await expect(convertSourceToMarkdown('raw/missing.md', 'md', { wikiFS, basePath: tmpVault }))
      .rejects.toThrow(/ENOENT|not found|missing/i)
  })

  it('throws on unsupported ext', async () => {
    const wikiFS = makeFakeWikiFS('')
    await expect(convertSourceToMarkdown('raw/x.exe', 'exe', { wikiFS, basePath: tmpVault }))
      .rejects.toThrow(/unsupported|not supported|unknown ext/i)
  })
})
