/**
 * §5.7.5 RED — AC-L14 atomic persist + abort signal.
 *
 * persist() 가 (a) tmp file 만들고 rename 후 final 로 이동 (atomic) +
 * (b) opts.signal?.aborted 시 final write skip + tmp 잔존 X.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createOramaIndex, type KoreanTokenizerHandle } from '../../search/orama-index.js'

function tokenizer(): KoreanTokenizerHandle {
  return {
    tokenize: (t: string) =>
      t ? t.toLowerCase().split(/\s+/).filter((s) => s.length > 0) : [],
    close: () => undefined,
  }
}

let tmpRoot = ''
beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'wikey-orama-persist-'))
})
afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true })
})

describe('§5.7.5 orama-index persist atomic + abort', () => {
  it('AC-L14: persist() writes via tmp file + rename, abort skips final write', async () => {
    const cachePath = join(tmpRoot, 'orama', 'wikey-wiki.json')
    const handle = await createOramaIndex({ cachePath, tokenizer: tokenizer() })

    // Normal persist — final file exists, no leftover .tmp
    await handle.persist()
    expect(existsSync(cachePath)).toBe(true)
    const filesAfterPersist = readdirSync(join(tmpRoot, 'orama'))
    // tmp file must not remain after rename
    expect(filesAfterPersist.some((n) => n.endsWith('.tmp'))).toBe(false)

    // Abort path — pre-aborted signal: final write must NOT happen, tmp must NOT remain
    rmSync(cachePath, { force: true })
    expect(existsSync(cachePath)).toBe(false)
    const ac = new AbortController()
    ac.abort()
    await handle.persist({ signal: ac.signal })
    // After abort, the final cache should not be (re)written and no tmp left behind
    expect(existsSync(cachePath)).toBe(false)
    const filesAfterAbort = readdirSync(join(tmpRoot, 'orama'))
    expect(filesAfterAbort.some((n) => n.endsWith('.tmp'))).toBe(false)
  })
})
