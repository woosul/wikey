# 인제스트 분할 전략 (Ingest Decomposition)

> raw/ 소스 1개가 wiki/ 페이지 여러 개로 분해되는 이유와 구조.
> 기반 철학: [`llm-wiki.md`](../llm-wiki.md) — "A single source might touch 10-15 wiki pages."

---

## 배경: 왜 1 소스 → N 페이지인가

RAG는 쿼리 시점마다 raw 청크를 뒤져서 답을 **재조립**한다. 지식이 축적되지 않는다. 같은 질문을 100번 해도 100번 다시 검색한다.

Wikey는 다르다. 인제스트 시점에 LLM이 **한 번** 읽고, 추출한 정보를 위키에 **영구** 기록한다. `llm-wiki.md`의 표현으로:

> "The wiki is a persistent, compounding artifact. The cross-references are already there. The contradictions have already been flagged. The synthesis already reflects everything you've read."

이 누적(compounding)을 가능하게 하려면 소스 1개를 **의미 단위로 쪼개** 여러 페이지에 분산 기록해야 한다. 그래야 다음 소스가 들어올 때 기존 엔티티·개념 페이지와 자연스럽게 연결된다.

`llm-wiki.md`는 인제스트 1회가 **10~15개 페이지**를 건드린다고 명시한다. Wikey는 이 원칙을 4개 카테고리로 구체화한다.

---

## 4 카테고리 구조

| 카테고리 | 경로 | 성격 | 멱등성 | 예시 |
|---------|------|------|-------|------|
| **entities** | `wiki/entities/` | 인물·조직·제품·도구 — 고유명사 단위 | O | `andrej-karpathy.md`, `obsidian.md`, `nanovna-v2.md` |
| **concepts** | `wiki/concepts/` | 이론·방법론·패턴 — 추상 명사 단위 | O | `append-and-review-note.md`, `contextual-retrieval.md` |
| **sources** | `wiki/sources/` | 원본 1개당 요약 페이지 1개 | O | `source-dji-o3-air-unit.md` |
| **analyses** | `wiki/analyses/` | 쿼리/비교/탐색으로 생성된 합성 지식 | 추가 전용 | `korean-search-comparison.md` |

**멱등성 (O)**: 같은 엔티티/개념이 여러 소스에서 언급돼도 페이지는 하나. 기존 페이지를 **업데이트**하며, 중복 생성하지 않는다.

**추가 전용 (analyses)**: 쿼리 세션에서 가치 있는 답변이 나올 때마다 새 페이지로 파일링. 과거 분석은 보존.

---

## 분할의 3가지 이유

### 1. 검색 단위 세분화

qmd는 페이지 단위로 BM25 + 벡터 임베딩을 인덱싱한다. 1개의 거대 페이지보다 여러 작은 페이지가 Top-K 검색 정확도가 높다. Contextual Retrieval(Gemma 4 prefix)의 효과도 페이지 단위로 극대화된다.

Phase 2 측정치: BM25 Top-1 60%, vsearch 100% — 분할된 페이지 단위 덕분.

### 2. 재사용 가능성 (compounding)

`andrej-karpathy` 엔티티는 여러 소스에서 참조된다. 소스별로 인물 정보를 중복 저장하지 않고 **하나의 엔티티 페이지**로 합친다. 새 소스가 들어올 때마다 이 페이지가 더 풍부해진다.

```
source-append-and-review.md ──┐
                               ├──► entity: andrej-karpathy.md  (업데이트)
source-llm-wiki-community.md ─┘
```

### 3. 백링크 그래프

Obsidian 그래프 뷰는 페이지 간 `[[wikilink]]` 관계로 시각화된다. 분할하지 않으면 그래프 가치는 0.

```
[[andrej-karpathy]] ← source-append-and-review ← concept-single-note-system
                   ← source-llm-wiki-community  ← concept-append-and-review
```

`llm-wiki.md`: "Obsidian's graph view is the best way to see the shape of your wiki — what's connected to what, which pages are hubs, which are orphans."

---

## 인제스트 실행 흐름

```
raw/3_resources/10_article/append-and-review-note.md  (1 원본)
   │
   ▼
LLM (ingest-pipeline.ts)
   │  JSON 스키마로 엔티티/개념 추출
   ▼
┌────────────────────────────────────────────┐
│ source-append-and-review.md      (+1 신규) │
│ entity: andrej-karpathy.md       (업데이트) │
│ concept: append-and-review-note.md (+1 신규)│
│ concept: single-note-system.md   (+1 신규) │
│ concept: append-only-pattern.md  (+1 신규) │
│ index.md                         (카테고리 등재) │
│ log.md                           (이력 추가) │
└────────────────────────────────────────────┘
        → 1 소스 = 5~15 페이지 touch
```

---

## 숫자가 안 맞아 보이는 이유 (대시보드 해설)

Wiki 섹션의 총합이 Raw 원본 수를 크게 앞지르는 것은 **정상**이다.

**예시 스냅샷** (2026-04-19 기준):

| 구분 | 수 | 설명 |
|------|----|------|
| Raw 원본 | ~23 | `raw/` 트리의 PDF/md/docx 파일 |
| **Wiki Total** | **~66** | 분할 결과 |
| &nbsp;&nbsp;└ entities | 30 | 재사용 되는 인물/제품/도구 |
| &nbsp;&nbsp;└ concepts | 26 | 이론/방법론 |
| &nbsp;&nbsp;└ sources | 8 | 원본 요약 (원본 수 < wiki source 수: 인제스트 안 된 원본 존재) |
| &nbsp;&nbsp;└ analyses | 2 | 쿼리 세션 합성물 |

**주의할 점**
- `sources` 수가 raw 원본 수보다 작으면 = 인제스트 안 된 원본이 있다는 신호
- `entities/concepts` 합이 `sources` × 5~10 언저리면 정상 건전성
- `orphans`(백링크 0인 페이지)는 린트 세션 대상

---

## 운영 원칙

1. **멱등 업데이트**: 같은 엔티티/개념이 두 번째 소스에서 재등장하면 기존 페이지에 섹션 추가
2. **소스 삭제 시 인용 정리**: raw 삭제 → `wiki/sources/source-*.md` 삭제 → 해당 소스를 인용한 다른 페이지에서 "근거 삭제됨" 표시
3. **분석 페이지 파일링**: 쿼리 답변 중 가치 있는 것은 `wiki/analyses/`로 저장. 대화에서 사라지지 않게.
4. **스케일 한계**: `llm-wiki.md`는 `~100 sources, ~hundreds of pages`에서 `index.md` 네비게이션이 충분하다고 본다. Wikey는 그 이상을 위해 qmd 하이브리드 검색을 병행.

---

## 관련 파일

- [`llm-wiki.md`](../llm-wiki.md) — 기반 철학
- [`wikey.schema.md`](../wikey.schema.md) — 3계층 아키텍처 + 워크플로우 상세
- `wikey-core/src/ingest-pipeline.ts` — JSON 추출 구현
- `wikey-core/src/wiki-ops.ts` — createPage / updateIndex 멱등 구현
- `prompts/ingest.txt` — 분할 규칙 프롬프트
