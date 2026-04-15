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

⚠️ **배포 필수**: 작업 완료 후 항상 main 머지 + 푸시해야 실제 사이트 반영됨.
```bash
git checkout main && git merge claude/fix-community-modal-close-6eTry --no-edit && git push origin main
git checkout claude/fix-community-modal-close-6eTry
```

작업 브랜치: `claude/fix-community-modal-close-6eTry`

---

## ⚠️ Supabase SQL 실행 필요

> 아래 SQL을 Supabase → SQL Editor에서 직접 실행해야 합니다.

### 1. `supabase/add_is_hidden.sql`
```sql
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false;
UPDATE reviews SET is_hidden = false WHERE is_hidden IS NULL;
```

### 2. `supabase/create_banners.sql` (banners, featured_places 테이블)

---

## 1. 즉시 처리할 버그/기능 (우선순위 순)

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

### [ ] #9 — 마이펫 사진 메인화면 노출 ← 구현 완료, 실서비스 미적용 (Supabase SQL 실행 필요)
- 로그인 + 마이펫 등록된 사람이면 메인 상단에 반려동물 사진 + "안녕하세요 보리맘님 🐾"

---

## 3. 완료된 항목 (참고용)

- [x] community.html 글쓰기 모달 버그 2종 (insert 후 모달 안 닫힘, 폼 초기화 누락)
- [x] #1 최근후기 좋아요/신고 반응 없음 (bindReviewActions에 recent-review-list 추가)
- [x] #2 마이페이지 내 리뷰에 단골병원 등록 버튼
- [x] #3 체중기록 미래날짜 차단 (weight-date-input max=today)
- [x] #7 방문일 클릭 시 달력 자동 펼치기 (showPicker)
- [x] #8 결제금액 step=10 + 영수증 자동입력 안내
- [x] #5 업종 필터 큰 탭 버튼 (category-tab-bar)
- [x] #9 메인 마이펫 인사 바 (pet-greeting-bar)
- [x] #10 미용샵 탭 이벤트 섹션 (grooming-events-section)
- [x] #13 리뷰 아바타 펫사진 연동 + 영수증 비공개
- [x] #4 신고처리 소프트삭제 (is_hidden toggle, 신고 무시/리뷰 숨김 분리)
- [x] #12 admin.html banners/featured_places 테이블 없을 때 graceful 처리
