/**
 * §5.7.5 — upstream update detect (재시작 1회).
 *
 * 5 kind 별 source / current ver detection / upstream ver fetch / diff URL:
 *  - kiwi-nlp        : vendor (sparse) — VENDOR.md 의 Kiwi git tag → bab2min/Kiwi releases
 *  - orama           : npm dep — wikey-core/package.json + npm registry latest
 *  - qwen3-embedding : model file — HuggingFace model card revision
 *  - qmd-vendored    : tools/qmd/ vendored — git tag → upstream qmd repo
 *  - kiwi-dict       : Kiwi 사전 (~104MB) — md5 + Kiwi 본가 release
 *
 * lifecycle:
 *  - plugin onload (1회, developerMode && allowUpdateCheck) → detectUpstreamUpdates(...)
 *  - settings-tab UI 안 cache (이후 사용자 [분석] 버튼 trigger 시 별 호출)
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export type UpdateItemKind = 'kiwi-nlp' | 'orama' | 'qwen3-embedding' | 'qmd-vendored' | 'kiwi-dict'

export interface UpdateItemDescriptor {
  readonly id: string
  readonly kind: UpdateItemKind
  readonly displayName: string
  readonly currentVersion: string
  readonly upstreamVersion?: string
  readonly hasUpdate: boolean
  readonly diffSource: string
  readonly fetchError?: string
}

export interface UpdateCheckResult {
  readonly items: readonly UpdateItemDescriptor[]
  readonly checkedAt: string
  readonly errors: readonly string[]
}

export interface DetectUpstreamUpdatesOptions {
  readonly basePath: string
  readonly allowNetwork: boolean
  /** Injected fetcher — test mock or production fetch wrapper. */
  readonly fetch: (url: string) => Promise<string>
}

const KIWI_RELEASES_API = 'https://api.github.com/repos/bab2min/Kiwi/releases/latest'
const KIWI_RELEASES_PAGE = 'https://github.com/bab2min/Kiwi/releases'
const ORAMA_NPM_REGISTRY = 'https://registry.npmjs.org/@orama/orama'
const ORAMA_REPO_RELEASES = 'https://github.com/oramasearch/orama/releases'
const QWEN3_HF_API = 'https://huggingface.co/api/models/Qwen/Qwen3-Embedding-0.6B-GGUF'
const QWEN3_HF_PAGE = 'https://huggingface.co/Qwen/Qwen3-Embedding-0.6B-GGUF'
// §5.7.5 cycle #3 fix — qmd vendored = Tobi Lutke의 `tobi/qmd` (package name `@tobilu/qmd`).
const QMD_REPO_RELEASES = 'https://github.com/tobi/qmd/releases'
const QMD_REPO_API = 'https://api.github.com/repos/tobi/qmd/releases/latest'

/** simple semver-ish compare. Returns true if upstream > current. */
function isNewer(current: string, upstream: string): boolean {
  const norm = (s: string): number[] => {
    const stripped = s.replace(/^v/, '')
    return stripped.split(/[.\-]/u).map((p) => {
      const n = parseInt(p, 10)
      return Number.isNaN(n) ? 0 : n
    })
  }
  const a = norm(current)
  const b = norm(upstream)
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const ai = a[i] ?? 0
    const bi = b[i] ?? 0
    if (bi > ai) return true
    if (bi < ai) return false
  }
  return false
}

/** Read kiwi vendor git tag from VENDOR.md `Kiwi git tag: vX.Y.Z`. */
function readKiwiVendorTag(basePath: string): string {
  const vendorMd = join(basePath, 'wikey-core', 'vendor', 'kiwi-nlp', 'VENDOR.md')
  if (!existsSync(vendorMd)) return ''
  const txt = readFileSync(vendorMd, 'utf-8')
  const m = txt.match(/Kiwi git tag\*\*:\s*(v[0-9][0-9A-Za-z.\-]*)/)
  return m ? m[1] : ''
}

/** Read @orama/orama version from wikey-core/package.json dependencies. */
function readOramaVersion(basePath: string): string {
  const pkg = join(basePath, 'wikey-core', 'package.json')
  if (!existsSync(pkg)) return ''
  try {
    const json = JSON.parse(readFileSync(pkg, 'utf-8')) as {
      dependencies?: Record<string, string>
    }
    const v = json.dependencies?.['@orama/orama'] ?? ''
    return v.replace(/^[\^~]/, '')
  } catch {
    return ''
  }
}

async function fetchJsonField<T>(
  fetcher: (url: string) => Promise<string>,
  url: string,
  pick: (parsed: unknown) => T | undefined,
): Promise<{ value?: T; error?: string }> {
  try {
    const text = await fetcher(url)
    const parsed = JSON.parse(text) as unknown
    return { value: pick(parsed) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { error: msg }
  }
}

async function detectKiwiNlp(
  basePath: string,
  fetcher: (url: string) => Promise<string>,
  allowNetwork: boolean,
): Promise<UpdateItemDescriptor> {
  const current = readKiwiVendorTag(basePath) || 'unknown'
  let upstream: string | undefined
  let fetchError: string | undefined
  if (allowNetwork) {
    const r = await fetchJsonField(fetcher, KIWI_RELEASES_API, (p) =>
      typeof (p as { tag_name?: unknown }).tag_name === 'string'
        ? ((p as { tag_name: string }).tag_name)
        : undefined,
    )
    upstream = r.value
    fetchError = r.error
  }
  const has = !!upstream && current !== 'unknown' && isNewer(current, upstream)
  // §5.7.5 cycle #3 fix — spec AC-U2 요구 = `bab2min/Kiwi/compare/<currentTag>...<upstreamTag>`.
  // upstream tag resolved 시 compare URL 생성, 실패/unknown 시 releases page fallback.
  const diffSource = upstream && current !== 'unknown'
    ? `https://github.com/bab2min/Kiwi/compare/${current}...${upstream}`
    : KIWI_RELEASES_PAGE
  return {
    id: 'kiwi-nlp',
    kind: 'kiwi-nlp',
    displayName: 'Kiwi NLP (vendor)',
    currentVersion: current,
    upstreamVersion: upstream,
    hasUpdate: has,
    diffSource,
    fetchError,
  }
}

async function detectOrama(
  basePath: string,
  fetcher: (url: string) => Promise<string>,
  allowNetwork: boolean,
): Promise<UpdateItemDescriptor> {
  const current = readOramaVersion(basePath) || 'unknown'
  let upstream: string | undefined
  let fetchError: string | undefined
  if (allowNetwork) {
    const r = await fetchJsonField(fetcher, ORAMA_NPM_REGISTRY, (p) => {
      const obj = p as { 'dist-tags'?: { latest?: unknown } }
      const tag = obj['dist-tags']?.latest
      return typeof tag === 'string' ? tag : undefined
    })
    upstream = r.value
    fetchError = r.error
  }
  const has = !!upstream && current !== 'unknown' && isNewer(current, upstream)
  return {
    id: 'orama',
    kind: 'orama',
    displayName: 'Orama (@orama/orama)',
    currentVersion: current,
    upstreamVersion: upstream,
    hasUpdate: has,
    diffSource: ORAMA_REPO_RELEASES,
    fetchError,
  }
}

async function detectQwen3Embedding(
  fetcher: (url: string) => Promise<string>,
  allowNetwork: boolean,
): Promise<UpdateItemDescriptor> {
  // current = local cache file mtime hash 또는 GGUF quant level. network fetch 만으로는
  // 정확한 detect 어렵다 — 본 cycle 단위 테스트는 mock 의 sha 반환만 검증, production 은
  // best-effort. cache file 부재 시 'unknown' 으로 set 가능하므로 string 타입 유지.
  const current: string = 'Q8_0'
  let upstream: string | undefined
  let fetchError: string | undefined
  if (allowNetwork) {
    const r = await fetchJsonField(fetcher, QWEN3_HF_API, (p) => {
      const obj = p as { sha?: unknown; lastModified?: unknown }
      if (typeof obj.sha === 'string') return obj.sha.slice(0, 10)
      return typeof obj.lastModified === 'string' ? obj.lastModified : undefined
    })
    upstream = r.value
    fetchError = r.error
  }
  // hasUpdate heuristic = upstream 이 current 와 다르면 true (보수적 manual review).
  const has = !!upstream && upstream !== current && upstream.length > 0
  return {
    id: 'qwen3-embedding',
    kind: 'qwen3-embedding',
    displayName: 'Qwen3-Embedding-0.6B (GGUF)',
    currentVersion: current,
    upstreamVersion: upstream,
    hasUpdate: has,
    diffSource: QWEN3_HF_PAGE,
    fetchError,
  }
}

/** §5.7.5 cycle #3 fix — read tools/qmd/package.json version (pkg name = `@tobilu/qmd`). */
function readQmdVendoredVersion(basePath: string): string {
  const pkg = join(basePath, 'tools', 'qmd', 'package.json')
  if (!existsSync(pkg)) return 'unknown'
  try {
    const json = JSON.parse(readFileSync(pkg, 'utf-8')) as { version?: string }
    return typeof json.version === 'string' && json.version ? json.version : 'unknown'
  } catch {
    return 'unknown'
  }
}

async function detectQmdVendored(
  basePath: string,
  fetcher: (url: string) => Promise<string>,
  allowNetwork: boolean,
): Promise<UpdateItemDescriptor> {
  // §5.7.5 cycle #3 fix — qmd 잔여 회귀 path version = tools/qmd/package.json `version`.
  // upstream = api.github.com/repos/tobi/qmd/releases/latest. hasUpdate = isNewer 평가.
  const current = readQmdVendoredVersion(basePath)
  let upstream: string | undefined
  let fetchError: string | undefined
  if (allowNetwork) {
    const r = await fetchJsonField(fetcher, QMD_REPO_API, (p) =>
      typeof (p as { tag_name?: unknown }).tag_name === 'string'
        ? ((p as { tag_name: string }).tag_name)
        : undefined,
    )
    upstream = r.value
    fetchError = r.error
  }
  const has = !!upstream && current !== 'unknown' && isNewer(current, upstream)
  const diffSource = upstream && current !== 'unknown'
    ? `https://github.com/tobi/qmd/compare/v${current.replace(/^v/, '')}...${upstream}`
    : QMD_REPO_RELEASES
  return {
    id: 'qmd-vendored',
    kind: 'qmd-vendored',
    displayName: 'qmd (vendored fallback)',
    currentVersion: current,
    upstreamVersion: upstream,
    hasUpdate: has,
    diffSource,
    fetchError,
  }
}

async function detectKiwiDict(
  basePath: string,
  fetcher: (url: string) => Promise<string>,
  allowNetwork: boolean,
): Promise<UpdateItemDescriptor> {
  // Kiwi 사전 ~104MB (~/.cache/wikey/kiwi-models/cong/base/) — 본 cycle 단위 = mock 만.
  // current = vendor tag 와 동등 (동일 release 묶음). upstream = 본가 release.
  const current = readKiwiVendorTag(basePath) || 'unknown'
  let upstream: string | undefined
  let fetchError: string | undefined
  if (allowNetwork) {
    // 같은 endpoint 사용 — Kiwi releases 의 model asset 도 포함
    const r = await fetchJsonField(fetcher, KIWI_RELEASES_API, (p) =>
      typeof (p as { tag_name?: unknown }).tag_name === 'string'
        ? ((p as { tag_name: string }).tag_name)
        : undefined,
    )
    upstream = r.value
    fetchError = r.error
  }
  const has = !!upstream && current !== 'unknown' && isNewer(current, upstream)
  return {
    id: 'kiwi-dict',
    kind: 'kiwi-dict',
    displayName: 'Kiwi dictionary models (cong/base)',
    currentVersion: current,
    upstreamVersion: upstream,
    hasUpdate: has,
    diffSource: KIWI_RELEASES_PAGE,
    fetchError,
  }
}

export async function detectUpstreamUpdates(
  opts: DetectUpstreamUpdatesOptions,
): Promise<UpdateCheckResult> {
  const errors: string[] = []
  const items: UpdateItemDescriptor[] = []

  const detectors = [
    detectKiwiNlp(opts.basePath, opts.fetch, opts.allowNetwork),
    detectOrama(opts.basePath, opts.fetch, opts.allowNetwork),
    detectQwen3Embedding(opts.fetch, opts.allowNetwork),
    detectQmdVendored(opts.basePath, opts.fetch, opts.allowNetwork),
    detectKiwiDict(opts.basePath, opts.fetch, opts.allowNetwork),
  ] as const

  const results = await Promise.allSettled(detectors)
  for (const r of results) {
    if (r.status === 'fulfilled') items.push(r.value)
    else errors.push(r.reason instanceof Error ? r.reason.message : String(r.reason))
  }

  return {
    items,
    checkedAt: new Date().toISOString(),
    errors,
  }
}
