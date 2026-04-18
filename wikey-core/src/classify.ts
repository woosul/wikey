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
    case 'pdf':
      if (PDF_REPORT_RE.test(base)) {
        return { filename, hint: '리포트/논문 PDF', destination: 'raw/3_resources/20_report/' }
      }
      if (PDF_MANUAL_RE.test(base)) {
        return { filename, hint: '매뉴얼/가이드 PDF', destination: 'raw/3_resources/30_manual/' }
      }
      // Default PDF → manual (most common case for this vault)
      return { filename, hint: 'PDF 문서', destination: 'raw/3_resources/30_manual/' }

    case 'md':
    case 'txt':
      return { filename, hint: '노트/기사', destination: 'raw/3_resources/60_note/' }

    case 'stl':
    case 'step':
    case 'obj':
    case '3mf':
      return { filename, hint: 'CAD 파일', destination: 'raw/3_resources/40_cad/' }

    case 'c':
    case 'h':
    case 'cpp':
    case 'ino':
    case 'py':
      return { filename, hint: '소스코드', destination: 'raw/3_resources/50_firmware/' }

    case 'exe':
    case 'dll':
    case 'bin':
    case 'hex':
      return { filename, hint: '바이너리/펌웨어', destination: 'raw/3_resources/50_firmware/' }

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
