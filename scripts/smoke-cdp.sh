#!/usr/bin/env bash
# scripts/smoke-cdp.sh — Claude CDP wrapper for Phase 4 integrated smoke (v6).
# Wraps /tmp/wikey-cdp.py via scripts/wikey-cdp-wrap.sh (isolated venv).
set -euo pipefail
CDP="/Users/denny/Project/wikey/scripts/wikey-cdp-wrap.sh"

require_jq() { command -v jq >/dev/null 2>&1 || { echo "jq required" >&2; exit 2; }; }
require_jq

case "${1:-}" in
  click)          # smoke-cdp.sh click '.selector'
    "$CDP" eval "document.querySelector($(jq -cn --arg s "$2" '$s')).click()"
    ;;
  type)           # smoke-cdp.sh type '.selector' 'text'
    "$CDP" eval "(() => { const el = document.querySelector($(jq -cn --arg s "$2" '$s')); el.focus(); el.value = $(jq -cn --arg t "$3" '$t'); el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); })()"
    ;;
  key)            # smoke-cdp.sh key '.selector' 'Enter'
    "$CDP" eval "(() => { const el = document.querySelector($(jq -cn --arg s "$2" '$s')); el.focus(); el.dispatchEvent(new KeyboardEvent('keydown', {key:$(jq -cn --arg k "$3" '$k'), bubbles:true})); el.dispatchEvent(new KeyboardEvent('keyup', {key:$(jq -cn --arg k "$3" '$k'), bubbles:true})); })()"
    ;;
  wait)           # smoke-cdp.sh wait 'JS boolean expr' [timeout=30]
    "$CDP" eval "(async () => { const start = Date.now(); const timeout = ${3:-30} * 1000; while (Date.now() - start < timeout) { if ($2) return true; await new Promise(r => setTimeout(r, 200)); } return false; })()" await "${3:-35}"
    ;;
  text)           # smoke-cdp.sh text '.selector'
    "$CDP" eval "(() => { const el = document.querySelector($(jq -cn --arg s "$2" '$s')); return el ? el.textContent : null; })()"
    ;;
  capture-logs)   # dump _wikeyLog buffer
    "$CDP" eval "(() => { const logs = window._wikeyLog || []; window._wikeyLog = []; return logs.join('\\n'); })()"
    ;;
  init-log)       # install console wrapper
    "$CDP" eval "(() => { if (window._wikeyLog) return 'already'; window._wikeyLog = []; ['log','warn','error','info'].forEach(lvl => { const orig = console[lvl]; console[lvl] = function(...a) { window._wikeyLog.push('['+lvl+'] '+a.join(' ')); return orig.apply(this, a); }; }); return 'ok'; })()"
    ;;

  clickPanelButton)  # '<aria-label>'
    "$CDP" eval "(() => { const b = document.querySelector('button.wikey-header-btn[aria-label=' + $(jq -cn --arg n "$2" '$n') + ']'); if (!b) return { error: 'panel button not found: $2' }; b.click(); return { clicked: b.getAttribute('aria-label') }; })()"
    ;;
  clickRowByName)    # '<filename>'
    "$CDP" eval "(() => { const rows = [...document.querySelectorAll('.wikey-audit-row')]; const target = rows.find(r => r.querySelector('.wikey-audit-name')?.textContent?.trim() === $(jq -cn --arg f "$2" '$f')); if (!target) return { error: 'row not found: $2', visibleRows: rows.length }; const cb = target.querySelector('.wikey-audit-cb'); if (!cb) return { error: 'checkbox missing in row' }; cb.click(); return { clicked: true, row: target.outerHTML.slice(0, 120) }; })()"
    ;;
  clickButtonByText) # '<root-selector>' '<button-text>'
    "$CDP" eval "(() => { const root = document.querySelector($(jq -cn --arg r "$2" '$r')); if (!root) return { error: 'root not found: $2' }; const btns = [...root.querySelectorAll('button')]; const target = btns.find(b => b.textContent.trim() === $(jq -cn --arg t "$3" '$t')); if (!target) return { error: 'button not found: $3', buttons: btns.map(b => b.textContent.trim()) }; if (target.disabled) return { error: 'button disabled: $3' }; target.click(); return { clicked: true }; })()"
    ;;
  waitForModalPhase) # brief|processing|preview|closed [timeout]
    PHASE_SEL=""
    case "$2" in
      brief)      PHASE_SEL=".wikey-ingest-flow-modal .wikey-modal-brief" ;;
      processing) PHASE_SEL=".wikey-ingest-flow-modal .wikey-modal-processing" ;;
      preview)    PHASE_SEL=".wikey-ingest-flow-modal .wikey-modal-plan-list" ;;
      closed)     PHASE_SEL="___closed___" ;;
      *) echo "unknown phase: $2" >&2; exit 2 ;;
    esac
    T="${3:-60}"
    if [ "$PHASE_SEL" = "___closed___" ]; then
      "$CDP" eval "(async () => { const start = Date.now(); const timeout = $T * 1000; while (Date.now() - start < timeout) { if (!document.querySelector('.wikey-ingest-flow-modal')) return { ok: true, ms: Date.now() - start }; await new Promise(r => setTimeout(r, 300)); } return { ok: false, timeout: $T }; })()" await "$((T + 5))"
    else
      "$CDP" eval "(async () => { const start = Date.now(); const timeout = $T * 1000; while (Date.now() - start < timeout) { if (document.querySelector($(jq -cn --arg s "$PHASE_SEL" '$s'))) return { ok: true, ms: Date.now() - start }; await new Promise(r => setTimeout(r, 300)); } return { ok: false, timeout: $T }; })()" await "$((T + 5))"
    fi
    ;;
  waitForNoticeText) # '<substring>' [timeout]
    T="${3:-30}"
    "$CDP" eval "(async () => { const start = Date.now(); const timeout = $T * 1000; const needle = $(jq -cn --arg n "$2" '$n'); while (Date.now() - start < timeout) { const hit = [...document.querySelectorAll('.notice')].find(n => n.textContent.includes(needle)); if (hit) return { ok: true, text: hit.textContent }; await new Promise(r => setTimeout(r, 300)); } return { ok: false, timeout: $T }; })()" await "$((T + 5))"
    ;;
  waitForLog)        # '<substring>' [timeout]
    T="${3:-60}"
    "$CDP" eval "(async () => { const start = Date.now(); const timeout = $T * 1000; const needle = $(jq -cn --arg n "$2" '$n'); while (Date.now() - start < timeout) { const logs = window._wikeyLog || []; const hit = logs.find(l => l.includes(needle)); if (hit) return { ok: true, line: hit }; await new Promise(r => setTimeout(r, 500)); } return { ok: false, timeout: $T }; })()" await "$((T + 5))"
    ;;

  *)
    echo "usage: $0 {click|type|key|wait|text|capture-logs|init-log|clickPanelButton|clickRowByName|clickButtonByText|waitForModalPhase|waitForNoticeText|waitForLog} [args...]" >&2
    exit 2
    ;;
esac
