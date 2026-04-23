import { describe, it, expect } from 'vitest'
import { classifyFile, classifyFileAsync, classifyWithLLM, clearClassifyRulesCache } from '../classify.js'
import type { HttpClient, HttpRequestOptions, HttpResponse, WikeyConfig, WikiFS } from '../types.js'

// ── LLM test helpers (reused for S3-1 / S3-4) ──

function mockHttpOnce(body: string): {
  client: HttpClient
  lastPrompt(): string
  calls: Array<{ url: string; opts: HttpRequestOptions }>
} {
  const calls: Array<{ url: string; opts: HttpRequestOptions }> = []
  return {
    client: {
      async request(url: string, opts: HttpRequestOptions): Promise<HttpResponse> {
        calls.push({ url, opts })
        return { status: 200, body }
      },
    },
    lastPrompt(): string {
      const opts = calls[calls.length - 1]?.opts
      if (!opts?.body) return ''
      try {
        const payload = JSON.parse(opts.body)
        // Gemini payload shape
        return payload?.contents?.[0]?.parts?.[0]?.text ?? ''
      } catch {
        return opts.body
      }
    },
    calls,
  }
}

function memFS(files: Record<string, string>, listMap: Record<string, string[]> = {}): WikiFS {
  const store = new Map(Object.entries(files))
  return {
    async read(path: string): Promise<string> {
      if (!store.has(path)) throw new Error(`ENOENT ${path}`)
      return store.get(path)!
    },
    async write(path: string, content: string): Promise<void> {
      store.set(path, content)
    },
    async exists(path: string): Promise<boolean> {
      return store.has(path)
    },
    async list(dir: string): Promise<string[]> {
      return listMap[dir] ?? []
    },
  }
}

const classifyBaseConfig: WikeyConfig = {
  WIKEY_BASIC_MODEL: 'gemini',
  WIKEY_SEARCH_BACKEND: 'basic',
  WIKEY_MODEL: 'wikey',
  WIKEY_QMD_TOP_N: 5,
  GEMINI_API_KEY: 'k',
  ANTHROPIC_API_KEY: '',
  OPENAI_API_KEY: '',
  OLLAMA_URL: 'http://localhost:11434',
  INGEST_PROVIDER: 'gemini',
  LINT_PROVIDER: '',
  SUMMARIZE_PROVIDER: '',
  CONTEXTUAL_MODEL: 'gemma4',
  COST_LIMIT: 50,
}

function geminiBody(text: string): string {
  return JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })
}

describe('classifyFile — 2차 서브폴더 라우팅 (CLASSIFY.md 기준)', () => {
  it('.meta.yaml → empty destination (URI reference)', () => {
    const r = classifyFile('api-spec.meta.yaml', false)
    expect(r.destination).toBe('')
  })

  it('folder → raw/3_resources/ (LLM judgment needed)', () => {
    const r = classifyFile('product-bundle', true)
    expect(r.destination).toBe('raw/3_resources/')
  })

  it('PDF with manual/guide keyword → 30_manual (when 3차 키워드 없음)', () => {
    expect(classifyFile('User-Guide-v1.pdf', false).destination).toBe('raw/3_resources/30_manual/')
    expect(classifyFile('Generic-Handbook.pdf', false).destination).toBe('raw/3_resources/30_manual/')
    expect(classifyFile('일반사용법.pdf', false).destination).toBe('raw/3_resources/30_manual/')
  })

  it('PDF with report/paper keyword → 20_report (when 3차 키워드 없음)', () => {
    expect(classifyFile('Q3-Report-2026.pdf', false).destination).toBe('raw/3_resources/20_report/')
    expect(classifyFile('annual-analysis.pdf', false).destination).toBe('raw/3_resources/20_report/')
    expect(classifyFile('분기리포트.pdf', false).destination).toBe('raw/3_resources/20_report/')
  })

  it('PDF without manual/report keyword → empty destination (LLM fallback)', () => {
    const r = classifyFile('unknown-document.pdf', false)
    expect(r.destination).toBe('')
    expect(r.needsThirdLevel).toBe(true)
  })

  it('PDF with report keyword but no Dewey match → 2차 only + needsThirdLevel', () => {
    const r = classifyFile('Q3-Report-ambiguous.pdf', false)
    expect(r.destination).toBe('raw/3_resources/20_report/')
    expect(r.needsThirdLevel).toBe(true)
  })

  it('DEWEY expansion — 10 categories cover social/philosophy/religion/language/literature/history', () => {
    // DDC 300 social — 사업자등록증 style (report keyword triggers 2차)
    expect(classifyFile('corporate-registration-report.pdf', false).destination).toBe('raw/3_resources/20_report/300_social_sciences/')
    // DDC 100 philosophy
    expect(classifyFile('philosophy-ethics-paper.pdf', false).destination).toBe('raw/3_resources/20_report/100_philosophy_psychology/')
    // DDC 200 religion
    expect(classifyFile('buddhism-scripture-report.pdf', false).destination).toBe('raw/3_resources/20_report/200_religion/')
    // DDC 400 language
    expect(classifyFile('linguistic-grammar-analysis.pdf', false).destination).toBe('raw/3_resources/20_report/400_language/')
    // DDC 800 literature
    expect(classifyFile('novel-literature-analysis.pdf', false).destination).toBe('raw/3_resources/20_report/800_literature/')
    // DDC 900 history
    expect(classifyFile('history-biography-report.pdf', false).destination).toBe('raw/3_resources/20_report/900_history_geography/')
  })

  it('markdown / txt → 60_note (when 3차 키워드 없음)', () => {
    expect(classifyFile('diary.md', false).destination).toBe('raw/3_resources/60_note/')
    expect(classifyFile('thoughts.txt', false).destination).toBe('raw/3_resources/60_note/')
  })

  it('CAD format default (ext matches 3차 keyword list via stl/step/3mf, but bare filename has no other keyword)', () => {
    // stl/step/3mf are both 확장자 AND 3차 keywords → always routed to 600_technology (DDC applied sciences)
    expect(classifyFile('part.stl', false).destination).toBe('raw/3_resources/40_cad/600_technology/')
    expect(classifyFile('mount.step', false).destination).toBe('raw/3_resources/40_cad/600_technology/')
    expect(classifyFile('widget.3mf', false).destination).toBe('raw/3_resources/40_cad/600_technology/')
  })

  it('source code → 50_firmware (keyword-free names)', () => {
    expect(classifyFile('helper.c', false).destination).toBe('raw/3_resources/50_firmware/')
    expect(classifyFile('parser.cpp', false).destination).toBe('raw/3_resources/50_firmware/')
    expect(classifyFile('blink.ino', false).destination).toBe('raw/3_resources/50_firmware/')
    expect(classifyFile('util.py', false).destination).toBe('raw/3_resources/50_firmware/')
  })

  it('binary .bin/.exe → 50_firmware (keyword-free; firmware keyword matches 500_technology)', () => {
    expect(classifyFile('image.bin', false).destination).toBe('raw/3_resources/50_firmware/')
    expect(classifyFile('installer.exe', false).destination).toBe('raw/3_resources/50_firmware/')
  })

  it('unknown extension → empty destination (LLM fallback)', () => {
    const r = classifyFile('weird.xyz', false)
    expect(r.destination).toBe('')
    expect(r.needsThirdLevel).toBe(true)
  })
})

describe('classifyFile — 3차 Dewey Decimal (DDC 표준 10대분류)', () => {
  it('AI/LLM/임베디드/컴퓨팅 → 000_computer_science', () => {
    expect(classifyFile('Raspberry_Pi_Getting_Started.pdf', false).destination)
      .toBe('raw/3_resources/30_manual/000_computer_science/')
    expect(classifyFile('llm-research-note.md', false).destination)
      .toBe('raw/3_resources/60_note/000_computer_science/')
    expect(classifyFile('arduino-programming-guide.pdf', false).destination)
      .toBe('raw/3_resources/30_manual/000_computer_science/')
  })

  it('물리/화학/수학/반도체 → 500_natural_science', () => {
    expect(classifyFile('SiC-physics-handbook.pdf', false).destination)
      .toBe('raw/3_resources/30_manual/500_natural_science/')
    expect(classifyFile('quantum-mechanics-note.md', false).destination)
      .toBe('raw/3_resources/60_note/500_natural_science/')
    expect(classifyFile('반도체-이론-매뉴얼.pdf', false).destination)
      .toBe('raw/3_resources/30_manual/500_natural_science/')
  })

  it('회로/CAD/기계/통신/RF → 600_technology', () => {
    expect(classifyFile('pcb-layout-guide.pdf', false).destination)
      .toBe('raw/3_resources/30_manual/600_technology/')
    expect(classifyFile('chassis.stl', false).destination)
      .toBe('raw/3_resources/40_cad/600_technology/')
    expect(classifyFile('bldc-motor-design-guide.pdf', false).destination)
      .toBe('raw/3_resources/30_manual/600_technology/')
    expect(classifyFile('DJI_O3_Air_Unit_Manual.pdf', false).destination)
      .toBe('raw/3_resources/30_manual/600_technology/')
    expect(classifyFile('nanovna-v2-user-guide.pdf', false).destination)
      .toBe('raw/3_resources/30_manual/600_technology/')
    expect(classifyFile('malahit-dsp-review.md', false).destination)
      .toBe('raw/3_resources/60_note/600_technology/')
  })

  it('취미/여가/오디오/키보드 → 700_arts_recreation', () => {
    expect(classifyFile('Kyosho-MR-04-Manual.pdf', false).destination)
      .toBe('raw/3_resources/30_manual/700_arts_recreation/')
    expect(classifyFile('hotas-setup.md', false).destination)
      .toBe('raw/3_resources/60_note/700_arts_recreation/')
  })

  it('PDF with no manual/report keyword → empty destination (LLM fallback)', () => {
    const r = classifyFile('random-document.pdf', false)
    expect(r.destination).toBe('')
    expect(r.needsThirdLevel).toBe(true)
  })

  it('md/txt with no keyword match → 2차 only + needsThirdLevel', () => {
    const r = classifyFile('meeting-2026.md', false)
    expect(r.destination).toBe('raw/3_resources/60_note/')
    expect(r.needsThirdLevel).toBe(true)
  })

  it('우선순위: sic 키워드 매칭 시 500_natural_science (반도체 물성)', () => {
    expect(classifyFile('sic-datasheet.pdf', false).destination)
      .toBe('raw/3_resources/30_manual/500_natural_science/')
  })
})

// ── §4.2.3 Stage 3 S3-1: classifyWithLLM 4차 slug 힌트 ──

describe('classifyWithLLM — 4차 제품 slug 힌트 주입 (§4.2.3 S3-1)', () => {
  it('기존 NNN_topic 폴더가 있으면 prompt 에 재사용 우선 힌트로 inject', async () => {
    clearClassifyRulesCache()
    const http = mockHttpOnce(geminiBody(
      'json\n' +
      '```json\n{"destination":"raw/3_resources/30_manual/500_natural_science/300_pms/","reason":"기존 슬러그 재사용"}\n```',
    ))
    const wikiFS = memFS({}, {
      'raw/3_resources/30_manual/500_natural_science/': [
        '100_physics_intro',
        '300_pms',
        'not_a_slug.pdf', // 파일은 무시
      ],
    })

    const result = await classifyWithLLM(
      'PMS_Manual_v2.pdf',
      false,
      'raw/3_resources/30_manual/500_natural_science/',
      { wikiFS, httpClient: http.client, config: classifyBaseConfig },
    )

    const prompt = http.lastPrompt()
    expect(prompt).toContain('기존 NNN_topic')
    expect(prompt).toContain('100_physics_intro')
    expect(prompt).toContain('300_pms')
    expect(prompt).not.toContain('not_a_slug.pdf')
    expect(result.destination).toBe('raw/3_resources/30_manual/500_natural_science/300_pms/')
  })

  it('기존 슬러그 없으면 "신규 slug 생성 가이드" 안내', async () => {
    clearClassifyRulesCache()
    const http = mockHttpOnce(geminiBody(
      '```json\n{"destination":"raw/3_resources/30_manual/600_technology/150_new_device/","reason":"신규 제품"}\n```',
    ))
    const wikiFS = memFS({}, {
      'raw/3_resources/30_manual/600_technology/': [], // 비어있음
    })

    const result = await classifyWithLLM(
      'BrandNew_Device.pdf',
      false,
      'raw/3_resources/30_manual/600_technology/',
      { wikiFS, httpClient: http.client, config: classifyBaseConfig },
    )

    const prompt = http.lastPrompt()
    expect(prompt).toContain('기존 NNN_topic')
    expect(prompt).toMatch(/(없음|비어 있음|없\b|empty)/i)
    expect(result.destination).toBe('raw/3_resources/30_manual/600_technology/150_new_device/')
  })

  it('JSON 파싱 실패 → 2차 힌트로 fallback', async () => {
    clearClassifyRulesCache()
    const http = mockHttpOnce(geminiBody('이건 JSON 이 아닙니다'))
    const wikiFS = memFS({}, {})

    const result = await classifyWithLLM(
      'unknown.pdf',
      false,
      'raw/3_resources/30_manual/',
      { wikiFS, httpClient: http.client, config: classifyBaseConfig },
    )

    expect(result.destination).toBe('raw/3_resources/30_manual/')
    expect(result.reason).toContain('파싱 실패')
  })

  it('WikiFS.list 가 full path 반환해도 basename 정규화 후 slug 매칭', async () => {
    clearClassifyRulesCache()
    const http = mockHttpOnce(geminiBody(
      '```json\n{"destination":"raw/3_resources/30_manual/500_natural_science/300_pms/","reason":"ok"}\n```',
    ))
    const parent = 'raw/3_resources/30_manual/500_natural_science/'
    const wikiFS = memFS({}, {
      [parent]: [
        // Obsidian 반환 형태 — full vault path
        `${parent}100_physics_intro`,
        `${parent}300_pms`,
        `${parent}readme.md`, // 파일은 무시
      ],
    })

    await classifyWithLLM(
      'PMS_v2.pdf',
      false,
      parent,
      { wikiFS, httpClient: http.client, config: classifyBaseConfig },
    )

    const prompt = http.lastPrompt()
    expect(prompt).toContain('100_physics_intro')
    expect(prompt).toContain('300_pms')
    expect(prompt).not.toContain('readme.md')
  })

  it('resolveProvider("classify") 를 사용한다 — CLASSIFY_PROVIDER override 가 적용됨', async () => {
    clearClassifyRulesCache()
    const http = mockHttpOnce(geminiBody(
      '```json\n{"destination":"raw/3_resources/","reason":"ok"}\n```',
    ))
    const wikiFS = memFS({}, {})

    // INGEST_PROVIDER 는 anthropic 이지만 CLASSIFY_PROVIDER=gemini 로 override
    const config = {
      ...classifyBaseConfig,
      ANTHROPIC_API_KEY: 'k',
      INGEST_PROVIDER: 'anthropic',
      CLASSIFY_PROVIDER: 'gemini',
    }

    await classifyWithLLM(
      'any.pdf',
      false,
      'raw/3_resources/',
      { wikiFS, httpClient: http.client, config },
    )

    expect(http.calls).toHaveLength(1)
    expect(http.calls[0].url).toContain('generativelanguage.googleapis.com')
  })

  it('paraRoot 제약 전달 시 prompt 에 "반드시 <paraRoot>/ 로 시작" constraint 주입', async () => {
    clearClassifyRulesCache()
    const http = mockHttpOnce(geminiBody(
      '```json\n{"destination":"raw/1_projects/30_manual/600_technology/","reason":"scoped"}\n```',
    ))
    const wikiFS = memFS({}, {})
    await classifyWithLLM(
      'Mystery-Paper.pdf',
      false,
      'raw/3_resources/30_manual/',
      { wikiFS, httpClient: http.client, config: classifyBaseConfig },
      'raw/1_projects',
    )
    const prompt = http.lastPrompt()
    expect(prompt).toContain('필수 제약')
    expect(prompt).toContain('raw/1_projects/')
  })
})

describe('classifyFileAsync — paraRoot 옵션 (수동 PARA 지정)', () => {
  it('hardcoded rules 가 정상 결정 시 PARA prefix 를 지정값으로 swap', async () => {
    // 여기선 LLM 호출 없음. needsThirdLevel=false 경로만 확인.
    clearClassifyRulesCache()
    const wikiFS = memFS({}, {})
    const http = mockHttpOnce('') // 불릴 일 없음
    const res = await classifyFile('AI_report_analysis.pdf', false)
    // rules 는 raw/3_resources/20_report/000_computer_science/ 방향
    expect(res.destination.startsWith('raw/3_resources/')).toBe(true)
    const withPara = await classifyFileAsync(
      'AI_report_analysis.pdf',
      false,
      { wikiFS, httpClient: http.client, config: classifyBaseConfig },
      { paraRoot: 'raw/2_areas' },
    )
    expect(withPara.destination.startsWith('raw/2_areas/')).toBe(true)
    expect(withPara.destination.endsWith(res.destination.replace(/^raw\/[1-4]_[a-z_]+/, ''))).toBe(true)
  })

  it('LLM fallback 결과의 PARA 를 지정값으로 강제 swap (LLM 오답 방어)', async () => {
    clearClassifyRulesCache()
    // LLM 이 raw/4_archive 로 잘못 돌려도 paraRoot=raw/1_projects 로 swap 되어야 함.
    const http = mockHttpOnce(geminiBody(
      '```json\n{"destination":"raw/4_archive/30_manual/600_technology/510_pms/","reason":"x"}\n```',
    ))
    const wikiFS = memFS({}, {})
    const res = await classifyFileAsync(
      'Unknown.pdf',
      false,
      { wikiFS, httpClient: http.client, config: classifyBaseConfig },
      { paraRoot: 'raw/1_projects' },
    )
    expect(res.destination).toBe('raw/1_projects/30_manual/600_technology/510_pms/')
  })
})
