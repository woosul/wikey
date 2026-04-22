#!/usr/bin/env node
/**
 * migrate-ingest-map.mjs — Phase 4.2 Stage 1 S1-4 (plan v3).
 *
 * Convert legacy `wiki/.ingest-map.json` (path → source filename) into the new
 * `.wikey/source-registry.json` schema. Idempotent — running on a vault without
 * the legacy map is a no-op.
 *
 * Usage:
 *   node scripts/migrate-ingest-map.mjs              # run migration
 *   node scripts/migrate-ingest-map.mjs --dry-run    # report only
 */

import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, basename } from 'node:path'

const PROJECT_DIR = process.cwd()
const LEGACY_PATH = join(PROJECT_DIR, 'wiki/.ingest-map.json')
const REGISTRY_PATH = join(PROJECT_DIR, '.wikey/source-registry.json')

const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('-n')

function log(msg) {
  process.stderr.write(`[migrate-ingest-map] ${msg}\n`)
}

function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function main() {
  if (!existsSync(LEGACY_PATH)) {
    log('no legacy .ingest-map.json found — no-op')
    process.exit(0)
  }
  log(`reading ${LEGACY_PATH}`)
  const legacy = JSON.parse(readFileSync(LEGACY_PATH, 'utf-8'))

  const existing = existsSync(REGISTRY_PATH) ? JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8')) : {}
  const now = new Date().toISOString()

  let migrated = 0
  let missing = 0
  for (const [rawPath, sourceFilename] of Object.entries(legacy)) {
    const fullPath = join(PROJECT_DIR, rawPath)
    if (!existsSync(fullPath)) {
      log(`missing on fs: ${rawPath} — tombstone`)
      missing++
      continue
    }
    const bytes = readFileSync(fullPath)
    const fullHash = sha256Hex(bytes)
    const id = `sha256:${fullHash.slice(0, 16)}`
    if (existing[id]) {
      log(`already registered: ${id} (${rawPath}) — skip`)
      continue
    }
    const size = statSync(fullPath).size
    const sidecarCandidate = `${rawPath}.md`
    const hasSidecar = existsSync(join(PROJECT_DIR, sidecarCandidate))
    existing[id] = {
      vault_path: rawPath,
      ...(hasSidecar ? { sidecar_vault_path: sidecarCandidate } : {}),
      hash: fullHash,
      size,
      first_seen: now,
      ingested_pages: [`wiki/sources/${sourceFilename}`],
      path_history: [{ vault_path: rawPath, at: now }],
      tombstone: false,
    }
    migrated++
    log(`migrated: ${rawPath} → ${id}`)
  }

  log(`summary — migrated=${migrated}, missing=${missing}, total-legacy=${Object.keys(legacy).length}`)

  if (DRY_RUN) {
    log('dry-run — not writing registry')
    return
  }

  if (migrated > 0) {
    mkdirSync(dirname(REGISTRY_PATH), { recursive: true })
    writeFileSync(REGISTRY_PATH, JSON.stringify(existing, null, 2), 'utf-8')
    log(`wrote ${REGISTRY_PATH}`)
  } else {
    log('no new records — registry untouched')
  }
}

main()
