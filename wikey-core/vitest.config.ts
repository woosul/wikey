import { defineConfig } from 'vitest/config'

/**
 * §5.7.4 — wikey-core vitest config. Default include = src/__tests__/**, vendor/ 제외.
 *
 * 이전: vitest 가 root scan 으로 vendor/kiwi-nlp/test/*.test.ts 도 picking
 * (vendor 의 build 결과물이 결정적이지 않으므로 wikey-core 회귀 시 noise 유발).
 */
export default defineConfig({
  test: {
    include: ['src/__tests__/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'vendor/**'],
  },
})
