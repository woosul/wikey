# Vault page 미존재 mention fixture

이 문서는 vault page set 에 없는 wikilink target 을 포함한다. mention-guard 의 I9 (Spec 3) 가 [[unknown-entity]] 와 [[ghost-concept|Ghost Concept]] 같은 mention 을 plain text 로 강등해야 한다 — page 가 vault 에 없기 때문이다.

반면 [[claude]] 는 vault `wiki/entities/claude.md` 매치 — 그대로 보존되어야 한다.

[[mythical-tool|레전드 도구]] 는 alias 가 있지만 vault 에 없음 → alias 텍스트만 plain text 로 남는다.

## 출처

- [[source-existing|source]]
- [[mention-only.md|원문]]
