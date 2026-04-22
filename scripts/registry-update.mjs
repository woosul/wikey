#!/usr/bin/env node
/**
 * registry-update.mjs — Phase 4.2 Stage 2 S2-5 (plan v3).
 *
 * bash <-> registry 브릿지. Obsidian 오프라인에서도 `.wikey/source-registry.json`
 * 을 즉시 갱신하기 위한 CLI (codex High #4 반영).
 *
 * Usage:
 *   node scripts/registry-update.mjs --record-move <id-or-path> <new-vault-path> [<new-sidecar-vault-path>]
 *   node scripts/registry-update.mjs --record-delete <id-or-path>
 *   node scripts/registry-update.mjs --find-by-path <vault-path>
 *   node scripts/registry-update.mjs --find-by-hash <full-sha256>
 *
 * Paths are vault-relative (POSIX forward slashes).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'

const PROJECT_DIR = process.cwd()
const REGISTRY_PATH = join(PROJECT_DIR, '.wikey/source-registry.json')

function load() {
  if (!existsSync(REGISTRY_PATH)) return {}
  try {
    return JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'))
  } catch (err) {
    process.stderr.write(`[registry-update] corrupt JSON: ${err.message}\n`)
    return {}
  }
}

function save(reg) {
  mkdirSync(dirname(REGISTRY_PATH), { recursive: true })
  const tmp = `${REGISTRY_PATH}.tmp`
  writeFileSync(tmp, JSON.stringify(reg, null, 2), 'utf-8')
  // atomic rename
  renameSync(tmp, REGISTRY_PATH)
}

function findKey(reg, idOrPath) {
  if (reg[idOrPath]) return idOrPath
  for (const [id, rec] of Object.entries(reg)) {
    if (rec.vault_path === idOrPath) return id
    if (Array.isArray(rec.path_history) && rec.path_history.some((h) => h.vault_path === idOrPath)) {
      return id
    }
  }
  return null
}

function usage(exit = 1) {
  process.stderr.write(
    'Usage: registry-update.mjs --record-move <id-or-path> <new-vault-path> [<new-sidecar-vault-path>]\n' +
      '       registry-update.mjs --record-delete <id-or-path>\n' +
      '       registry-update.mjs --find-by-path <vault-path>\n' +
      '       registry-update.mjs --find-by-hash <full-sha256>\n',
  )
  process.exit(exit)
}

function cmdRecordMove(args) {
  const [idOrPath, newPath, newSidecar] = args
  if (!idOrPath || !newPath) usage()
  const reg = load()
  const id = findKey(reg, idOrPath)
  if (!id) {
    process.stderr.write(`[registry-update] not found: ${idOrPath}\n`)
    process.exit(2)
  }
  const existing = reg[id]
  const at = new Date().toISOString()
  reg[id] = {
    ...existing,
    vault_path: newPath,
    sidecar_vault_path: newSidecar ?? existing.sidecar_vault_path,
    path_history: [...(existing.path_history ?? []), { vault_path: newPath, at }],
  }
  save(reg)
  process.stdout.write(`${id}\n`)
}

function cmdRecordDelete(args) {
  const [idOrPath] = args
  if (!idOrPath) usage()
  const reg = load()
  const id = findKey(reg, idOrPath)
  if (!id) {
    process.stderr.write(`[registry-update] not found: ${idOrPath}\n`)
    process.exit(2)
  }
  reg[id] = { ...reg[id], tombstone: true }
  save(reg)
  process.stdout.write(`${id}\n`)
}

function cmdFindByPath(args) {
  const [path] = args
  if (!path) usage()
  const reg = load()
  const id = findKey(reg, path)
  if (!id) process.exit(1)
  process.stdout.write(JSON.stringify({ id, record: reg[id] }, null, 2) + '\n')
}

function cmdFindByHash(args) {
  const [hash] = args
  if (!hash) usage()
  const reg = load()
  for (const [id, rec] of Object.entries(reg)) {
    if (rec.hash === hash) {
      process.stdout.write(JSON.stringify({ id, record: rec }, null, 2) + '\n')
      return
    }
  }
  process.exit(1)
}

const [, , cmd, ...rest] = process.argv
switch (cmd) {
  case '--record-move':
    cmdRecordMove(rest)
    break
  case '--record-delete':
    cmdRecordDelete(rest)
    break
  case '--find-by-path':
    cmdFindByPath(rest)
    break
  case '--find-by-hash':
    cmdFindByHash(rest)
    break
  default:
    usage(cmd ? 1 : 0)
}
