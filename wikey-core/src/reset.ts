/**
 * reset.ts — Phase 4.5.2 (본체 필수): 삭제·초기화 안전장치 순수 로직.
 *
 * 두 축:
 *   1. computeDeletionImpact — 삭제 전 영향 범위 계산 (영향 페이지 / registry 레코드 / backlink 수).
 *   2. previewReset          — 5 단계 scope 별 초기화 대상 파일 + 바이트 합.
 *
 * 모두 순수 — fs 부작용 없음. 실제 삭제는 wikey-obsidian/src/commands.ts
 * 에서 fs.unlinkSync / registry.recordDelete 로 수행.
 */

import type { WikiFS } from './types.js'
import {
  REGISTRY_PATH,
  findByPath as registryFindByPath,
  type SourceRecord,
  type SourceRegistry,
} from './source-registry.js'
import { extractWikilinks } from './wiki-ops.js'

// ─────────────────────────────────────────────────────────────
//  computeDeletionImpact
// ─────────────────────────────────────────────────────────────

export type DeletionTarget =
  | { readonly kind: 'source'; readonly vault_path: string }
  | { readonly kind: 'wiki-page'; readonly page_path: string }

export interface DeletionImpact {
  readonly pages: readonly string[]
  readonly backlinks: number
  readonly registryRecord?: { readonly id: string; readonly record: SourceRecord }
}

export interface ComputeDeletionImpactOptions {
  readonly wikiFS: WikiFS
  readonly registry: SourceRegistry
  readonly target: DeletionTarget
}

export async function computeDeletionImpact(
  opts: ComputeDeletionImpactOptions,
): Promise<DeletionImpact> {
  if (opts.target.kind === 'source') {
    const lookup = registryFindByPath(opts.registry, opts.target.vault_path)
    if (!lookup) {
      return { pages: [], backlinks: 0 }
    }
    return {
      pages: [...lookup.record.ingested_pages],
      backlinks: 0,
      registryRecord: { id: lookup.id, record: lookup.record },
    }
  }

  // wiki-page: count distinct pages that wikilink to target's basename.
  const pagePath = opts.target.page_path
  const basename = pagePath.split('/').pop()!.replace(/\.md$/, '')

  let backlinks = 0
  for (const p of await listWikiPages(opts.wikiFS)) {
    if (p === pagePath) continue
    let content: string
    try {
      content = await opts.wikiFS.read(p)
    } catch {
      continue
    }
    const links = extractWikilinks(content)
    if (links.some((l) => l === basename)) backlinks += 1
  }

  return {
    pages: [pagePath],
    backlinks,
  }
}

// ─────────────────────────────────────────────────────────────
//  previewReset
// ─────────────────────────────────────────────────────────────

export type ResetScope =
  | 'wiki+registry'
  | 'wiki-only'
  | 'registry-only'
  | 'qmd-index'
  | 'settings'

export interface PreviewResetOptions {
  readonly wikiFS: WikiFS
  readonly scope: ResetScope
}

export interface ResetPreview {
  readonly files: readonly string[]
  readonly bytes: number
}

/**
 * Marker path returned by qmd-index scope. Caller (commands.ts) resolves
 * to `~/.cache/qmd/index.sqlite` + invokes `reindex --purge`.
 */
export const QMD_INDEX_MARKER = '~/.cache/qmd/index.sqlite'

/**
 * Marker path returned by settings scope. Caller reset plugin data.json to
 * DEFAULT_SETTINGS in-place (commands.ts resolves vault adapter path).
 */
export const SETTINGS_MARKER = '.obsidian/plugins/wikey/data.json'

export async function previewReset(opts: PreviewResetOptions): Promise<ResetPreview> {
  switch (opts.scope) {
    case 'wiki+registry': {
      const wiki = await listWikiPages(opts.wikiFS)
      const files = [...wiki]
      if (await opts.wikiFS.exists(REGISTRY_PATH)) files.push(REGISTRY_PATH)
      const bytes = await sumBytes(opts.wikiFS, files)
      return { files, bytes }
    }
    case 'wiki-only': {
      const wiki = await listWikiPages(opts.wikiFS)
      const bytes = await sumBytes(opts.wikiFS, wiki)
      return { files: wiki, bytes }
    }
    case 'registry-only': {
      const files = (await opts.wikiFS.exists(REGISTRY_PATH)) ? [REGISTRY_PATH] : [REGISTRY_PATH]
      const bytes = await sumBytes(opts.wikiFS, files)
      return { files, bytes }
    }
    case 'qmd-index': {
      // External cache — WikiFS 로 사이즈 알 수 없음. marker 만 반환.
      return { files: [QMD_INDEX_MARKER], bytes: 0 }
    }
    case 'settings': {
      return { files: [SETTINGS_MARKER], bytes: 0 }
    }
    default:
      throw new Error(`previewReset: unknown scope ${String(opts.scope)}`)
  }
}

// ─────────────────────────────────────────────────────────────
//  Internals
// ─────────────────────────────────────────────────────────────

async function listWikiPages(fs: WikiFS): Promise<string[]> {
  const all = await fs.list('wiki')
  return all.filter((p) => p.startsWith('wiki/') && p.endsWith('.md')).sort()
}

async function sumBytes(fs: WikiFS, paths: readonly string[]): Promise<number> {
  let total = 0
  for (const p of paths) {
    try {
      const c = await fs.read(p)
      total += Buffer.byteLength(c, 'utf8')
    } catch {
      // missing — contribute 0
    }
  }
  return total
}
