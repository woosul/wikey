/**
 * check-pii.ts — Phase 5 §5.7.1 (2026-05-08).
 *
 * `scripts/check-pii.sh` 의 TypeScript 포팅. wiki/*.md walk 후 leak 패턴 (전화/이메일/주민)
 * 매칭. plugin runtime 이 bash spawn 없이 in-process 호출 가능.
 *
 * 동등성: 기존 .sh 와 동일한 stdout 형식 + exit code (0=클린, 1=발견).
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import {
  loadPiiPatternsFromYaml,
  type PiiPattern,
  type SingleLinePiiPattern,
} from '../pii-patterns.js'

export interface CheckPiiOptions {
  readonly basePath: string
  /** wiki 디렉터리 이름. default 'wiki' (relative to basePath). */
  readonly wikiDir?: string
  /** 출력 sink. default = console.log. */
  readonly write?: (line: string) => void
  /** 설정 디렉터리 override (테스트용). default = `${basePath}/.wikey` + `~/.config/wikey`. */
  readonly configPaths?: readonly string[]
}

export interface CheckPiiResult {
  readonly exitCode: number
  readonly foundCount: number
}

function bundledDefaultYamlPath(): URL {
  return new URL('../defaults/check-pii.default.yaml', import.meta.url)
}

/**
 * bundled YAML 로드 실패 시 fallback. plugin esbuild bundle 은 `import.meta.url` 을
 * cjs 포맷으로 처리할 때 empty 가 되어 bundled YAML 로드 실패 — 이때 hardcoded fallback
 * 으로 회귀 방지. pii-patterns.ts 의 `DEFAULT_PATTERNS` 와 동일 정책.
 */
const FALLBACK_DEFAULT_PATTERNS: readonly SingleLinePiiPattern[] = [
  {
    id: 'phone-kr',
    patternType: 'single-line',
    kind: 'phone-kr',
    regex: '010-\\d{4}-\\d{4}',
    mask: 'digits',
    description: '한국 휴대폰 번호 (010-1234-5678)',
  },
  {
    id: 'email',
    patternType: 'single-line',
    kind: 'email',
    regex: '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}',
    mask: 'full',
    description: '이메일 주소',
  },
  {
    id: 'jumin',
    patternType: 'single-line',
    kind: 'jumin',
    regex: '\\d{6}-[1-4]\\d{6}',
    mask: 'digits',
    description: '주민등록번호 6-7 (뒷자리 1-4 시작)',
  },
]

function loadDefault(): readonly SingleLinePiiPattern[] {
  try {
    const txt = fs.readFileSync(bundledDefaultYamlPath(), 'utf-8')
    const loaded = loadPiiPatternsFromYaml(txt)
    if (loaded) return filterSingleLine(loaded)
  } catch {
    // bundled YAML 누락 — fallback 으로
  }
  return FALLBACK_DEFAULT_PATTERNS
}

function filterSingleLine(patterns: readonly PiiPattern[]): readonly SingleLinePiiPattern[] {
  return patterns.filter(
    (p): p is SingleLinePiiPattern => p.patternType === 'single-line' || p.patternType === undefined,
  )
}

function loadOverride(yamlPath: string): readonly SingleLinePiiPattern[] | null {
  try {
    if (!fs.existsSync(yamlPath)) return null
    const txt = fs.readFileSync(yamlPath, 'utf-8')
    const loaded = loadPiiPatternsFromYaml(txt)
    if (!loaded) return null
    return filterSingleLine(loaded)
  } catch {
    return null
  }
}

function mergePatterns(
  base: readonly SingleLinePiiPattern[],
  override: readonly SingleLinePiiPattern[],
): readonly SingleLinePiiPattern[] {
  const map = new Map<string, SingleLinePiiPattern>()
  for (const p of base) map.set(p.id, p)
  for (const p of override) map.set(p.id, p)
  return Array.from(map.values())
}

function loadCheckPiiPatterns(opts: CheckPiiOptions): readonly SingleLinePiiPattern[] {
  let merged = loadDefault()
  // schema 명시 path (`pii-patterns.yaml`) 와 leak-check 전용 path 양쪽 인식. ingest gate
  // 와 leak check 가 같은 사용자 yaml 의 single-line 패턴 share 가능 — schema 호환 + 분리
  // 정신 둘 다 보존. 동일 id 는 뒤가 우선 (schema → check-pii 별 file).
  const candidates: string[] = opts.configPaths
    ? Array.from(opts.configPaths)
    : [
        path.join(os.homedir(), '.config', 'wikey', 'pii-patterns.yaml'),
        path.join(os.homedir(), '.config', 'wikey', 'check-pii-patterns.yaml'),
        path.join(opts.basePath, '.wikey', 'pii-patterns.yaml'),
        path.join(opts.basePath, '.wikey', 'check-pii-patterns.yaml'),
      ]
  for (const yamlPath of candidates) {
    const override = loadOverride(yamlPath)
    if (override) merged = mergePatterns(merged, override)
  }
  return merged
}

function* walkMarkdown(dir: string): Generator<string> {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  // 알파벳 정렬 — 출력 결정성 (기존 find 순서와 동등하지 않을 수 있으나, line-by-line diff 가능)
  entries.sort((a, b) => a.name.localeCompare(b.name))
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walkMarkdown(full)
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      yield full
    }
  }
}

interface PatternHit {
  readonly lineNumber: number
  readonly lineText: string
}

function scanFile(content: string, regex: RegExp): readonly PatternHit[] {
  const hits: PatternHit[] = []
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    if (regex.test(lines[i])) {
      hits.push({ lineNumber: i + 1, lineText: lines[i] })
    }
    // reset lastIndex for global flag (we don't use g flag here, but defensive)
  }
  return hits
}

function compileRegex(p: SingleLinePiiPattern): RegExp | null {
  try {
    return new RegExp(p.regex)
  } catch {
    return null
  }
}

const PATTERN_LABELS: Record<string, string> = {
  'phone-kr': '전화번호',
  email: '이메일',
  jumin: '주민번호',
}

function labelFor(p: SingleLinePiiPattern): string {
  return PATTERN_LABELS[p.id] ?? p.description ?? p.id
}

export async function runCheckPii(opts: CheckPiiOptions): Promise<CheckPiiResult> {
  const write = opts.write ?? ((line: string) => console.log(line))
  const wikiRel = opts.wikiDir ?? 'wiki'
  const wikiAbs = path.isAbsolute(wikiRel) ? wikiRel : path.join(opts.basePath, wikiRel)
  const patterns = loadCheckPiiPatterns(opts)
  const compiled = patterns
    .map((p) => ({ p, re: compileRegex(p) }))
    .filter((x): x is { p: SingleLinePiiPattern; re: RegExp } => x.re !== null)

  write('=== PII 스캔: wiki/ ===')

  let foundCount = 0
  for (const file of walkMarkdown(wikiAbs)) {
    let content: string
    try {
      content = fs.readFileSync(file, 'utf-8')
    } catch {
      continue
    }
    // 출력 경로 — basePath 기준 상대 경로 (기존 .sh 와 동등)
    const displayPath = path.relative(opts.basePath, file) || file
    for (const { p, re } of compiled) {
      const hits = scanFile(content, re)
      if (hits.length === 0) continue
      for (const hit of hits) {
        write(`${hit.lineNumber}:${hit.lineText}`)
      }
      write(`PII: ${displayPath}: ${labelFor(p)} 패턴 발견`)
      foundCount += 1
    }
  }

  write('')
  if (foundCount === 0) {
    write('PASS: PII 패턴 없음')
    return { exitCode: 0, foundCount }
  }
  write(`WARN: ${foundCount}건 PII 패턴 발견 — 커밋 전 확인 필요`)
  return { exitCode: 1, foundCount }
}

export async function main(_argv: readonly string[]): Promise<number> {
  const result = await runCheckPii({ basePath: process.cwd() })
  return result.exitCode
}

// plugin esbuild cjs bundle 에서 `import.meta.url` 이 empty 이면 fileURLToPath 가 throw
// (ERR_INVALID_ARG_TYPE). plugin runtime 안 module load 시 깨짐 방지 — try/catch + undefined guard.
function isEntryPoint(): boolean {
  try {
    if (typeof process === 'undefined' || !process.argv[1]) return false
    const metaUrl = (import.meta as { url?: unknown })?.url
    if (typeof metaUrl !== 'string' || metaUrl.length === 0) return false
    return process.argv[1] === fileURLToPath(metaUrl)
  } catch {
    return false
  }
}

if (isEntryPoint()) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(err)
      process.exit(2)
    })
}
