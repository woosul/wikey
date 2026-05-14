/**
 * §5.20 sidebar-chat query log helper — GREEN implementation (Step C).
 *
 * Spec source: `docs/planning/phase-5/phase-5-spec-5.20-knowledge-gap-management.md` v0.2 (LOCK).
 *
 * `buildQueryLogEntry` normalizes a (question, query result) pair into the I3
 * 5-key `QueryLogEntry` shape. Privacy minimize — answer body / wiki path /
 * sources array 미저장. `now` 주입으로 deterministic test.
 */
import type { QueryLogEntry } from 'wikey-core'

export function buildQueryLogEntry(
  question: string,
  result: { answer: string; sources?: readonly unknown[]; citations?: readonly unknown[] },
  now: Date = new Date(),
): QueryLogEntry {
  return {
    ts: now.toISOString(),
    query: question,
    answerLen: result.answer.length,
    citationCount: result.citations?.length ?? 0,
    resolveFailed: (result.sources?.length ?? 0) === 0,
  }
}
