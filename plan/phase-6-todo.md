# Phase 6: 웹 환경 구축

> 기간: Phase 5 완료 후
> 전제: Phase 4 (본체 완성) + Phase 5 (튜닝·고도화·개선·확장) 완료
> 목표: Obsidian 없이도 wikey 를 사용할 수 있는 웹 인터페이스
> 이력: 2026-04-22 Phase 재편으로 기존 Phase 5 → Phase 6 으로 이동 (기존 Phase 5 자리를 본체 완성 후 튜닝·고도화 스코프가 차지).
> 구성 원칙: 번호·제목·태그는 `activity/phase-6-result.md` 와 1:1 mirror (현재 result 는 착수 후 생성).

## 관련 문서

- **Result mirror**: `activity/phase-6-result.md` (착수 시 생성).
- **보조 문서**: 착수 시 `phase-6-todox-<section>-<topic>.md` · `phase-6-resultx-<section>-<topic>-<date>.md` 형식으로 추가.
- **프로젝트 공통**: [`plan/decisions.md`](./decisions.md) · [`plan/plan_wikey-enterprise-kb.md`](./plan_wikey-enterprise-kb.md).

---

## 6.1 웹 프론트엔드
> tag: #design, #main-feature

- [ ] Next.js 또는 SvelteKit 기반 웹 앱
- [ ] 채팅 UI (Obsidian 플러그인과 동일 기능)
- [ ] 위키 브라우저 (페이지 탐색, 검색, 위키링크 네비게이션)
- [ ] 대시보드 (통계, 태그 랭킹, 그래프 뷰)
- [ ] 인제스트 UI (파일 업로드, 진행률, 결과)

## 6.2 웹 백엔드 API
> tag: #core, #infra

- [ ] wikey-core 를 API 서버로 래핑
- [ ] REST 또는 tRPC 엔드포인트
- [ ] 인증/인가 (개인용 → 멀티유저)
- [ ] WebSocket 실시간 인제스트 진행률

## 6.3 배포
> tag: #infra, #ops

- [ ] Docker 컨테이너화
- [ ] self-hosted (로컬 서버, NAS)
- [ ] 클라우드 배포 옵션 (Vercel, Railway)
