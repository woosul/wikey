/**
 * §5.7.7 Step C0 — Inew dimension lock 단일 source.
 *
 * Spec invariant Inew (phase-5-spec-5.7.7-vector-hybrid-reroute.md §1.1):
 * 모든 dim reference (Orama schema vector[N], qwen3-loader response 검증, RRF fuse,
 * Settings UI badge) 가 본 파일의 `EMBEDDING_DIM` constant 를 import 한다. 추후 model
 * upgrade (Qwen3-Embedding-4B = 2048D 또는 Gemini text-embedding-004 = 768D 등) 시
 * 1 spot 변경만으로 전체 일관성 유지.
 *
 * 실측 (master 직접 ollama endpoint 호출, 2026-05-10):
 *   POST http://localhost:11434/api/embeddings
 *   body { model: 'dengcao/Qwen3-Embedding-0.6B:Q8_0', prompt: '<text>' }
 *   response.embedding.length === 1024
 */

/** Qwen3-Embedding 0.6B native vector dimension. */
export const EMBEDDING_DIM = 1024 as const

/** Default ollama tag used by Spec 1 loader. settings UI override possible. */
export const EMBEDDING_MODEL_DEFAULT = 'dengcao/Qwen3-Embedding-0.6B:Q8_0' as const

/** License of the Qwen3 model family — wikey LGPL-2.1 호환 (Spec 1.1 I1). */
export const QWEN3_LICENSE = 'Apache-2.0' as const
