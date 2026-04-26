#!/usr/bin/env node
/**
 * qmd-embeddings-export.mjs — Phase 5 §5.4.7 1순위 (실 qmd embeddings 통합).
 *
 * Plan: plan/phase-5-todox-5.4-integration.md §10
 *
 * Read-only export of qmd vector store embeddings keyed by mention slug, for
 * injection into run-convergence-pass.mjs `--embeddings <path>`. Reuses the
 * tools/qmd/node_modules better-sqlite3 + sqlite-vec stack via createRequire,
 * so wikey-core's zero-deps policy is preserved. Only SELECT is performed
 * (tools/qmd/CLAUDE.md "Never modify the SQLite database directly").
 *
 * Usage:
 *   node scripts/qmd-embeddings-export.mjs                   # default paths
 *   node scripts/qmd-embeddings-export.mjs --dry-run         # report, no write
 *   node scripts/qmd-embeddings-export.mjs \
 *     --qmd-db ~/.cache/qmd/index.sqlite \
 *     --collection wikey-wiki \
 *     --history .wikey/mention-history.json \
 *     --output  .wikey/qmd-embeddings.json
 *
 * Output JSON shape:
 *   { "<slug>": [number, ...×1024], ... }
 *
 * Behaviour:
 *   - Aggregates unique slugs across all ingests' concepts[] + entities[].
 *   - For each slug, finds documents.path = concepts/<slug>.md OR entities/<slug>.md
 *     in the configured collection. Slug missing from qmd → warn + skip.
 *   - Slug with multiple chunks (content_vectors.seq=0..N-1) → element-wise mean.
 *   - Embedding BLOB → Float32Array reinterpret → number[] serialize.
 *   - Dim sanity check (default 1024); mismatched dim → warn + skip.
 */

import { promises as fs } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, resolve, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_DIR = resolve(__dirname, '..')

// Isolated native deps (better-sqlite3 + sqlite-vec) for the host Node version,
// kept outside wikey-core (zero-deps policy) and outside tools/qmd (which
// targets Bun and may have a Bun-specific ABI). See scripts/qmd-export-deps/
// for the minimal package.json. Run `npm install` in that dir if missing.
const depsRequire = createRequire(resolve(PROJECT_DIR, 'scripts/qmd-export-deps/package.json'))
const Database = depsRequire('better-sqlite3')
const sqliteVec = depsRequire('sqlite-vec')

function log(msg) {
  process.stderr.write(`[qmd-embeddings-export] ${msg}\n`)
}

function expandHome(p) {
  if (!p) return p
  if (p.startsWith('~/')) return resolve(homedir(), p.slice(2))
  return p
}

function parseArgs(argv) {
  const args = {
    qmdDb: expandHome('~/.cache/qmd/index.sqlite'),
    collection: 'wikey-wiki',
    history: resolve(PROJECT_DIR, '.wikey/mention-history.json'),
    output: resolve(PROJECT_DIR, '.wikey/qmd-embeddings.json'),
    dim: 1024,
    dryRun: false,
    explicitSlugs: null,
  }
  const a = argv.slice(2)
  for (let i = 0; i < a.length; i++) {
    const k = a[i]
    const v = a[i + 1]
    switch (k) {
      case '--qmd-db':       args.qmdDb = expandHome(v); i++; break
      case '--collection':   args.collection = v; i++; break
      case '--history':      args.history = isAbsolute(v) ? v : resolve(PROJECT_DIR, v); i++; break
      case '--output':       args.output = isAbsolute(v) ? v : resolve(PROJECT_DIR, v); i++; break
      case '--dim':          args.dim = parseInt(v, 10); i++; break
      case '--dry-run': case '-n': args.dryRun = true; break
      case '--explicit-slugs': args.explicitSlugs = v.split(',').map((s) => s.trim()).filter(Boolean); i++; break
      case '--help': case '-h':
        process.stdout.write(
`qmd-embeddings-export — export qmd vector store embeddings keyed by mention slug

Options:
  --qmd-db <path>          qmd sqlite path (default ~/.cache/qmd/index.sqlite)
  --collection <name>      qmd collection name (default wikey-wiki)
  --history <path>         mention-history.json (default .wikey/mention-history.json)
  --output <path>          output JSON (default .wikey/qmd-embeddings.json)
  --dim <num>              expected embedding dim (default 1024)
  --explicit-slugs <list>  comma-separated slug override (skip history scan)
  --dry-run, -n            report only, do not write
  --help, -h               this help
`)
        process.exit(0)
      default:
        log(`unknown arg: ${k}`)
        process.exit(2)
    }
  }
  return args
}

async function loadSlugs(historyPath, explicit) {
  if (explicit && explicit.length > 0) {
    return explicit.map((slug) => ({ slug, type: null }))
  }
  const raw = await fs.readFile(historyPath, 'utf-8')
  const parsed = JSON.parse(raw)
  const ingests = Array.isArray(parsed) ? parsed
                : (parsed && Array.isArray(parsed.ingests)) ? parsed.ingests
                : []
  const seen = new Map()  // slug → type (first seen wins)
  for (const ing of ingests) {
    for (const c of (ing.concepts || [])) {
      if (typeof c === 'string') seen.set(c, 'concept')
      else if (c && c.slug) seen.set(c.slug, c.type === 'entity' || c.type === 'organization' || c.type === 'person' ? 'entity' : 'concept')
    }
    for (const e of (ing.entities || [])) {
      if (typeof e === 'string') seen.set(e, 'entity')
      else if (e && e.slug) seen.set(e.slug, 'entity')
    }
  }
  return Array.from(seen.entries()).map(([slug, type]) => ({ slug, type }))
}

function decodeFloat32Blob(blob, dim) {
  const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(blob)
  if (buf.byteLength !== dim * 4) {
    return null
  }
  // Copy into a fresh ArrayBuffer to avoid alignment issues, then view as Float32.
  const ab = new ArrayBuffer(buf.byteLength)
  const u8 = new Uint8Array(ab)
  u8.set(buf)
  return new Float32Array(ab)
}

function meanVectors(vectors, dim) {
  if (vectors.length === 0) return null
  if (vectors.length === 1) return Array.from(vectors[0])
  const acc = new Float64Array(dim)
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) acc[i] += v[i]
  }
  const out = new Array(dim)
  for (let i = 0; i < dim; i++) out[i] = acc[i] / vectors.length
  return out
}

async function main() {
  const args = parseArgs(process.argv)

  log(`qmd-db: ${args.qmdDb}`)
  log(`collection: ${args.collection}`)
  log(`history: ${args.history}`)
  log(`output: ${args.output}`)
  log(`dim: ${args.dim}`)
  if (args.dryRun) log('dry-run: TRUE')

  const slugs = await loadSlugs(args.history, args.explicitSlugs)
  log(`slugs: ${slugs.length} unique`)

  // Open qmd DB read-only + load sqlite-vec
  const db = new Database(args.qmdDb, { readonly: true, fileMustExist: true })
  sqliteVec.load(db)

  // Lookup statements
  // documents.path candidates per slug: concepts/<slug>.md, entities/<slug>.md
  const docByPath = db.prepare(
    `SELECT id, path, hash FROM documents WHERE collection = ? AND path = ? AND active = 1 LIMIT 1`
  )
  const seqsForHash = db.prepare(
    `SELECT seq FROM content_vectors WHERE hash = ? ORDER BY seq ASC`
  )
  const vecForHashSeq = db.prepare(
    `SELECT embedding FROM vectors_vec WHERE hash_seq = ?`
  )

  const result = {}
  let okCount = 0
  let missingCount = 0
  let dimMismatchCount = 0
  let noVectorCount = 0
  const missingSlugs = []
  const noVectorSlugs = []

  for (const { slug, type } of slugs) {
    // Try the type-implied path first; fall back to the other.
    const candidates = type === 'entity'
      ? [`entities/${slug}.md`, `concepts/${slug}.md`]
      : [`concepts/${slug}.md`, `entities/${slug}.md`]
    let doc = null
    for (const p of candidates) {
      const row = docByPath.get(args.collection, p)
      if (row) { doc = row; break }
    }
    if (!doc) {
      missingCount++
      missingSlugs.push(slug)
      continue
    }
    const seqRows = seqsForHash.all(doc.hash)
    if (seqRows.length === 0) {
      noVectorCount++
      noVectorSlugs.push(slug)
      continue
    }
    const vectors = []
    let dimBad = false
    for (const { seq } of seqRows) {
      const hashSeq = `${doc.hash}_${seq}`
      const row = vecForHashSeq.get(hashSeq)
      if (!row || !row.embedding) continue
      const f32 = decodeFloat32Blob(row.embedding, args.dim)
      if (!f32) { dimBad = true; continue }
      vectors.push(f32)
    }
    if (dimBad && vectors.length === 0) {
      dimMismatchCount++
      continue
    }
    if (vectors.length === 0) {
      noVectorCount++
      noVectorSlugs.push(slug)
      continue
    }
    const mean = meanVectors(vectors, args.dim)
    result[slug] = mean
    okCount++
  }

  db.close()

  log(`extracted: ${okCount} / ${slugs.length} (missing ${missingCount}, no-vector ${noVectorCount}, dim-mismatch ${dimMismatchCount})`)
  if (missingSlugs.length > 0) log(`missing slugs: ${missingSlugs.slice(0, 20).join(', ')}${missingSlugs.length > 20 ? ` ... (+${missingSlugs.length - 20})` : ''}`)
  if (noVectorSlugs.length > 0) log(`no-vector slugs (qmd embed not run for these?): ${noVectorSlugs.slice(0, 20).join(', ')}${noVectorSlugs.length > 20 ? ` ... (+${noVectorSlugs.length - 20})` : ''}`)

  if (args.dryRun) {
    log('dry-run: skipping write')
    return
  }

  const outDir = dirname(args.output)
  await fs.mkdir(outDir, { recursive: true })
  const tmp = `${args.output}.tmp`
  await fs.writeFile(tmp, JSON.stringify(result, null, 2), 'utf-8')
  await fs.rename(tmp, args.output)
  log(`wrote ${okCount} embeddings → ${args.output}`)
}

main().catch((err) => {
  process.stderr.write(`qmd-embeddings-export failed: ${err && err.stack ? err.stack : err}\n`)
  process.exit(1)
})
