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
