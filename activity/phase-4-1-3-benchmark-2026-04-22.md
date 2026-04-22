# Phase 4.1.3.4 — Tier chain 5 코퍼스 회귀 벤치마크

실행일: 2026-04-22

## 요약 테이블

| 문서 | pages | 채택 Tier | Tier 1 decision | Tier 1 score | 최종 score | flags | bodyChars | koreanChars |
|---|---|---|---|---|---|---|---|---|
| **ROHM** | 5 | 1b-docling-force-ocr-kloss | retry | 0.56 | 0.94 | — | 4714 | 2112 |
| **RP1** | 93 | 1-docling | accept | 0.93 | 0.93 | — | 236858 | 1 |
| **PMS** | 31 | 1a-docling-no-ocr | retry-no-ocr | 0.53 | 0.91 | — | 47979 | 18654 |
| **GOODSTREAM** | 1 | 1b-docling-force-ocr-scan | accept | 1.00 | 1.00 | — | 393 | 182 |
| **CONTRACT** | 6 | 1b-docling-force-ocr-scan | accept | 0.95 | 0.96 | — | 6024 | 0 |

## Tier별 상세 (각 문서)

### ROHM (docs/samples/ROHM_Wi-SUN Juta통신모듈(BP35CO-J15).pdf)

- pages: 5
- **Tier 1 (default)**: dur=7.2s, score=0.56, decision=`retry`, flags=`[korean-whitespace-loss]`, isScan=false, koreanLong=42.1%, bodyChars=4896, lines=145, koreanChars=2112, perPage=868
- **Tier 1b (--force-ocr)**: dur=10.6s, score=0.94, decision=`accept`, flags=`[]`, bodyChars=4714, lines=103, koreanChars=2083
- **최종 채택**: `1b-docling-force-ocr-kloss`, score=0.94, flags=`[]`

### RP1 (docs/samples/rp1-peripherals.pdf)

- pages: 93
- **Tier 1 (default)**: dur=73.5s, score=0.93, decision=`accept`, flags=`[]`, isScan=false, koreanLong=0.0%, bodyChars=236858, lines=4099, koreanChars=1, perPage=1344
- **최종 채택**: `1-docling`, score=0.93, flags=`[]`

### PMS (raw/0_inbox/PMS_제품소개_R10_20220815.pdf)

- pages: 31
- **Tier 1 (default)**: dur=28.3s, score=0.53, decision=`retry-no-ocr`, flags=`[image-ocr-pollution]`, isScan=false, koreanLong=3.8%, bodyChars=56255, lines=1922, koreanChars=18654, perPage=1011
- **Tier 1a (--no-ocr)**: dur=12.9s, score=0.91, decision=`accept`, flags=`[]`, bodyChars=47979, lines=532, koreanChars=15549
- **최종 채택**: `1a-docling-no-ocr`, score=0.91, flags=`[]`

### GOODSTREAM (raw/0_inbox/사업자등록증C_(주)굿스트림_301-86-19385(2015).pdf)

- pages: 1
- **Tier 1 (default)**: dur=5.9s, score=1.00, decision=`accept`, flags=`[]`, isScan=false, koreanLong=1.1%, bodyChars=453, lines=49, koreanChars=182, perPage=383
- **Tier 1b (--force-ocr)**: dur=5.9s, score=1.00, decision=`accept`, flags=`[]`, bodyChars=393, lines=41, koreanChars=180
- **최종 채택**: `1b-docling-force-ocr-scan`, score=1.00, flags=`[]`

### CONTRACT (raw/0_inbox/C20260410_용역계약서_SK바이오텍전자구매시스템구축.pdf)

- pages: 6
- **Tier 1 (default)**: dur=10.8s, score=0.95, decision=`accept`, flags=`[]`, isScan=false, koreanLong=0.0%, bodyChars=8114, lines=194, koreanChars=0, perPage=1036
- **Tier 1b (--force-ocr)**: dur=10.8s, score=0.96, decision=`accept`, flags=`[]`, bodyChars=6024, lines=174, koreanChars=2810
- **최종 채택**: `1b-docling-force-ocr-scan`, score=0.96, flags=`[]`
