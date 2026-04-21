# 다음 세션 시작 시 자동 실행 목록

> 이 파일을 보고 있다면: 아래 순서대로 바로 실행할 것.

---

## 0. 세션 시작 시 필수 (매번)

```bash
git remote set-url origin https://<PAT_TOKEN>@github.com/biniare-del/petreview.git
```

⚠️ **배포**: 작업 완료 후 main 머지 + 푸시해야 사이트 반영됨.
```bash
git checkout main && git merge claude/fix-greeting-login-ui-2Z225 --no-edit && git push origin main
git checkout claude/fix-greeting-login-ui-2Z225
```

작업 브랜치: `claude/fix-greeting-login-ui-2Z225`

⚠️ **배포할 때마다** `sw.js`의 `CACHE_NAME` 버전 올릴 것 (현재 `petreview-v2`)
→ 안 올리면 PWA 설치 사용자가 구버전 캐시 계속 사용함

---

## ⚠️ Supabase SQL 실행 필요 (수동 실행)

> Supabase → SQL Editor에서 직접 실행. 아직 안 했으면 꼭 실행할 것.

| 파일 | 내용 | 상태 |
|------|------|------|
| `supabase/create_review_comments.sql` | review_comments 테이블 + RLS | ✅ 실행 완료 |
| `supabase/create_post_reports.sql` | 커뮤니티 글 신고 테이블 | ❓ 실행 필요 확인 |
| `supabase/create_feedbacks.sql` | 건의함 테이블 | ✅ 실행 완료 (2026-04-21) |
| `supabase/add_is_hidden.sql` | reviews.is_hidden 컬럼 | ❓ 실행 필요 확인 |
| `supabase/add_kakao_place_id.sql` | reviews.kakao_place_id 컬럼 + 인덱스 | ❓ 실행 필요 확인 |
| `supabase/add_review_photo_urls.sql` | reviews.review_photo_urls 컬럼 (text[]) | ❓ 실행 필요 확인 |
| `supabase/create_banners.sql` | banners 테이블 | ❓ 실행 필요 확인 |

> favorites 테이블에 kakao_place_id 컬럼 추가도 필요:
> `ALTER TABLE favorites ADD COLUMN IF NOT EXISTS kakao_place_id text;`

---

## 1. 구현 완료 목록

### 인증 / 계정
- [x] 구글 OAuth 로그인 (Supabase PKCE)
- [x] 네이버 로그인 (Vercel 서버리스 커스텀 OAuth)
- [x] 인앱 브라우저 감지 → Chrome 유도 모달
- [x] 비로그인 인사바 → 소셜 로그인 CTA (Google/네이버 버튼)

### 메인 (index.html)
- [x] 히어로 섹션, 이달의 추천, 최근 후기
- [x] 최상단 카테고리 탭 (동물병원/미용샵 sticky)
- [x] 마이펫 인사바 (로그인/미등록/등록 3가지 상태)
- [x] 카카오 API 병원/미용샵 검색 (Vercel 프록시, 전국)
- [x] 검색 결과 정렬 (단골순/가나다순)
- [x] 검색 카드에 리뷰 수 + 평균 가격 배지
- [x] 업체 자동완성 (카카오+Supabase 병렬, 리뷰 있는 병원 상단)
- [x] 전국 지역 선택 (시/도 + 구/시/군)
- [x] 병원 상세 모달 (진료비 통계, 별점, 인증 리뷰, 지도 링크)
- [x] 병원/미용샵 상세 페이지 (hospital.html)
- [x] 리뷰 작성 폼 (마이펫 선택, 다항목 별점, 영수증 업로드)
- [x] **리뷰 사진 첨부 (최대 3장, review_photo_urls)** ← 코드 완료, SQL 실행 필요
- [x] 리뷰 카드: 다항목 별점, 닉네임, 댓글 수 💬, N번째 리뷰 뱃지 (A3)
- [x] 리뷰 필터 (업종/지역/동물 종류)
- [x] 리뷰 정렬 (인증순/별점순/가격낮은순/최신순)
- [x] 이미지 확대 뷰어 (lightbox)
- [x] 리뷰 좋아요/신고/소프트삭제
- [x] **병원 카드/상세 공유 버튼** (Web Share API, B1)
- [x] kakao_place_id 정규화 (병원 조회 정확도 향상)
- [x] 배너 광고 (banners 테이블)
- [x] 하단 탭바 (≤480px)
- [x] PWA (manifest.json, Service Worker, 홈화면 설치)
- [x] 푸시 알림 (VAPID, 구독/해제, Vercel cron)

### 커뮤니티 (community.html)
- [x] 태그 필터, 글 목록, 글 작성/수정/상세/댓글
- [x] 글 좋아요 (post_likes)
- [x] **글/댓글 신고 (라디오 모달 방식, F1)**
- [x] 헤더 아바타 클릭 → 마이페이지

### 마이페이지 (mypage.html)
- [x] 내 리뷰 목록 (삭제 가능)
- [x] **내 커뮤니티 글 목록 탭 (F2)**
- [x] 단골병원 즐겨찾기
- [x] 마이펫 등록/수정/삭제 (사진 포함)
- [x] 건강 기록 (진료메모 C3, 심장사상충 C4, 예방접종 C5)
- [x] 프로필 (닉네임 변경, **리뷰 횟수 뱃지 A2**)
- [x] 푸시 알림 구독/해제

### 관리자 (admin.html)
- [x] 영수증 검수
- [x] 리뷰 관리 (숨기기/삭제 인라인 버튼)
- [x] 신고 관리 (리뷰/댓글/커뮤니티 글)
- [x] 회원 관리
- [x] 광고 관리 (배너 + 우수협력병원)
- [x] **건의함 탭 (K1)**

### 기타
- [x] feedback.html (건의함, K1)
- [x] contact.html, terms.html, privacy.html
- [x] hospital.html (병원/미용샵 상세 페이지)

---

## 2. 미구현 / 미결 기능

### 미구현 (코드 없음)
- [ ] **병원 즐겨찾기 → 신규 리뷰 푸시 알림**
  - favorites + push_subscriptions 조인 → api/push-cron.js 수정 필요
- [ ] **검색 결과 지도 뷰**
  - 카드 목록 외에 지도 핀으로 보기 (Kakao Map JS SDK)
- [ ] **포인트/이벤트 시스템** (미결 결정)
  - A) 포인트 적립 / B) 이벤트 배너만 / C) 유지

### 미결 결정
- 포인트/이벤트: 리뷰 작성 시 포인트 적립 or 배너만?
- 병원 고정 URL (B2): SEO 필요 시점에 결정 (MAU 5만 기준)
