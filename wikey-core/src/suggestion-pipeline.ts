import { createHash } from 'node:crypto'
import type {
  CanonicalizedResult,
  IngestRecord,
  Suggestion,
  CandidatePattern,
  ConceptType,
  EntityType,
} from './types.js'
import {
  detectCoOccurrence,
  detectSuffixCluster,
  computeConfidence,
} from './suggestion-detector.js'

/**
 * §5.4.2 AC8 — pipeline glue called from `ingest-pipeline.ts` finalize step.
 *
 * Pure-function surface so it remains easy to unit-test without spinning up
 * a full ingest. Side-effects (writing `.wikey/suggestions.json` /
 * `.wikey/mention-history.json`) are the caller's responsibility.
 */

const DEFAULT_CONFIDENCE_CUTOFF = 0.6

export interface RunSuggestionDetectionInput {
  readonly history: readonly IngestRecord[]
  readonly sourcePath: string
  readonly ingestedAt: string
  readonly canon: CanonicalizedResult
  readonly negativeCache: readonly string[]
  readonly confidenceCutoff?: number
}

export interface RunSuggestionDetectionResult {
  readonly suggestions: readonly Suggestion[]
  readonly updatedHistory: readonly IngestRecord[]
}

/**
 * Append a record to history with dedup on (source, ingestedAt). Pure.
 * Plan §3.2.3 line 382 mandates dedup so a retried ingest doesn't grow history.
 */
export function appendIngestHistory(
  history: readonly IngestRecord[],
  record: IngestRecord,
): readonly IngestRecord[] {
  const exists = history.some(
    (r) => r.source === record.source && r.ingestedAt === record.ingestedAt,
  )
  if (exists) return history
  return [...history, record]
}

/**
 * Run AC3+AC4 detectors on the updated history, score each candidate, drop
 * negativeCache hits, and emit Suggestion objects (state=pending) for those
 * passing `confidenceCutoff` (default 0.6 alpha — see plan §3.2.2 line 359).
 */
export function runSuggestionDetection(
  input: RunSuggestionDetectionInput,
): RunSuggestionDetectionResult {
  const cutoff = input.confidenceCutoff ?? DEFAULT_CONFIDENCE_CUTOFF
  const record = ingestRecordFromCanon(input.sourcePath, input.ingestedAt, input.canon)
  const updatedHistory = appendIngestHistory(input.history, record)

  // Co-occurrence detector runs on the new ingest only (per-source clusters).
  const coOccur = detectCoOccurrence(record)
  // Suffix-cluster detector runs across the full history (cross-source).
  const suffix = detectSuffixCluster(updatedHistory)

  const negSet = new Set(input.negativeCache)
  const suggestions: Suggestion[] = []
  for (const p of [...coOccur, ...suffix]) {
    const sig = signature(p)
    if (negSet.has(sig)) continue
    const confidence = computeConfidence(p)
    if (confidence < cutoff) continue
    suggestions.push(toSuggestion(p, sig, confidence, input.ingestedAt))
  }
  return { suggestions, updatedHistory }
}

function ingestRecordFromCanon(
  sourcePath: string,
  ingestedAt: string,
  canon: CanonicalizedResult,
): IngestRecord {
  const concepts = canon.concepts
    .filter((p) => p.conceptType !== undefined)
    .map((p) => ({ slug: p.filename, type: p.conceptType as ConceptType }))
  const entities = canon.entities
    .filter((p) => p.entityType !== undefined)
    .map((p) => ({ slug: p.filename, type: p.entityType as EntityType }))
  return { source: sourcePath, ingestedAt, concepts, entities }
}

/** Stable id = sha1(umbrella_slug + sorted component slugs). */
function signature(p: CandidatePattern): string {
  const slugs = [...p.components.map((c) => c.slug)].sort().join('|')
  return createHash('sha1').update(`${p.umbrella_slug}::${slugs}`).digest('hex')
}

function toSuggestion(
  p: CandidatePattern,
  id: string,
  confidence: number,
  ingestedAt: string,
): Suggestion {
  const suffix_score = p.unique_suffixes <= 1 ? 1.0 : 0.5
  return {
    id,
    umbrella_slug: p.umbrella_slug,
    umbrella_name: p.umbrella_name,
    candidate_components: p.components,
    support_count: p.support_count,
    suffix_score,
    mention_count: p.mention_count,
    confidence,
    evidence: p.evidence,
    state: { kind: 'pending' },
    createdAt: ingestedAt,
    updatedAt: ingestedAt,
  }
}
