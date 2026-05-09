/**
 * §5.7.4 — Kiwi WASM 기반 Korean tokenizer (Orama components.tokenizer 호환).
 *
 * 본 모듈은 PoC (`wikey-obsidian/src/commands.ts:96~522`) 의 init / smart_tokenize
 * path 를 wikey-core 로 이전. production query path (query-pipeline.ts) 가 호출.
 *
 * Module.instantiateWasm hook + wasmBinary 직접 주입 — Electron renderer file:// fetch
 * 함정 회피 (PoC 단계 2-B 검증 path 동일).
 *
 * Spec: phase-5-spec-5.7.4-orama-migration.md §3.1.
 */

import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
// vendor (B-2 sparse vendor) — wikey-core/vendor/kiwi-nlp/dist/build/kiwi-wasm.js (default export).
// import path canonical (codex cycle #3 HIGH-2 fix v5). vendor 안에 .d.ts 가 동거 (kiwi-wasm.d.ts).
import initKiwi from '../../vendor/kiwi-nlp/dist/build/kiwi-wasm.js'

/** Kiwi POS tag set considered "content" — 명사 / 동사 / 형용사 / 부사 / 어근 / 외래어 / 숫자 / 한자. */
const CONTENT_POS: ReadonlySet<string> = new Set([
  'NNG', 'NNP', 'NNB', 'NR', 'VV', 'VA', 'VX', 'MAG', 'XR', 'SL', 'SN', 'SH',
])

/**
 * Alphanumeric-preserve regex — `BM25`, `ISO`, `gpt-4`, `o3.5_mini` 등 검색에 의미 있는
 * 단일 토큰 보존. start/end 가 영숫자, 사이에 `.`, `-`, `_` 허용.
 */
const ALNUM_TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9.\-_]*[A-Za-z0-9]$|^[A-Za-z0-9]$/

/** Kiwi 사전 9 파일 (cong/base 모델). lazy download 절차 = scripts/download-kiwi-models.sh. */
const KIWI_DICT_FILES: readonly string[] = [
  'sj.morph',
  'default.dict',
  'dialect.dict',
  'multi.dict',
  'typo.dict',
  'combiningRule.txt',
  'cong.mdl',
  'extract.mdl',
  'nounchr.mdl',
]

export interface KoreanTokenizerOptions {
  /** Kiwi WASM 바이너리 경로 (vendor 또는 plugin runtime path). */
  readonly wasmPath: string
  /**
   * Kiwi WASM 바이너리 (pre-read Uint8Array). Module.instantiateWasm hook 이 직접 주입 —
   * Electron renderer 환경에서 fetch / file:// path 함정 회피 (PoC 검증 path).
   * 미지정 시 `readFileSync(wasmPath)` 자동 read.
   */
  readonly wasmBinary?: Uint8Array
  /** Kiwi 사전 디렉토리 — `~/.cache/wikey/kiwi-models/cong/base/` (9 파일). */
  readonly modelDir: string
}

export interface KoreanTokenizerHandle {
  /** Orama components.tokenizer 의 tokenize fn 으로 직접 주입 가능. */
  readonly tokenize: (text: string) => string[]
  /** 명시 dispose. close 후 tokenize 재 호출 시 throw. */
  readonly close: () => void
}

interface KiwiToken {
  readonly str: string
  readonly tag: string
}

interface KiwiInstance {
  tokenize(text: string): readonly KiwiToken[]
}

/**
 * Production tokenizer factory. PoC commands.ts:142-156 의 smart_tokenize logic 동일.
 */
export async function createKoreanTokenizer(
  opts: KoreanTokenizerOptions,
): Promise<KoreanTokenizerHandle> {
  const wasmBinary = opts.wasmBinary ?? new Uint8Array(readFileSync(opts.wasmPath))

  // Init Kiwi WASM module via Module.instantiateWasm hook (PoC pattern).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kiwiModule: any = await initKiwi({
    wasmBinary,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    instantiateWasm: (imports: any, successCallback: any) => {
      WebAssembly.instantiate(wasmBinary, imports)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((result: any) => successCallback(result.instance, result.module))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .catch((err: any) => {
          // eslint-disable-next-line no-console
          console.error('[wikey] Kiwi instantiateWasm failed:', err)
        })
      return {}
    },
  })

  // Mount model files into the WASM in-memory FS (PoC pattern).
  const modelMount = `m${Date.now()}`
  kiwiModule.FS.mkdir(modelMount)
  for (const fn of KIWI_DICT_FILES) {
    const src = join(opts.modelDir, fn)
    const data = readFileSync(src)
    kiwiModule.FS.writeFile(`${modelMount}/${basename(fn)}`, data)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiCmd = (args: any): any => JSON.parse(kiwiModule.api(JSON.stringify(args)))
  const id = apiCmd({
    method: 'build',
    args: [{
      modelPath: modelMount,
      integrateAllomorph: true,
      loadDefaultDict: true,
      loadTypoDict: true,
    }],
  }) as number

  const kiwi: KiwiInstance = new Proxy({} as KiwiInstance, {
    get: (_t, prop) => {
      if (prop === 'then') return undefined
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (...a: any[]) => apiCmd({ method: prop.toString(), id, args: a })
    },
  }) as unknown as KiwiInstance

  let closed = false
  const tokenize = (text: string): string[] => {
    if (closed) throw new Error('KoreanTokenizerHandle: tokenize after close')
    if (!text || typeof text !== 'string') return []
    const result: string[] = []
    for (const word of text.split(/\s+/)) {
      if (!word) continue
      if (ALNUM_TOKEN_RE.test(word)) {
        result.push(word.toLowerCase())
        continue
      }
      const tokens = kiwi.tokenize(word)
      for (const t of tokens) {
        const tag = t.tag.split('-')[0]
        if (CONTENT_POS.has(tag)) result.push(t.str.toLowerCase())
      }
    }
    return result
  }

  const close = (): void => {
    if (closed) return
    closed = true
    // Best-effort cleanup — Kiwi WASM heap free + FS unmount. Ignore errors.
    try {
      apiCmd({ method: 'destroy', id, args: [] })
    } catch {
      /* ignore — Kiwi instance may already be released */
    }
  }

  return { tokenize, close }
}
