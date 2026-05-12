/**
 * validate-wiki.ts — Phase 5 §5.7.1 (2026-05-08).
 *
 * `scripts/validate-wiki.sh` 의 TypeScript 포팅. 6 검증 (frontmatter / wikilink /
 * index.md 등재 / log.md format / 중복 basename / raw↔wiki basename 충돌). plugin
 * runtime 이 bash spawn 없이 in-process 호출 가능.
 *
 * 동등성: 기존 .sh 와 동일한 stdout 헤더 + `FAIL: ...` / `PASS:` 메시지 + exit code.
 * 차이: wikilink dedup (한 파일 같은 깨진 link 가 여러 번 있어도 1 회만 보고) — .sh 는
 * 매 매치마다 보고. 양쪽 모두 깨진 link 0건 = 동일 출력.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface ValidateWikiOptions {
  readonly basePath: string
  readonly wikiDir?: string
  readonly rawDir?: string
  readonly write?: (line: string) => void
  /**
   * Cooperative AbortSignal — polled at the head of every per-page validator
   * loop (frontmatter / wikilinks / index registration / duplicate basename /
   * raw↔wiki conflict). Pre-aborted signals throw before any output. §5.19
   * cycle #5 Finding 1 — `scripts-runner.captureRun` already wires its
   * `parentSignal` into the internal controller, so passing it through here
   * makes modal close → SIGTERM the same abort path as the timeout.
   */
  readonly signal?: AbortSignal
}

export interface ValidateWikiResult {
  readonly exitCode: number
  readonly errorCount: number
}

function* walkMarkdown(dir: string): Generator<string> {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  entries.sort((a, b) => a.name.localeCompare(b.name))
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walkMarkdown(full)
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      yield full
    }
  }
}

function* walkAll(dir: string): Generator<string> {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  entries.sort((a, b) => a.name.localeCompare(b.name))
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walkAll(full)
    } else if (entry.isFile()) {
      yield full
    }
  }
}

function readSafe(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf-8')
  } catch {
    return null
  }
}

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g

function extractRawLinks(content: string): readonly string[] {
  const links: string[] = []
  WIKILINK_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = WIKILINK_RE.exec(content)) !== null) {
    let link = match[1]
    const pipe = link.indexOf('|')
    if (pipe >= 0) link = link.slice(0, pipe)
    link = link.trim()
    if (link) links.push(link)
  }
  // dedup preserving order
  return Array.from(new Set(links))
}

function findFirstFile(root: string, predicate: (entry: string) => boolean): string | null {
  const stack = [root]
  while (stack.length > 0) {
    const dir = stack.shift()!
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        stack.push(full)
      } else if (entry.isFile() && predicate(entry.name)) {
        return full
      }
    }
  }
  return null
}

function resolveLink(
  link: string,
  wikiAbs: string,
  rawAbs: string,
  basePath: string,
): boolean {
  // path 형태 (`/` 포함): vault root 기준 직접 존재 검사
  if (link.includes('/')) {
    const candidate = path.isAbsolute(link) ? link : path.join(basePath, link)
    return fs.existsSync(candidate)
  }
  // basename 매칭 — 4 fallback (§5.13.B2)
  // 1) wiki/ 안 link 자체 (extension 포함)
  let found = findFirstFile(wikiAbs, (name) => name === link)
  if (found) return true
  // 2) wiki/ 안 link.md auto-append
  found = findFirstFile(wikiAbs, (name) => name === `${link}.md`)
  if (found) return true
  // 3) raw/ 안 link 자체
  found = findFirstFile(rawAbs, (name) => name === link)
  if (found) return true
  // 4) raw/ 안 link.* fallback
  const linkDot = `${link}.`
  found = findFirstFile(rawAbs, (name) => name.startsWith(linkDot))
  return found !== null
}

interface ValidateContext {
  readonly write: (s: string) => void
  readonly basePath: string
  readonly wikiAbs: string
  readonly rawAbs: string
  readonly signal?: AbortSignal
  errorCount: number
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return
  const err: Error & { name: string } = new Error('AbortError')
  err.name = 'AbortError'
  throw err
}

function fail(ctx: ValidateContext, msg: string): void {
  ctx.write(`FAIL: ${msg}`)
  ctx.errorCount += 1
}

function relDisplay(ctx: ValidateContext, file: string): string {
  return path.relative(ctx.basePath, file) || file
}

function checkFrontmatter(ctx: ValidateContext): void {
  ctx.write('=== 검증 1: 프론트매터 확인 ===')
  for (const file of walkMarkdown(ctx.wikiAbs)) {
    throwIfAborted(ctx.signal)
    const content = readSafe(file)
    if (content === null) continue
    const firstLine = content.split('\n', 1)[0] ?? ''
    if (firstLine !== '---') {
      fail(ctx, `${relDisplay(ctx, file)}: 프론트매터 없음`)
    }
  }
}

function checkWikilinks(ctx: ValidateContext): void {
  ctx.write('=== 검증 2: 위키링크 확인 ===')
  for (const file of walkMarkdown(ctx.wikiAbs)) {
    throwIfAborted(ctx.signal)
    const content = readSafe(file)
    if (content === null) continue
    const display = relDisplay(ctx, file)
    for (const link of extractRawLinks(content)) {
      if (!resolveLink(link, ctx.wikiAbs, ctx.rawAbs, ctx.basePath)) {
        fail(ctx, `${display}: 깨진 위키링크 [[${link}]]`)
      }
    }
  }
}

const INDEX_REGISTERED_SUBDIRS = ['entities', 'concepts', 'sources'] as const

function checkIndexRegistration(ctx: ValidateContext): void {
  ctx.write('=== 검증 3: 인덱스 등재 확인 ===')
  const indexPath = path.join(ctx.wikiAbs, 'index.md')
  const indexContent = readSafe(indexPath)
  if (indexContent === null) {
    fail(ctx, 'index.md 파일 없음')
    return
  }
  for (const subdir of INDEX_REGISTERED_SUBDIRS) {
    const subdirAbs = path.join(ctx.wikiAbs, subdir)
    if (!fs.existsSync(subdirAbs)) continue
    for (const file of walkMarkdown(subdirAbs)) {
      throwIfAborted(ctx.signal)
      const basename = path.basename(file, '.md')
      // 동등성: .sh 의 grep `[[<basename>]]` (alias 형식 미허용)
      if (!indexContent.includes(`[[${basename}]]`)) {
        fail(ctx, `${relDisplay(ctx, file)}: index.md에 미등재`)
      }
    }
  }
}

function checkLogFormat(ctx: ValidateContext): void {
  ctx.write('=== 검증 4: log.md 형식 확인 ===')
  const logPath = path.join(ctx.wikiAbs, 'log.md')
  const logContent = readSafe(logPath)
  if (logContent === null) return
  const dateHeaderRe = /^## \[\d{4}-\d{2}-\d{2}\]/
  const sectionRe = /^## /
  let inBody = false
  let dashCount = 0
  for (const line of logContent.split('\n')) {
    if (line === '---') {
      dashCount += 1
      if (dashCount >= 2) inBody = true
      continue
    }
    if (inBody && sectionRe.test(line) && !dateHeaderRe.test(line)) {
      fail(ctx, `log.md: 잘못된 형식 — ${line}`)
    }
  }
}

function checkDuplicateBasename(ctx: ValidateContext): void {
  ctx.write('=== 검증 5: 중복 파일명 확인 ===')
  const basenameMap = new Map<string, number>()
  for (const file of walkMarkdown(ctx.wikiAbs)) {
    throwIfAborted(ctx.signal)
    const base = path.basename(file)
    basenameMap.set(base, (basenameMap.get(base) ?? 0) + 1)
  }
  for (const [name, count] of basenameMap) {
    if (count > 1) fail(ctx, `중복 파일명: ${name}`)
  }
}

function checkBasenameConflict(ctx: ValidateContext): void {
  ctx.write('=== 검증 6: raw vs wiki basename 충돌 확인 ===')
  if (!fs.existsSync(ctx.rawAbs)) return
  for (const rawFile of walkMarkdown(ctx.rawAbs)) {
    throwIfAborted(ctx.signal)
    const base = path.basename(rawFile)
    const wikiMatch = findFirstFile(ctx.wikiAbs, (name) => name === base)
    if (wikiMatch) {
      fail(
        ctx,
        `basename 충돌: ${base} (raw=${relDisplay(ctx, rawFile)} ↔ wiki=${relDisplay(ctx, wikiMatch)}) — §5.13.A1 raw wikilink target ambiguity`,
      )
    }
  }
}

export async function runValidateWiki(opts: ValidateWikiOptions): Promise<ValidateWikiResult> {
  const write = opts.write ?? ((line: string) => console.log(line))
  const wikiRel = opts.wikiDir ?? 'wiki'
  const rawRel = opts.rawDir ?? 'raw'
  const ctx: ValidateContext = {
    write,
    basePath: opts.basePath,
    wikiAbs: path.isAbsolute(wikiRel) ? wikiRel : path.join(opts.basePath, wikiRel),
    rawAbs: path.isAbsolute(rawRel) ? rawRel : path.join(opts.basePath, rawRel),
    signal: opts.signal,
    errorCount: 0,
  }

  // Pre-aborted signal → throw before any output (consistent with maintenance core).
  throwIfAborted(ctx.signal)
  checkFrontmatter(ctx)
  checkWikilinks(ctx)
  checkIndexRegistration(ctx)
  checkLogFormat(ctx)
  checkDuplicateBasename(ctx)
  checkBasenameConflict(ctx)

  write('')
  if (ctx.errorCount === 0) {
    write('PASS: 모든 검증 통과')
    return { exitCode: 0, errorCount: 0 }
  }
  write(`FAIL: ${ctx.errorCount}건 오류 발견`)
  return { exitCode: 1, errorCount: ctx.errorCount }
}

export async function main(_argv: readonly string[]): Promise<number> {
  const result = await runValidateWiki({ basePath: process.cwd() })
  return result.exitCode
}

// plugin esbuild cjs bundle 에서 `import.meta.url` empty → fileURLToPath throw 방지.
function isEntryPoint(): boolean {
  try {
    if (typeof process === 'undefined' || !process.argv[1]) return false
    const metaUrl = (import.meta as { url?: unknown })?.url
    if (typeof metaUrl !== 'string' || metaUrl.length === 0) return false
    return process.argv[1] === fileURLToPath(metaUrl)
  } catch {
    return false
  }
}

if (isEntryPoint()) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(err)
      process.exit(2)
    })
}
