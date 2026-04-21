#!/usr/bin/env bash
# ablation-ingest.sh — §4.5.1.5 v2 ablation 측정
#
# 가설: "RAG chunk 경계 지터가 CV 32.5% 의 주범" — 이를 정량 증거로 확증/반증.
#
# 4 실험:
#   1. Frozen markdown × N — Docling 변환은 1회만, ingest 만 N 회 반복
#      (전처리 variance 제거 후 CV 가 여전히 32% 면 경계 주범 아님)
#   2. Extraction-only × N — frozen mention call 만 N 회 (canonicalize 제외)
#   3. Canonicalizer-only × N — frozen mention set 을 입력으로 canonicalize 만 N 회
#   4. Seed + temp=0 × N — Gemini generationConfig.seed=42 temperature=0 재현
#
# 사용법:
#   ./scripts/ablation-ingest.sh <source-path> [-n N] [-o output.md]
#
# 전제:
#   - Obsidian --remote-debugging-port=9222 기동
#   - source-path 는 raw/ 하위
#   - /tmp/wikey-cdp.py 헬퍼 존재 (reference_obsidian_cdp_e2e.md)
#
# 출력: activity/ablation-<slug>-<date>.md (4 실험 결과 + variance 성분 파이차트 데이터)
#
# 이 스크립트는 §4.5.1.5 v2 의 ablation gate 입력:
#   - 섹션 경계 기여 > 50% → 30-run PMS main 진행
#   - 20-50% → 30-run + 개선폭 재산정
#   - < 20% → smoke 만 + §4.5.1.6 신규 (LLM 수준 variance)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

usage() {
  cat <<EOF
사용법: ./scripts/ablation-ingest.sh <source-path> [-n N] [-o output.md]

옵션:
  -n N       각 실험 run 수 (기본 10)
  -o PATH    출력 경로 (기본 activity/ablation-<slug>-<date>.md)
  -h, --help
EOF
  exit 0
}

N_RUNS=10
OUTPUT_PATH=""
SOURCE_PATH=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -n) N_RUNS="$2"; shift 2 ;;
    -o) OUTPUT_PATH="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) SOURCE_PATH="$1"; shift ;;
  esac
done

if [[ -z "$SOURCE_PATH" ]]; then
  echo "ERROR: source-path 미지정" >&2
  usage
fi

if [[ ! -f "${PROJECT_DIR}/${SOURCE_PATH}" ]]; then
  echo "ERROR: source 파일 없음: ${PROJECT_DIR}/${SOURCE_PATH}" >&2
  exit 2
fi

# CDP 연결 확인
if ! curl -fsS http://localhost:9222/json -o /dev/null 2>&1; then
  echo "ERROR: Obsidian CDP (port 9222) 연결 실패" >&2
  echo "Obsidian 을 다음 옵션으로 재기동:" >&2
  echo "  /Applications/Obsidian.app/Contents/MacOS/Obsidian --remote-debugging-port=9222 '--remote-allow-origins=*' &" >&2
  exit 1
fi

# 출력 경로
if [[ -z "$OUTPUT_PATH" ]]; then
  src_basename=$(basename "$SOURCE_PATH")
  src_slug=$(echo "${src_basename%.*}" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g')
  date_str=$(date '+%Y-%m-%d')
  OUTPUT_PATH="activity/ablation-${src_slug}-${date_str}.md"
fi
ABS_OUTPUT="${PROJECT_DIR}/${OUTPUT_PATH}"

echo "[ablation] source: ${SOURCE_PATH}"
echo "[ablation] runs per experiment: ${N_RUNS}"
echo "[ablation] output: ${OUTPUT_PATH}"
echo

# 실험 1: Frozen markdown (Docling 1회, ingest N회)
# 이 실험은 기존 measure-determinism.sh 가 이미 수행하는 것과 동일 —
# 캐시가 적용되어 있어 source 변환은 자동으로 캐시 히트. 따라서 measure-determinism.sh 재사용.
echo "[ablation] 실험 1: Frozen markdown (measure-determinism.sh 위임)..."
"${SCRIPT_DIR}/measure-determinism.sh" "$SOURCE_PATH" -n "$N_RUNS" -o "activity/ablation-exp1-${src_slug}-${date_str}.md" || {
  echo "[ablation] 실험 1 실패" >&2
  exit 3
}
echo

# 실험 2-4 는 ingest-pipeline 내부를 직접 호출하는 별도 Node 스크립트 필요.
# 현재 인프라로는 ingest 전체만 재현 가능 (extractMentions / canonicalize 단독 재호출 불가).
# 따라서 이 스크립트는 **현재 실험 1 만 실제 수행**, 실험 2-4 는 플레이스홀더로 기록.
#
# 후속 (§4.5.1.5.7 혹은 별 과제): Node 스크립트 추가해 mention list 를 frozen file 로 dump
# 한 뒤 canonicalize 만 N 회 호출하는 통합 방법 설계.

cat > "$ABS_OUTPUT" <<EOF
# Ablation 측정 — $(basename "$SOURCE_PATH")

> 일시: $(date '+%Y-%m-%d')
> Source: \`${SOURCE_PATH}\`
> Runs per experiment: ${N_RUNS}
> 스크립트: \`scripts/ablation-ingest.sh\`

## 실험 1: Frozen markdown + 전체 ingest × N

Docling 변환본은 cache 히트로 고정. 매 run 마다 \`extractMentions\` → \`canonicalize\` 만 반복.
전처리 variance 가 제거된 상태의 순수 LLM variance 측정.

결과: \`activity/ablation-exp1-${src_slug}-${date_str}.md\` 참조 (measure-determinism.sh 출력).

## 실험 2: Extraction-only (미구현)

**필요 작업**: frozen section 하나를 고정 → \`extractMentions\` 만 N 회 직접 호출 (canonicalize 제외).

구현 보류 이유: ingest-pipeline 내부 함수가 직접 export 되지 않음. 별도 Node helper 스크립트 필요.

## 실험 3: Canonicalizer-only (미구현)

**필요 작업**: frozen mention set 을 입력으로 \`canonicalize\` 만 N 회 호출.

구현 보류 이유: mention set 직렬화/역직렬화 포맷 미정. v2.1 후속 과제.

## 실험 4: Seed + temperature=0 (미구현 — llm-client.ts 옵션 추가 필요)

**필요 작업**: Gemini \`generationConfig.seed=42 temperature=0\` 으로 measure-determinism.sh 재실행.

현재 llm-client.ts 는 temperature 기본값 0.1 (실측), seed 미설정. 옵션 플래그 추가 후 실행.

## Gate 판정 (실험 1 결과 기준)

- Total CV ≤ §4.5.1.4 baseline (32.5%) 의 50% → 섹션 경계 기여 **> 50%** (주범) → 30-run PMS main 진행
- 50% < CV ≤ 80% → **20-50%** 기여 → 30-run + 개선폭 재산정
- CV > 80% → **< 20%** 기여 → smoke 만 + \`§4.5.1.6\` 신규 (LLM 수준 variance 분석)

## 재현

\`\`\`bash
# 실험 1 만 수행 (실험 2-4 는 후속 infra 필요)
./scripts/ablation-ingest.sh ${SOURCE_PATH} -n ${N_RUNS}
\`\`\`
EOF

echo "[ablation] 실험 1 완료"
echo "[ablation] 전체 리포트: ${OUTPUT_PATH}"
echo "[ablation] 실험 2-4 는 infra 추가 후 별도 실행"
