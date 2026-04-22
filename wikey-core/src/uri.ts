/**
 * uri.ts — Phase 4.2 Stage 1 (plan v3).
 *
 * 저장하는 것은 source_id + vault_path 만. URI 는 render/open 시점 derive.
 * 번들 id 는 내부 relative path 기반 — 이동 무관 불변 (codex Critical #2).
 * 64-bit prefix + full-hash verify 루틴 (codex Medium #5).
 */

import { createHash } from 'node:crypto'

const PREFIX_HEX_LEN = 16 // 64-bit prefix. full hash is stored separately in registry.

export interface BundleEntry {
  readonly relativePath: string
  readonly bytes: Uint8Array
}

function sha256Hex(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export function computeFileId(bytes: Uint8Array): string {
  return `sha256:${sha256Hex(bytes).slice(0, PREFIX_HEX_LEN)}`
}

export function computeFullHash(bytes: Uint8Array): string {
  return sha256Hex(bytes)
}

/**
 * Bundle id is derived from internal (bundle-relative) paths + bytes.
 * vault-relative path is NOT used — the id must survive PARA moves.
 */
export function computeBundleId(entries: readonly BundleEntry[]): string {
  const sorted = [...entries].sort((a, b) => a.relativePath.localeCompare(b.relativePath))
  const lines = sorted.map((e) => `${e.relativePath}\t${sha256Hex(e.bytes)}`)
  const payload = lines.join('\n')
  return `sha256:${sha256Hex(payload).slice(0, PREFIX_HEX_LEN)}`
}

export function computeExternalId(uri: string): string {
  return `uri-hash:${sha256Hex(uri).slice(0, PREFIX_HEX_LEN)}`
}

/**
 * Obsidian internal link. Used by UI / wiki pages / plugin commands.
 * Produces `obsidian://open?vault=<enc>&file=<enc>` which Obsidian's built-in
 * URI handler resolves.
 */
export function buildObsidianOpenUri(vaultName: string, vaultPath: string): string {
  const v = encodeURIComponent(vaultName)
  const f = encodeURIComponent(vaultPath)
  return `obsidian://open?vault=${v}&file=${f}`
}

/** OS file:// URI for external-app opens (Finder reveal, xdg-open). */
export function buildFileUri(absolutePath: string): string {
  const normalized = absolutePath.startsWith('/') ? absolutePath : `/${absolutePath}`
  return `file://${normalized}`
}

/** Display form — raw vault-relative path, Korean/spaces untouched. */
export function formatDisplayPath(vaultPath: string): string {
  return vaultPath
}

/**
 * Verify that sha256(bytes) starts with the given prefix hex.
 * Used by registry.findByIdPrefix to disambiguate 64-bit prefix collisions.
 */
export function verifyFullHash(prefixHex: string, bytes: Uint8Array): boolean {
  const full = sha256Hex(bytes)
  return full.startsWith(prefixHex)
}

/** Paired sidecar .md path — deterministic suffix. */
export function sidecarVaultPath(originalVaultPath: string): string {
  return `${originalVaultPath}.md`
}
