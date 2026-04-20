# 다음 세션 시작 시 자동 실행 목록

> 이 파일을 보고 있다면: 아래 순서대로 바로 실행할 것.

---

## 0. 세션 시작 시 필수 (매번)

```bash
git remote set-url origin https://<PAT_TOKEN>@github.com/biniare-del/petreview.git
```
> PAT 토큰은 GitHub Settings → Developer settings → Personal access tokens에서 확인.

⚠️ **배포**: 작업 완료 후 main 머지 + 푸시해야 사이트 반영됨.
```bash
git checkout main && git merge claude/fix-community-modal-close-6eTry --no-edit && git push origin main
git checkout claude/fix-community-modal-close-6eTry
```

작업 브랜치: `claude/fix-community-modal-close-6eTry`

⚠️ **배포할 때마다** `sw.js`의 `CACHE_NAME` 버전 올릴 것 (현재 `petreview-v2`)
→ 안 올리면 PWA 설치 사용자가 구버전 캐시 계속 사용함

---

## ⚠️ Supabase SQL 실행 필요

> Supabase → SQL Editor에서 직접 실행

### 1. `supabase/create_review_comments.sql` ← **댓글 안 보이는 버그 해결**
```sql
-- review_comments 테이블 + SELECT 전체 허용 RLS 정책
-- (파일 내용 그대로 실행)
```

### 2. `supabase/add_is_hidden.sql`
```sql
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false;
```

### 3. `supabase/add_kakao_place_id.sql` ← **신규 리뷰부터 카카오 장소 ID 저장**
```sql
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS kakao_place_id text;
CREATE INDEX IF NOT EXISTS reviews_kakao_place_id_idx ON reviews (kakao_place_id);
```
> 기존 리뷰는 kakao_place_id = NULL → place_name으로 fallback 조회됨 (자동 처리)

---

## 1. 다음 우선순위 기능

### [x] kakao_place_id 정규화 (완료)
- api/facilities.js에서 카카오 장소 ID 전달
- 자동완성 선택 시 selectedKakaoPlaceId 저장
- 리뷰 저장 시 kakao_place_id 컬럼에 기록
- 병원 상세 모달/페이지에서 kakao_place_id로 우선 조회, fallback → place_name
- hospital.html → "후기 남기기" → index.html prefill_kakao_id 전달
- SQL: supabase/add_kakao_place_id.sql 실행 필요

### [x] 영수증 없어도 됩니다 안내 (초록 박스, 폼 상단)
### [x] 리뷰 사진 안내 문구 (병원 내부, 간판, 처방전 등)
### [x] 즐겨찾기에 kakao_place_id 저장 (favorites 테이블 업데이트 필요)
### [x] 관리자 인라인 버튼 (일반 리뷰 카드에 🔒숨기기/🗑️삭제 버튼)
> Supabase favorites 테이블에 kakao_place_id 컬럼 추가 필요:
> `ALTER TABLE favorites ADD COLUMN IF NOT EXISTS kakao_place_id text;`

### [ ] 병원 즐겨찾기 → 신규 리뷰 푸시 알림
- 단골 등록(favorites) 병원에 새 approved 리뷰 등록 시 알림
- api/push-cron.js에 favorites + push_subscriptions 조인 로직 추가

### [ ] 리뷰 이미지 첨부 (반려동물 사진과 별개로 리뷰 사진)
- 현재: `pet_photo_url` 1장만 가능
- 목표: 병원/미용샵 내부 사진, 처방전 사진 등 별도 첨부 (review_photos 버킷)

### [ ] 검색 결과 지도 뷰
- 카드 목록 외에 지도 핀으로 보기 (Naver Map 또는 Kakao Map JS SDK)

### [ ] 포인트/이벤트 시스템
- 리뷰 작성 시 포인트 적립 or 이벤트 배너만 (미결 결정)

---

## 2. 완료된 항목 (참고용)

### 최근 완료
- [x] 병원/미용샵 상세 페이지 (hospital.html + hospital.js)
- [x] 검색 카드에 리뷰 수 + 평균 가격 배지
- [x] 댓글 수 뱃지 (리뷰 카드에 💬 N)
- [x] 리뷰 정렬 옵션 (인증순/별점순/가격낮은순/최신순)
- [x] 동물 종류 필터 (강아지/고양이/전체)
- [x] 이미지 확대 뷰어 lightbox
- [x] 이달의 추천 섹션 (상위 5개 병원/미용샵)
- [x] 최상단 카테고리 탭 (동물병원/미용샵 sticky)
- [x] 시/도 변경 시 구 select 자동 초기화
- [x] 마이펫 미등록 인사바 → 등록 유도
- [x] 인사바 클릭 → 마이페이지 링크
- [x] 커뮤니티 아바타 클릭 → 마이페이지
- [x] 전국 확대 (17 시/도 + 구/시/군 datalist→select)
- [x] PWA (manifest, SW, 홈화면 설치)
- [x] 푸시 알림 (VAPID, 구독/해제, Vercel cron)
- [x] 건강 기록 C3/C4/C5 (진료메모, 심장사상충, 예방접종)
- [x] 인앱 브라우저 Google 로그인 차단 → Chrome 유도
- [x] 리뷰 댓글 (review_comments) + SQL RLS
- [x] community.html 글쓰기 모달 버그
- [x] 리뷰 좋아요/신고/소프트삭제
- [x] 마이펫 등록/수정/삭제 (사진 포함)
- [x] 단골병원 즐겨찾기
- [x] 관리자: 영수증 검수, 리뷰/신고/회원/광고 관리
