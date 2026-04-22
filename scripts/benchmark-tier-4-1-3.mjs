#!/usr/bin/env node
/**
 * Phase 4.1.3.4 — Tier chain 회귀 벤치마크 (5 코퍼스).
 *
 * 각 PDF 에 대해:
 *   1. Tier 1 (docling default) 실행 → scoreConvertOutput + isLikelyScanPdf 평가
 *   2. decision 에 따라 Tier 1a (--no-ocr) 또는 Tier 1b (--force-ocr) 실행
 *   3. Tier 1a: score 비교 후 더 나은 쪽 채택
 *   4. Tier 1b: regression guard (korean/body) 후 채택 or rollback
 *
 * 결과 `activity/phase-4-1-3-benchmark-<date>.md` 에 테이블 기록.
 *
 * 사용:
 *   node scripts/benchmark-tier-4-1-3.mjs [output_md]
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  scoreConvertOutput,
  isLikelyScanPdf,
  koreanLongTokenRatio,
  bodyCharsPerPage,
  countKoreanChars,
  hasKoreanRegression,
  hasBodyRegression,
} from '../wikey-core/dist/convert-quality.js'
import { stripEmbeddedImages } from '../wikey-core/dist/rag-preprocess.js'

const execAsync = promisify(execFile)

// 4 코퍼스 — 사용자 선택 (docs/samples 2개 + raw의 PMS·GOODSTREAM):
//   ROHM   : 한국어 공백 소실 케이스 (Tier 1 → retry → Tier 1b force-ocr 기대)
//   RP1    : 영문 vector PDF (Tier 1 accept 기대)
//   PMS    : vector PDF + UI screenshots (pollution → Tier 1a no-ocr 기대)
//   GOODSTREAM 사업자등록증: 단순 문서 (Tier 1 accept 기대)
// OMRON/TWHB (scan·큰 책) 는 실행 시간 이유로 본 라운드에서 제외 (§4.1.3.4 후속 확장).
const CORPORA = [
  ['ROHM', 'docs/samples/ROHM_Wi-SUN Juta통신모듈(BP35CO-J15).pdf'],
  ['RP1', 'docs/samples/rp1-peripherals.pdf'],
  ['PMS', 'raw/0_inbox/PMS_제품소개_R10_20220815.pdf'],
  ['GOODSTREAM', 'raw/0_inbox/사업자등록증C_(주)굿스트림_301-86-19385(2015).pdf'],
]

function buildArgs(pdf, outDir, mode) {
  const base = [pdf, '--to', 'md', '--output', outDir, '--table-mode', 'accurate', '--device', 'mps', '--image-export-mode', 'embedded']
  if (mode === 'default') return [...base, '--ocr-engine', 'ocrmac', '--ocr-lang', 'ko-KR,en-US']
  if (mode === 'no-ocr') return [...base, '--no-ocr']
  if (mode === 'force-ocr') return [...base, '--force-ocr', '--ocr-engine', 'ocrmac', '--ocr-lang', 'ko-KR,en-US']
  throw new Error(`unknown mode: ${mode}`)
}

async function getPageCount(pdf) {
  try {
    const { stdout } = await execAsync('python3', ['-c', 'import fitz, sys; print(len(fitz.open(sys.argv[1])))', pdf], { timeout: 5000 })
    return parseInt(stdout.trim(), 10) || 0
  } catch { return 0 }
}

async function runDocling(pdf, mode) {
  const dir = mkdtempSync(join(tmpdir(), `wikey-bench-${mode}-`))
  const t0 = Date.now()
  try {
    await execAsync('docling', buildArgs(pdf, dir, mode), { timeout: 900000, maxBuffer: 200 * 1024 * 1024 })
    const files = readdirSync(dir)
    const mdFile = files.find((f) => f.endsWith('.md'))
    if (!mdFile) return { md: '', dur: (Date.now() - t0) / 1000, err: 'no output md' }
    const raw = readFileSync(join(dir, mdFile), 'utf8')
    return { md: stripEmbeddedImages(raw), raw, dur: (Date.now() - t0) / 1000 }
  } catch (err) {
    return { md: '', dur: (Date.now() - t0) / 1000, err: err.message.split('\n')[0] }
  } finally {
    try { rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
  }
}

function analyze(md, pageCount) {
  const q = scoreConvertOutput(md, { retryOnKoreanWhitespace: true })
  return {
    score: q.score,
    decision: q.decision,
    flags: q.flags,
    isScan: isLikelyScanPdf(md, pageCount),
    koreanLong: koreanLongTokenRatio(md),
    perPage: bodyCharsPerPage(md, pageCount),
    bodyChars: md.trim().length,
    lines: md.split('\n').length,
    koreanChars: countKoreanChars(md),
  }
}

async function benchmark() {
  const results = []
  for (const [name, pdf] of CORPORA) {
    console.log(`\n=== ${name} (${pdf})`)
    const pageCount = await getPageCount(pdf)
    console.log(`  pages: ${pageCount}`)

    console.log(`  tier 1 (default)…`)
    const t1 = await runDocling(pdf, 'default')
    if (!t1.md) {
      console.log(`    ERROR: ${t1.err}`)
      results.push({ name, pdf, pageCount, err: t1.err })
      continue
    }
    const a1 = analyze(t1.md, pageCount)
    console.log(`    dur=${t1.dur.toFixed(1)}s score=${a1.score.toFixed(2)} decision=${a1.decision} flags=[${a1.flags.join(',')}] isScan=${a1.isScan} koreanLong=${(a1.koreanLong * 100).toFixed(1)}% bodyChars=${a1.bodyChars} lines=${a1.lines} koreanChars=${a1.koreanChars}`)

    let finalTier = '1-docling'
    let finalMd = t1.md
    let finalRaw = t1.raw     // §4.1.3: sidecar 저장용 raw (이미지 포함)
    let finalA = a1
    let t1aRun = null
    let t1bRun = null
    let a1a = null
    let a1b = null

    if (a1.decision === 'accept' && !a1.isScan) {
      // final = tier 1
    } else if (a1.decision === 'retry-no-ocr') {
      console.log(`  tier 1a (no-ocr)…`)
      t1aRun = await runDocling(pdf, 'no-ocr')
      if (t1aRun.md) {
        a1a = analyze(t1aRun.md, pageCount)
        console.log(`    dur=${t1aRun.dur.toFixed(1)}s score=${a1a.score.toFixed(2)} decision=${a1a.decision} flags=[${a1a.flags.join(',')}] bodyChars=${a1a.bodyChars} lines=${a1a.lines}`)
        if (a1a.score > a1.score) {
          finalTier = '1a-docling-no-ocr'
          finalMd = t1aRun.md
          finalRaw = t1aRun.raw
          finalA = a1a
        } else {
          console.log(`    → tier 1a score not greater, keeping tier 1`)
        }
      } else {
        console.log(`    ERROR: ${t1aRun.err}`)
      }
    } else if (a1.decision === 'retry' || a1.isScan) {
      console.log(`  tier 1b (force-ocr)…`)
      t1bRun = await runDocling(pdf, 'force-ocr')
      if (t1bRun.md) {
        const koRegress = hasKoreanRegression(t1.md, t1bRun.md)
        const bodyRegress = hasBodyRegression(t1.md, t1bRun.md)
        a1b = analyze(t1bRun.md, pageCount)
        console.log(`    dur=${t1bRun.dur.toFixed(1)}s score=${a1b.score.toFixed(2)} decision=${a1b.decision} flags=[${a1b.flags.join(',')}] koRegress=${koRegress} bodyRegress=${bodyRegress}`)
        if (koRegress || bodyRegress) {
          console.log(`    → regression — keeping tier 1`)
        } else if (a1b.decision === 'accept') {
          finalTier = '1b-docling-force-ocr'
          finalMd = t1bRun.md
          finalRaw = t1bRun.raw
          finalA = a1b
        } else {
          // score 비교
          const bq = scoreConvertOutput(t1.md, { retryOnKoreanWhitespace: false })
          if (bq.score > a1b.score) {
            console.log(`    → tier 1b worse, keeping tier 1`)
          } else {
            console.log(`    → tier 1b still low quality (fall through to tier 2 in real path); keeping tier 1 for bench record`)
          }
        }
      } else {
        console.log(`    ERROR: ${t1bRun.err}`)
      }
    } else {
      // decision=reject 단독 (!isScan) — 현 실제 루틴은 tier 2 fallthrough. 여기선 reject 기록.
      finalTier = 'REJECT → fall through'
    }

    // Sidecar 저장 — 사용자 설계 (§4.1.3): 원본.md = 이미지 포함 raw 를 저장.
    //   LLM 투입용 stripped 는 benchmark 내부 analyze() 전용, 디스크에 남지 않음.
    //   ingest-pipeline::extractPdfText::finalize 와 동일 정책.
    if (finalRaw && !finalTier.startsWith('REJECT')) {
      try {
        writeFileSync(`${pdf}.md`, finalRaw, 'utf8')
        console.log(`    sidecar (raw, images) → ${pdf}.md (${finalRaw.length} chars, tier=${finalTier})`)
      } catch (err) {
        console.log(`    sidecar save failed: ${err.message}`)
      }
    }

    results.push({
      name, pdf, pageCount,
      tier1: { ...a1, dur: t1.dur },
      tier1a: a1a ? { ...a1a, dur: t1aRun.dur } : null,
      tier1b: a1b ? { ...a1b, dur: t1bRun.dur } : null,
      finalTier,
      finalScore: finalA.score,
      finalFlags: finalA.flags,
      finalBodyChars: finalA.bodyChars,
    })
  }
  return results
}

function formatTable(results) {
  const lines = []
  lines.push('# Phase 4.1.3.4 — Tier chain 5 코퍼스 회귀 벤치마크')
  lines.push('')
  lines.push(`실행일: ${new Date().toISOString().slice(0, 10)}`)
  lines.push('')
  lines.push('## 요약 테이블')
  lines.push('')
  lines.push('| 문서 | pages | 채택 Tier | Tier 1 decision | Tier 1 score | 최종 score | flags | bodyChars | koreanChars |')
  lines.push('|---|---|---|---|---|---|---|---|---|')
  for (const r of results) {
    if (r.err) {
      lines.push(`| **${r.name}** | ${r.pageCount} | ERR | — | — | — | ${r.err} | — | — |`)
      continue
    }
    lines.push(`| **${r.name}** | ${r.pageCount} | ${r.finalTier} | ${r.tier1.decision} | ${r.tier1.score.toFixed(2)} | ${r.finalScore.toFixed(2)} | ${r.finalFlags.join(',') || '—'} | ${r.finalBodyChars} | ${r.tier1.koreanChars} |`)
  }
  lines.push('')
  lines.push('## Tier별 상세 (각 문서)')
  for (const r of results) {
    lines.push('')
    lines.push(`### ${r.name} (${r.pdf})`)
    if (r.err) {
      lines.push(`ERROR: ${r.err}`)
      continue
    }
    lines.push('')
    lines.push(`- pages: ${r.pageCount}`)
    lines.push(`- **Tier 1 (default)**: dur=${r.tier1.dur.toFixed(1)}s, score=${r.tier1.score.toFixed(2)}, decision=\`${r.tier1.decision}\`, flags=\`[${r.tier1.flags.join(',')}]\`, isScan=${r.tier1.isScan}, koreanLong=${(r.tier1.koreanLong * 100).toFixed(1)}%, bodyChars=${r.tier1.bodyChars}, lines=${r.tier1.lines}, koreanChars=${r.tier1.koreanChars}, perPage=${r.tier1.perPage.toFixed(0)}`)
    if (r.tier1a) {
      lines.push(`- **Tier 1a (--no-ocr)**: dur=${r.tier1a.dur.toFixed(1)}s, score=${r.tier1a.score.toFixed(2)}, decision=\`${r.tier1a.decision}\`, flags=\`[${r.tier1a.flags.join(',')}]\`, bodyChars=${r.tier1a.bodyChars}, lines=${r.tier1a.lines}, koreanChars=${r.tier1a.koreanChars}`)
    }
    if (r.tier1b) {
      lines.push(`- **Tier 1b (--force-ocr)**: dur=${r.tier1b.dur.toFixed(1)}s, score=${r.tier1b.score.toFixed(2)}, decision=\`${r.tier1b.decision}\`, flags=\`[${r.tier1b.flags.join(',')}]\`, bodyChars=${r.tier1b.bodyChars}, lines=${r.tier1b.lines}, koreanChars=${r.tier1b.koreanChars}`)
    }
    lines.push(`- **최종 채택**: \`${r.finalTier}\`, score=${r.finalScore.toFixed(2)}, flags=\`[${r.finalFlags.join(',')}]\``)
  }
  return lines.join('\n') + '\n'
}

const outPath = process.argv[2] || `activity/phase-4-1-3-benchmark-${new Date().toISOString().slice(0, 10)}.md`

benchmark().then((results) => {
  const out = formatTable(results)
  writeFileSync(outPath, out)
  console.log(`\n\n=== results written to ${outPath}`)
  console.log(out)
}).catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
