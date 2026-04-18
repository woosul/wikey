/**
 * setup-para.ts — PARA 폴더 구조를 vault에 idempotent하게 생성.
 *
 * 플러그인 onload 시 자동 실행 → 신규 사용자 vault에 기본 구조 배포.
 * 기존 폴더는 skip (mkdir -p 동등). 사용자가 만든 파일·서브폴더는 건드리지 않음.
 *
 * 구조는 `scripts/setup-para-folders.sh`와 동일:
 * - 1차 PARA 6개
 * - Areas / Resources / Archive 공통 2차 × 3차 Dewey Decimal (Projects는 프로젝트별 고유라 제외)
 *
 * 참고: https://fortelabs.com/blog/para/ (Tiago Forte)
 */
import type { App } from 'obsidian'

const TOP = ['0_inbox', '1_projects', '2_areas', '3_resources', '4_archive', '9_assets'] as const

const SECOND = ['10_article', '20_report', '30_manual', '40_cad', '50_firmware', '60_note'] as const

// Dewey Decimal 간소화 10대 자연계 분류
const THIRD = [
  '000_general',
  '100_humanities',
  '200_social',
  '300_science',
  '400_engineering',
  '500_technology',
  '600_communication',
  '700_arts',
  '800_literature',
  '900_lifestyle',
] as const

// PARA 방법론상 주제 기반 분류를 공유하는 3계층 (Projects는 제외)
const SHARED_TAXONOMY_PARENTS = ['2_areas', '3_resources', '4_archive'] as const

export interface SetupParaResult {
  readonly created: number
  readonly existed: number
}

export async function ensureParaFolders(app: App): Promise<SetupParaResult> {
  const adapter = app.vault.adapter
  let created = 0
  let existed = 0

  const ensure = async (path: string) => {
    if (await adapter.exists(path)) {
      existed++
    } else {
      try {
        await adapter.mkdir(path)
        created++
      } catch {
        // 이미 존재하거나 권한 문제 — 계속 진행
      }
    }
  }

  for (const p of TOP) {
    await ensure(`raw/${p}`)
  }
  for (const parent of SHARED_TAXONOMY_PARENTS) {
    for (const s of SECOND) {
      await ensure(`raw/${parent}/${s}`)
      for (const t of THIRD) {
        await ensure(`raw/${parent}/${s}/${t}`)
      }
    }
  }

  return { created, existed }
}
