/**
 * classify.ts — inbox 파일 분류 힌트 (classify-hint.sh 포팅)
 */

export interface ClassifyResult {
  readonly filename: string
  readonly hint: string
  readonly destination: string
}

export function classifyFile(filename: string, isDir: boolean): ClassifyResult {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''

  // Rule 1: .meta.yaml
  if (filename.endsWith('.meta.yaml')) {
    return { filename, hint: 'URI 참조 — classification 필드 확인', destination: '' }
  }

  // Rule 3: Folder
  if (isDir) {
    return { filename, hint: '폴더 — LLM 판단 필요', destination: 'raw/resources/' }
  }

  // Rule 4-7: Extension-based
  switch (ext) {
    case 'pdf':
      return { filename, hint: 'PDF 문서', destination: 'raw/resources/' }
    case 'md':
      return { filename, hint: '마크다운 노트', destination: 'raw/resources/' }
    case 'stl': case 'step': case 'obj': case '3mf':
      return { filename, hint: 'CAD 파일', destination: 'raw/resources/' }
    case 'c': case 'h': case 'cpp': case 'ino': case 'py':
      return { filename, hint: '소스코드', destination: 'raw/resources/' }
    case 'exe': case 'dll': case 'bin': case 'hex':
      return { filename, hint: '바이너리/펌웨어', destination: 'raw/resources/' }
    default:
      return { filename, hint: 'CLASSIFY.md 참조', destination: 'raw/resources/' }
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
