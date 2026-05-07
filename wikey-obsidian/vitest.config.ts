import { defineConfig } from 'vitest/config'
import path from 'node:path'

/**
 * §5.15.A: wikey-obsidian UI test 인프라. vitest + happy-dom + Obsidian API mock layer.
 *
 * v0 scope (Karpathy Simplicity First):
 *   - happy-dom (jsdom 보다 빠른 minimal DOM 구현)
 *   - obsidian module → src/__tests__/__mocks__/obsidian.ts 로 alias
 *   - test 파일 패턴: src/__tests__/**\/*.test.ts
 *   - esbuild 빌드 영향 0 (build 는 esbuild.config.mjs 별도)
 */
export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/__tests__/**/*.test.ts'],
    globals: false,
  },
  resolve: {
    alias: {
      // Obsidian 1.7.x API surface 의 부분 mock — 실제 obsidian 모듈은 plugin runtime 에서만 가용.
      // test 환경에서는 본 alias 가 mock 으로 대체 (plan §2.1 — 5 인터페이스 minimum).
      obsidian: path.resolve(__dirname, 'src/__tests__/__mocks__/obsidian.ts'),
    },
  },
})
