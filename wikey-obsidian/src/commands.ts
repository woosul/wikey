import { FuzzySuggestModal, Notice, TFile } from 'obsidian'
import type WikeyPlugin from './main'
import {
  generateBrief,
  ingest,
  PlanRejectedError,
  PiiIngestBlockedError,
  IngestCancelledByUserError,
  type IngestPlan,
  type SkippedIngestResult,
  type ConflictInfo,
  classifyFileAsync,
  movePair,
  loadRegistry,
  saveRegistry,
  registryRecordDelete,
  computeDeletionImpact,
  previewReset,
  REGISTRY_PATH,
  QMD_INDEX_MARKER,
  SETTINGS_MARKER,
  type ResetScope,
  reindexQuick,
  convertSourceToMarkdown,
  type ConversionResult,
  needsWikilinkSanitize,
  sanitizeWikilinkTarget,
} from 'wikey-core'
import { ConflictModal, type ConflictChoice } from './conflict-modal'
import { WIKEY_CHAT_VIEW } from './sidebar-chat'
import { IngestFlowModal } from './ingest-modals'
import { DeleteImpactModal, ResetImpactModal } from './reset-modals'

export function registerCommands(plugin: WikeyPlugin): void {
  // Cmd+Shift+I: Ingest current note
  plugin.addCommand({
    id: 'ingest-current-note',
    name: 'Ingest current note',
    hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'i' }],
    checkCallback: (checking) => {
      const file = plugin.app.workspace.getActiveFile()
      if (!file) return false
      if (checking) return true
      // §5.2.9: raw/0_inbox/ 에서 트리거 시 audit panel 과 동일하게 자동 분류 +
      // movePair (CLASSIFY.md + LLM fallback). 그렇지 않으면 inbox 잔재 + 답변 의
      // 원본 backlink 가 inbox 가리킴 (사용자 의문 발생).
      const autoMove = file.path.startsWith('raw/0_inbox/')
      runIngest(
        plugin,
        file.path,
        (s, t, m) => new Notice(`${s}/${t} ${m}`),
        { autoMoveFromInbox: autoMove },
      ).then((r) => {
        if (r.success) new Notice(`인제스트 완료: ${r.createdPages.length}개 페이지`)
        else new Notice(`인제스트 실패: ${r.error}`)
      })
      return true
    },
  })

  // Command palette: Ingest file (picker)
  plugin.addCommand({
    id: 'ingest-file',
    name: 'Ingest file...',
    callback: () => {
      new IngestFileSuggestModal(plugin).open()
    },
  })

  // Obsidian URI protocol
  plugin.registerObsidianProtocolHandler('wikey', async (params) => {
    if (params.query) {
      await plugin.activateChatView()
      // Trigger query in chat view after a short delay for view to mount
      setTimeout(() => {
        const leaves = plugin.app.workspace.getLeavesOfType(WIKEY_CHAT_VIEW)
        if (leaves.length > 0) {
          const view = leaves[0].view as any
          if (view.inputEl) {
            view.inputEl.value = params.query
            view.handleSend?.()
          }
        }
      }, 300)
    }

    if (params.ingest) {
      runIngest(plugin, params.ingest)
    }
  })

  // ── §4.5.2 Delete safety ──
  registerDeleteCommand(plugin)
  registerResetCommand(plugin)

  // ── §5.7.2 PoC — Orama in Electron renderer (TEMPORARY, revert after verify) ──
  registerOramaPoCCommand(plugin)
  registerKiwiOramaPoCCommand(plugin)
  registerOramaBenchmarkCommand(plugin)
}

// §5.7.2 PoC 단계 3: Quality benchmark — wiki/ 전체 corpus 로 Orama vs qmd 비교 (BM25)
function registerOramaBenchmarkCommand(plugin: WikeyPlugin): void {
  plugin.addCommand({
    id: 'wikey-poc-orama-benchmark',
    name: 'Wikey: PoC — Orama benchmark (10 query vs qmd)',
    callback: async () => {
      try {
        const path = require('node:path') as typeof import('node:path')
        const fs = require('node:fs') as typeof import('node:fs')
        const os = require('node:os') as typeof import('node:os')
        const initKiwi = (await import('kiwi-nlp/dist/build/kiwi-wasm.js')).default
        const orama = await import('@orama/orama')

        const projectRoot = (plugin.app.vault.adapter as any).basePath as string
        const wasmPath = path.join(projectRoot, 'node_modules/kiwi-nlp/dist/kiwi-wasm.wasm')
        const wasmBinary = fs.readFileSync(wasmPath)
        const kiwiModule: any = await initKiwi({
          wasmBinary,
          instantiateWasm: (imports: any, cb: any) => {
            WebAssembly.instantiate(wasmBinary, imports).then((r: any) => cb(r.instance, r.module))
            return {}
          },
        })

        const modelDir = path.join(os.homedir(), '.cache/wikey/kiwi-models/cong/base')
        const modelPath = 'm' + Date.now()
        kiwiModule.FS.mkdir(modelPath)
        for (const fn of ['sj.morph','default.dict','dialect.dict','multi.dict','typo.dict','combiningRule.txt','cong.mdl','extract.mdl','nounchr.mdl']) {
          kiwiModule.FS.writeFile(modelPath + '/' + fn, fs.readFileSync(path.join(modelDir, fn)))
        }
        const apiCmd = (args: any) => JSON.parse(kiwiModule.api(JSON.stringify(args)))
        const id = apiCmd({ method: 'build', args: [{ modelPath, integrateAllomorph: true, loadDefaultDict: true, loadTypoDict: true }] })
        const kiwi: any = new Proxy({}, {
          get: (_t, prop) => {
            if (prop === 'then') return undefined
            return (...a: any[]) => apiCmd({ method: prop.toString(), id, args: a })
          },
        })

        // wikey-style tokenizer (smart_tokenize alphanumeric 보존 + content POS 필터)
        const CONTENT_POS = new Set(['NNG','NNP','NNB','NR','VV','VA','VX','MAG','XR','SL','SN','SH'])
        const ALNUM = /^[A-Za-z0-9][A-Za-z0-9.\-_]*[A-Za-z0-9]$|^[A-Za-z0-9]$/
        const tokenizeFn = (text: string): string[] => {
          if (!text || typeof text !== 'string') return []
          const result: string[] = []
          for (const word of text.split(/\s+/)) {
            if (!word) continue
            if (ALNUM.test(word)) { result.push(word); continue }
            for (const t of kiwi.tokenize(word)) {
              const tag = t.tag.split('-')[0]
              if (CONTENT_POS.has(tag)) result.push(t.str.toLowerCase())
            }
          }
          return result
        }

        const db = await orama.create({
          schema: { id: 'string', title: 'string', body: 'string' },
          components: {
            tokenizer: {
              language: 'korean',
              normalizationCache: new Map(),
              tokenize: tokenizeFn,
            } as any,
          },
        })

        // wiki/ 전체 .md walk
        const walk = (dir: string, out: string[] = []): string[] => {
          for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, f.name)
            if (f.isDirectory()) walk(p, out)
            else if (f.name.endsWith('.md')) out.push(p)
          }
          return out
        }
        const wikiDir = path.join(projectRoot, 'wiki')
        const files = walk(wikiDir)

        const t0 = Date.now()
        const docs: Array<{ id: string; title: string; body: string }> = []
        for (const f of files) {
          const raw = fs.readFileSync(f, 'utf-8')
          // Strip frontmatter (YAML between ---...---)
          const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
          let body = fmMatch ? fmMatch[2] : raw
          let title = path.basename(f, '.md')
          if (fmMatch) {
            const titleMatch = fmMatch[1].match(/^title:\s*(.+)$/m)
            if (titleMatch) title = titleMatch[1].trim().replace(/^["']|["']$/g, '')
          }
          // qmd-relative id (matches qmd output format)
          const rel = path.relative(wikiDir, f)
          docs.push({ id: rel, title, body })
        }
        const parseMs = Date.now() - t0

        const t1 = Date.now()
        await orama.insertMultiple(db, docs)
        const insertMs = Date.now() - t1

        const queries = [
          'ISO 27001 기술적 통제',
          'PMBOK 프로젝트 관리',
          'RAG 검색 증강',
          'ITIL 4 가이드 원칙',
          '프로젝트 일정 관리',
          '벡터 검색',
          '물리적 통제',
          '공급망 관리',
          'MES 제조 실행',
          'Obsidian 마크다운 위키',
        ]

        console.log(`[Orama Bench] ${docs.length} docs ingested in ${parseMs + insertMs}ms`)
        const allLatencies: number[] = []
        for (let i = 0; i < queries.length; i++) {
          const q = queries[i]
          const t = Date.now()
          const r = await orama.search(db, {
            term: q,
            properties: ['title', 'body'],
            limit: 5,
          })
          const dt = Date.now() - t
          allLatencies.push(dt)
          const hitsStr = r.hits.length === 0
            ? '(no hits)'
            : r.hits.map(h => `${h.id} score=${h.score.toFixed(2)}`).join(' | ')
          console.log(`[Orama Bench] Q${i+1}: "${q}" → ${r.hits.length} hits in ${dt}ms`)
          for (let j = 0; j < r.hits.length; j++) {
            console.log(`[Orama Bench]   ${j+1}. ${r.hits[j].id} score=${r.hits[j].score.toFixed(3)}`)
          }
        }

        const sum = allLatencies.reduce((a,b) => a+b, 0)
        const sortedL = [...allLatencies].sort((a,b)=>a-b)
        const p50 = sortedL[Math.floor(sortedL.length/2)]
        const p95 = sortedL[Math.floor(sortedL.length*0.95)]
        console.log(`[Orama Bench] LATENCY: avg=${(sum/queries.length).toFixed(1)}ms p50=${p50}ms p95=${p95}ms (${queries.length} queries)`)
        new Notice(`✅ Orama Bench: ${docs.length}docs, ${queries.length}q, avg=${(sum/queries.length).toFixed(1)}ms`, 12000)
      } catch (err: any) {
        const msg = err?.message || String(err)
        const stack = err?.stack || ''
        console.error('[Orama Bench] FAIL:', msg, stack)
        new Notice(`❌ Orama Bench FAIL: ${msg}`, 15000)
      }
    },
  })
}

// §5.7.2 PoC 단계 2-B: Kiwi WASM + Orama hybrid in Electron renderer.
// model files: ~/.cache/wikey/kiwi-models/cong/base/ (qmd-style cache, lazy download production)
function registerKiwiOramaPoCCommand(plugin: WikeyPlugin): void {
  plugin.addCommand({
    id: 'wikey-poc-kiwi-orama',
    name: 'Wikey: PoC — Kiwi WASM + Orama hybrid (Electron)',
    callback: async () => {
      const t0 = Date.now()
      try {
        const path = require('node:path') as typeof import('node:path')
        const fs = require('node:fs') as typeof import('node:fs')
        const os = require('node:os') as typeof import('node:os')

        // Kiwi WASM imports — initKiwi 직접 호출로 wasmBinary 주입 (fetch 함정 회피)
        // KiwiBuilder.create 는 wasmPath (string) 만 받고 Emscripten 이 fetch 시도 → file:// 차단으로 fail
        // Module.wasmBinary 옵션 (kiwi-wasm.js line 1827-1828) 으로 binary 직접 주입 = renderer 호환
        const initKiwi = (await import('kiwi-nlp/dist/build/kiwi-wasm.js')).default
        const orama = await import('@orama/orama')
        const importMs = Date.now() - t0

        const projectRoot = (plugin.app.vault.adapter as any).basePath as string
        const wasmPath = path.join(projectRoot, 'node_modules/kiwi-nlp/dist/kiwi-wasm.wasm')
        if (!fs.existsSync(wasmPath)) {
          throw new Error(`WASM not found: ${wasmPath}`)
        }
        const modelDir = path.join(os.homedir(), '.cache/wikey/kiwi-models/cong/base')
        if (!fs.existsSync(modelDir)) {
          throw new Error(`Model dir not found: ${modelDir}`)
        }

        const t1a = Date.now()
        const wasmBinary = fs.readFileSync(wasmPath)
        const wasmReadMs = Date.now() - t1a

        const t1 = Date.now()
        // Use Module.instantiateWasm hook — fully bypass standard fetch / findWasmBinary 흐름
        // (CJS bundle 의 import.meta.url 빈 값 때문에 표준 흐름은 URL 생성 fail)
        const kiwiModule: any = await initKiwi({
          wasmBinary,
          instantiateWasm: (imports: any, successCallback: any) => {
            WebAssembly.instantiate(wasmBinary, imports)
              .then((result: any) => successCallback(result.instance, result.module))
              .catch((err: any) => { console.error('[Kiwi PoC] instantiateWasm err:', err) })
            return {}
          },
        })
        const kiwiCreateMs = Date.now() - t1

        const t2 = Date.now()
        const fileNames = ['sj.morph','default.dict','dialect.dict','multi.dict','typo.dict','combiningRule.txt','cong.mdl','extract.mdl','nounchr.mdl']
        let totalBytes = 0
        const modelPath = 'm' + Date.now()
        kiwiModule.FS.mkdir(modelPath)
        for (const fn of fileNames) {
          const buf = fs.readFileSync(path.join(modelDir, fn))
          kiwiModule.FS.writeFile(modelPath + '/' + fn, buf)
          totalBytes += buf.byteLength
        }
        const readMs = Date.now() - t2

        const apiCmd = (args: any) => JSON.parse(kiwiModule.api(JSON.stringify(args)))
        const t3 = Date.now()
        const id = apiCmd({ method: 'build', args: [{ modelPath, integrateAllomorph: true, loadDefaultDict: true, loadTypoDict: true }] })
        const buildMs = Date.now() - t3
        const kiwi: any = new Proxy({}, {
          get: (_t, prop) => {
            if (prop === 'then') return undefined
            return (...methodArgs: any[]) => apiCmd({ method: prop.toString(), id, args: methodArgs })
          },
        })

        // Sanity sync tokenize 5 samples
        const samples = [
          '위키 핵심 개념을 검색합니다',
          'PMBOK 통제 도구의 변경 관리',
          'RAG 와 Wiki 의 차이점',
          'BM25 알고리즘 정확도',
          'ISO 27001 통제 항목 설명',
        ]
        const t4 = Date.now()
        const tokenized = samples.map(s => kiwi.tokenize(s))
        const tokenizeMs = Date.now() - t4

        const tokenSummary = tokenized.map((tk, i) => {
          const words = tk.map(t => `${t.str}/${t.tag}`).join(' ')
          return `[${i+1}] ${samples[i]} → ${words}`
        })

        // Orama integration with custom Kiwi tokenizer
        const CONTENT_POS = new Set(['NNG','NNP','NNB','NR','VV','VA','VX','MAG','XR','SL','SN','SH'])
        const ALNUM = /^[A-Za-z0-9][A-Za-z0-9.\-_]*[A-Za-z0-9]$|^[A-Za-z0-9]$/
        const tokenizeFn = (text: string, _lang?: string, _prop?: string): string[] => {
          if (!text) return []
          const result: string[] = []
          for (const word of text.split(/\s+/)) {
            if (!word) continue
            if (ALNUM.test(word)) { result.push(word); continue }
            for (const t of kiwi.tokenize(word)) {
              const tag = t.tag.split('-')[0]
              if (CONTENT_POS.has(tag)) result.push(t.str)
            }
          }
          return result
        }

        const t5 = Date.now()
        const db = await orama.create({
          schema: { id: 'string', title: 'string', body: 'string', embedding: 'vector[768]' },
          components: {
            tokenizer: {
              language: 'korean',
              normalizationCache: new Map(),
              tokenize: tokenizeFn,
            } as any,
          },
        })
        const oramaCreateMs = Date.now() - t5

        // Mock 768D embedding
        const mockVec = (seed: number): number[] => {
          const v = new Array(768)
          let s = seed
          for (let i = 0; i < 768; i++) {
            s = (s * 9301 + 49297) % 233280
            v[i] = (s / 233280) * 2 - 1
          }
          return v
        }

        const docs = [
          { id: 'p1', title: '위키 핵심 개념', body: '위키 핵심 개념을 검색합니다. 지식 그래프와 BM25 인덱스를 결합한 LLM Wiki.', embedding: mockVec(1) },
          { id: 'p2', title: 'PMBOK 통제 도구', body: 'PMBOK 통제 도구의 변경 관리 프로세스. 프로젝트 관리 표준.', embedding: mockVec(2) },
          { id: 'p3', title: 'RAG vs Wiki', body: 'RAG 와 Wiki 의 차이점. 위키는 영구 누적, RAG 는 매 쿼리마다 재추출.', embedding: mockVec(3) },
          { id: 'p4', title: 'BM25 알고리즘', body: 'BM25 알고리즘 정확도. FTS5 인덱스에서 BM25 스코어링.', embedding: mockVec(4) },
          { id: 'p5', title: 'ISO 27001', body: 'ISO 27001 통제 항목 설명. 정보보안 관리 시스템 표준.', embedding: mockVec(5) },
        ]

        const t6 = Date.now()
        await orama.insertMultiple(db, docs)
        const insertMs = Date.now() - t6

        const t7 = Date.now()
        const r1 = await orama.search(db, { term: 'BM25 알고리즘', properties: ['body','title'], limit: 3 })
        const ftsMs = Date.now() - t7

        const t8 = Date.now()
        const r2 = await orama.search(db, {
          mode: 'hybrid',
          term: '위키 핵심',
          vector: { value: mockVec(1), property: 'embedding' },
          properties: ['body','title'],
          similarity: 0.5,
          limit: 3,
        })
        const hybridMs = Date.now() - t8

        const total = Date.now() - t0
        const summary = [
          `import=${importMs}ms`,
          `wasm-read=${wasmReadMs}ms`,
          `kiwi-init=${kiwiCreateMs}ms`,
          `read-models(${(totalBytes/1024/1024).toFixed(1)}MB)=${readMs}ms`,
          `kiwi-build=${buildMs}ms`,
          `tokenize5=${tokenizeMs}ms`,
          `orama-create=${oramaCreateMs}ms`,
          `insert5=${insertMs}ms`,
          `BM25=${ftsMs}ms(${r1.count}h)`,
          `hybrid=${hybridMs}ms(${r2.count}h)`,
          `TOTAL=${total}ms`,
        ].join(' ')

        for (const line of tokenSummary) console.log('[Kiwi PoC]', line)
        console.log('[Kiwi PoC] BM25 hits:', r1.hits.map(h => `${h.id}=${h.score.toFixed(2)}`).join(', '))
        console.log('[Kiwi PoC] hybrid hits:', r2.hits.map(h => `${h.id}=${h.score.toFixed(2)}`).join(', '))
        console.log('[Kiwi PoC] PASS', summary)
        new Notice(`✅ Kiwi+Orama PoC OK: ${summary}`, 15000)
      } catch (err: any) {
        const msg = err?.message || String(err)
        const stack = err?.stack || ''
        console.error('[Kiwi PoC] FAIL:', msg, stack)
        new Notice(`❌ Kiwi+Orama PoC FAIL: ${msg}`, 15000)
      }
    },
  })
}

// §5.7.2 PoC: Verify @orama/orama loads in Electron renderer (no file:// dynamic import).
// Revert after PoC complete (cleanup: remove this function + import + registration call + dep).
function registerOramaPoCCommand(plugin: WikeyPlugin): void {
  plugin.addCommand({
    id: 'wikey-poc-orama-test',
    name: 'Wikey: PoC — Orama Electron renderer test',
    callback: async () => {
      const t0 = Date.now()
      try {
        // Static import — esbuild bundles into main.js, NOT file:// dynamic import.
        // §5.7.2 fundamental fail (Chromium ESM loader 우선) 함정 회피 가설 검증.
        const orama = await import('@orama/orama')
        const importMs = Date.now() - t0
        console.log('[Orama PoC] import OK', importMs + 'ms', Object.keys(orama).slice(0, 8))

        const t1 = Date.now()
        const db = await orama.create({
          schema: {
            id: 'string',
            title: 'string',
            body: 'string',
            embedding: 'vector[768]',
          },
        })
        const createMs = Date.now() - t1

        // Mock 768D embedding (deterministic)
        const mockVec = (seed: number): number[] => {
          const v = new Array(768)
          let s = seed
          for (let i = 0; i < 768; i++) {
            s = (s * 9301 + 49297) % 233280
            v[i] = (s / 233280) * 2 - 1
          }
          return v
        }

        const docs = [
          { id: 'p1', title: 'Wiki core concepts', body: 'wiki search BM25 LLM index hybrid', embedding: mockVec(1) },
          { id: 'p2', title: 'PMBOK control tools', body: 'PMBOK control change management process', embedding: mockVec(2) },
          { id: 'p3', title: 'RAG vs Wiki', body: 'RAG and Wiki difference accumulation extract', embedding: mockVec(3) },
          { id: 'p4', title: 'BM25 algorithm', body: 'BM25 algorithm accuracy FTS5 scoring', embedding: mockVec(4) },
          { id: 'p5', title: 'ISO 27001', body: 'ISO 27001 security control standard', embedding: mockVec(5) },
        ]

        const t2 = Date.now()
        await orama.insertMultiple(db, docs)
        const insertMs = Date.now() - t2

        const t3 = Date.now()
        const r1 = await orama.search(db, { term: 'BM25 algorithm', properties: ['body', 'title'], limit: 3 })
        const ftsMs = Date.now() - t3

        const t4 = Date.now()
        const r2 = await orama.search(db, {
          mode: 'hybrid',
          term: 'wiki search',
          vector: { value: mockVec(1), property: 'embedding' },
          properties: ['body', 'title'],
          similarity: 0.5,
          limit: 3,
        })
        const hybridMs = Date.now() - t4

        const total = Date.now() - t0
        const summary = [
          `import=${importMs}ms create=${createMs}ms insert=${insertMs}ms`,
          `BM25=${ftsMs}ms (${r1.count} hits)`,
          `hybrid=${hybridMs}ms (${r2.count} hits)`,
          `TOTAL=${total}ms`,
        ].join(' | ')

        console.log('[Orama PoC] BM25 hits:', r1.hits.map(h => `${h.id}=${h.score.toFixed(2)}`).join(', '))
        console.log('[Orama PoC] hybrid hits:', r2.hits.map(h => `${h.id}=${h.score.toFixed(2)}`).join(', '))
        console.log('[Orama PoC] PASS', summary)
        new Notice(`✅ Orama PoC OK: ${summary}`, 12000)
      } catch (err: any) {
        const msg = err?.message || String(err)
        console.error('[Orama PoC] FAIL:', err)
        new Notice(`❌ Orama PoC FAIL: ${msg}`, 15000)
      }
    },
  })
}

// ─────────────────────────────────────────────────────────────
//  §4.5.2 — Delete source / wiki page (dry-run + typed-confirm)
// ─────────────────────────────────────────────────────────────

function registerDeleteCommand(plugin: WikeyPlugin): void {
  plugin.addCommand({
    id: 'delete-source',
    name: 'Wikey: Delete source (dry-run)',
    callback: () => {
      new DeleteSourceSuggestModal(plugin).open()
    },
  })

  plugin.addCommand({
    id: 'delete-wiki-page',
    name: 'Wikey: Delete wiki page (dry-run)',
    checkCallback: (checking) => {
      const file = plugin.app.workspace.getActiveFile()
      if (!file || !file.path.startsWith('wiki/')) return false
      if (checking) return true
      void promptWikiPageDelete(plugin, file.path)
      return true
    },
  })
}

async function promptSourceDelete(plugin: WikeyPlugin, sourcePath: string): Promise<void> {
  const registry = await loadRegistry(plugin.wikiFS)
  const impact = await computeDeletionImpact({
    wikiFS: plugin.wikiFS,
    registry,
    target: { kind: 'source', vault_path: sourcePath },
  })

  const shortId = impact.registryRecord?.id.slice(0, 23) ?? 'unknown'
  const confirmPhrase = `DEL ${shortId}`

  new DeleteImpactModal(plugin.app, {
    title: `Delete source: ${sourcePath}`,
    confirmPhrase,
    impact,
    onConfirm: async () => {
      const fs = require('node:fs') as typeof import('node:fs')
      const path = require('node:path') as typeof import('node:path')
      const basePath = getBasePath(plugin)

      // 1) Delete wiki ingested pages.
      for (const p of impact.pages) {
        const abs = path.join(basePath, p)
        try { fs.unlinkSync(abs) } catch (err: any) {
          if (err?.code !== 'ENOENT') throw err
        }
      }
      // 2) Delete sidecar + source file itself.
      const sidecar = impact.registryRecord?.record.sidecar_vault_path
      if (sidecar) {
        try { fs.unlinkSync(path.join(basePath, sidecar)) } catch (err: any) {
          if (err?.code !== 'ENOENT') throw err
        }
      }
      try { fs.unlinkSync(path.join(basePath, sourcePath)) } catch (err: any) {
        if (err?.code !== 'ENOENT') throw err
      }
      // 3) Tombstone the registry record.
      if (impact.registryRecord) {
        const next = registryRecordDelete(registry, impact.registryRecord.id)
        await saveRegistry(plugin.wikiFS, next)
      }
    },
  }).open()
}

async function promptWikiPageDelete(plugin: WikeyPlugin, pagePath: string): Promise<void> {
  const registry = await loadRegistry(plugin.wikiFS)
  const impact = await computeDeletionImpact({
    wikiFS: plugin.wikiFS,
    registry,
    target: { kind: 'wiki-page', page_path: pagePath },
  })

  const basename = pagePath.split('/').pop()!.replace(/\.md$/, '')
  const confirmPhrase = `DEL ${basename}`

  new DeleteImpactModal(plugin.app, {
    title: `Delete wiki page: ${pagePath}`,
    confirmPhrase,
    impact,
    onConfirm: async () => {
      const fs = require('node:fs') as typeof import('node:fs')
      const path = require('node:path') as typeof import('node:path')
      const abs = path.join(getBasePath(plugin), pagePath)
      try { fs.unlinkSync(abs) } catch (err: any) {
        if (err?.code !== 'ENOENT') throw err
      }
    },
  }).open()
}

class DeleteSourceSuggestModal extends FuzzySuggestModal<TFile> {
  constructor(private readonly plugin: WikeyPlugin) {
    super(plugin.app)
    this.setPlaceholder('삭제할 raw/ 소스를 선택하세요...')
  }

  getItems(): TFile[] {
    return this.plugin.app.vault
      .getFiles()
      .filter((f) => f.path.startsWith('raw/') && !f.path.endsWith('.md'))
  }

  getItemText(f: TFile): string {
    return f.path
  }

  onChooseItem(f: TFile): void {
    void promptSourceDelete(this.plugin, f.path)
  }
}

// ─────────────────────────────────────────────────────────────
//  §4.5.2 — Reset (5-way scope)
// ─────────────────────────────────────────────────────────────

function registerResetCommand(plugin: WikeyPlugin): void {
  const scopes: ReadonlyArray<{ id: string; name: string; scope: ResetScope }> = [
    { id: 'reset-wiki-registry', name: 'Wikey: Reset wiki + registry', scope: 'wiki+registry' },
    { id: 'reset-wiki-only', name: 'Wikey: Reset wiki only', scope: 'wiki-only' },
    { id: 'reset-registry-only', name: 'Wikey: Reset registry only', scope: 'registry-only' },
    { id: 'reset-qmd-index', name: 'Wikey: Reset qmd index', scope: 'qmd-index' },
    { id: 'reset-settings', name: 'Wikey: Reset settings (data.json)', scope: 'settings' },
  ]

  for (const s of scopes) {
    plugin.addCommand({
      id: s.id,
      name: s.name,
      callback: () => {
        void promptReset(plugin, s.scope)
      },
    })
  }
}

async function promptReset(plugin: WikeyPlugin, scope: ResetScope): Promise<void> {
  const preview = await previewReset({ wikiFS: plugin.wikiFS, scope })
  new ResetImpactModal(plugin.app, {
    scope,
    preview,
    onConfirm: async () => {
      await executeReset(plugin, scope, preview.files)
    },
  }).open()
}

export async function executeReset(
  plugin: WikeyPlugin,
  scope: ResetScope,
  files: readonly string[],
): Promise<void> {
  const fs = require('node:fs') as typeof import('node:fs')
  const path = require('node:path') as typeof import('node:path')
  const os = require('node:os') as typeof import('node:os')
  const basePath = getBasePath(plugin)

  switch (scope) {
    case 'wiki+registry':
    case 'wiki-only':
    case 'registry-only': {
      for (const p of files) {
        const abs = path.join(basePath, p)
        try { fs.unlinkSync(abs) } catch (err: any) {
          if (err?.code !== 'ENOENT') throw err
        }
      }
      if (scope === 'registry-only') {
        await plugin.wikiFS.write(REGISTRY_PATH, '{}')
      }
      return
    }
    case 'qmd-index': {
      const abs = path.join(os.homedir(), '.cache', 'qmd', 'index.sqlite')
      try { fs.unlinkSync(abs) } catch (err: any) {
        if (err?.code !== 'ENOENT') throw err
      }
      new Notice('qmd 인덱스 삭제됨. 다음 인제스트/쿼리 시 reindex 자동 실행됨.')
      return
    }
    case 'settings': {
      const abs = path.join(basePath, SETTINGS_MARKER)
      try { fs.unlinkSync(abs) } catch (err: any) {
        if (err?.code !== 'ENOENT') throw err
      }
      new Notice('설정 초기화됨. Obsidian 재시작 시 DEFAULT_SETTINGS 로 복원됨.')
      return
    }
  }
}

function getBasePath(plugin: WikeyPlugin): string {
  return (plugin.app.vault.adapter as any).basePath ?? ''
}

export interface IngestRunResult {
  success: boolean
  sourcePath: string
  createdPages: string[]
  error?: string
  cancelled?: boolean
}

export interface IngestRunOptions {
  /** Skip Stage 1 (brief + guide) — used for auto-ingest or batch mode after user opts out. */
  skipBriefModal?: boolean
  /** Bypass Stage 2 (preview) regardless of settings. Rarely used. */
  skipPreviewModal?: boolean
  /**
   * Auto-classify and move raw/0_inbox/ file to a PARA folder after successful ingest.
   * - audit panel: true (auto-classify via CLASSIFY.md + LLM fallback)
   * - inbox panel: false (moveBtn handles destination manually via user selection)
   */
  autoMoveFromInbox?: boolean
  // 주의: converter 선택 / 캐시 bypass 모두 사용자 UI 에서 제거됨.
  // 전처리 ~ ingest 가 자동 흐름이므로 사용자가 변환 결과 검토 후 재변환 판단할 틈 없음.
  // - converter 선택 → 자동 판정 (한국어 공백 소실·스캔 PDF 감지)
  // - 캐시 무효화 → 필요 시 ~/.cache/wikey/convert/ 직접 삭제
}

export async function runIngest(
  plugin: WikeyPlugin,
  sourcePath: string,
  onProgress?: (step: number, total: number, message: string, subStep?: number, subTotal?: number) => void,
  runOpts?: IngestRunOptions,
): Promise<IngestRunResult> {
  const basePath = (plugin.app.vault.adapter as any).basePath ?? ''

  // §5.15.D: ingest 진입 시 raw 파일명 wikilink-safe normalize. raw 파일 자체를 vault rename
  //   → disk 와 wikilink target 일관 보장. wikilink-unsafe character (`|` `[` `]` `#` `^` `\`
  //   + Unicode 특수문자 등) 포함 시 sanitize 결과로 rename. 사용자 통찰: blacklist 가 아닌
  //   whitelist (`wikilink-safe.ts`) 라 향후 reserved char 자동 cover.
  sourcePath = await sanitizeRawFilenameIfNeeded(plugin, sourcePath)

  const briefMode = plugin.settings.ingestBriefs
  const shouldShowFlow = !runOpts?.skipBriefModal
    && briefMode !== 'never'
    && !plugin.skipIngestBriefsThisSession

  // ── Fast path: no modal (auto-ingest or "never" mode) ──
  if (!shouldShowFlow) {
    return await runIngestCore(plugin, sourcePath, basePath, {
      guideHint: undefined,
      planGate: undefined,
      onProgress,
      autoMoveFromInbox: runOpts?.autoMoveFromInbox,
    })
  }

  // ── Stay-involved flow: unified modal (converting → brief → processing → preview) ──
  // Phase 5 §5.10.1.3 AC-C1.3: conversion 1 회 보장. modal.open() 직후 단일 변환 entry
  // (`convertSourceToMarkdown`) 호출 → brief + ingest 가 동일 결과 공유.
  // §5.10.3.10 옵션 C: stepper 4 단계 (Converting / Brief / Processing / Preview) — 변환 단계 시각화.
  // Cancel 시 vault write 0 invariant (AC-C1.4): runIngestCore 호출 안 함. cache 만 ephemeral 보존.
  const modal = new IngestFlowModal(plugin.app, sourcePath, '', plugin.settings.verifyIngestResults)
  modal.open()

  const sourceFilename = sourcePath.split('/').pop() ?? sourcePath
  const ext = sourceFilename.toLowerCase().split('.').pop() ?? ''
  // md/txt 도 stepper 표시는 동일 4 단계. message 만 분기 ("Reading source" vs "Converting source").
  const convertingMsg = ext === 'md' || ext === 'txt' ? 'Reading source...' : `Converting ${ext.toUpperCase()} → markdown...`
  modal.showConverting(convertingMsg)
  onProgress?.(1, 4, convertingMsg)

  let conversionResult: ConversionResult
  try {
    conversionResult = await convertSourceToMarkdown(sourcePath, ext, {
      basePath,
      execEnv: plugin.getExecEnv(),
      config: plugin.buildConfig(),
      wikiFS: plugin.wikiFS,
    })
  } catch (err) {
    const errMsg = `Conversion failed: ${(err as Error)?.message ?? err}`
    console.error(`[Wikey ingest] conversion failed for ${sourcePath}:`, errMsg, (err as Error)?.stack ?? '')
    modal.showBrief()
    modal.setBrief(`(${errMsg})`)
    await modal.awaitBrief()
    modal.dispose()
    return { success: false, sourcePath, createdPages: [], error: errMsg }
  }

  modal.showBrief()
  onProgress?.(2, 4, 'Generating brief...')
  generateBrief(
    conversionResult.content,
    sourceFilename,
    plugin.buildConfig(),
    plugin.httpClient,
    {
      basePath,
      // Phase 5 §5.8: brief 도 ingest 와 동일 PII 정책.
      piiGuardEnabled: plugin.settings.piiGuardEnabled,
    },
  )
    .then((b) => modal.setBrief(b))
    .catch((err) => modal.setBrief(`(Brief generation failed: ${err?.message ?? err})`))

  // Brief → Processing → (optional Preview) loop. Back from Processing returns to Brief.
  while (true) {
    const briefOutcome = await modal.awaitBrief()
    if (briefOutcome.action === 'cancel') {
      // AC-C1.4: Cancel 시 vault write 0 invariant — runIngestCore 호출 안 함.
      // conversionResult 는 휘발 (cache 는 ~/.cache/wikey/convert/ ephemeral 보존, 30일 TTL).
      modal.dispose()
      return { success: false, sourcePath, createdPages: [], cancelled: true }
    }
    if (briefOutcome.action === 'skip-session') {
      plugin.skipIngestBriefsThisSession = true
    }

    modal.showProcessing('Extracting with LLM...')

    const planGate = briefOutcome.verifyResults
      ? async (plan: IngestPlan): Promise<boolean> => {
          return await modal.awaitPreview(plan)
        }
      : undefined

    const result = await runIngestCore(plugin, sourcePath, basePath, {
      guideHint: briefOutcome.guideHint || undefined,
      planGate,
      onProgress: (step, total, message, subStep, subTotal) => {
        modal.updateProgress(step, total, message, subStep, subTotal)
        onProgress?.(step, total, message, subStep, subTotal)
      },
      autoMoveFromInbox: runOpts?.autoMoveFromInbox,
      preconverted: conversionResult,
    })

    // If user hit [Back] during processing, the modal already flipped back to Brief.
    // Discard this in-flight result and loop around for a new guide.
    if (modal.backRequested) {
      console.info('[Wikey ingest] user pressed Back — discarding result, returning to Brief')
      continue
    }

    modal.finish()
    return result
  }
}

// ── Internal: core pipeline invocation (shared by modal & auto paths) ──
async function runIngestCore(
  plugin: WikeyPlugin,
  sourcePath: string,
  basePath: string,
  ctx: {
    guideHint: string | undefined
    planGate: ((plan: IngestPlan) => Promise<boolean>) | undefined
    onProgress?: (step: number, total: number, message: string, subStep?: number, subTotal?: number) => void
    autoMoveFromInbox?: boolean
    forceReingest?: boolean
    onConflict?: (info: ConflictInfo) => Promise<ConflictChoice>
    // Phase 5 §5.10.1.5 AC-C1.5: brief 단계에서 이미 변환된 결과를 ingest 에 전달.
    // ingest() 가 Step 1 conversion 재호출 skip → cache hit (1 회) 도 회피.
    preconverted?: ConversionResult
  },
): Promise<IngestRunResult> {
  // §5.3.1/§5.3.2 (plan v11 P2-3): default ConflictModal injection — silent auto-protect
  // is never the default GUI experience; caller can override via ctx.onConflict.
  const defaultConflict = (info: ConflictInfo): Promise<ConflictChoice> =>
    new Promise((resolve) => new ConflictModal(plugin.app, info, resolve).open())
  const onConflict = ctx.onConflict ?? defaultConflict
  try {
    const result = await ingest(
      sourcePath,
      plugin.wikiFS,
      plugin.buildConfig(),
      plugin.httpClient,
      (progress) => ctx.onProgress?.(progress.step, progress.total, progress.message, progress.subStep, progress.subTotal),
      {
        basePath,
        execEnv: plugin.getExecEnv(),
        guideHint: ctx.guideHint,
        onPlanReady: ctx.planGate,
        // §5.3.1/§5.3.2 — incremental reingest options.
        forceReingest: ctx.forceReingest,
        onConflict,
        // Phase 5 §5.10.1.5 AC-C1.5: brief 가 미리 변환했으면 재변환 skip.
        preconverted: ctx.preconverted,
        // Phase 4 D.0.c — PII 2-layer gate (settings 에서 제어).
        piiGuardEnabled: plugin.settings.piiGuardEnabled,
        allowPiiIngest: plugin.settings.allowPiiIngest,
        piiRedactionMode: plugin.settings.piiRedactionMode,
        // Phase 4 D.0.f follow-up (codex P2): user-visible Notice on reindex/freshness issue
        // (plan v6 §4.4.6 — 사용자가 stale 상태를 인지해야 한다).
        // §5.2.9: better-sqlite3 ABI mismatch (`ERR_DLOPEN_FAILED` / `NODE_MODULE_VERSION`)
        // detection — user 가 nvm node 로 처음 install 했고 plugin 이 system node 를 쓰면
        // 발생. specific 해결 명령 안내.
        onFreshnessIssue: (reason, message) => {
          const isAbiMismatch = /NODE_MODULE_VERSION|ERR_DLOPEN_FAILED/.test(message)
          if (isAbiMismatch) {
            new Notice(
              `qmd 네이티브 모듈 ABI 불일치 — 터미널에서 다음 실행 후 재시도:\n` +
              `  bash ./scripts/rebuild-qmd-deps.sh`,
              12000,
            )
            return
          }
          const label = reason === 'reindex-failed' ? '인덱싱 실패' : '인덱스 갱신 지연'
          new Notice(`${label} — 잠시 후 검색 가능 (${message.slice(0, 80)})`, 6000)
        },
        // §5.2.5: silent-fail 자체 제거 — 성공 시도 항상 짧은 Notice. 사용자가 reindex 가
        // 실제 호출됐는지 가시 확증.
        onFreshnessOk: (ms) => {
          new Notice(`✓ 검색 인덱스 최신 (${(ms / 1000).toFixed(1)}s)`, 2000)
        },
      },
    )

    // §5.3.1/§5.3.2 — type guard for skip branches: SkippedIngestResult has no LLM output.
    if ('skipped' in result) {
      const skipped = result as SkippedIngestResult
      const labels: Record<SkippedIngestResult['skipReason'], string> = {
        'hash-match': '이미 인제스트 완료 (변경 없음)',
        'hash-match-sidecar-seed': 'sidecar baseline 만 갱신 (LLM 호출 없음)',
        'hash-match-sidecar-edit-noted': '사용자 sidecar 수정 보존 (raw 변경 없음)',
        'duplicate-hash-other-path': `중복 detect — 동일 hash 가 ${skipped.duplicateOfId ?? '다른 경로'}`,
      }
      new Notice(`Wikey: ${labels[skipped.skipReason]}`, 4000)
      console.info(
        `[Wikey ingest] skip — reason=${skipped.skipReason} sourceId=${skipped.sourceId}`,
      )
      // skip branches do NOT call saveIngestMap, classify, movePair, or autoMove.
      return { success: true, sourcePath, createdPages: [] }
    }

    const createdPages = [
      result.sourcePage.filename,
      ...result.entities.map((e) => e.filename),
      ...result.concepts.map((c) => c.filename),
    ]

    saveIngestMap(basePath, sourcePath, result.sourcePage.filename)

    // Auto-classify + move: audit panel uses this path; raw/0_inbox/ file is
    // routed to the correct PARA folder via CLASSIFY.md rules + LLM fallback.
    // Inbox panel's moveBtn manages destination manually (user-selected PARA)
    // and passes autoMoveFromInbox=false to skip this branch.
    let finalSourcePath = sourcePath
    if (ctx.autoMoveFromInbox && sourcePath.startsWith('raw/0_inbox/')) {
      try {
        const { basename, join } = require('node:path') as typeof import('node:path')
        const filename = basename(sourcePath)
        const classifyResult = await classifyFileAsync(filename, false, {
          wikiFS: plugin.wikiFS,
          httpClient: plugin.httpClient,
          config: plugin.buildConfig(),
        })
        if (classifyResult.destination) {
          // §4.2 S2-3: movePair — original + sidecar 가 한 쌍으로 이동 + registry 갱신 + frontmatter rewrite.
          const result = await movePair({
            basePath,
            sourceVaultPath: sourcePath,
            destDir: classifyResult.destination,
            wikiFS: plugin.wikiFS,
            renameGuard: plugin.renameGuard,
          })
          const newSourcePath = join(classifyResult.destination, filename)
          finalSourcePath = newSourcePath
          console.info(
            `[Wikey ingest] auto-moved to PARA: ${sourcePath} → ${newSourcePath} (${classifyResult.hint}) sidecar=${result.movedSidecar}${result.sidecarSkipReason ? ` [${result.sidecarSkipReason}]` : ''}`,
          )
          // §5.2.5: movePair rewrote frontmatter on wiki/sources/source-*.md
          // (vault_path/sidecar_vault_path patch). Without re-reindex the next
          // --check would report stale because that source page mtime > STAMP_FILE
          // (set by the reindex inside ingest()). Touch STAMP again so freshness
          // gate is consistent.
          try {
            await reindexQuick(basePath, plugin.getExecEnv())
          } catch (err: any) {
            console.warn(`[Wikey ingest] post-movePair reindex failed (non-fatal): ${err?.message ?? err}`)
          }
        } else {
          console.info(`[Wikey ingest] auto-move skipped (classify returned no destination): ${sourcePath}`)
        }
      } catch (err: any) {
        console.warn(`[Wikey ingest] auto-move failed (staying in inbox): ${err?.message ?? err}`)
      }
    }

    return { success: true, sourcePath: finalSourcePath, createdPages }
  } catch (err: any) {
    if (err instanceof PlanRejectedError) {
      console.info(`[Wikey ingest] cancelled at preview: ${sourcePath}`)
      return { success: false, sourcePath, createdPages: [], cancelled: true }
    }
    if (err instanceof IngestCancelledByUserError) {
      console.info(`[Wikey ingest] cancelled at conflict modal: ${sourcePath}`)
      new Notice('인제스트 취소됨 (충돌 modal)', 3000)
      return { success: false, sourcePath, createdPages: [], cancelled: true }
    }
    if (err instanceof PiiIngestBlockedError) {
      // Phase 4 D.0.c — PII 감지 + allowPiiIngest=false 조합. 사용자가 설정에서 허용해야 진행.
      const kinds = Array.from(new Set(err.matches.map((m) => m.kind))).join(', ')
      const msg = `PII 감지 — ${err.matches.length}건 (${kinds}). 설정에서 "PII 감지 시 인제스트 진행" 을 켜거나 원본을 정리해 주세요.`
      console.warn(`[Wikey ingest] blocked by PII gate: ${sourcePath} — ${err.matches.length} matches`)
      new Notice(msg, 8000)
      return { success: false, sourcePath, createdPages: [], error: msg }
    }
    const msg = err?.message ?? String(err)
    console.error(`[Wikey ingest] failed for ${sourcePath}:`, msg, err?.stack ?? '')
    return { success: false, sourcePath, createdPages: [], error: msg }
  }
}

// §4.2.4 S4-4: path-based API 는 Phase 5 §5.3 에서 완전 제거.
// 현재 wikey-core 는 source-registry (hash 기반) 로 이관 완료, .ingest-map.json 은
// 남아있는 legacy 호환 필드. 1회만 경고 후 조용히 유지.
let _ingestMapWarnOnce = false
function saveIngestMap(basePath: string, rawPath: string, sourceFilename: string): void {
  if (!_ingestMapWarnOnce) {
    console.warn(
      '[Wikey deprecated] .ingest-map.json path-based API — use source-registry. Slated for removal in Phase 5 §5.3.',
    )
    _ingestMapWarnOnce = true
  }
  const { join } = require('node:path') as typeof import('node:path')
  const { readFileSync, writeFileSync } = require('node:fs') as typeof import('node:fs')
  const mapPath = join(basePath, 'wiki/.ingest-map.json')

  let map: Record<string, string> = {}
  try {
    map = JSON.parse(readFileSync(mapPath, 'utf-8'))
  } catch {
    // 파일 없으면 빈 맵
  }

  map[normalizeRawPath(rawPath)] = sourceFilename
  writeFileSync(mapPath, JSON.stringify(map, null, 2), 'utf-8')
}

/** Move an ingest-map entry from its pre-move path to the post-move path (called after moveFile to PARA). */
export function updateIngestMapPath(basePath: string, oldRawPath: string, newRawPath: string): void {
  const { join } = require('node:path') as typeof import('node:path')
  const { readFileSync, writeFileSync } = require('node:fs') as typeof import('node:fs')
  const mapPath = join(basePath, 'wiki/.ingest-map.json')

  let map: Record<string, string> = {}
  try {
    map = JSON.parse(readFileSync(mapPath, 'utf-8'))
  } catch {
    return
  }

  const oldKey = normalizeRawPath(oldRawPath)
  const newKey = normalizeRawPath(newRawPath)
  const value = map[oldKey]
  if (!value) return

  delete map[oldKey]
  map[newKey] = value
  writeFileSync(mapPath, JSON.stringify(map, null, 2), 'utf-8')
}

/** Collapse duplicate slashes (`a//b` → `a/b`) so audit-ingest.py exact-match keys work. */
function normalizeRawPath(p: string): string {
  return p.replace(/\/{2,}/g, '/')
}

export class IngestFileSuggestModal extends FuzzySuggestModal<TFile> {
  constructor(private readonly plugin: WikeyPlugin) {
    super(plugin.app)
    this.setPlaceholder('Select a file to ingest...')
  }

  getItems(): TFile[] {
    // §5.10.3.10 옵션 C: md 외 모든 ingest 가능 file 포함 (HWP/PDF/DOCX/PPTX/XLSX/HTML/HWPX 등).
    // wiki/ + .obsidian/ + .wikey/ 같은 system 영역은 제외.
    return this.plugin.app.vault.getFiles().filter(
      (f) => !f.path.startsWith('wiki/') && !f.path.startsWith('.'),
    )
  }

  getItemText(file: TFile): string {
    return file.path
  }

  onChooseItem(file: TFile): void {
    runIngest(this.plugin, file.path)
  }
}

/**
 * §5.15.D — Wikilink-safe vault rename (whitelist 정책).
 *
 * raw 파일명에 wikilink-unsafe character (`|` `[` `]` `#` `^` `\` + Unicode 특수문자
 * 등) 가 포함되면 `sanitizeWikilinkTarget` 결과로 *vault rename*. disk 와 wikilink
 * target 일관 → Obsidian basename matcher + validate-wiki.sh 정합 보장.
 *
 * `sourcePath` 의 dirname 보존, basename 만 sanitize. rename 충돌 시 `-N` suffix.
 * rename 발생 시 사용자 Notice + 신 path 반환. unsafe char 없으면 no-op.
 */
async function sanitizeRawFilenameIfNeeded(
  plugin: WikeyPlugin,
  sourcePath: string,
): Promise<string> {
  const filename = sourcePath.includes('/') ? sourcePath.split('/').pop()! : sourcePath
  if (!needsWikilinkSanitize(filename)) return sourcePath

  const dir = sourcePath.includes('/') ? sourcePath.slice(0, sourcePath.lastIndexOf('/')) : ''
  const safe = sanitizeWikilinkTarget(filename)
  if (!safe || safe === filename) return sourcePath

  // 충돌 회피: <safe>, <safe>-1, <safe>-2 ... (확장자 보존)
  const dotIdx = safe.lastIndexOf('.')
  const stem = dotIdx > 0 ? safe.slice(0, dotIdx) : safe
  const ext = dotIdx > 0 ? safe.slice(dotIdx) : ''
  let candidate = safe
  let suffix = 0
  while (await plugin.app.vault.adapter.exists(dir ? `${dir}/${candidate}` : candidate)) {
    suffix += 1
    candidate = `${stem}-${suffix}${ext}`
    if (suffix > 99) break // 안전망
  }
  const newPath = dir ? `${dir}/${candidate}` : candidate

  const file = plugin.app.vault.getAbstractFileByPath(sourcePath)
  if (!file || !(file instanceof TFile)) return sourcePath
  try {
    plugin.renameGuard?.register(newPath) // movePair 와 동일 패턴 — 자체 rename 이벤트 skip
    await plugin.app.fileManager.renameFile(file, newPath)
    new Notice(
      `Wikey: 파일명 wikilink-safe 정규화 — ${filename} → ${candidate}`,
      6000,
    )
    console.info(`[Wikey ingest] §5.15.D rename — ${sourcePath} → ${newPath}`)
    return newPath
  } catch (err) {
    console.warn(`[Wikey ingest] §5.15.D rename failed (continuing with original):`, err)
    return sourcePath
  }
}
