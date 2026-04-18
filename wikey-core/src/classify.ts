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
  readonly destination: string
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
]

function tokenize(name: string): Set<string> {
  const norm = name.toLowerCase().replace(/[^a-z0-9가-힣]+/g, ' ').trim()
  return new Set(norm.split(/\s+/).filter(Boolean))
}

function withThirdLevel(secondLevel: string, filename: string): string {
  const tokens = tokenize(filename)
  const norm = filename.toLowerCase()
  for (const cat of DEWEY) {
    for (const k of cat.keywords) {
      // Korean keywords: substring match (no word boundary in 한국어)
      if (/[가-힣]/.test(k)) {
        if (norm.includes(k)) return `${secondLevel}${cat.folder}/`
      } else {
        if (tokens.has(k)) return `${secondLevel}${cat.folder}/`
      }
    }
  }
  return secondLevel
}

export function classifyFile(filename: string, isDir: boolean): ClassifyResult {
  // Rule 1: .meta.yaml (URI reference — classification 필드는 외부에서 읽음)
  if (filename.endsWith('.meta.yaml')) {
    return { filename, hint: 'URI 참조 — classification 필드 확인', destination: '' }
  }

  // Rule 2: Folder bundle — LLM judgment required, safe default
  if (isDir) {
    return { filename, hint: '폴더 — LLM 판단 필요', destination: 'raw/3_resources/' }
  }

  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const base = filename.toLowerCase()

  switch (ext) {
    case 'pdf': {
      let second: string
      let hint: string
      if (PDF_REPORT_RE.test(base)) {
        second = 'raw/3_resources/20_report/'
        hint = '리포트/논문 PDF'
      } else if (PDF_MANUAL_RE.test(base)) {
        second = 'raw/3_resources/30_manual/'
        hint = '매뉴얼/가이드 PDF'
      } else {
        second = 'raw/3_resources/30_manual/'
        hint = 'PDF 문서'
      }
      return { filename, hint, destination: withThirdLevel(second, base) }
    }

    case 'md':
    case 'txt':
      return { filename, hint: '노트/기사', destination: withThirdLevel('raw/3_resources/60_note/', base) }

    case 'stl':
    case 'step':
    case 'obj':
    case '3mf':
      return { filename, hint: 'CAD 파일', destination: withThirdLevel('raw/3_resources/40_cad/', base) }

    case 'c':
    case 'h':
    case 'cpp':
    case 'ino':
    case 'py':
      return { filename, hint: '소스코드', destination: withThirdLevel('raw/3_resources/50_firmware/', base) }

    case 'exe':
    case 'dll':
    case 'bin':
    case 'hex':
      return { filename, hint: '바이너리/펌웨어', destination: withThirdLevel('raw/3_resources/50_firmware/', base) }

    default:
      return { filename, hint: 'CLASSIFY.md 참조', destination: 'raw/3_resources/' }
  }
}

/**
 * inbox 파일을 대상 폴더로 이동
 */
export function moveFile(basePath: string, sourcePath: string, destDir: string): void {
  const { join, basename } = require('node:path') as typeof import('node:path')
  const { renameSync, mkdirSync, existsSync } = require('node:fs') as typeof import('node:fs')

  const fullDest = join(basePath, destDir)
  if (!existsSync(fullDest)) mkdirSync(fullDest, { recursive: true })

  const name = basename(sourcePath)
  renameSync(join(basePath, sourcePath), join(fullDest, name))
}
