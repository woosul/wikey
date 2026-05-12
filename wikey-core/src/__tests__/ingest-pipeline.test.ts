import { describe, it, expect, vi } from 'vitest'
import {
  extractJsonBlock, buildIngestPrompt,
  loadEffectiveIngestPrompt,
  loadEffectiveStage1Prompt, loadEffectiveStage2Prompt, loadEffectiveStage3Prompt,
  INGEST_PROMPT_PATH, STAGE1_SUMMARY_PROMPT_PATH, STAGE2_MENTION_PROMPT_PATH, STAGE3_CANONICALIZE_PROMPT_PATH,
  BUNDLED_INGEST_PROMPT, BUNDLED_STAGE2_MENTION_PROMPT,
  formatLocalDate, assertNotWikiPath, callLLMWithRetry,
  buildDoclingArgs, defaultOcrLangForEngine, defaultOcrEngine,
  normalizeSourcePageFilename,
} from '../ingest-pipeline.js'
import type { WikiFS } from '../types.js'
import type { LLMClient } from '../llm-client.js'

describe('formatLocalDate', () => {
  it('returns YYYY-MM-DD in local timezone (not UTC)', () => {
    // Simulate Seoul midnight (2026-04-19 00:30 KST = 2026-04-18 15:30 UTC)
    // Without fix: toISOString returns 2026-04-18
    // With fix: getFullYear/getMonth/getDate returns 2026-04-19
    const d = new Date('2026-04-18T15:30:00.000Z')
    // When running in +09:00 (Asia/Seoul), local date should be 2026-04-19.
    // When running in UTC, local date should be 2026-04-18.
    // We assert format shape and that output equals date computed from local getters.
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    expect(formatLocalDate(d)).toBe(expected)
  })

  it('pads single-digit month and day', () => {
    const d = new Date(2026, 0, 5, 12, 0, 0) // local: 2026-01-05
    expect(formatLocalDate(d)).toBe('2026-01-05')
  })

  it('format is always 10 chars YYYY-MM-DD', () => {
    const d = new Date()
    const out = formatLocalDate(d)
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('extractJsonBlock', () => {
  it('extracts JSON from ```json code block', () => {
    const text = 'Some text\n```json\n{"key": "value"}\n```\nMore text'
    const result = extractJsonBlock(text)
    expect(result).toEqual({ key: 'value' })
  })

  it('extracts JSON from ``` code block without lang tag', () => {
    const text = 'Text\n```\n{"key": "value"}\n```'
    const result = extractJsonBlock(text)
    expect(result).toEqual({ key: 'value' })
  })

  it('extracts bare JSON object', () => {
    const text = '{"source_page": {"filename": "test.md", "content": "# Test"}}'
    const result = extractJsonBlock(text)
    expect(result).toHaveProperty('source_page')
  })

  it('handles multiline JSON in code block', () => {
    const text = '```json\n{\n  "source_page": {\n    "filename": "test.md",\n    "content": "# Test"\n  },\n  "entities": [],\n  "concepts": []\n}\n```'
    const result = extractJsonBlock(text)
    expect(result).toHaveProperty('source_page')
    expect(result.source_page.filename).toBe('test.md')
  })

  it('returns null for no JSON found', () => {
    const text = 'No JSON here, just text.'
    const result = extractJsonBlock(text)
    expect(result).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    const text = '```json\n{broken json\n```'
    const result = extractJsonBlock(text)
    expect(result).toBeNull()
  })
})

describe('buildIngestPrompt', () => {
  it('includes source content and filename', () => {
    const prompt = buildIngestPrompt('# Source content', 'my-source.md', '- [[esc]] — ESC')
    expect(prompt).toContain('my-source.md')
    expect(prompt).toContain('# Source content')
  })

  it('includes current index', () => {
    const prompt = buildIngestPrompt('content', 'file.md', '- [[esc]] — ESC\n- [[fc]] — FC')
    expect(prompt).toContain('[[esc]]')
    expect(prompt).toContain('[[fc]]')
  })

  it('includes today date placeholder', () => {
    const prompt = buildIngestPrompt('content', 'file.md', '')
    // The prompt template has {{TODAY}} which gets replaced with actual date
    expect(prompt).toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('requests JSON output format', () => {
    const prompt = buildIngestPrompt('content', 'file.md', '')
    expect(prompt).toContain('source_page')
    expect(prompt).toContain('entities')
    expect(prompt).toContain('concepts')
  })

  it('uses bundled template when no override is provided', () => {
    const prompt = buildIngestPrompt('content', 'file.md', '')
    expect(prompt).toContain('당신은 wikey LLM Wiki의 인제스트 에이전트입니다')
  })

  it('uses templateOverride when provided', () => {
    const override = 'CUSTOM PROMPT — process {{SOURCE_FILENAME}} content: {{SOURCE_CONTENT}}'
    const prompt = buildIngestPrompt('hello', 'foo.md', '', override)
    expect(prompt).toBe('CUSTOM PROMPT — process foo.md content: hello')
  })

  // §5.13 AC-C4-5 — prompt template 의 source_page.filename 강제 문구 포함.
  // LLM emit drift (prefix 누락) 의 1차 방어선: prompt 명시. 2차 방어선:
  // ingest-pipeline 의 normalize (callLLMForSummary 내부, defense in depth).
  it('§5.13 AC-C4-5: bundled prompt enforces source_page.filename = source- prefix', () => {
    const prompt = buildIngestPrompt('content', 'file.md', '')
    expect(prompt).toContain('source_page.filename')
    expect(prompt).toContain('source-')
    expect(prompt).toMatch(/source-\s*prefix|반드시\s*[`']?source-/)
  })
})

// §5.13.C4 — LLM emit `source_page.filename` 의 `source-` prefix 누락 시 자동 prepend.
// 다른 prefix (e.g., `raw-`, `archive-`) 도 force prepend (사용자 결정 = force, 보존 X).
// 호출 위치: callLLMForSummary 내부 LLM call 결과 받은 직후, sourcePageBase derive
// (assembleCanonicalResult 내부 normalizeBase) 보다 먼저.
describe('§5.13.C4 normalizeSourcePageFilename', () => {
  it('§5.13 AC-C4-1: prefix 정상 시 그대로 반환 (회귀)', () => {
    const parsed = {
      source_page: { filename: 'source-pmbok-overview.md', content: '# PMBOK\n' },
      entities: [],
      concepts: [],
    }
    const result = normalizeSourcePageFilename(parsed)
    expect(result.source_page.filename).toBe('source-pmbok-overview.md')
  })

  it('§5.13 AC-C4-2: prefix 누락 시 source- 자동 prepend + warn 로그', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const parsed = {
        source_page: { filename: 'pmbok-overview.md', content: '# PMBOK\n' },
        entities: [],
        concepts: [],
      }
      const result = normalizeSourcePageFilename(parsed)
      expect(result.source_page.filename).toBe('source-pmbok-overview.md')
      // codex P1 (d) — warn 로그 assertion (LLM emit drift detection observability)
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/LLM emit drift.*pmbok-overview\.md.*source-pmbok-overview\.md/),
      )
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('§5.13 AC-C4-3: 다른 prefix (raw-) 시 force prepend (보존 X) + warn 로그', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const parsed = {
        source_page: { filename: 'raw-pmbok.md', content: '# Raw\n' },
        entities: [],
        concepts: [],
      }
      const result = normalizeSourcePageFilename(parsed)
      // 사용자 결정 = force prepend (raw- 보존하지 않음)
      expect(result.source_page.filename).toBe('source-raw-pmbok.md')
      // codex P1 (d) — warn 로그 assertion
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/LLM emit drift.*raw-pmbok\.md.*source-raw-pmbok\.md/),
      )
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('§5.13 AC-C4-4: normalize 후 sourcePageBase derive 일관 (normalizeBase 결과)', async () => {
    const { normalizeBase } = await import('../wiki-ops.js')
    const cases = [
      { emit: 'pmbok-overview.md', expectedBase: 'source-pmbok-overview' },
      { emit: 'source-pmbok-overview.md', expectedBase: 'source-pmbok-overview' },
      { emit: 'raw-pmbok.md', expectedBase: 'source-raw-pmbok' },
    ]
    for (const c of cases) {
      const parsed = {
        source_page: { filename: c.emit, content: '' },
        entities: [],
        concepts: [],
      }
      const normalized = normalizeSourcePageFilename(parsed)
      // assembleCanonicalResult 의 sourcePageBase derive (line 887) 가 normalize 결과 사용
      const sourcePageBase = normalizeBase(normalized.source_page.filename)
      expect(sourcePageBase, `emit=${c.emit}`).toBe(c.expectedBase)
    }
  })

  // codex P1 (d) — plan v2 §AC-C4-6 SEGMENTED route 의도 명확화. callLLMForSummary 가
  // FULL/SEGMENTED 양 route 의 진입점이고 normalize 가 그 안 line 870 직후에서 1회 발생 →
  // route-agnostic. SEGMENTED 의 segmented_summary parsed JSON 도 동일 schema (source_page +
  // entities + concepts) 를 emit 하므로 normalize 가 동일하게 적용. assembleCanonicalResult
  // sourcePageBase derive 가 normalize 결과 사용 → entity/concept ## 출처 첫 줄 wikilink 도
  // normalized base 일관 (AC-C4-4 + canonicalizer.test §5.13 AC-A1-* 결합 증명).
  it('§5.13 AC-C4-6 (SEGMENTED route): segmented_summary 의 source_page 도 normalize 일관', async () => {
    const { normalizeBase } = await import('../wiki-ops.js')
    // SEGMENTED route 의 segmented_summary parsed JSON shape (= FULL parsed 동일 schema).
    // 다중 chunk merge 후 한 번의 source_page emit. normalizeSourcePageFilename 적용 검증.
    const segmentedParsed = {
      source_page: { filename: 'pmbok-overview.md', content: '# PMBOK (segmented merged)\n' },
      entities: [{ name: 'pmi', display_name: 'PMI', description: 'org', type: 'organization' }],
      concepts: [{ name: 'pmbok', display_name: 'PMBOK', description: 'standard', type: 'standard' }],
    }
    const normalized = normalizeSourcePageFilename(segmentedParsed)
    // SEGMENTED route 의 normalize 결과 = FULL 동일
    expect(normalized.source_page.filename).toBe('source-pmbok-overview.md')
    // sourcePageBase derive 도 normalized 일관 — entity/concept ## 출처 첫 줄 wikilink target
    expect(normalizeBase(normalized.source_page.filename)).toBe('source-pmbok-overview')
  })

  it('§5.13 AC-C4-defensive: 결과 immutable — 원본 parsed 변경 없음', () => {
    const parsed = {
      source_page: { filename: 'pmbok-overview.md', content: '# PMBOK\n' },
      entities: [],
      concepts: [],
    }
    const original = parsed.source_page.filename
    normalizeSourcePageFilename(parsed)
    expect(parsed.source_page.filename).toBe(original)
  })

  it('§5.13: source_page 누락 시 그대로 반환 (defensive)', () => {
    const parsed = { entities: [], concepts: [] } as any
    const result = normalizeSourcePageFilename(parsed)
    expect(result).toBe(parsed)
  })
})

describe('loadEffectiveIngestPrompt', () => {
  function makeFS(files: Record<string, string>): WikiFS {
    return {
      read: async (path: string) => {
        if (!(path in files)) throw new Error(`ENOENT: ${path}`)
        return files[path]
      },
      write: async () => {},
      exists: async (path: string) => path in files,
      list: async () => [],
    }
  }

  it('returns bundled default when override file is absent', async () => {
    const result = await loadEffectiveIngestPrompt(makeFS({}))
    expect(result).toBe(BUNDLED_INGEST_PROMPT)
  })

  it('returns override file content when present', async () => {
    const content = '나만의 시스템 프롬프트 — {{SOURCE_CONTENT}}'
    const fs = makeFS({ [INGEST_PROMPT_PATH]: content })
    const result = await loadEffectiveIngestPrompt(fs)
    expect(result).toBe(content)
  })

  it('falls back to bundled default if override read throws', async () => {
    const fs: WikiFS = {
      read: async () => { throw new Error('disk error') },
      write: async () => {},
      exists: async () => true,
      list: async () => [],
      walk: async () => [],
    }
    const result = await loadEffectiveIngestPrompt(fs)
    expect(result).toBe(BUNDLED_INGEST_PROMPT)
  })
})

// ── §4.3.1 3-stage prompt override ──

describe('loadEffectiveStage1Prompt', () => {
  function makeFS(files: Record<string, string>): WikiFS {
    return {
      read: async (path: string) => {
        if (!(path in files)) throw new Error(`ENOENT: ${path}`)
        return files[path]
      },
      write: async () => {},
      exists: async (path: string) => path in files,
      list: async () => [],
    }
  }

  it('prefers canonical stage1 path when both canonical and legacy exist', async () => {
    const canonical = '# stage1 canonical'
    const legacy = '# legacy ingest_prompt'
    const fs = makeFS({
      [STAGE1_SUMMARY_PROMPT_PATH]: canonical,
      [INGEST_PROMPT_PATH]: legacy,
    })
    const res = await loadEffectiveStage1Prompt(fs)
    expect(res.overridden).toBe(true)
    expect(res.source).toBe('stage1')
    expect(res.prompt).toBe(canonical)
  })

  it('falls back to legacy path when canonical is absent', async () => {
    const legacy = '# legacy only'
    const fs = makeFS({ [INGEST_PROMPT_PATH]: legacy })
    const res = await loadEffectiveStage1Prompt(fs)
    expect(res.source).toBe('legacy-ingest')
    expect(res.prompt).toBe(legacy)
  })

  it('returns bundled when neither override present', async () => {
    const res = await loadEffectiveStage1Prompt(makeFS({}))
    expect(res.overridden).toBe(false)
    expect(res.source).toBe('bundled')
    expect(res.prompt).toBe(BUNDLED_INGEST_PROMPT)
  })
})

describe('loadEffectiveStage2Prompt', () => {
  function makeFS(files: Record<string, string>): WikiFS {
    return {
      read: async (path: string) => {
        if (!(path in files)) throw new Error(`ENOENT: ${path}`)
        return files[path]
      },
      write: async () => {},
      exists: async (path: string) => path in files,
      list: async () => [],
    }
  }

  it('returns bundled stage2 template when no override', async () => {
    const res = await loadEffectiveStage2Prompt(makeFS({}))
    expect(res.overridden).toBe(false)
    expect(res.prompt).toBe(BUNDLED_STAGE2_MENTION_PROMPT)
    expect(res.prompt).toContain('{{CHUNK_CONTENT}}')
  })

  it('returns override content when file exists', async () => {
    const content = '나만의 mention prompt — {{SOURCE_FILENAME}} / {{CHUNK_CONTENT}}'
    const fs = makeFS({ [STAGE2_MENTION_PROMPT_PATH]: content })
    const res = await loadEffectiveStage2Prompt(fs)
    expect(res.overridden).toBe(true)
    expect(res.source).toBe('stage2')
    expect(res.prompt).toBe(content)
  })

  // Phase 5 §5.10.3.1 R0 — D-wide LLM-only ontology: type_hint 는 7-type union 강제 X.
  it('R0 (D-wide): BUNDLED_STAGE2_MENTION_PROMPT type_hint 는 자유 string (7-type union 강제 X)', () => {
    // 변경 전 표현 (LLM 출력 7-type 강제): "다음 중 하나 또는 \`unknown\`" + "분류하지 마세요" 무시
    // 변경 후: "예시" 또는 "자유" 명시. 7-type union 강제 X.
    expect(BUNDLED_STAGE2_MENTION_PROMPT).not.toMatch(/다음 중 하나 또는 `unknown`/)
    // type_hint 자유 — 예시 표현 또는 "이 외도" 같은 LLM 자율 통과 가능 명시
    expect(BUNDLED_STAGE2_MENTION_PROMPT).toMatch(/예시|이 외|기타|자유|또는 자유/)
  })
})

describe('loadEffectiveStage3Prompt', () => {
  function makeFS(files: Record<string, string>): WikiFS {
    return {
      read: async (path: string) => {
        if (!(path in files)) throw new Error(`ENOENT: ${path}`)
        return files[path]
      },
      write: async () => {},
      exists: async (path: string) => path in files,
      list: async () => [],
    }
  }

  it('returns empty prompt + overridden=false when no file (bundled 생성은 canonicalizer 내부)', async () => {
    const res = await loadEffectiveStage3Prompt(makeFS({}))
    expect(res.overridden).toBe(false)
    expect(res.prompt).toBe('')
  })

  it('returns override content when present', async () => {
    const content = '전용 canonicalizer — mentions {{MENTIONS_COUNT}}'
    const fs = makeFS({ [STAGE3_CANONICALIZE_PROMPT_PATH]: content })
    const res = await loadEffectiveStage3Prompt(fs)
    expect(res.overridden).toBe(true)
    expect(res.source).toBe('stage3')
    expect(res.prompt).toBe(content)
  })
})

describe('callLLMWithRetry — §4.5.1.6.1 determinism flag', () => {
  function makeMockLLM(): { llm: LLMClient; capturedOpts: any[] } {
    const capturedOpts: any[] = []
    const llm = {
      call: vi.fn().mockImplementation(async (_prompt: string, opts: any) => {
        capturedOpts.push(opts)
        return '```json\n{"source_page":{"filename":"s.md","content":"x"}}\n```'
      }),
    } as unknown as LLMClient
    return { llm, capturedOpts }
  }

  it('omits temperature/seed when deterministic is false', async () => {
    const { llm, capturedOpts } = makeMockLLM()
    await callLLMWithRetry(llm, 'p', 'gemini', 'gemini-2.5-flash', false)
    expect(capturedOpts).toHaveLength(1)
    expect(capturedOpts[0].temperature).toBeUndefined()
    expect(capturedOpts[0].seed).toBeUndefined()
  })

  it('injects temperature=0 and seed=42 into Gemini opts when deterministic=true', async () => {
    const { llm, capturedOpts } = makeMockLLM()
    await callLLMWithRetry(llm, 'p', 'gemini', 'gemini-2.5-flash', true)
    expect(capturedOpts[0].temperature).toBe(0)
    expect(capturedOpts[0].seed).toBe(42)
    expect(capturedOpts[0].responseMimeType).toBe('application/json')
    expect(capturedOpts[0].jsonMode).toBe(true)
  })

  it('injects temperature=0 and seed=42 into non-Gemini opts too', async () => {
    const { llm, capturedOpts } = makeMockLLM()
    await callLLMWithRetry(llm, 'p', 'ollama', 'qwen3:8b', true)
    expect(capturedOpts[0].temperature).toBe(0)
    expect(capturedOpts[0].seed).toBe(42)
    expect(capturedOpts[0].jsonMode).toBe(true)
  })

  it('omits determinism opts when flag is undefined', async () => {
    const { llm, capturedOpts } = makeMockLLM()
    await callLLMWithRetry(llm, 'p', 'gemini', 'gemini-2.5-flash')
    expect(capturedOpts[0].temperature).toBeUndefined()
    expect(capturedOpts[0].seed).toBeUndefined()
  })
})

describe('defaultOcrEngine — §4.1.3 platform fallback', () => {
  it('macOS 에서는 ocrmac (Apple Vision, 한국어 우수)', () => {
    // 이 테스트 환경이 macOS 인 경우만 검증. 아니면 rapidocr 기대.
    const expected = process.platform === 'darwin' ? 'ocrmac' : 'rapidocr'
    expect(defaultOcrEngine()).toBe(expected)
  })
})

describe('defaultOcrLangForEngine — §4.1.3 engine 별 lang 코드 매핑', () => {
  it('ocrmac → BCP-47 (ko-KR,en-US)', () => {
    expect(defaultOcrLangForEngine('ocrmac')).toBe('ko-KR,en-US')
  })

  it('rapidocr → 언어명 (korean,english) — paddleOCR 모델', () => {
    expect(defaultOcrLangForEngine('rapidocr')).toBe('korean,english')
  })

  it('easyocr → ISO 639-1 (ko,en)', () => {
    expect(defaultOcrLangForEngine('easyocr')).toBe('ko,en')
  })

  it('tesseract → ISO 639-2 (kor,eng)', () => {
    expect(defaultOcrLangForEngine('tesseract')).toBe('kor,eng')
    expect(defaultOcrLangForEngine('tesserocr')).toBe('kor,eng')
  })

  it('unknown engine → fallback (ko-KR,en-US)', () => {
    expect(defaultOcrLangForEngine('unknown-engine')).toBe('ko-KR,en-US')
  })
})

describe('buildDoclingArgs — §4.1.3 engine 별 lang 자동 매핑', () => {
  it('config DOCLING_OCR_ENGINE=rapidocr 지정 시 lang 도 korean,english 로 자동', () => {
    const args = buildDoclingArgs('/tmp/p.pdf', '/tmp/out', { DOCLING_OCR_ENGINE: 'rapidocr' } as any, 'default')
    expect(args).toContain('--ocr-engine')
    expect(args[args.indexOf('--ocr-engine') + 1]).toBe('rapidocr')
    expect(args).toContain('--ocr-lang')
    expect(args[args.indexOf('--ocr-lang') + 1]).toBe('korean,english')
  })

  it('config DOCLING_OCR_LANG 명시 지정 시 해당 값 우선', () => {
    const args = buildDoclingArgs('/tmp/p.pdf', '/tmp/out', {
      DOCLING_OCR_ENGINE: 'rapidocr',
      DOCLING_OCR_LANG: 'korean,english,chinese',
    } as any, 'default')
    expect(args[args.indexOf('--ocr-lang') + 1]).toBe('korean,english,chinese')
  })
})

describe('buildDoclingArgs — §4.1.3.1 mode parameter', () => {
  it("mode='default' (기본값): docling CLI 기본값 유지 — --no-ocr/--force-ocr 없음, ocr-engine/lang 포함", () => {
    const args = buildDoclingArgs('/tmp/p.pdf', '/tmp/out')
    expect(args).not.toContain('--no-ocr')
    expect(args).not.toContain('--force-ocr')
    expect(args).toContain('--ocr-engine')
    expect(args).toContain('--ocr-lang')
  })

  it("mode='default' 명시: 기본값과 동일 동작", () => {
    const args = buildDoclingArgs('/tmp/p.pdf', '/tmp/out', undefined, 'default')
    expect(args).not.toContain('--no-ocr')
    expect(args).not.toContain('--force-ocr')
    expect(args).toContain('--ocr-engine')
  })

  it("mode='no-ocr': --no-ocr 포함, ocr-engine/lang 생략 (bitmap OCR 억제)", () => {
    const args = buildDoclingArgs('/tmp/p.pdf', '/tmp/out', undefined, 'no-ocr')
    expect(args).toContain('--no-ocr')
    expect(args).not.toContain('--force-ocr')
    expect(args).not.toContain('--ocr-engine')
    expect(args).not.toContain('--ocr-lang')
  })

  it("mode='force-ocr': --force-ocr + ocr-engine/lang 포함, --no-ocr 없음", () => {
    const args = buildDoclingArgs('/tmp/p.pdf', '/tmp/out', undefined, 'force-ocr')
    expect(args).toContain('--force-ocr')
    expect(args).toContain('--ocr-engine')
    expect(args).toContain('--ocr-lang')
    expect(args).not.toContain('--no-ocr')
  })

  it('공통 args: source path, --to md, --output, --table-mode, --device, --image-export-mode 포함', () => {
    const args = buildDoclingArgs('/tmp/p.pdf', '/tmp/out')
    expect(args[0]).toBe('/tmp/p.pdf')
    expect(args).toContain('--to')
    expect(args).toContain('md')
    expect(args).toContain('--output')
    expect(args).toContain('/tmp/out')
    expect(args).toContain('--table-mode')
    expect(args).toContain('--device')
    expect(args).toContain('--image-export-mode')
    expect(args).toContain('embedded')
  })
})

describe('assertNotWikiPath', () => {
  it('rejects bare wiki/* path', () => {
    expect(() => assertNotWikiPath('wiki/sources/foo.md', 'ingest')).toThrow(/cannot ingest from wiki/)
  })

  it('rejects wiki at root (no trailing slash)', () => {
    expect(() => assertNotWikiPath('wiki', 'ingest')).toThrow(/cannot ingest from wiki/)
  })

  it('rejects ./wiki/* relative path', () => {
    expect(() => assertNotWikiPath('./wiki/entities/foo.md', 'generateBrief')).toThrow(/generateBrief: cannot ingest from wiki/)
  })

  it('rejects /wiki/* absolute-style path', () => {
    expect(() => assertNotWikiPath('/wiki/concepts/foo.md', 'ingest')).toThrow(/cannot ingest from wiki/)
  })

  it('allows raw/* paths', () => {
    expect(() => assertNotWikiPath('raw/0_inbox/foo.pdf', 'ingest')).not.toThrow()
  })

  it('allows paths that merely contain wiki as a substring', () => {
    expect(() => assertNotWikiPath('raw/3_resources/wikipedia-export.md', 'ingest')).not.toThrow()
    expect(() => assertNotWikiPath('raw/wiki-archive/foo.md', 'ingest')).not.toThrow()
  })

  it('embeds the offending path and caller in the error', () => {
    try {
      assertNotWikiPath('wiki/foo.md', 'myCaller')
      throw new Error('should have thrown')
    } catch (err: unknown) {
      const msg = (err as Error).message
      expect(msg).toContain('myCaller')
      expect(msg).toContain('wiki/foo.md')
    }
  })
})

/**
 * §5.17 Step B (RED) — Spec 2 + Spec 3 invariants
 *
 * Spec 2 (write phase batching):
 *   I5 (per-file atomic 유지): WikiFS.write 각 호출은 atomic — 추가 layer X
 *   I6 (batch progress yield): 매 5~10 page 마다 microtask yield (await Promise/setTimeout(0))
 *   I7 (index/log batch flush): index.md / log.md 갱신은 loop 종료 후 1회 atomic write
 *   I8 (cancel rollback): cancel 시 partial 보존 + log.md `cancelled` 표시
 *
 * Spec 3 (HWP 변환 품질 진단 WARN telemetry):
 *   body < 1,000 char + raw > 10 KB → WARN log + Notice 발화 (v0.3 정정: 500 → 1,000)
 *   case B: 842 char / 16896 B → WARN (case A typical: 5000 char / 10000 B → no WARN)
 *
 * 통과 조건: 신규 export `writePagesWithBatchYield` + `assessConversionQuality` 가
 * implement 되어야 PASS. 현 코드 미구현 → RED FAIL.
 */
describe('§5.17 writePagesWithBatchYield — Spec 2 I6/I7/I8 + I5', () => {
  // T13 ↔ Spec 2 I6 batch yield
  it('T13 ↔ Spec 2 I6: 50 page write 시 매 5~10 page 마다 microtask yield 발생', async () => {
    const { writePagesWithBatchYield } = await import('../ingest-pipeline.js') as any
    const writes: string[] = []
    const wikiFS: any = {
      async write(path: string) { writes.push(path) },
      async exists() { return false },
      async read() { return '' },
      async list() { return [] },
    }
    const pages = Array.from({ length: 50 }, (_, i) => ({
      filename: `page-${i}.md`,
      category: 'entities',
      content: `# page ${i}\n`,
    }))
    // setTimeout spy — yield invocation count 측정
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
    await writePagesWithBatchYield({ wikiFS, pages, batchSize: 10 })
    // 50 page / batchSize 10 = 5 batch → yield 최소 4회 (마지막 batch 후 생략 가능)
    const yieldCalls = setTimeoutSpy.mock.calls.filter((c: any[]) => c[1] === 0)
    expect(yieldCalls.length).toBeGreaterThanOrEqual(4)
    expect(writes).toHaveLength(50)
    setTimeoutSpy.mockRestore()
  })

  // T14 ↔ Spec 2 I7 index/log batch flush
  it('T14 ↔ Spec 2 I7: index/log 갱신은 page write 후 1회만 (loop 안에서 N회 호출 X)', async () => {
    const { writePagesWithBatchYield } = await import('../ingest-pipeline.js') as any
    const writes: string[] = []
    const wikiFS: any = {
      async write(path: string) { writes.push(path) },
      async exists() { return false },
      async read() { return '' },
      async list() { return [] },
    }
    const pages = Array.from({ length: 20 }, (_, i) => ({
      filename: `page-${i}.md`,
      category: 'entities',
      content: `# page ${i}\n`,
    }))
    await writePagesWithBatchYield({ wikiFS, pages, batchSize: 5 })
    // page write loop 안에서는 index.md / log.md 에 write 일어나지 않아야 함
    const indexWrites = writes.filter((p) => p.endsWith('index.md'))
    const logWrites = writes.filter((p) => p.endsWith('log.md'))
    expect(indexWrites).toHaveLength(0)
    expect(logWrites).toHaveLength(0)
    // 20 page 모두 write
    expect(writes).toHaveLength(20)
  })

  // T15 ↔ Spec 2 I8 cancel partial
  it('T15 ↔ Spec 2 I8: cancel signal mid-write → 이미 write 된 page 잔존 (rollback X)', async () => {
    const { writePagesWithBatchYield } = await import('../ingest-pipeline.js') as any
    const writes: string[] = []
    const wikiFS: any = {
      async write(path: string) { writes.push(path) },
      async exists() { return false },
      async read() { return '' },
      async list() { return [] },
    }
    const pages = Array.from({ length: 30 }, (_, i) => ({
      filename: `page-${i}.md`,
      category: 'entities',
      content: `# page ${i}\n`,
    }))
    const controller = new AbortController()
    // 10 page write 후 cancel
    let count = 0
    const wikiFSWithCancel: any = {
      async write(path: string) {
        writes.push(path)
        count++
        if (count === 10) controller.abort()
      },
      async exists() { return false },
      async read() { return '' },
      async list() { return [] },
    }
    let cancelled = false
    try {
      await writePagesWithBatchYield({
        wikiFS: wikiFSWithCancel,
        pages,
        batchSize: 5,
        signal: controller.signal,
      })
    } catch (e) {
      cancelled = (e as Error).name === 'AbortError' || (e as Error).message.includes('cancel') || (e as Error).message.includes('abort')
    }
    // partial 보존 — 이미 write 된 page 는 rollback 안 됨
    expect(writes.length).toBeGreaterThanOrEqual(10)
    expect(writes.length).toBeLessThan(30)
    expect(cancelled).toBe(true)
  })
})

describe('§5.17 assessConversionQuality — Spec 3 HWP 변환 품질 WARN telemetry', () => {
  // T16 ↔ Spec 3 case B 842 char / 16896 B → WARN 발화
  it('T16 ↔ Spec 3 case B: body < 1,000 char + raw > 10 KB → WARN ({warn: true, ...})', async () => {
    const { assessConversionQuality } = await import('../ingest-pipeline.js') as any
    const result = assessConversionQuality({
      bodyCharLen: 842,
      rawByteLen: 16896,
    })
    expect(result.warn).toBe(true)
    expect(result.message).toMatch(/변환 품질 의심|conversion|quality/i)
    // 본문 N자 / 원본 NKB 정량 포함
    expect(result.message).toMatch(/842/)
  })

  // T17 ↔ Spec 3 typical case 5000 char / 10000 B → no WARN
  it('T17 ↔ Spec 3 typical: body 5000 char / raw 10000 B → warn=false', async () => {
    const { assessConversionQuality } = await import('../ingest-pipeline.js') as any
    const result = assessConversionQuality({
      bodyCharLen: 5000,
      rawByteLen: 10000,
    })
    expect(result.warn).toBe(false)
  })
})
