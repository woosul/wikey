import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { accessSync } from 'node:fs'
import { join } from 'node:path'

const execFileAsync = promisify(execFile)

export interface EnvStatus {
  shellPath: string
  nodePath: string
  pythonPath: string
  qmdPath: string
  ollamaUrl: string
  ollamaRunning: boolean
  ollamaModels: string[]
  hasGemma4: boolean
  hasQwen3: boolean
  hasQwen36: boolean
  hasKiwipiepy: boolean
  hasMarkitdown: boolean
  hasMarkitdownOcr: boolean
  hasDocling: boolean
  doclingVersion: string
  hasUnhwp: boolean
  ready: boolean
  issues: string[]
}

const DEFAULT_STATUS: EnvStatus = {
  shellPath: '',
  nodePath: '',
  pythonPath: '',
  qmdPath: '',
  ollamaUrl: 'http://localhost:11434',
  ollamaRunning: false,
  ollamaModels: [],
  hasGemma4: false,
  hasQwen3: false,
  hasQwen36: false,
  hasKiwipiepy: false,
  hasMarkitdown: false,
  hasMarkitdownOcr: false,
  hasDocling: false,
  doclingVersion: '',
  hasUnhwp: false,
  ready: false,
  issues: [],
}

/**
 * 로그인 셸에서 사용자의 실제 PATH를 가져온다.
 * Obsidian Electron은 최소 PATH만 갖고 있어서, nvm/homebrew 등이 빠져있다.
 */
async function detectShellPath(): Promise<string> {
  const shell = process.env.SHELL || '/bin/zsh'
  try {
    const { stdout } = await execFileAsync(shell, ['-l', '-c', 'echo $PATH'], { timeout: 5000 })
    return stdout.trim()
  } catch {
    return process.env.PATH ?? '/usr/bin:/bin'
  }
}

function makeEnv(shellPath: string): Record<string, string> {
  return { ...process.env, PATH: shellPath } as Record<string, string>
}

async function which(cmd: string, env: Record<string, string>): Promise<string> {
  try {
    const { stdout } = await execFileAsync('which', [cmd], { env, timeout: 3000 })
    return stdout.trim()
  } catch {
    return ''
  }
}

/**
 * qmd의 better-sqlite3가 컴파일된 node 버전과 일치하는 node를 찾는다.
 * qmd 네이티브 모듈 ABI mismatch 방지.
 */
async function findCompatibleNode(
  basePath: string,
  env: Record<string, string>,
): Promise<string> {
  const { join } = require('node:path') as typeof import('node:path')

  // 후보 node 경로들 수집
  const candidates: string[] = []

  // 1. nvm current (가장 가능성 높음 — nvm으로 npm install 했을 것)
  try {
    const { stdout } = await execFileAsync(
      process.env.SHELL || '/bin/zsh',
      ['-l', '-c', 'which node'],
      { timeout: 5000 },
    )
    const nvmNode = stdout.trim()
    if (nvmNode) candidates.push(nvmNode)
  } catch { /* pass */ }

  // 2. nvm default
  const nvmDir = process.env.NVM_DIR || join(process.env.HOME ?? '', '.nvm')
  try {
    const { readdirSync } = require('node:fs') as typeof import('node:fs')
    const versionsDir = join(nvmDir, 'versions/node')
    const versions = readdirSync(versionsDir).sort().reverse()
    for (const v of versions) {
      candidates.push(join(versionsDir, v, 'bin/node'))
    }
  } catch { /* pass */ }

  // 3. homebrew node
  const brewNode = await which('node', env)
  if (brewNode && !candidates.includes(brewNode)) {
    candidates.push(brewNode)
  }

  // 4. §5.2.9 — 명시 fallback 경로 (login shell PATH order 가 nvm 을 우선 picking
  // 하면 homebrew/system node 가 후보에서 누락되는 문제 방지). better-sqlite3 ABI
  // 가 어느 node 와 맞는지는 .node 파일이 결정 — 모든 후보를 시도해야 호환 node 발견.
  const explicitFallbacks = [
    '/opt/homebrew/bin/node',
    '/usr/local/bin/node',
    '/usr/bin/node',
  ]
  for (const p of explicitFallbacks) {
    if (!candidates.includes(p)) candidates.push(p)
  }

  // qmd better-sqlite3 경로
  const nativeModule = join(basePath, 'tools/qmd/node_modules/better-sqlite3/build/Release/better_sqlite3.node')
  const { existsSync } = require('node:fs') as typeof import('node:fs')
  if (!existsSync(nativeModule)) {
    // 네이티브 모듈 없으면 아무 node나 사용
    return candidates[0] || 'node'
  }

  // 각 후보로 better-sqlite3 로드 시도
  for (const nodePath of candidates) {
    try {
      const { existsSync: exists } = require('node:fs') as typeof import('node:fs')
      if (!exists(nodePath)) continue

      await execFileAsync(nodePath, [
        '-e', `require('${nativeModule.replace(/'/g, "\\'")}')`,
      ], { timeout: 5000 })
      console.log(`[Wikey] qmd 호환 node 발견: ${nodePath}`)
      return nodePath
    } catch (err: any) {
      const msg = err?.message ?? ''
      if (msg.includes('MODULE_VERSION')) {
        console.log(`[Wikey] node ABI 불일치: ${nodePath} — 건너뜀`)
        continue
      }
      // MODULE_VERSION 외 다른 에러면 사용 가능할 수 있음
      return nodePath
    }
  }

  return candidates[0] || 'node'
}

async function checkOllama(url: string): Promise<{ running: boolean; models: string[] }> {
  const http = require('node:http') as typeof import('node:http')
  return new Promise((resolve) => {
    const req = http.get(`${url}/api/tags`, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString())
          const models = (data.models ?? []).map((m: any) => m.name as string)
          resolve({ running: true, models })
        } catch {
          resolve({ running: false, models: [] })
        }
      })
    })
    req.on('error', () => resolve({ running: false, models: [] }))
    req.setTimeout(3000, () => { req.destroy(); resolve({ running: false, models: [] }) })
  })
}

async function checkKiwipiepy(pythonPath: string, env: Record<string, string>): Promise<boolean> {
  if (!pythonPath) return false
  try {
    await execFileAsync(pythonPath, ['-c', 'import kiwipiepy'], { env, timeout: 5000 })
    return true
  } catch {
    return false
  }
}

async function checkMarkitdown(pythonPath: string, env: Record<string, string>): Promise<boolean> {
  if (!pythonPath) return false
  try {
    await execFileAsync(pythonPath, ['-c', 'from markitdown import MarkItDown'], { env, timeout: 5000 })
    return true
  } catch {
    return false
  }
}

async function checkMarkitdownOcr(pythonPath: string, env: Record<string, string>): Promise<boolean> {
  if (!pythonPath) return false
  try {
    // markitdown-ocr 패키지 + openai SDK 둘 다 있어야 OCR fallback 가능.
    await execFileAsync(pythonPath, ['-c', 'import markitdown_ocr, openai'], { env, timeout: 5000 })
    return true
  } catch {
    return false
  }
}

async function checkDocling(env: Record<string, string>): Promise<{ ok: boolean; version: string }> {
  try {
    const { stdout } = await execFileAsync('docling', ['--version'], { env, timeout: 5000 })
    // docling --version 출력 예: "Docling version: 2.90.0" 또는 "docling, version 2.90.0"
    const m = stdout.match(/(\d+\.\d+\.\d+)/)
    return { ok: true, version: m ? m[1] : stdout.trim().split('\n')[0].slice(0, 40) }
  } catch {
    return { ok: false, version: '' }
  }
}

async function checkUnhwp(pythonPath: string, env: Record<string, string>): Promise<boolean> {
  if (!pythonPath) return false
  try {
    await execFileAsync(pythonPath, ['-c', 'import unhwp'], { env, timeout: 5000 })
    return true
  } catch {
    return false
  }
}

/**
 * 전체 환경 탐지 실행. 플러그인 onload에서 1회 호출.
 */
export async function detectEnvironment(basePath: string, ollamaUrl: string): Promise<EnvStatus> {
  const status: EnvStatus = { ...DEFAULT_STATUS, ollamaUrl }
  const issues: string[] = []

  // 1. 로그인 셸 PATH
  status.shellPath = await detectShellPath()
  const env = makeEnv(status.shellPath)

  // 2. node (qmd 네이티브 모듈 호환 버전 우선 탐지)
  status.nodePath = await findCompatibleNode(basePath, env)
  if (!status.nodePath) {
    issues.push('node를 찾을 수 없습니다. Node.js를 설치하세요.')
  }

  // 3. python3
  status.pythonPath = await which('python3', env)
  if (!status.pythonPath) {
    issues.push('python3를 찾을 수 없습니다 (한국어 검색 제한됨).')
  }

  // 4. qmd
  const vendoredQmd = join(basePath, 'tools/qmd/bin/qmd')
  try {
    accessSync(vendoredQmd)
    status.qmdPath = vendoredQmd
  } catch {
    const systemQmd = await which('qmd', env)
    if (systemQmd) {
      status.qmdPath = systemQmd
    } else {
      issues.push('qmd를 찾을 수 없습니다. tools/qmd/를 확인하세요.')
    }
  }

  // 5. Ollama
  const ollama = await checkOllama(ollamaUrl)
  status.ollamaRunning = ollama.running
  status.ollamaModels = ollama.models
  status.hasGemma4 = ollama.models.some((n) => n.includes('gemma4'))
  status.hasQwen3 = ollama.models.some((n) => /^qwen3:[0-9]/.test(n))
  status.hasQwen36 = ollama.models.some((n) => n.includes('qwen3.6'))
  if (!ollama.running) {
    issues.push('Ollama is not running. Run: ollama serve')
  }
  // LLM models are all optional — not flagged as issues.
  // Selection dropdowns only show installed models (via Ollama /api/tags).

  // 6. kiwipiepy
  status.hasKiwipiepy = await checkKiwipiepy(status.pythonPath, env)

  // 7. markitdown
  status.hasMarkitdown = await checkMarkitdown(status.pythonPath, env)

  // 8. markitdown-ocr (스캔 PDF용 OCR fallback, 옵셔널)
  status.hasMarkitdownOcr = await checkMarkitdownOcr(status.pythonPath, env)

  // 9. docling (tier 1 메인 컨버터)
  const docling = await checkDocling(env)
  status.hasDocling = docling.ok
  status.doclingVersion = docling.version

  // 10. unhwp (HWP/HWPX 전용, 옵셔널 — .hwp 소스를 다루는 경우만 필요)
  status.hasUnhwp = await checkUnhwp(status.pythonPath, env)

  status.issues = issues
  status.ready = issues.length === 0
  return status
}

/**
 * 탐지된 shellPath를 exec에서 사용할 env 객체로 변환.
 */
export function buildExecEnv(shellPath: string): Record<string, string> {
  return makeEnv(shellPath)
}
