import { describe, it, expect, beforeEach } from 'vitest'
import { App, Vault, TFile, Notice, ItemView, type WorkspaceLeaf } from 'obsidian'

/**
 * §5.15.A AC-A2 — Obsidian API mock layer 의 5 인터페이스 minimum cover.
 *
 * 본 test 는 vitest + happy-dom + mock layer 인프라 자체를 검증. wikey-obsidian 의
 * 실 source code 를 cover 하지 않음 (그것은 cycle 2~5 sidebar-chat / main.ts test).
 *
 * Cycle 1 인프라 구축 PASS 신호:
 *   - vitest 가 happy-dom 환경에서 정상 startup
 *   - resolve.alias.obsidian 이 본 mock 으로 정상 alias
 *   - 5 인터페이스 (App / Vault / TFile / Notice / ItemView) 모두 instantiate 가능
 *   - Test helper (`__setFile` / `__getFile` / `__listAll` / `Notice.__log`) 가 후속 test 에서 사용 가능
 */

describe('§5.15.A AC-A2 — Obsidian mock layer 5 인터페이스', () => {
  describe('TFile', () => {
    it('path / name / basename / extension 을 정확히 분해', () => {
      const f = new TFile('PARA/wiki/example.md')
      expect(f.path).toBe('PARA/wiki/example.md')
      expect(f.name).toBe('example.md')
      expect(f.basename).toBe('example')
      expect(f.extension).toBe('md')
    })

    it('확장자 없는 path 도 처리', () => {
      const f = new TFile('README')
      expect(f.basename).toBe('README')
      expect(f.extension).toBe('')
    })
  })

  describe('Vault', () => {
    let vault: Vault
    beforeEach(() => { vault = new Vault() })

    it('write → read 라운드트립', async () => {
      const f = new TFile('test.md')
      await vault.write(f, 'hello')
      expect(await vault.read(f)).toBe('hello')
    })

    it('read 부재 → throw', async () => {
      const f = new TFile('missing.md')
      await expect(vault.read(f)).rejects.toThrow('ENOENT')
    })

    it('getMarkdownFiles — .md 확장자만 반환', () => {
      vault.__setFile('a.md', '')
      vault.__setFile('b.txt', '')
      vault.__setFile('c.md', '')
      const md = vault.getMarkdownFiles().map((f) => f.path).sort()
      expect(md).toEqual(['a.md', 'c.md'])
    })

    it('getAbstractFileByPath — 부재 시 null', () => {
      expect(vault.getAbstractFileByPath('nope.md')).toBeNull()
      vault.__setFile('exists.md', 'x')
      expect(vault.getAbstractFileByPath('exists.md')?.path).toBe('exists.md')
    })

    it('test helper — __listAll 정렬 반환', () => {
      vault.__setFile('z.md', '')
      vault.__setFile('a.md', '')
      vault.__setFile('m.md', '')
      expect(vault.__listAll()).toEqual(['a.md', 'm.md', 'z.md'])
    })
  })

  describe('App', () => {
    it('default vault 자동 생성', () => {
      const app = new App()
      expect(app.vault).toBeInstanceOf(Vault)
    })

    it('vault 주입 가능', () => {
      const v = new Vault()
      v.__setFile('seed.md', 'data')
      const app = new App(v)
      expect(app.vault.__getFile('seed.md')).toBe('data')
    })

    it('workspace.onLayoutReady 즉시 호출 (test 환경 — 비동기 lifecycle 필요 없음)', () => {
      const app = new App()
      let called = false
      app.workspace.onLayoutReady(() => { called = true })
      expect(called).toBe(true)
    })
  })

  describe('Notice', () => {
    beforeEach(() => { Notice.__log.length = 0 })

    it('생성자가 message 등록 + __log 누적', () => {
      new Notice('hello')
      new Notice('world')
      expect(Notice.__log).toEqual(['hello', 'world'])
    })

    it('setMessage 체이닝 + message 갱신', () => {
      const n = new Notice('initial')
      const ret = n.setMessage('updated')
      expect(ret).toBe(n)
      expect(n.message).toBe('updated')
    })
  })

  describe('ItemView', () => {
    it('containerEl 에 header + content 자식 2개 자동 생성', () => {
      const leaf: WorkspaceLeaf = { view: null }
      const view = new ItemView(leaf)
      expect(view.containerEl.children.length).toBe(2)
      expect(view.leaf).toBe(leaf)
    })

    it('happy-dom 환경에서 DOM 조작 가능', () => {
      const leaf: WorkspaceLeaf = { view: null }
      const view = new ItemView(leaf)
      const child = document.createElement('div')
      child.textContent = 'test'
      child.classList.add('wikey-test-marker')
      view.containerEl.appendChild(child)
      expect(view.containerEl.querySelector('.wikey-test-marker')?.textContent).toBe('test')
    })
  })
})
