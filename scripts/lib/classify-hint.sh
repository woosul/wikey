#!/usr/bin/env bash
# classify-hint.sh — CLASSIFY.md 자동 규칙 기반 분류 힌트 (공유 라이브러리)
#
# 사용법: source "$(dirname "$0")/lib/classify-hint.sh"
#         hint=$(classify_hint "/path/to/file")

classify_hint() {
  local path="$1"
  local name
  name=$(basename "$path")
  local ext="${name##*.}"

  # Rule 1: .meta.yaml
  if [[ "$name" == *.meta.yaml ]]; then
    echo "URI 참조 — classification 필드 확인"
    return
  fi

  # Rule 2: Obsidian Web Clipper
  if [[ "$ext" == "md" ]] && head -10 "$path" 2>/dev/null | grep -qi "clipped\|source.*http\|web.clipper"; then
    echo "3_resources/10_article/ (웹 클리핑)"
    return
  fi

  # Rule 3: Product folder (contains PDF + other files)
  if [ -d "$path" ]; then
    if find "$path" -maxdepth 2 -name "*.pdf" 2>/dev/null | head -1 | grep -q .; then
      echo "3_resources/30_manual/{topic}/{product}/ (제품 매뉴얼 번들)"
    else
      echo "3_resources/{topic}/ (폴더 — LLM 판단 필요)"
    fi
    return
  fi

  # Rule 4-7: Extension-based
  case "$ext" in
    pdf)   echo "3_resources/30_manual/ (PDF 문서)" ;;
    md)    echo "3_resources/60_note/ (마크다운 노트)" ;;
    stl|step|obj|3mf) echo "3_resources/40_cad/ (CAD 파일)" ;;
    c|h|cpp|ino|py)   echo "3_resources/50_firmware/ (소스코드)" ;;
    exe|dll|bin|hex)   echo "3_resources/50_firmware/ (바이너리/펌웨어)" ;;
    *)     echo "3_resources/ (CLASSIFY.md 참조)" ;;
  esac
}
