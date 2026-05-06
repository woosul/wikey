#!/bin/bash
# validate-wiki.test.sh — fixture-based acceptance test for validate-wiki.sh
# Phase 5 §5.13.B2: link 자체 매칭 + extension fallback 양방 시도

set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SCRIPT="$ROOT/scripts/validate-wiki.sh"

passes=0
fails=0
total=0

declare -a results

run_case() {
  local id="$1"; local desc="$2"; local expected="$3"; local fixture_fn="$4"
  total=$((total + 1))
  local tmp; tmp=$(mktemp -d)
  cd "$tmp"
  "$fixture_fn"
  set +e
  output=$("$SCRIPT" 2>&1)
  local exit_code=$?
  set -e
  cd "$ROOT"
  rm -rf "$tmp"
  if [ "$exit_code" = "$expected" ]; then
    passes=$((passes + 1))
    results+=("PASS [$id] $desc (exit=$exit_code)")
  else
    fails=$((fails + 1))
    results+=("FAIL [$id] $desc (expected exit=$expected, got=$exit_code)")
    results+=("       output: $(echo "$output" | grep -E '^FAIL:|PASS:' | head -3 | tr '\n' '|')")
  fi
}

write_baseline() {
  mkdir -p wiki/concepts wiki/entities wiki/sources
  printf -- '---\ntitle: index\ntype: index\n---\n\n# Index\n\n- [[%s]]\n' "$1" > wiki/index.md
  printf -- '---\ntitle: log\ntype: log\n---\n\n## [2026-05-07] test entry\n\n- [[%s]]\n' "$1" > wiki/log.md
}

# AC-B2-1: raw/<base>.md 파일 + wikilink [[<base>.md]] → validator PASS
fixture_AC_B2_1() {
  mkdir -p raw/3_resources
  echo "raw md content" > raw/3_resources/example.md
  write_baseline "concept-foo"
  cat > wiki/concepts/concept-foo.md <<'EOF'
---
title: foo
type: concept
---

# Foo

## 출처
- [[example.md|원문]]
EOF
}

# AC-B2-2: raw/<base>.pdf + wikilink [[<base>]] (확장자 없음) → validator PASS (회귀)
fixture_AC_B2_2() {
  mkdir -p raw/3_resources
  echo "%PDF-1.4 stub" > raw/3_resources/sample.pdf
  write_baseline "concept-foo"
  cat > wiki/concepts/concept-foo.md <<'EOF'
---
title: foo
type: concept
---

# Foo

## 출처
- [[sample]]
EOF
}

# AC-B2-3: raw/<base>.hwpx + wikilink [[<base>.hwpx]] → validator PASS
fixture_AC_B2_3() {
  mkdir -p raw/3_resources
  echo "stub hwpx" > raw/3_resources/document.hwpx
  write_baseline "concept-foo"
  cat > wiki/concepts/concept-foo.md <<'EOF'
---
title: foo
type: concept
---

# Foo

## 출처
- [[document.hwpx|원문]]
EOF
}

# AC-B2-4: raw 에 없는 wikilink → validator FAIL (회귀 없음)
fixture_AC_B2_4() {
  mkdir -p raw/3_resources
  write_baseline "concept-foo"
  cat > wiki/concepts/concept-foo.md <<'EOF'
---
title: foo
type: concept
---

# Foo

## 출처
- [[non-existent-file.md|원문]]
EOF
}

# AC-B2-5: wiki/<X>.md + wikilink [[<X>]] (basename only) → validator PASS (회귀)
fixture_AC_B2_5() {
  write_baseline "concept-foo"
  cat > wiki/sources/source-bar.md <<'EOF'
---
title: bar
type: source
---

# Bar
EOF
  printf -- '---\ntitle: index\ntype: index\n---\n\n# Index\n\n- [[concept-foo]]\n- [[source-bar]]\n' > wiki/index.md
  cat > wiki/concepts/concept-foo.md <<'EOF'
---
title: foo
type: concept
---

# Foo

## 출처
- [[source-bar|bar]]
EOF
}

# AC-B2-6: wiki/<X>.md + wikilink [[<X>.md]] (extension 포함) → validator PASS
fixture_AC_B2_6() {
  write_baseline "concept-foo"
  cat > wiki/sources/source-bar.md <<'EOF'
---
title: bar
type: source
---

# Bar
EOF
  printf -- '---\ntitle: index\ntype: index\n---\n\n# Index\n\n- [[concept-foo]]\n- [[source-bar]]\n' > wiki/index.md
  cat > wiki/concepts/concept-foo.md <<'EOF'
---
title: foo
type: concept
---

# Foo

## 출처
- [[source-bar.md|bar]]
EOF
}

run_case AC-B2-1 "raw/<base>.md + [[<base>.md]] PASS" 0 fixture_AC_B2_1
run_case AC-B2-2 "raw/<base>.pdf + [[<base>]] PASS (regression)" 0 fixture_AC_B2_2
run_case AC-B2-3 "raw/<base>.hwpx + [[<base>.hwpx]] PASS" 0 fixture_AC_B2_3
run_case AC-B2-4 "non-existent wikilink FAIL (no regression)" 1 fixture_AC_B2_4
run_case AC-B2-5 "wiki/<X>.md + [[<X>]] PASS (regression)" 0 fixture_AC_B2_5
run_case AC-B2-6 "wiki/<X>.md + [[<X>.md]] PASS" 0 fixture_AC_B2_6

echo ""
echo "── Results ──"
for r in "${results[@]}"; do echo "$r"; done
echo ""
echo "Total: $total | Pass: $passes | Fail: $fails"

[ "$fails" -eq 0 ]
