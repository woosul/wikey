/**
 * capability-map.ts — Phase 4 D.0.d (v6 §4.2).
 *
 * 런타임 문서 변환 능력을 구조화. `audit-ingest.py` 와 UI 가 동일 소스로 사용하기 위해
 * `~/.cache/wikey/capabilities.json` 으로 덤프한다.
 *
 * 설계 원칙:
 *   - **pure function** — IO 는 `dumpCapabilityMap` 한 곳에 격리. buildCapabilityMap 은
 *     입력 (hasDocling, hasUnhwp) 만 보고 순수 계산.
 *   - TS 테스트 가능. Python audit-ingest.py 는 파일 read 로 동일 정보 소비 (static
 *     table 지양).
 *   - 확장자는 항상 소문자 + 선두 `.` 포함 (POSIX ext 관례).
 *
 * Stage:
 *   - md / txt: 항상 supported
 *   - docling 설치: pdf / docx / pptx / xlsx / csv / html / htm / png / jpg / jpeg / tiff / tif
 *   - unhwp 설치: hwp / hwpx
 *   - 기타 레거시 (.doc / .ppt / .xls OLE): 항상 unsupported (현 변환 chain 미지원)
 */

export interface SupportedExtensionMap {
  /** Supported 확장자 목록 (sorted, lowercased, dot-prefixed). */
  readonly supported: readonly string[]
  /** Unsupported 확장자 목록 (same shape). */
  readonly unsupported: readonly string[]
  readonly doclingInstalled: boolean
  readonly unhwpInstalled: boolean
  /** ISO 8601 timestamp — stale 판정용 (지금은 정보 제공만). */
  readonly generatedAt: string
}

export interface BuildCapabilityInput {
  readonly hasDocling: boolean
  readonly hasUnhwp: boolean
  /** Optional clock for deterministic testing. */
  readonly now?: Date
}

const ALWAYS_SUPPORTED = ['.md', '.txt']
const DOCLING_FORMATS = [
  '.pdf',
  '.docx', '.pptx', '.xlsx',
  '.csv',
  '.html', '.htm',
  '.png', '.jpg', '.jpeg', '.tiff', '.tif',
]
const UNHWP_FORMATS = ['.hwp', '.hwpx']
const ALWAYS_UNSUPPORTED = ['.doc', '.ppt', '.xls']

/**
 * 순수 계산. 런타임 IO 없음.
 */
export function buildCapabilityMap(input: BuildCapabilityInput): SupportedExtensionMap {
  const supported = new Set<string>(ALWAYS_SUPPORTED)
  const unsupported = new Set<string>(ALWAYS_UNSUPPORTED)

  if (input.hasDocling) {
    for (const ext of DOCLING_FORMATS) supported.add(ext)
  } else {
    for (const ext of DOCLING_FORMATS) unsupported.add(ext)
  }
  if (input.hasUnhwp) {
    for (const ext of UNHWP_FORMATS) supported.add(ext)
  } else {
    for (const ext of UNHWP_FORMATS) unsupported.add(ext)
  }

  const now = input.now ?? new Date()
  return {
    supported: [...supported].sort(),
    unsupported: [...unsupported].sort(),
    doclingInstalled: input.hasDocling,
    unhwpInstalled: input.hasUnhwp,
    generatedAt: now.toISOString(),
  }
}

/**
 * 캐시 파일 경로 ([XDG_]CACHE/wikey/capabilities.json).
 * Python audit-ingest.py 가 동일 경로 읽음.
 */
export function defaultCapabilityCachePath(): string {
  const os = require('node:os') as typeof import('node:os')
  const path = require('node:path') as typeof import('node:path')
  return path.join(os.homedir(), '.cache', 'wikey', 'capabilities.json')
}

/**
 * capabilityMap 을 JSON 파일로 덤프. Dir 없으면 생성.
 * IO 실패는 throw — 호출자가 try/catch 로 감쌀 것.
 */
export async function dumpCapabilityMap(
  map: SupportedExtensionMap,
  cachePath: string,
): Promise<void> {
  const { mkdir, writeFile } = await import('node:fs/promises')
  const path = require('node:path') as typeof import('node:path')
  const dir = path.dirname(cachePath)
  await mkdir(dir, { recursive: true })
  const payload = JSON.stringify({
    supported: map.supported,
    unsupported: map.unsupported,
    doclingInstalled: map.doclingInstalled,
    unhwpInstalled: map.unhwpInstalled,
    generatedAt: map.generatedAt,
  }, null, 2)
  await writeFile(cachePath, payload, 'utf-8')
}
