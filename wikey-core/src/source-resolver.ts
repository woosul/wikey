/**
 * source-resolver.ts — Phase 4.3 Part B.
 *
 * provenance.ref (`sources/<source_id>`) 를 Obsidian/filesystem URI 로 derive.
 * registry 조회 → tombstone/미등록 판정 → URI 생성. UI 층 (sidebar-chat) 이 소비.
 *
 * **저장 금지 원칙 (§4.2 v3)**: URI 는 runtime 에 계산하고 결과를 frontmatter 에
 * 다시 쓰지 않는다. PARA 이동 시 registry.vault_path 만 갱신되면 backlink 자동 유효.
 */

import type { WikiFS } from './types.js'
import {
  loadRegistry,
  findById,
  type SourceRecord,
  type SourceRegistry,
} from './source-registry.js'
import { buildObsidianOpenUri, buildFileUri, formatDisplayPath } from './uri.js'

/** Supported source id shapes. 'external' = user-supplied external URI (web/cloud). */
export type SourceIdKind = 'file' | 'external'

export interface ResolvedSource {
  /** `sha256:<16 hex>` (file) or `uri-hash:<16 hex>` (external). */
  readonly sourceId: string
  readonly kind: SourceIdKind
  /** Registry-current vault-relative path (PARA 이동 후 최신). null for external-only entries. */
  readonly currentPath: string | null
  /** Sidecar `.md` path if file + ingested (non-md source). */
  readonly sidecarPath: string | null
  /** Display form — "filename (dir)" 스타일 텍스트. UI 툴팁/레이블. */
  readonly displayLabel: string
  /** filename extension lowercased (`pdf`, `hwp`, `md`, …). Empty for external. */
  readonly extension: string
  /** True when registry.tombstone = true (raw/ 에서 삭제됨). */
  readonly tombstoned: boolean
  /**
   * URI to use when opening — `obsidian://open?vault=&file=` (internal vault file)
   * or absolute external URI (http(s)/file:). Tombstoned records return `null`.
   */
  readonly openUri: string | null
  /**
   * Optional absolute OS path (POSIX). Only populated when caller supplied
   * `absoluteBasePath`. Useful for `app.openWithDefaultApp` / file:// fallbacks.
   */
  readonly absolutePath: string | null
}

export interface ResolveSourceOptions {
  /** Obsidian vault name (used to build `obsidian://open?vault=...` URIs). */
  readonly vaultName: string
  /** Absolute OS path to the vault root. Optional — only needed for absolute-path output. */
  readonly absoluteBasePath?: string
  /**
   * Pre-loaded registry (batch render optimization). When omitted, `loadRegistry`
   * is invoked per call — fine for one-off lookups, wasteful for many.
   */
  readonly registry?: SourceRegistry
}

/**
 * Resolve a `provenance.ref` (or bare source_id) into a `ResolvedSource`.
 *
 * Accepted `idOrRef` shapes:
 *   - `sources/sha256:aaaaaaaaaaaaaaaa`      ← provenance.ref 그대로
 *   - `sha256:aaaaaaaaaaaaaaaa`              ← id 만
 *   - `sources/uri-hash:aaaaaaaaaaaaaaaa`    ← external
 *   - `uri-hash:aaaaaaaaaaaaaaaa`
 *
 * 반환:
 *   - Registry 에 없음 → `null` (UI 층에서 "원본 미등록" 처리).
 *   - Registry 에 있으나 tombstone=true → `tombstoned: true`, `openUri: null`.
 *   - 정상 → `openUri = obsidian://open?...` 또는 external URI.
 */
export async function resolveSource(
  wikiFS: WikiFS,
  idOrRef: string,
  opts: ResolveSourceOptions,
): Promise<ResolvedSource | null> {
  const sourceId = stripSourcesPrefix(idOrRef)
  if (!sourceId) return null

  const kind: SourceIdKind = sourceId.startsWith('uri-hash:') ? 'external' : 'file'

  const registry = opts.registry ?? (await loadRegistry(wikiFS))
  const record = findById(registry, sourceId)
  if (!record) return null

  return buildResolved(sourceId, kind, record, opts)
}

/**
 * Synchronous variant used by batch renderers that already hold a loaded registry.
 * Returns `null` when the record is missing — caller decides whether to surface as
 * "원본 미등록" or skip silently.
 */
export function resolveSourceSync(
  idOrRef: string,
  registry: SourceRegistry,
  opts: Omit<ResolveSourceOptions, 'registry'>,
): ResolvedSource | null {
  const sourceId = stripSourcesPrefix(idOrRef)
  if (!sourceId) return null
  const record = findById(registry, sourceId)
  if (!record) return null
  const kind: SourceIdKind = sourceId.startsWith('uri-hash:') ? 'external' : 'file'
  return buildResolved(sourceId, kind, record, opts)
}

function buildResolved(
  sourceId: string,
  kind: SourceIdKind,
  record: SourceRecord,
  opts: Omit<ResolveSourceOptions, 'registry'>,
): ResolvedSource {
  const currentPath = record.vault_path || null
  const sidecarPath = record.sidecar_vault_path || null
  const extension = extractExtension(currentPath)
  const displayLabel = currentPath
    ? formatDisplayPath(currentPath)
    : `(external ${sourceId.slice(0, 24)}…)`

  const absolutePath = opts.absoluteBasePath && currentPath
    ? joinPosix(opts.absoluteBasePath, currentPath)
    : null

  let openUri: string | null
  if (record.tombstone) {
    openUri = null
  } else if (kind === 'external') {
    // external refs: currentPath is the canonical URI (or null if never recorded).
    openUri = currentPath || null
  } else if (currentPath) {
    openUri = buildObsidianOpenUri(opts.vaultName, currentPath)
  } else {
    openUri = null
  }

  return {
    sourceId,
    kind,
    currentPath,
    sidecarPath,
    displayLabel,
    extension,
    tombstoned: record.tombstone,
    openUri,
    absolutePath,
  }
}

function stripSourcesPrefix(idOrRef: string): string | null {
  if (!idOrRef) return null
  const trimmed = idOrRef.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('sources/')) return trimmed.slice('sources/'.length) || null
  return trimmed
}

function extractExtension(vaultPath: string | null): string {
  if (!vaultPath) return ''
  const basename = vaultPath.split('/').pop() ?? ''
  const dotIdx = basename.lastIndexOf('.')
  if (dotIdx <= 0 || dotIdx === basename.length - 1) return ''
  return basename.slice(dotIdx + 1).toLowerCase()
}

function joinPosix(base: string, rel: string): string {
  const b = base.endsWith('/') ? base.slice(0, -1) : base
  const r = rel.startsWith('/') ? rel.slice(1) : rel
  return `${b}/${r}`
}

/** Convenience builder for file:// URI, exported for UI layer fallback. */
export function resolvedAbsoluteFileUri(resolved: ResolvedSource): string | null {
  if (!resolved.absolutePath) return null
  return buildFileUri(resolved.absolutePath)
}
