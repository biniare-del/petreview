# 다음 세션 시작 시 자동 실행 목록

> 이 파일을 보고 있다면: 아래 순서대로 바로 실행할 것.  
> 완료된 항목은 체크하고, 완료 후 git push까지 마치면 이 파일도 업데이트할 것.

---

## 0. 세션 시작 시 필수 (매번)

```bash
git remote set-url origin https://<PAT_TOKEN>@github.com/biniare-del/petreview.git
```
> PAT 토큰은 GitHub Settings → Developer settings → Personal access tokens에서 확인.  
> 이유: 환경이 세션마다 remote를 로컬 프록시로 초기화해버림. push 전에 반드시 먼저 실행.

작업 브랜치: `claude/fix-community-modal-close-6eTry`

---

## 1. 즉시 처리할 버그/기능 (우선순위 순)

### [ ] #12 — admin.html 배너/우수협력병원 테이블 오류 수정
- 증상: "Could not find the table 'public.banners' in the schema cache" 오류
- 할 일: `admin.js`에서 해당 쿼리 찾아서 테이블 없을 때 graceful 처리 (오류 숨기기 또는 안내 메시지)
- Supabase SQL로 `banners`, `partner_hospitals` 테이블 생성 스크립트도 별도 파일(`supabase/schema_banners.sql`)로 준비

### [ ] #11 — 배너/우수협력병원 플레이스홀더 (관리자가 등록 전 샘플 표시)
- 메인(index.html)에 배너 섹션이 있다면: 관리자가 등록한 배너 없을 때 샘플 카드 표시
- "광고 문의 | 지금 모집 중" 같은 텍스트로 공간 표시
- 관리자가 Supabase에 데이터 넣으면 자동 교체

### [ ] #5 — 실제 방문자 리뷰 업종 필터를 큰 버튼으로
- index.html + app.js: 현재 드롭다운 또는 작은 버튼 → 동물병원 / 미용샵 / 기타를 큰 탭 버튼으로
- 클릭 시 배경색/테마 전환 효과

### [ ] #6 — 리뷰 작성 "어떤 아이와 다녀오셨어요"에 마이펫 빠른 추가
- index.html 리뷰 폼: 마이펫 없을 때 인라인 "마이펫 추가" 버튼
- 클릭 시 mypage.html 마이펫 탭으로 이동 (또는 간단 모달)

---

## 2. 아이디어성 작업 (논의 후 진행)

### [ ] #9 — 마이펫 사진 메인화면 노출
- 로그인 + 마이펫 등록된 사람이면 메인 상단에 반려동물 사진 + "안녕하세요 보리맘님 🐾"
- 구현 전 디자인 먼저 논의

### [ ] #13 — 마이펫 사진 → 리뷰 아바타 연동
- 리뷰 작성 시 펫 선택하면 그 펫 사진이 리뷰 카드 아바타로 표시
- 구현 전 리뷰 테이블 컬럼 확인 필요

### [ ] #4 — 관리자 신고처리 버튼 역할 분리
- 현재 "처리완료" 버튼이 무엇을 하는지 admin.js에서 확인
- 글삭제 / 상태변경 / 신고무시를 별도 버튼으로 분리

---

## 3. 완료된 항목 (참고용)

- [x] community.html 글쓰기 모달 버그 2종 (insert 후 모달 안 닫힘, 폼 초기화 누락)
- [x] #1 최근후기 좋아요/신고 반응 없음 (bindReviewActions에 recent-review-list 추가)
- [x] #2 마이페이지 내 리뷰에 단골병원 등록 버튼
- [x] #3 체중기록 미래날짜 차단 (weight-date-input max=today)
- [x] #7 방문일 클릭 시 달력 자동 펼치기 (showPicker)
- [x] #8 결제금액 step=10 + 영수증 자동입력 안내
