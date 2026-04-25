/**
 * paired-sidecar.ts — Phase 5 §5.2.0
 *
 * Mirror of `ingest-pipeline.ts:1870` `hasSidecar` rule (ext != md/txt + sibling
 * `<sourcePath>.md` exists). Used by Ingest/Audit panel UI to hide derived
 * `<base>.<ext>.md` rows + tag the original row with `[md]` badge + correct
 * file counts.
 *
 * UI-layer only — does NOT touch registry, movePair, or wiki/ data.
 */

const CONVERTIBLE_EXT_RE = /\.(pdf|hwp|hwpx|docx|pptx|xlsx|csv|html|htm|png|jpg|jpeg|tiff|tif)$/i

export function pairedSidecarSet(files: readonly string[]): Set<string> {
  const all = new Set(files)
  const paired = new Set<string>()
  for (const f of files) {
    if (!f.endsWith('.md')) continue
    const candidate = f.slice(0, -3)
    if (!all.has(candidate)) continue
    if (!CONVERTIBLE_EXT_RE.test(candidate)) continue
    paired.add(f)
  }
  return paired
}

export function hasSidecar(file: string, allFiles: ReadonlySet<string>): boolean {
  if (!CONVERTIBLE_EXT_RE.test(file)) return false
  return allFiles.has(`${file}.md`)
}

export function filterOutPairedSidecars(files: readonly string[]): string[] {
  const paired = pairedSidecarSet(files)
  return files.filter((f) => !paired.has(f))
}

export interface AuditCountInput {
  ingested: readonly string[]
  missing: readonly string[]
  unsupported?: readonly string[]
}

export interface AuditCountResult {
  ingested: string[]
  missing: string[]
  unsupported: string[]
  totalFiles: number
  folders: Record<string, { total: number; ingested: number; missing: number }>
}

/**
 * Phase 5 §5.2.0 v4 (2026-04-25):
 * paired sidecar 를 audit/dashboard 카운트에서 제외 + per-folder 재계산.
 *
 * Audit panel + Dashboard raw sources 양쪽이 동일한 결과를 가져야 하므로
 * pure helper 로 추출. unsupported 는 audit/dashboard 양쪽에서 missing 에 포함하지
 * 않고 total 에만 합산 (audit-ingest.py 정책 mirror).
 *
 * folder key = path 의 두 번째 segment (`raw/<folder>/...`).
 */
export function recountAuditAfterPairedExclude(input: AuditCountInput): AuditCountResult {
  const ingestedRaw = input.ingested ?? []
  const missingRaw = input.missing ?? []
  const unsupportedRaw = input.unsupported ?? []
  const all = new Set<string>([...ingestedRaw, ...missingRaw, ...unsupportedRaw])
  const paired = pairedSidecarSet([...all])
  const drop = (xs: readonly string[]) => xs.filter((x) => !paired.has(x))
  const ingested = drop(ingestedRaw)
  const missing = drop(missingRaw)
  const unsupported = drop(unsupportedRaw)

  const folders: Record<string, { total: number; ingested: number; missing: number }> = {}
  const folderOf = (path: string): string => {
    const parts = path.split('/')
    return parts.length >= 2 ? parts[1] : 'other'
  }
  const ensure = (key: string) => {
    if (!folders[key]) folders[key] = { total: 0, ingested: 0, missing: 0 }
    return folders[key]
  }
  for (const f of ingested) {
    const slot = ensure(folderOf(f))
    slot.total += 1
    slot.ingested += 1
  }
  for (const f of missing) {
    const slot = ensure(folderOf(f))
    slot.total += 1
    slot.missing += 1
  }
  for (const f of unsupported) {
    const slot = ensure(folderOf(f))
    slot.total += 1
  }

  return {
    ingested,
    missing,
    unsupported,
    totalFiles: ingested.length + missing.length + unsupported.length,
    folders,
  }
}
