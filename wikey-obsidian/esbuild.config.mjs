import esbuild from 'esbuild'
import process from 'node:process'
import * as fs from 'node:fs'
import * as path from 'node:path'

const prod = process.argv[2] === 'production'

// §5.7.4 — wasmCopyPlugin: vendor 안 kiwi-wasm.wasm 을 plugin root 로 copy.
// Source = wikey-core/vendor/kiwi-nlp/dist/kiwi-wasm.wasm (B-2 sparse vendor, §3.8 v6).
// Dest   = wikey-obsidian/kiwi-wasm.wasm (plugin root = .obsidian/plugins/wikey/).
// Production + dev 모두 copy. dev watch rebuild 시 매 build 마다 재 copy.
const wasmCopyPlugin = {
  name: 'wikey-wasm-copy',
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length > 0) return
      const src = path.resolve('../wikey-core/vendor/kiwi-nlp/dist/kiwi-wasm.wasm')
      const dst = path.resolve('kiwi-wasm.wasm')
      try {
        fs.copyFileSync(src, dst)
        const size = fs.statSync(dst).size
        console.log(`[wikey] kiwi-wasm.wasm copied: ${size} bytes`)
      } catch (err) {
        console.error(`[wikey] kiwi-wasm.wasm copy FAILED: ${err.message ?? err}`)
      }
    })
  },
}

const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: [
    'obsidian',
    'electron',
    '@codemirror/autocomplete',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    '@lezer/lr',
  ],
  format: 'cjs',
  target: 'es2022',
  logLevel: 'info',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  outfile: 'main.js',
  platform: 'node',
  minify: prod,
  plugins: [wasmCopyPlugin],
})

if (prod) {
  await context.rebuild()
  process.exit(0)
} else {
  await context.watch()
}
