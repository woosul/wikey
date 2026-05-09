/**
 * §5.7.5 — onload trigger gate (developerMode + allowUpdateCheck matrix).
 *
 * 사용자 결정 #2 = opt-in. detect 호출은 양쪽 토글이 모두 true 일 때만 (재시작 1회).
 *
 * 추출 motivation: main.ts onload 안의 분기 logic 을 단위 test 가능한 pure helper 로
 * 분리. Plugin runtime mount 가 아니라 boolean × boolean → boolean 평가.
 */

export interface UpstreamUpdateGateInput {
  readonly developerMode: boolean
  readonly allowUpdateCheck: boolean
}

/**
 * Returns true if (and only if) plugin onload should kick off
 * `detectUpstreamUpdates`. AC-U4 matrix:
 *   (a) developerMode && allowUpdateCheck → true
 *   (b/c) otherwise → false (cron 금지, opt-in 보장)
 */
export function shouldDetectUpstreamUpdates(input: UpstreamUpdateGateInput): boolean {
  return input.developerMode === true && input.allowUpdateCheck === true
}
