/**
 * §5.19 v0.5 R6 — Refactoring archive.
 *
 * Duplicates / lowUtility 페이지를 `wiki/archive/<original-path>` 로 이동 (단순
 * archive 만 — duplicate 본문 merge 는 별 cycle scope).
 *
 * Invariants:
 *   I-ARCH-1 (confirm 의무): confirm=false → 변경 0.
 *   I-ARCH-2 (idempotent): 같은 paths 2회 → 2회째 archived=[].
 *   I-ARCH-3 (dry-run): dryRun=true → 변경 0 + wouldArchive 채움.
 *   I-ARCH-4 (selective): archivePaths 명시한 페이지만 archive.
 *   I-ARCH-5 (path preserve): wiki/entities/foo.md → wiki/archive/entities/foo.md.
 *   I-ARCH-6 (log entry): apply 후 wiki/log.md 에 `lint-fix | refactoring archive` entry.
 *
 * NOTE: `WikiFS.delete` 가 type 정의에 없을 수 있어 optional 처리. delete 미지원
 *       runtime 에서는 archive copy 만 만들고 원본 보존 (현재 모든 production
 *       FS 는 delete 지원 — 검증 후 throw 로 격상 가능).
 */

import type { WikiFS } from '../../types.js'
import { throwIfAborted } from './helpers.js'

export interface ApplyRefactoringArchiveOptions {
  readonly confirm: boolean
  readonly archivePaths: readonly string[]
  readonly dryRun?: boolean
  readonly today?: string
  readonly signal?: AbortSignal
}

export interface RefactoringArchiveReport {
  readonly archived: readonly string[]
  readonly wouldArchive: readonly string[]
  /** 존재 안 했거나 archive 대상이 아닌 path (silent skip — idempotent). */
  readonly skipped: readonly string[]
  readonly logEntryAdded: boolean
}

const ARCHIVE_PREFIX = 'wiki/archive/'
const WIKI_PREFIX = 'wiki/'

export async function applyRefactoringArchive(
  fs: WikiFS,
  opts: ApplyRefactoringArchiveOptions,
): Promise<RefactoringArchiveReport> {
  // I-ARCH-1 — confirm 의무.
  if (!opts.confirm) {
    return { archived: [], wouldArchive: [], skipped: [], logEntryAdded: false }
  }

  throwIfAborted(opts.signal)

  // Pre-resolve which paths actually exist + are eligible (under wiki/, NOT already
  // in wiki/archive/).
  const toArchive: string[] = []
  const skipped: string[] = []
  for (const path of opts.archivePaths) {
    throwIfAborted(opts.signal)
    if (!path.startsWith(WIKI_PREFIX)) {
      skipped.push(path)
      continue
    }
    if (path.startsWith(ARCHIVE_PREFIX)) {
      // Already archived — idempotent skip.
      skipped.push(path)
      continue
    }
    if (!(await fs.exists(path))) {
      skipped.push(path)
      continue
    }
    toArchive.push(path)
  }

  // I-ARCH-3 — dry-run short-circuit.
  if (opts.dryRun) {
    return { archived: [], wouldArchive: toArchive, skipped, logEntryAdded: false }
  }

  if (toArchive.length === 0) {
    return { archived: [], wouldArchive: [], skipped, logEntryAdded: false }
  }

  // Apply — copy to archive path, then delete original.
  const archived: string[] = []
  for (const source of toArchive) {
    throwIfAborted(opts.signal)
    const content = await fs.read(source)
    const dest = archiveDestPath(source)
    await fs.write(dest, content)
    await deleteIfSupported(fs, source)
    archived.push(source)
  }

  // I-ARCH-6 — log entry append.
  const today = opts.today ?? new Date().toISOString().slice(0, 10)
  const logPath = 'wiki/log.md'
  const existing = (await fs.exists(logPath)) ? await fs.read(logPath) : ''
  const entry = renderLogEntry(today, archived)
  const separator = existing.endsWith('\n') || existing === '' ? '' : '\n'
  await fs.write(logPath, existing + separator + entry)

  return { archived, wouldArchive: [], skipped, logEntryAdded: true }
}

/**
 * `wiki/entities/foo.md` → `wiki/archive/entities/foo.md` — mirror sub-path
 * under archive/ so the original category (entities / concepts / sources /
 * analyses) is preserved for later recovery / audit.
 */
function archiveDestPath(source: string): string {
  // Strip the leading `wiki/` then prepend `wiki/archive/`.
  const sub = source.slice(WIKI_PREFIX.length)
  return `${ARCHIVE_PREFIX}${sub}`
}

async function deleteIfSupported(fs: WikiFS, path: string): Promise<void> {
  // `WikiFS.delete` is not yet on the public type. The Obsidian + node FS
  // adapters both implement it; tests stub it directly. Fallback: leave
  // original in place (archive copy still created — partial-state acceptable
  // since the log entry records the archive event).
  const maybeDelete = (fs as unknown as { delete?: (p: string) => Promise<void> }).delete
  if (typeof maybeDelete === 'function') {
    await maybeDelete.call(fs, path)
  }
}

function renderLogEntry(today: string, archived: readonly string[]): string {
  const lines = [
    `## [${today}] lint-fix | refactoring archive`,
    '',
    `- archive 된 페이지: ${archived.length}개`,
  ]
  for (const p of archived) lines.push(`  - ${p}`)
  lines.push('')
  return lines.join('\n')
}
