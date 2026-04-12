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
  hasKiwipiepy: boolean
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
  hasKiwipiepy: false,
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

/**
 * 전체 환경 탐지 실행. 플러그인 onload에서 1회 호출.
 */
export async function detectEnvironment(basePath: string, ollamaUrl: string): Promise<EnvStatus> {
  const status: EnvStatus = { ...DEFAULT_STATUS, ollamaUrl }
  const issues: string[] = []

  // 1. 로그인 셸 PATH
  status.shellPath = await detectShellPath()
  const env = makeEnv(status.shellPath)

  // 2. node
  status.nodePath = await which('node', env)
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
  status.hasGemma4 = ollama.models.some((n) => n.includes('gemma4') || n.includes('wikey'))
  if (!ollama.running) {
    issues.push('Ollama가 실행 중이 아닙니다. ollama serve를 실행하세요.')
  } else if (!status.hasGemma4) {
    issues.push('Gemma 4 모델이 없습니다. ollama pull gemma4를 실행하세요.')
  }

  // 6. kiwipiepy
  status.hasKiwipiepy = await checkKiwipiepy(status.pythonPath, env)

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
