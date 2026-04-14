# Phase 5: 웹 환경 구축

> 기간: Phase 4 완료 후
> 전제: Phase 4 (인제스트 고도화 + 지식 그래프) 완료
> 목표: Obsidian 없이도 wikey를 사용할 수 있는 웹 인터페이스

---

## 5-1. 웹 프론트엔드

- [ ] Next.js 또는 SvelteKit 기반 웹 앱
- [ ] 채팅 UI (Obsidian 플러그인과 동일 기능)
- [ ] 위키 브라우저 (페이지 탐색, 검색, 위키링크 네비게이션)
- [ ] 대시보드 (통계, 태그 랭킹, 그래프 뷰)
- [ ] 인제스트 UI (파일 업로드, 진행률, 결과)

## 5-2. 웹 백엔드 API

- [ ] wikey-core를 API 서버로 래핑
- [ ] REST 또는 tRPC 엔드포인트
- [ ] 인증/인가 (개인용 → 멀티유저)
- [ ] WebSocket 실시간 인제스트 진행률

## 5-3. 배포

- [ ] Docker 컨테이너화
- [ ] self-hosted (로컬 서버, NAS)
- [ ] 클라우드 배포 옵션 (Vercel, Railway)
