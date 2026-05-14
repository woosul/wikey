# Graphify의 내부 프로세스와 파이프라인 분석

---

## 1. `/graphify .` 최초 실행: 그래프 빌드 내부 프로세스

Graphify는 Claude Code 스킬이 Python 라이브러리를 오케스트레이션하는 구조입니다. 사용자가 Claude Code에서 `/graphify .`을 입력하면 내부적으로 7단계의 파이프라인이 순차적으로 실행됩니다.

파이프라인의 전체 흐름은 `detect() → extract() → build_graph() → cluster() → analyze() → report() → export()`이며, 각 단계는 독립된 모듈의 단일 함수입니다. 모든 단계는 일반 Python dict와 NetworkX 그래프를 통해 통신하고, `graphify-out/` 외부에는 어떤 부수 효과도 남기지 않습니다.

### Stage 1: detect() -- 파일 수집

`detect.py`의 `collect_files(root)` 함수가 대상 디렉토리를 재귀적으로 탐색하여 처리할 파일 목록을 생성합니다. 이 단계에서 `.graphifyignore` 파일의 패턴이 적용되어 `node_modules/`, `dist/`, `.git/` 같은 디렉토리가 제외됩니다. v4.5 이후로는 `graphify-out/` 자체도 스캔 대상에서 제외되어, 생성된 아티팩트가 증분 업데이트 시 불필요한 재처리 압력을 만들지 않습니다. 코드 파일은 `CODE_EXTENSIONS`에 등록된 25개 언어의 확장자로 식별되고, 문서(`.md`, `.txt`, `.pdf`), 이미지(`.png`, `.jpg`, `.svg`, `.webp`), 비디오/오디오 파일이 각각 분류됩니다.

```
detect.py: collect_files(root: Path) -> [Path]
|-- 디렉토리 재귀 탐색
|-- .graphifyignore 패턴 적용
|-- graphify-out/ 자동 제외
|-- 파일 유형별 분류: code / doc / image / video+audio
+-- 결과: 처리 대상 파일 경로 리스트 반환
```

### Stage 2: extract() -- 3-Pass 추출

`extract.py`의 `extract(path)` 함수가 각 파일에 대해 유형별로 다른 추출 전략을 적용합니다. 모든 추출기는 동일한 출력 스키마 `{nodes: [...], edges: [...]}`를 반환하며, `validate.py`가 이 스키마를 검증한 후 `build_graph()`에 전달합니다.

**Pass 1 -- 코드 파일: tree-sitter AST 결정론적 추출 (LLM 불필요)**

`extract.py`에 `extract_<lang>(path: Path) -> dict` 형태의 언어별 추출 함수가 정의되어 있으며, tree-sitter 파서로 AST를 생성한 뒤 노드를 순회하면서 `nodes`와 `edges`를 수집하고, 2차 패스에서 콜 그래프(call-graph)의 INFERRED 호출 엣지를 추가합니다.

구체적으로 추출되는 정보는 다음과 같습니다.

```python
# extract.py 내부의 추출 흐름 (개념적 구조)

def extract_python(path: Path) -> dict:
    # 1. tree-sitter로 AST 파싱
    tree = parser.parse(source_code)
  
    # 2. 1차 패스: 구조 노드 수집
    for node in walk(tree.root_node):
        if node.type == "class_definition":
            nodes.append({
                "id": f"{module}.{class_name}",
                "label": class_name,
                "source_file": str(path),
                "source_location": f"L{node.start_point[0]+1}"
            })
        elif node.type == "function_definition":
            # 함수 시그니처, 독스트링 추출
            ...
        elif node.type == "import_statement":
            # import/from-import 엣지 생성
            edges.append({
                "source": current_module,
                "target": imported_module,
                "relation": "imports",
                "confidence": "EXTRACTED"
            })
  
    # 3. 근거 주석 추출: # NOTE:, # WHY:, # HACK:, # IMPORTANT:
    for comment in comments:
        if matches_rationale_pattern(comment):
            nodes.append({"id": rationale_id, "label": comment_text, ...})
            edges.append({
                "source": rationale_id,
                "target": nearest_function_or_class,
                "relation": "rationale_for",
                "confidence": "EXTRACTED"
            })
  
    # 4. 2차 패스: 콜 그래프 (INFERRED 엣지)
    for call_site in all_function_calls:
        resolved = resolve_callee(call_site, known_functions)
        if resolved:
            edges.append({
                "source": caller,
                "target": resolved,
                "relation": "calls",
                "confidence": "INFERRED"  # 정적 분석으로 추론
            })
  
    return {"nodes": nodes, "edges": edges}
```

이 과정은 완전히 로컬에서 수행되며 네트워크 호출이 전혀 없습니다. v4.2에서 크로스파일 호출 해결이 Go, Rust, Zig, PowerShell, Elixir로 확장되었으며, 미해결 호출자는 `raw_calls`로 저장된 후 전역 후처리 패스에서 해결됩니다.

**Pass 2 -- 비디오/오디오: faster-whisper 로컬 트랜스크립션**

비디오와 오디오 파일은 faster-whisper로 로컬 트랜스크립션되며, 트랜스크립트는 `graphify-out/transcripts/`에 캐시되어 재실행 시 이미 처리된 파일을 건너뜁니다. 오디오 데이터는 절대 외부로 전송되지 않습니다. 트랜스크립트가 완성되면 Pass 3의 LLM 추출 파이프라인에 문서와 동일하게 투입됩니다.

**Pass 3 -- 문서/이미지: Claude 서브에이전트 병렬 추출**

Claude 서브에이전트가 문서, 논문, 이미지, 트랜스크립트에 대해 병렬로 실행되어 개념(concept), 관계(relationship), 설계 근거(design rationale)를 추출합니다. 이 단계에서 `semantically_similar_to` 타입의 INFERRED 엣지가 생성되며, 이 엣지는 구조적 연결 없이도 개념적으로 관련된 노드를 연결합니다.

v4.1에서 성능 최적화가 이루어져 시맨틱 추출 청크 크기가 12~15개 파일에서 20~25개 파일로 증가하여 서브에이전트 라운드트립 횟수가 줄었고, 코드만으로 구성된 코퍼스는 시맨틱 디스패치를 완전히 건너뛰어 AST만으로 처리합니다.

### Stage 3: build_graph() -- NetworkX 그래프 구축

`build.py`의 `build_graph(extractions)` 함수가 모든 추출 결과를 하나의 NetworkX 그래프로 병합합니다. 추출 dict 리스트를 입력받아 `nx.Graph`를 반환합니다.

```python
# build.py 내부 (개념적 구조)

def build_graph(extractions: list[dict]) -> nx.Graph:
    G = nx.Graph()
  
    for extraction in extractions:
        # 노드 추가 (같은 ID의 후속 추가는 속성을 덮어씀)
        for node in extraction["nodes"]:
            G.add_node(node["id"], **node)
      
        # 엣지 추가
        for edge in extraction["edges"]:
            G.add_edge(
                edge["source"], edge["target"],
                relation=edge["relation"],
                confidence=edge["confidence"]
            )
  
    return G
```

`build.py`는 의도적으로 같은 ID의 후속 노드 추가 시 속성을 덮어쓰는 방식을 사용합니다. 이 동작은 문서화되어 있지만, 출처(provenance) 메타데이터가 사라질 수 있어 향후 속성 병합(merge) 방식으로의 개선이 논의되고 있습니다.

### Stage 4: cluster() -- Leiden 커뮤니티 탐지

`cluster.py`의 `cluster(G)` 함수가 그래프에 Leiden 알고리즘(graspologic 라이브러리)을 적용하여 각 노드에 `community` 속성을 부여합니다. 클러스터링은 그래프 토폴로지 기반이며 임베딩을 사용하지 않습니다. Leiden은 엣지 밀도로 커뮤니티를 찾고, Claude가 추출한 시맨틱 유사성 엣지(`semantically_similar_to`, INFERRED 표시)가 이미 그래프 안에 존재하므로 커뮤니티 탐지에 직접 영향을 줍니다.

### Stage 5: analyze() -- God 노드 및 서프라이즈 분석

`analyze.py`의 `analyze(G)` 함수가 그래프를 분석하여 God 노드(최다 연결 허브), Surprising Connection(예상치 못한 크로스파일/크로스모달 연결), 추천 질문(그래프가 답하기에 특화된 4~5개 질문)을 도출합니다.

### Stage 6: report() -- GRAPH_REPORT.md 생성

`report.py`의 `render_report(G, analysis)` 함수가 분석 결과를 마크다운 형태의 감사 보고서로 렌더링합니다. 이 파일이 Claude Code 통합에서 가장 핵심적인 역할을 합니다.

### Stage 7: export() -- 최종 아티팩트 내보내기

`export.py`의 `export(G, out_dir, ...)` 함수가 `graphify-out/` 디렉토리에 최종 결과물을 생성합니다.

```
graphify-out/
|-- graph.html          # vis.js 기반 인터랙티브 시각화
|-- GRAPH_REPORT.md     # God 노드, 서프라이즈, 추천 질문
|-- graph.json          # 영속적 쿼리용 그래프
|-- cache/              # SHA256 해시 기반 증분 캐시
|-- transcripts/        # Whisper 트랜스크립트 캐시 (비디오/오디오 있는 경우)
+-- wiki/               # --wiki 옵션 사용 시 위키 아티클
```

실행 완료 시 토큰 벤치마크가 자동으로 출력됩니다. 혼합 코퍼스(Karpathy 레포 + 논문 + 이미지) 기준 쿼리당 원본 파일 대비 71.5배 적은 토큰을 사용합니다.

---

## 2. 코드 변경 시 그래프 업데이트 프로세스

코드가 추가/수정될 때 그래프를 최신 상태로 유지하는 메커니즘은 3가지가 있으며, 각각 트리거 방식과 처리 범위가 다릅니다.

### 메커니즘 A: `--update` 플래그 (수동 증분 업데이트)

`/graphify . --update` 명령을 실행하면 `cache.py`의 `check_semantic_cache()` 함수가 기존 캐시의 SHA256 해시와 현재 파일의 해시를 비교하여 변경된 파일만 식별합니다.

```python
# cache.py 내부 (개념적 구조)

def check_semantic_cache(files: list[Path], cache_dir: Path) -> tuple[list, list]:
    """파일 리스트를 (캐시됨, 캐시 안 됨) 두 그룹으로 분할"""
    cached = []
    uncached = []
  
    for file_path in files:
        current_hash = sha256(file_path.read_bytes()).hexdigest()
        cache_file = cache_dir / f"{file_path.stem}.hash"
      
        if cache_file.exists() and cache_file.read_text() == current_hash:
            cached.append(file_path)    # 변경 없음 -> 건너뜀
        else:
            uncached.append(file_path)  # 변경됨 or 신규 -> 재추출 대상
  
    return cached, uncached

def save_semantic_cache(files: list[Path], cache_dir: Path):
    """추출 완료 후 현재 해시를 캐시에 저장"""
    for file_path in files:
        current_hash = sha256(file_path.read_bytes()).hexdigest()
        cache_file = cache_dir / f"{file_path.stem}.hash"
        cache_file.write_text(current_hash)
```

`--update` 실행 시의 내부 흐름은 다음과 같습니다.

```
/graphify . --update 실행
|
|-- 1. detect(): 전체 파일 목록 수집
|-- 2. check_semantic_cache(): SHA256 비교
|       |-- 변경 없는 파일 -> 건너뜀 (cached)
|       +-- 변경된 파일 -> 재추출 대상 (uncached)
|-- 3. extract(): 변경된 파일만 추출
|       |-- 코드 파일 -> tree-sitter AST (로컬, LLM 불필요)
|       +-- 문서/이미지 -> Claude 서브에이전트 (LLM 토큰 소비)
|-- 4. build_merge(): 기존 graph.json + 신규 추출 결과 병합
|       +-- [!] 데이터 손실 방지: 병합 결과가 기존보다 작으면 거부
|-- 5. cluster(): 병합 그래프에 Leiden 재실행
|-- 6. analyze(): God 노드, 서프라이즈 재분석
|-- 7. report(): GRAPH_REPORT.md 재생성
+-- 8. export(): 아티팩트 갱신 + save_semantic_cache()
```

`build_merge()` 함수는 안전한 증분 업데이트를 위한 전용 함수로, 그래프를 오직 성장(grow)시키기만 합니다. `--update` 시 기존 `graph.json`보다 작은 그래프로 덮어쓰는 것을 거부하는 데이터 손실 방지 로직이 포함되어 있습니다.

### 메커니즘 B: `--watch` 모드 (실시간 자동 감지)

`watch.py`의 `watch(root, flag_path)` 함수가 파일 시스템 변경을 실시간으로 감시합니다. 코드 파일 저장 시 즉시 AST 리빌드가 트리거되며(LLM 불필요), 문서/이미지 변경 시에는 `--update` LLM 재처리 실행을 알려주는 알림이 표시됩니다.

```
/graphify . --watch 실행 (백그라운드 터미널)
|
+-- 파일 시스템 이벤트 루프
    |
    |-- 코드 파일 변경 감지 (.py, .js, .ts, .go, ...)
    |   |-- tree-sitter AST 즉시 재추출 (로컬, 0 토큰)
    |   |-- 해당 파일의 노드/엣지만 그래프에서 갱신
    |   +-- graph.json 업데이트
    |
    |-- 문서/이미지 변경 감지 (.md, .pdf, .png, ...)
    |   +-- "[!] 문서 변경 감지. /graphify . --update 실행 필요" 알림
    |
    +-- graphify-out/ 내부 변경 -> 무시 (자기 참조 방지)
```

v4.3에서 `watch.py`의 `_rebuild_code` 함수가 루트 경로에 `.resolve()`를 호출하도록 수정되어, 서브디렉토리에서 graphify를 실행할 때 발생하던 `graphify-out/graphify-out/` 중첩 버그가 해결되었습니다.

핵심적인 설계 결정은 코드 변경과 문서 변경을 분리 처리한다는 점입니다. 코드 변경은 tree-sitter AST만으로 처리할 수 있어 LLM 호출 없이 즉시 반영됩니다. 그러나 문서와 이미지의 의미적 추출은 LLM이 필요하므로, 자동 실행 시 예상치 못한 토큰 비용이 발생할 수 있습니다. 따라서 watch 모드는 문서 변경 시 자동 처리 대신 알림만 보내고, 개발자가 `--update`를 명시적으로 실행하도록 합니다.

### 메커니즘 C: Git Hooks (커밋/브랜치 전환 시 자동)

`hooks.py`의 기능으로, `graphify hook install` 명령이 Git의 `post-commit`과 `post-checkout` 훅을 설치합니다.

```
git commit 실행
|-- Git이 post-commit 훅 트리거
|   +-- graphify 자동 리빌드 (AST만, 코드 변경인 경우)
|       |-- 성공 -> 정상 진행
|       +-- 실패 -> 비정상 종료 코드 반환 -> Git이 에러 표시
|
git checkout <branch> 실행
|-- Git이 post-checkout 훅 트리거
|   +-- 브랜치 전환으로 파일 구조 변경
|       +-- 전체 그래프 리빌드 (캐시 활용)
```

훅 리빌드가 실패하면 비정상 종료 코드를 반환하여 Git이 에러를 표시하므로, 그래프 동기화 실패가 조용히 무시되지 않습니다.

`graphify hook install`은 `core.hooksPath` Git 설정을 존중하여, Husky 등의 도구와 함께 사용할 때도 올바른 경로에 훅을 설치합니다.

---

## 3. PreToolUse Hook: Claude Code가 자동으로 그래프를 참조하는 메커니즘

위의 업데이트 메커니즘과 별개로, Claude Code가 일상적인 질문에서 자동으로 그래프를 활용하는 흐름이 있습니다. `graphify claude install` 명령이 `settings.json`에 설치하는 PreToolUse Hook의 작동 방식입니다.

```
개발자: "AuthService의 의존성을 알려줘"
|
|-- Claude Code가 응답 준비
|   |-- Glob 도구 호출 시도 (파일 패턴 검색)
|   |   +-- [Hook 발동] PreToolUse: Glob
|   |       "graphify: Knowledge graph exists. 
|   |        Read GRAPH_REPORT.md for god nodes and 
|   |        community structure before searching raw files."
|   |
|   |-- Claude가 GRAPH_REPORT.md 먼저 읽음
|   |   |-- God 노드 확인: AuthService는 커뮤니티 3의 허브
|   |   |-- Surprising Connection: AuthService -> TokenValidator (크로스파일)
|   |   +-- 관련 파일 식별: src/auth/ 디렉토리
|   |
|   +-- 필요 시 graphify query로 정밀 탐색
|       graphify query "show dependencies of AuthService" --dfs
|
+-- 구조 기반 응답 생성 (무작위 grep 대신 그래프 경로 추적)
```

이 흐름에서 핵심은 Hook이 Claude의 Glob/Grep 호출 **이전에** 발동한다는 점입니다. Claude가 파일을 무작위로 검색하기 전에 그래프의 고수준 구조를 먼저 참조하게 되므로, 검색 범위가 대폭 축소되고 구조적 관계를 놓치지 않게 됩니다.

---

이 내용을 블로그 본문에 추가 챕터로 삽입할까요, 아니면 기존 3장(아키텍처와 작동 원리)을 이 수준으로 확장하는 방식이 좋을까요?
