/**
 * §5.7.8 Spec 4 — sidebar chat per-query override (`!nofilter` syntax) + metadata badge.
 * AC-S2.
 */

import { describe, it, expect } from 'vitest'
import {
  parseChatCommand,
  renderFilterMetadataBadges,
} from '../sidebar-chat'

describe('sidebar-chat — !nofilter parser', () => {
  it('Plain query → skipFilter=false', () => {
    expect(parseChatCommand('프로젝트 비용 관리')).toEqual({
      effectiveQuery: '프로젝트 비용 관리',
      skipFilter: false,
    })
  })

  it('!nofilter prefix is stripped + skipFilter=true', () => {
    expect(parseChatCommand('!nofilter 프로젝트 비용 관리')).toEqual({
      effectiveQuery: '프로젝트 비용 관리',
      skipFilter: true,
    })
  })

  it('!nofilter alone (empty query body)', () => {
    expect(parseChatCommand('!nofilter')).toEqual({
      effectiveQuery: '',
      skipFilter: true,
    })
  })

  it('Whitespace around prefix tolerated', () => {
    expect(parseChatCommand('  !nofilter   당뇨 합병증  ')).toEqual({
      effectiveQuery: '당뇨 합병증',
      skipFilter: true,
    })
  })

  it('Substring "nofilter" inside the body is not a prefix → skipFilter=false', () => {
    expect(parseChatCommand('how to nofilter pdfs')).toEqual({
      effectiveQuery: 'how to nofilter pdfs',
      skipFilter: false,
    })
  })
})

describe('sidebar-chat — metadata badges', () => {
  it('renderFilterMetadataBadges builds keep/drop badges per token', () => {
    const container = document.createElement('div')
    renderFilterMetadataBadges(container, [
      { token: '프로젝트', keep: true },
      { token: '가이드', keep: false },
    ])
    const wrapper = container.querySelector('.wikey-filter-metadata')
    expect(wrapper).toBeTruthy()
    const keep = container.querySelector('.wikey-filter-badge-keep')
    const drop = container.querySelector('.wikey-filter-badge-drop')
    expect(keep?.textContent).toContain('프로젝트')
    expect(drop?.textContent).toContain('가이드')
  })

  it('Empty token list → no wrapper rendered', () => {
    const container = document.createElement('div')
    renderFilterMetadataBadges(container, [])
    expect(container.querySelector('.wikey-filter-metadata')).toBeNull()
  })
})
