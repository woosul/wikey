# Obsidian E2E Test Plan — Phase 3 (2026-04-18 Carryover)

> **상위 문서**: [`activity/phase-3-result.md`](../activity/phase-3-result.md) · [`plan/phase-3-todo.md`](./phase-3-todo.md) — 본 문서는 §3.B (Obsidian E2E 테스트 플랜) 보조 자료. 명명규칙: `phase-N-todox-<section>-<topic>.md` / `phase-N-resultx-<section>-<topic>-<date>.md` — `CLAUDE.md §문서 명명규칙·조직화` 참조.

> **체크박스 주의**: 본 문서 내부의 `- [ ]` 는 설계 당시의 플래닝 아티팩트이며 **실 todo 아님**. 실제 추적은 `plan/phase-N-todo.md` 의 해당 section 에서 수행. (sync 스킬 Phase 0-4.6 의 "미이관 결정 케이스" — historical plan)


**Objective**: Execute ACTUAL Obsidian UI testing to verify ingest pipeline, environment detection, and user prompt customization work end-to-end.

**Scope**: 5 scenarios covering fresh install verification, small/large doc ingestion, user prompt customization, and error handling.

**Machine**: Mac mini M4 Pro 48GB, Ollama 0.20.5 running.

**Test Duration**: ~45 min total (fresh env: 5m, scenario 1: 5m, scenario 2: 5m, scenario 3: 10-15m, scenario 4: 5m, scenario 5: 5m)

---

## Scenario 1: Fresh Environment Verification

**Pre-check**
- [ ] Obsidian vault open (`~/Desktop/wiki` or equivalent)
- [ ] Ollama daemon running: `ollama serve` in separate terminal (or launchd)
- [ ] Verify 3 models installed: `ollama list` → shows qwen3:8b, qwen3.6:35b-a3b, gemma4:26b

**Steps**
1. Open Obsidian → left sidebar → click Wikey panel (or use Cmd+Shift+I once)
2. Wikey chat view opens → click Settings gear icon (⚙) in bottom-left
3. Settings panel opens → scroll to **Environment** section
4. Verify status rows (green badges = Installed, gray = Optional):
   - [ ] Node.js: green (Installed)
   - [ ] Python3: green (Installed)
   - [ ] kiwipiepy: green (Installed)
   - [ ] qmd: green (Installed)
   - [ ] Ollama: green "Running (3 models)" or similar
   - [ ] Qwen3 8B: green (Installed)
   - [ ] Qwen3.6:35b-a3b: gray (Optional) or green if loaded
   - [ ] Gemma4: green (Installed)
   - [ ] MarkItDown: green (Installed)
5. Check Ollama URL field → value is `http://localhost:11434`
6. Click [Re-detect] button → observe "Detecting..." then display refreshes

**Expected**
- All required tools show green badges
- LLM models (qwen3:8b, gemma4:26b) show green; qwen3.6:35b-a3b shows optional (not always loaded)
- No errors in settings panel
- Ollama status reflects running daemon

**If fails**
- Check console (Cmd+Shift+I in Obsidian → DevTools → Console tab)
- Verify Ollama running: `curl http://localhost:11434/api/tags` (should return JSON)
- If Ollama not running: `ollama serve &` in background
- If models missing: `ollama pull qwen3:8b && ollama pull gemma4:26b`

---

## Scenario 2: Small-Doc Single-Chunk Ingest (Qwen3 8B baseline)

**Pre-check**
- [ ] Select small file from raw/: `/Users/denny/Project/wikey/raw/1_projects/wikey/wikey-design-decisions.md` (~8KB)
- [ ] Verify file exists: `ls -lh ~/Project/wikey/raw/1_projects/wikey/wikey-design-decisions.md`
- [ ] Ollama model ready: `ollama list | grep qwen3:8b`
- [ ] Close Obsidian plugin > Open Settings > Ingest Model > Provider: Local, Model: qwen3:8b (confirm selected)

**Steps**
1. Obsidian → Wikey chat panel → click [+] icon (Ingest button, top of panel)
2. Ingest panel opens → "Select file or drag drop"
3. Click [Add to inbox] button → native file picker opens
4. Navigate: `/Users/denny/Project/wikey/raw/1_projects/wikey/` → select `wikey-design-decisions.md`
5. File appears in "Pending Ingest" list with name + size (~8 KB)
6. Verify Provider dropdown shows "Local" and Model dropdown shows "qwen3:8b"
7. Click [Ingest] button (right panel) → observe progress bar appear
8. Progress bar shows: "Summary" → "Entities" → "Concepts" → "Indexing"
9. Wait for completion (~30-60 seconds for small file)
10. Result card appears: "Ingested: wikey-design-decisions.md → X entities, Y concepts"
11. Click wikilink in result (e.g., "wikey-design-decisions") → opens wiki page

**Expected**
- File ingests successfully
- Progress bar shows 4 distinct steps
- 2-5 entities created under `wiki/entities/`
- 3-8 concepts created under `wiki/concepts/`
- Generated pages appear as wikilinks in ingest result
- No errors in console

**If fails**
- Check console: Cmd+Shift+I → DevTools
- Look for error: "Cannot find qwen3:8b" → verify `ollama list`
- Look for: "Timeout" → increase LLM timeout in settings (300s default)
- Check `vault_path/.wikey/ingest-map.json` → should show entry for this file
- If wikilinks don't work: verify wiki/ folder exists (`vault_path/wiki/`)

---

## Scenario 3: Large-Doc Chunked Ingest (Qwen3.6:35b-a3b)

**Pre-check**
- [ ] File path: `/Users/denny/Project/wikey/raw/3_resources/20_report/TWHB-16_001_kr_파워디바이스의기초.pdf` (88KB, verified above)
- [ ] System check: M4 Pro 48GB RAM available, minimal other apps running
- [ ] BEFORE STARTING: Close Chrome, Slack, or other heavy apps (this model uses ~27GB VRAM)
- [ ] Load model: `ollama pull qwen3.6:35b-a3b` (if not already loaded, takes ~5 min)
- [ ] Verify available: `ollama list | grep qwen3.6`
- [ ] Settings > Ingest Model > Provider: Local, Model: qwen3.6:35b-a3b

**Steps**
1. Obsidian → Wikey > [+] Ingest
2. [Add to inbox] → pick file browser → navigate to `/Users/denny/Project/wikey/raw/3_resources/20_report/`
3. Select `TWHB-16_001_kr_파워디바이스의기초.pdf`
4. File appears in pending list (88 KB)
5. Verify Model = "qwen3.6:35b-a3b" in dropdown
6. Click [Ingest] → observe progress bar
7. **Watch progress**: should show chained steps like:
   - "Summary" (5-10 sec)
   - "Chunk 1/10" → "Chunk 2/10" ... → "Chunk 10/10" (chunking step, 1-2 min each)
   - "Indexing" (final merge, 30-60 sec)
8. **Total expected time**: 7-15 min (varies by chunk count and model load)
9. After completion: observe result card → should show ~30+ entities, ~50+ concepts
10. Click entity/concept link → verify page created with content

**Expected**
- Progress bar advances through Summary → multiple chunks → Indexing
- Total time: 7-15 minutes
- Generated pages: 30-80 total (entities + concepts combined)
- No duplicate entity slugs (check `wiki/entities/` folder)
- Domain-specific terms present: "MOSFET", "파워 디바이스", "트렌치", "Trench", etc.
- No memory exhaustion errors (app should stay responsive)

**If fails**
- **OOM error**: system needs more free RAM; close apps and retry
- **Timeout error**: Qwen3.6 slow on first load; increase timeout to 600s in settings
- **No chunks progressing**: check console for JSON parse error; model may not support JSON mode
- **Duplicate entities**: check ingest-map.json for duplicate entries; may need manual cleanup
- **Missing domain terms**: LLM quality issue; verify model is qwen3.6:35b-a3b, not fallback

---

## Scenario 4: Ingest Prompt User Customization (A-1 Feature)

**Pre-check**
- [ ] Fresh vault or verify `vault_path/.wikey/ingest_prompt_user.md` does NOT exist yet
- [ ] Pick any small test file (same as scenario 2 is fine)

**Steps**
1. Obsidian → Settings (gear icon) → scroll to **Ingest Prompt** section
2. Verify section shows: "Custom ingest instructions (optional)" + two buttons: [Create & Edit] [Reset]
3. Click [Create & Edit]
4. Vault opens a new tab: `ingest_prompt_user.md` (in `.wikey/` folder)
5. File contains template with:
   - Comment: `<!-- User-Defined Ingest Instructions (optional) -->`
   - Placeholder instructions (or empty)
6. Add a custom instruction line (in Korean or English):
   ```
   엔티티 slug는 영문 소문자만 사용하고 언더스코어(_)는 금지.
   ```
7. Save file (Cmd+S)
8. Close file tab
9. Go back to ingest panel
10. Ingest same small file as before → click [Ingest]
11. Wait for completion
12. Check generated entity pages (e.g., click wikilinks)
13. Inspect entity slugs in `wiki/entities/` folder names:
    - [ ] No uppercase letters
    - [ ] No underscores in slug names
    - [ ] Slug format consistent (e.g., `wikey_design.md` → should be `wikeydesign.md`)
14. Return to Settings > Ingest Prompt section
15. Click [Reset] button
16. Confirm dialog: "Delete ingest_prompt_user.md?"
17. Click confirm → observe button text revert to [Create & Edit]
18. Verify file deleted: `.wikey/ingest_prompt_user.md` gone from vault

**Expected**
- Custom prompt file created and editable
- LLM respects custom instruction (entity slugs follow new format)
- Reset button deletes file and restores settings
- No errors in plugin console

**If fails**
- **File not created**: check `.wikey/` folder exists; manually create if missing
- **Custom instruction ignored**: verify user file was saved; restart Obsidian to reload
- **Reset fails**: manually delete `vault_path/.wikey/ingest_prompt_user.md`
- **Wrong entity format**: LLM may not strictly follow instruction; re-run with clearer phrasing

---

## Scenario 5: Error Cases

### 5a: Ingest while Ollama stopped

**Steps**
1. Stop Ollama: `killall ollama` or close terminal running `ollama serve`
2. Obsidian → Ingest panel → select small file → [Ingest]
3. Observe error within 5-10 seconds
4. Error message should appear in result card or console
5. Restart Ollama: `ollama serve &` in background terminal
6. Retry ingest → should succeed

**Expected**
- Clear error: "Ollama not running" or "Connection refused"
- Error shown in UI (not just console)
- Retry works after Ollama restarts

### 5b: Try non-existent model

**Steps**
1. Settings > Ingest Model > Model dropdown → type or select non-existent model (e.g., "fakemodel:7b")
2. Save settings
3. Ingest panel → select file → [Ingest]
4. Observe error within 10 seconds

**Expected**
- Error: "Model not found" or "Pull fakemodel:7b first"
- Suggests fallback to default model
- No hang or timeout

### 5c: Try file outside raw/

**Steps**
1. Ingest panel → [Add to inbox] → select file from `wiki/` or other location
2. File appears in pending list
3. Click [Ingest] → observe behavior

**Expected (depends on implementation)**
- Option A: Ingest succeeds (no strict guard)
- Option B: Warning: "File should be in raw/ folder"
- Option C: Error: "Cannot ingest from wiki/" (guard active)

If guard is expected → verify error message is clear.

---

## Test Completion Checklist

- [ ] Scenario 1: Environment status shows all required tools
- [ ] Scenario 2: Small doc ingests, creates wiki pages, shows progress
- [ ] Scenario 3: Large doc chunks correctly, takes expected time, no OOM
- [ ] Scenario 4: User prompt template created, custom instruction applied, reset deletes file
- [ ] Scenario 5a: Ollama-stopped error is clear, restart allows retry
- [ ] Scenario 5b: Non-existent model error is clear
- [ ] Scenario 5c: File outside raw/ handled consistently

---

## Troubleshooting Quick Reference

| Issue | Check | Fix |
|-------|-------|-----|
| Models not showing in Environment | Ollama not running | `ollama serve &` |
| qwen3.6 slow/timeout | First load, 27GB VRAM needed | Close apps, increase timeout to 600s |
| Ingest stalled at progress bar | JSON parse error, model mismatch | Check console, verify correct model |
| Duplicate entities in wiki/ | Ingest-map.json corrupted | Manually delete wiki/entities/ and retry |
| User prompt ignored | File not saved or Obsidian not reloaded | Save, close/reopen ingest panel |
| Wikilinks not clickable | wiki/ folder corrupted | Verify wiki/ exists, reindex via Settings |
| OOM during large doc | Insufficient free RAM | Close apps, use qwen3:8b instead |

---

## Post-Test

After all scenarios pass:
1. Note any failures or edge cases in `activity/phase-3-resultx-3.B-test-results.md`
2. If all pass: mark Phase 3 as DONE
3. Document any blockers for Phase 4 (llama.cpp PoC, distributed ingest)
4. Update task list in plan/phase-3-todo.md (lines 149-151 → completed)

