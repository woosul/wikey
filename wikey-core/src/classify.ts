/**
 * classify.ts — inbox 파일 분류 힌트 (CLASSIFY.md 규칙 기반)
 *
 * 2차 서브폴더 라우팅만 담당한다 (PARA 카테고리는 기본 3_resources).
 * 3차 상세 주제 폴더 및 PARA 간 이동(1_projects/2_areas/4_archive)은
 * LLM 기반 분류가 필요하므로 여기서 다루지 않는다.
 */

export interface ClassifyResult {
  readonly filename: string
  readonly hint: string
  /** Target folder relative to vault root. Empty string = "let LLM decide" or URI reference. */
  readonly destination: string
  /** True if the destination was decided by an LLM fallback (not hardcoded rules). */
  readonly llmDecided?: boolean
  /** True if hardcoded rules reached a 2nd-level folder but couldn't determine a 3rd-level (Dewey) folder. */
  readonly needsThirdLevel?: boolean
}

const PDF_MANUAL_RE = /(manual|guide|datasheet|getting.?started|user|매뉴얼|가이드|사용법|핸드북|handbook)/i
const PDF_REPORT_RE = /(report|paper|analysis|백서|리포트|논문|분석)/i

/**
 * 3차 폴더 — Dewey Decimal 10대분류 (DDC 표준 번호 준수).
 *
 * 표준 참조: https://en.wikipedia.org/wiki/Dewey_Decimal_Classification
 * - 000 Computer science, information & general works
 * - 100 Philosophy & psychology
 * - 200 Religion
 * - 300 Social sciences
 * - 400 Language
 * - 500 Natural sciences & Mathematics
 * - 600 Technology (Applied sciences)
 * - 700 Arts & Recreation
 * - 800 Literature
 * - 900 History & Geography
 *
 * 파일명을 `[^a-z0-9가-힣]+` 기준 토큰화 → 키워드 매칭. 첫 매칭 확정.
 * 매칭 없으면 2차 폴더까지만 (신규 주제는 LLM/사용자 수동 → Phase 4 §4-4b).
 */
interface DeweyCategory {
  readonly folder: string
  readonly keywords: readonly string[]
}

const DEWEY: readonly DeweyCategory[] = [
  {
    // DDC 000: Computer science, information, general works
    folder: '000_computer_science',
    keywords: [
      'ai', 'llm', 'gpt', 'claude', 'gemini', 'python', 'javascript', 'typescript',
      'raspberry', 'arduino', 'esp32', 'firmware', 'software', 'programming',
      'embedded', 'computer', 'linux', 'raspbian', 'wiki', 'database', 'algorithm',
      '프로그래밍', '소프트웨어', '컴퓨터', '정보',
    ],
  },
  {
    // DDC 100: Philosophy & psychology
    folder: '100_philosophy_psychology',
    keywords: [
      'philosophy', 'ethics', 'logic', 'metaphysics', 'psychology', 'psychological',
      'cognitive', 'behavior', 'consciousness', 'mind',
      '철학', '심리', '윤리', '논리', '인지',
    ],
  },
  {
    // DDC 200: Religion
    folder: '200_religion',
    keywords: [
      'religion', 'religious', 'theology', 'bible', 'buddhism', 'christianity',
      'islam', 'scripture', 'prayer', 'meditation',
      '종교', '불교', '기독교', '성경', '경전', '명상',
    ],
  },
  {
    // DDC 300: Social sciences — 행정·법·경제·상업·교육
    folder: '300_social_sciences',
    keywords: [
      'business', 'registration', 'certificate', 'tax', 'invoice', 'corporate',
      'legal', 'law', 'policy', 'government', 'administration', 'finance',
      'economic', 'economy', 'education', 'sociology', 'politics', 'election',
      '사업자', '사업자등록', '세금', '세무', '세금계산서', '법인', '증명서',
      '법률', '정책', '정부', '행정', '경제', '금융', '교육', '사회',
    ],
  },
  {
    // DDC 400: Language & Linguistics
    folder: '400_language',
    keywords: [
      'language', 'linguistic', 'grammar', 'vocabulary', 'dictionary', 'translation',
      '언어', '국어', '영어', '문법', '사전', '번역',
    ],
  },
  {
    // DDC 500: Natural sciences & mathematics
    folder: '500_natural_science',
    keywords: [
      'physics', 'chemistry', 'mathematics', 'math', 'biology', 'thermodynamics',
      'quantum', 'semiconductor', 'sic', 'silicon-carbide',
      '반도체', '물리', '화학', '수학', '생물', '과학',
    ],
  },
  {
    // DDC 600: Technology (Applied sciences) — 공학, 전자, 기계, 통신, 의학
    folder: '600_technology',
    keywords: [
      'circuit', 'pcb', 'schematic', 'cad', 'stl', 'step', '3mf', 'mechanical',
      'gear', 'chassis', 'bldc', 'brushless', 'servo', 'motor',
      'radio', 'wireless', 'fpv', 'dji', 'walksnail', 'sdr', 'malahit', 'nanovna',
      'vna', 'antenna', 'rf', 'bluetooth', 'wifi', 'ethernet', 'video', 'camera',
      'mipi', 'csi', 'dsi',
      '설계', '회로', '기계', '무선', '통신', '안테나', '카메라', '영상',
    ],
  },
  {
    // DDC 700: Arts & Recreation — 예술/취미/여가
    folder: '700_arts_recreation',
    keywords: [
      'kyosho', 'rccar', 'simracing', 'flightsim', 'hotas', 'virpil', 'racing',
      'hobby', 'fitness', 'keyboard', 'mouse', 'office', 'audio',
      '오디오', '키보드', '취미', '여가',
    ],
  },
  {
    // DDC 800: Literature
    folder: '800_literature',
    keywords: [
      'literature', 'novel', 'poetry', 'fiction', 'essay', 'drama',
      '문학', '소설', '시', '수필', '희곡',
    ],
  },
  {
    // DDC 900: History & Geography
    folder: '900_history_geography',
    keywords: [
      'history', 'historical', 'geography', 'biography', 'travel',
      '역사', '지리', '전기', '여행',
    ],
  },
]

function tokenize(name: string): Set<string> {
  const norm = name.toLowerCase().replace(/[^a-z0-9가-힣]+/g, ' ').trim()
  return new Set(norm.split(/\s+/).filter(Boolean))
}

interface ThirdLevelResult {
  destination: string
  matched: boolean
}

function withThirdLevel(secondLevel: string, filename: string): ThirdLevelResult {
  const tokens = tokenize(filename)
  const norm = filename.toLowerCase()
  for (const cat of DEWEY) {
    for (const k of cat.keywords) {
      // Korean keywords: substring match (no word boundary in 한국어)
      if (/[가-힣]/.test(k)) {
        if (norm.includes(k)) return { destination: `${secondLevel}${cat.folder}/`, matched: true }
      } else {
        if (tokens.has(k)) return { destination: `${secondLevel}${cat.folder}/`, matched: true }
      }
    }
  }
  return { destination: secondLevel, matched: false }
}

export function classifyFile(filename: string, isDir: boolean): ClassifyResult {
  // Rule 1: .meta.yaml (URI reference — classification 필드는 외부에서 읽음)
  if (filename.endsWith('.meta.yaml')) {
    return { filename, hint: 'URI 참조 — classification 필드 확인', destination: '' }
  }

  // Rule 2: Folder bundle — LLM judgment required, safe default
  if (isDir) {
    return { filename, hint: '폴더 — LLM 판단 필요', destination: 'raw/3_resources/', needsThirdLevel: true }
  }

  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const base = filename.toLowerCase()

  switch (ext) {
    case 'pdf': {
      // PDF: report vs manual classification requires content hints. If filename
      // does not match either pattern, return empty destination and let the LLM decide.
      if (PDF_REPORT_RE.test(base)) {
        const third = withThirdLevel('raw/3_resources/20_report/', base)
        return { filename, hint: '리포트/논문 PDF', destination: third.destination, needsThirdLevel: !third.matched }
      }
      if (PDF_MANUAL_RE.test(base)) {
        const third = withThirdLevel('raw/3_resources/30_manual/', base)
        return { filename, hint: '매뉴얼/가이드 PDF', destination: third.destination, needsThirdLevel: !third.matched }
      }
      // Unknown PDF — defer to LLM (no 30_manual default fallback).
      return { filename, hint: 'PDF — LLM 판단 필요', destination: '', needsThirdLevel: true }
    }

    case 'md':
    case 'txt': {
      const third = withThirdLevel('raw/3_resources/60_note/', base)
      return { filename, hint: '노트/기사', destination: third.destination, needsThirdLevel: !third.matched }
    }

    case 'stl':
    case 'step':
    case 'obj':
    case '3mf': {
      const third = withThirdLevel('raw/3_resources/40_cad/', base)
      return { filename, hint: 'CAD 파일', destination: third.destination, needsThirdLevel: !third.matched }
    }

    case 'c':
    case 'h':
    case 'cpp':
    case 'ino':
    case 'py': {
      const third = withThirdLevel('raw/3_resources/50_firmware/', base)
      return { filename, hint: '소스코드', destination: third.destination, needsThirdLevel: !third.matched }
    }

    case 'exe':
    case 'dll':
    case 'bin':
    case 'hex': {
      const third = withThirdLevel('raw/3_resources/50_firmware/', base)
      return { filename, hint: '바이너리/펌웨어', destination: third.destination, needsThirdLevel: !third.matched }
    }

    default:
      return { filename, hint: 'CLASSIFY.md 참조 — LLM 판단 필요', destination: '', needsThirdLevel: true }
  }
}

// ─────────────────────────────────────────────────────────────
//  LLM-based fallback classifier — CLASSIFY.md informed.
// ─────────────────────────────────────────────────────────────

import type { HttpClient, WikeyConfig, WikiFS, LLMCallOptions } from './types.js'
import { LLMClient } from './llm-client.js'
import { resolveProvider } from './config.js'
import { extractJsonBlock } from './ingest-pipeline.js'

const CLASSIFY_MD_PATH = 'raw/CLASSIFY.md'
let cachedRules: string | null = null

/** Load raw/CLASSIFY.md once and cache (module-level). Returns empty string if not found. */
export async function loadClassifyRules(wikiFS: WikiFS): Promise<string> {
  if (cachedRules != null) return cachedRules
  try {
    if (await wikiFS.exists(CLASSIFY_MD_PATH)) {
      cachedRules = await wikiFS.read(CLASSIFY_MD_PATH)
      return cachedRules
    }
  } catch { /* fall through */ }
  cachedRules = ''
  return cachedRules
}

/** Clear the CLASSIFY.md cache (for tests / hot-reload). */
export function clearClassifyRulesCache(): void {
  cachedRules = null
}

export interface ClassifyLLMDeps {
  readonly wikiFS: WikiFS
  readonly httpClient: HttpClient
  readonly config: WikeyConfig
}

export async function classifyWithLLM(
  filename: string,
  isDir: boolean,
  hint2nd: string,
  deps: ClassifyLLMDeps,
): Promise<{ destination: string; reason: string }> {
  const rules = await loadClassifyRules(deps.wikiFS)
  const { provider, model } = resolveProvider('ingest', deps.config)
  const llm = new LLMClient(deps.httpClient, deps.config)

  const prompt = `당신은 Wikey PARA/Dewey 분류 어시스턴트입니다. 아래 CLASSIFY.md 규칙을 따라 파일의 목적지 경로를 결정하세요.

== CLASSIFY.md 원문 ==
${rules || '(CLASSIFY.md 없음 — raw/3_resources/ 기본 구조 가정)'}

== 분류 대상 ==
- 파일명: ${filename}
- 종류: ${isDir ? '폴더(번들)' : '파일'}
- 하드코딩 2차 힌트: ${hint2nd || '(없음)'}

== 출력 요구 ==
JSON만 반환하세요. 다른 텍스트 없이. 형식:
\`\`\`json
{
  "destination": "raw/3_resources/NN_type/NNN_topic/",
  "reason": "한 문장(50자 이내) — 왜 이 폴더인지"
}
\`\`\`

규칙:
- destination은 vault 루트 기준 상대경로, 반드시 '/'로 끝냄
- 1차 PARA: 기본 3_resources, 단기 작업은 1_projects, 지속 영역은 2_areas, 완료/폐기는 4_archive
- 2차 유형(NN_): 10_article, 20_report, 30_manual, 40_cad, 50_firmware, 60_note 중 하나 또는 CLASSIFY.md 정의
- 3차 주제(NNN_): Dewey 10대분류(000 general/computer_science, 100 philosophy, 200 religion, 300 social_sciences, 400 language, 500 natural_science, 600 technology, 700 arts_recreation, 800 literature, 900 history_geography) 중 하나
- 기존 폴더가 있으면 재사용 우선. 신규 폴더가 필요하면 NNN_topic 네이밍 규칙 준수
- 애매하면 3_resources/{2차 힌트}/ 까지만 반환 가능`

  const callOpts: LLMCallOptions = { provider: provider as any, model, timeout: 60000 }
  let raw = ''
  try {
    raw = await llm.call(prompt, callOpts)
  } catch (err) {
    console.warn('[Wikey classify] LLM call failed:', (err as Error).message)
    return { destination: hint2nd || 'raw/3_resources/', reason: 'LLM 호출 실패 — 기본 경로 사용' }
  }

  const parsed = extractJsonBlock(raw) as unknown as { destination?: string; reason?: string } | null
  if (!parsed || typeof parsed.destination !== 'string') {
    console.warn('[Wikey classify] LLM JSON invalid:', raw.slice(0, 200))
    return { destination: hint2nd || 'raw/3_resources/', reason: 'LLM 응답 파싱 실패' }
  }

  let dest = parsed.destination.trim()
  if (!dest.endsWith('/')) dest += '/'
  if (!dest.startsWith('raw/')) dest = `raw/${dest.replace(/^\/+/, '')}`

  return { destination: dest, reason: (parsed.reason ?? '').slice(0, 120) }
}

/**
 * Async classify — runs hardcoded rules first, falls back to LLM when
 * destination is empty or 3rd-level folder is missing.
 */
export async function classifyFileAsync(
  filename: string,
  isDir: boolean,
  deps: ClassifyLLMDeps,
): Promise<ClassifyResult> {
  const base = classifyFile(filename, isDir)
  if (!base.needsThirdLevel && base.destination) return base

  const llm = await classifyWithLLM(filename, isDir, base.destination, deps)
  console.info(`[Wikey classify] LLM fallback: "${filename}" → ${llm.destination} (${llm.reason})`)
  return {
    filename,
    hint: `${base.hint} → LLM: ${llm.reason}`,
    destination: llm.destination,
    llmDecided: true,
  }
}

/**
 * inbox 파일을 대상 폴더로 이동 (legacy — Phase 4.2 부터는 movePair 권장).
 */
export function moveFile(basePath: string, sourcePath: string, destDir: string): void {
  const { join, basename } = require('node:path') as typeof import('node:path')
  const { renameSync, mkdirSync, existsSync } = require('node:fs') as typeof import('node:fs')

  const fullDest = join(basePath, destDir)
  if (!existsSync(fullDest)) mkdirSync(fullDest, { recursive: true })

  const name = basename(sourcePath)
  renameSync(join(basePath, sourcePath), join(fullDest, name))
}

// ─────────────────────────────────────────────────────────────
//  Phase 4.2 Stage 2 S2-1 — movePair (pair-aware move).
// ─────────────────────────────────────────────────────────────

import {
  loadRegistry,
  saveRegistry,
  findByPath as registryFindByPath,
  recordMove as registryRecordMove,
} from './source-registry.js'
import { rewriteSourcePageMeta } from './wiki-ops.js'

export interface MovePairResult {
  readonly movedOriginal: boolean
  readonly movedSidecar: boolean
  readonly sidecarSkipReason?: 'not-found' | 'dest-conflict' | 'is-md-original'
  readonly sourceId?: string
  readonly rewrittenSourcePages: readonly string[]
}

export interface MovePairOptions {
  readonly basePath: string
  readonly sourceVaultPath: string
  readonly destDir: string
  readonly wikiFS: WikiFS
}

export async function movePair(opts: MovePairOptions): Promise<MovePairResult> {
  const { join, basename, dirname } = require('node:path') as typeof import('node:path')
  const { renameSync, mkdirSync, existsSync, statSync } = require('node:fs') as typeof import('node:fs')

  const destDir = opts.destDir.endsWith('/') ? opts.destDir : `${opts.destDir}/`
  const sourceFullPath = join(opts.basePath, opts.sourceVaultPath)
  const name = basename(opts.sourceVaultPath)
  const destFullDir = join(opts.basePath, destDir)
  const destFullPath = join(destFullDir, name)

  // Idempotent guard: if already at dest, nothing to do.
  if (sourceFullPath === destFullPath) {
    return { movedOriginal: false, movedSidecar: false, rewrittenSourcePages: [] }
  }

  if (!existsSync(sourceFullPath)) {
    return { movedOriginal: false, movedSidecar: false, rewrittenSourcePages: [] }
  }
  const isDir = statSync(sourceFullPath).isDirectory()
  mkdirSync(destFullDir, { recursive: true })

  // Registry lookup before the move so we know the associated pages.
  const registry = await loadRegistry(opts.wikiFS)
  const lookup = registryFindByPath(registry, opts.sourceVaultPath)

  // Move original
  renameSync(sourceFullPath, destFullPath)
  const newOriginalVaultPath = destDir + name

  let movedSidecar = false
  let sidecarSkipReason: MovePairResult['sidecarSkipReason'] | undefined
  let newSidecarVaultPath: string | undefined

  if (isDir) {
    sidecarSkipReason = undefined // folder bundles have no sidecar
  } else if (isMdOriginal(name)) {
    sidecarSkipReason = 'is-md-original'
  } else {
    const sidecarSource = sourceFullPath + '.md'
    const sidecarDest = destFullPath + '.md'
    if (!existsSync(sidecarSource)) {
      sidecarSkipReason = 'not-found'
    } else if (existsSync(sidecarDest)) {
      sidecarSkipReason = 'dest-conflict'
    } else {
      renameSync(sidecarSource, sidecarDest)
      movedSidecar = true
      newSidecarVaultPath = newOriginalVaultPath + '.md'
    }
  }

  const rewrittenPages: string[] = []
  let updatedRegistry = registry
  let sourceId: string | undefined

  if (lookup) {
    sourceId = lookup.id
    updatedRegistry = registryRecordMove(
      registry,
      lookup.id,
      newOriginalVaultPath,
      newSidecarVaultPath ?? (movedSidecar ? undefined : lookup.record.sidecar_vault_path),
    )

    // Rewrite frontmatter on every ingested source page.
    for (const pagePath of lookup.record.ingested_pages) {
      try {
        const content = await opts.wikiFS.read(pagePath)
        const rewritten = rewriteSourcePageMeta(content, {
          vault_path: newOriginalVaultPath,
          sidecar_vault_path: newSidecarVaultPath ?? null,
        })
        if (rewritten !== content) {
          await opts.wikiFS.write(pagePath, rewritten)
        }
        rewrittenPages.push(pagePath)
      } catch (err) {
        console.warn(`[movePair] rewrite failed for ${pagePath}: ${(err as Error).message}`)
      }
    }
  }

  await saveRegistry(opts.wikiFS, updatedRegistry)

  return {
    movedOriginal: true,
    movedSidecar,
    sidecarSkipReason,
    sourceId,
    rewrittenSourcePages: rewrittenPages,
  }
}

function isMdOriginal(filename: string): boolean {
  const lower = filename.toLowerCase()
  return lower.endsWith('.md') || lower.endsWith('.txt')
}
