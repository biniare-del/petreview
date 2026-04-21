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
| `supabase/create_review_comments.sql` | review_comments 테이블 + RLS | ✅ 완료 |
| `supabase/create_feedbacks.sql` | 건의함 테이블 | ✅ 완료 |
| `supabase/create_comment_likes.sql` | 댓글 좋아요 테이블 (bigint) | ✅ 완료 |
| `supabase/admin_rls_bypass.sql` | 관리자 리뷰 수정/삭제 RLS 정책 | ⚠️ 실행 필요 |
| `supabase/create_post_reports.sql` | 커뮤니티 글 신고 테이블 | ❓ 확인 필요 |
| `supabase/add_is_hidden.sql` | reviews.is_hidden 컬럼 | ❓ 확인 필요 |
| `supabase/add_kakao_place_id.sql` | reviews.kakao_place_id 컬럼 | ❓ 확인 필요 |
| `supabase/add_review_photo_urls.sql` | reviews.review_photo_urls 컬럼 | ❓ 확인 필요 |
| `supabase/create_banners.sql` | banners 테이블 | ❓ 확인 필요 |

> favorites 테이블: `ALTER TABLE favorites ADD COLUMN IF NOT EXISTS kakao_place_id text;`

---

## 1. 구현 완료 목록

### 인증 / 계정
- [x] 구글 OAuth 로그인 (Supabase PKCE)
- [x] 네이버 로그인 (Vercel 서버리스 커스텀 OAuth)
- [x] 인앱 브라우저 감지 → Chrome 유도 모달
- [x] 비로그인 인사바 → 소셜 로그인 CTA

### 메인 (index.html)
- [x] 히어로 섹션, 이달의 추천, 최근 후기
- [x] 최상단 카테고리 탭 카드형 리디자인 (동물병원=파랑 / 펫미용실=핑크 완전 다른 테마)
- [x] 마이펫 인사바 → 펫 아바타 셀렉터 (건강기록 바로가기, 복수 펫 지원)
- [x] 인사바 아바타 64px 원형·그림자 강화
- [x] 카카오 API 이름 우선 검색 + 지역 토글 (지역검색 숨김/표시)
- [x] 이름 검색 자동완성 (debounce 300ms, 6개)
- [x] 검색 결과 정렬 (단골순/가나다순)
- [x] 검색 카드에 리뷰 수 + 평균 가격 배지
- [x] 병원 상세 모달 (진료비 통계, 별점, 인증 리뷰, 지도 링크)
- [x] 리뷰 작성 폼 (마이펫 선택·인라인 추가, 별점 필수 검증, 영수증·반려동물·리뷰사진)
- [x] 리뷰 카드: 업체명 상단 크게, 반려동물+닉네임+날짜 하단, 사진리뷰 뱃지
- [x] 리뷰 카드 "반려동물" fallback 제거
- [x] 리뷰 필터 (업종/지역/동물 종류/정렬)
- [x] 이미지 확대 뷰어 (lightbox)
- [x] 리뷰 좋아요/신고
- [x] 댓글 + **댓글 좋아요 ❤️** + 본인 댓글 삭제
- [x] 배너 광고 (banners 테이블)
- [x] 하단 탭바 (≤480px)
- [x] PWA (manifest.json, Service Worker, 홈화면 설치)
- [x] 푸시 알림 (VAPID, 구독/해제)
- [x] 병원/미용샵 공유 버튼 (Web Share API)
- [x] 병원 즐겨찾기 (favorites 테이블)

### 헤더/네비게이션
- [x] 헤더 nav: 커뮤니티 / 마이페이지 (주변업체검색 등 제거)
- [x] 모바일 햄버거 메뉴

### 커뮤니티 (community.html)
- [x] 태그 필터, 글 목록, 글 작성/수정/상세/댓글
- [x] 글 좋아요 (post_likes)
- [x] 글/댓글 신고

### 마이페이지 (mypage.html)
- [x] 내 리뷰 목록 (삭제)
- [x] **내 댓글 탭** (작성한 댓글 목록 + 삭제)
- [x] 내 커뮤니티 글 탭
- [x] 단골병원 즐겨찾기
- [x] 마이펫 등록/수정/삭제 + 펫 모달 오버레이 클릭 닫힘 버그 수정
- [x] 마이펫 URL `?pet=ID#pets` → 건강기록 모달 자동 오픈
- [x] 건강기록 (진료메모, 심장사상충, 예방접종)
- [x] 예방접종 프리셋 버튼 (DHPPL/광견병 등)
- [x] 심장사상충 → 드롭다운 선택 (하트가드/레볼루션 등)
- [x] 성별 표기: 수컷(남아) / 암컷(여아)
- [x] 프로필 닉네임 변경
- [x] **뱃지 시스템** (10종, 런타임 계산)
- [x] 푸시 알림 구독/해제

### 관리자 (admin.html)
- [x] 영수증 검수
- [x] 리뷰 전체 필드 수정 (인라인 폼 + 저장/취소)
- [x] 리뷰 반려동물 종류 수정 (강아지/고양이 등 선택)
- [x] 리뷰 숨기기/삭제
- [x] 신고 관리 (리뷰/댓글/커뮤니티)
- [x] 회원 관리
- [x] 광고 관리 (배너 + 우수협력병원)
- [x] 건의함 탭

### 진료항목
- [x] 병원: 심장사상충 예방 / 내·외부 구충 분리 (사상충 중복 제거)
- [x] 미용: 귀청소, 발톱정리, 항문낭, 스파케어 추가

### 기타 페이지
- [x] feedback.html (건의함)
- [x] contact.html, terms.html, privacy.html
- [x] hospital.html (병원/미용샵 상세 페이지)

---

## 2. 할 일 (우선순위 순)

### 🔴 즉시 필요 (Supabase SQL)
- [ ] `supabase/admin_rls_bypass.sql` 실행 → 관리자 리뷰 수정이 실제로 저장되게
  - 실행 안 하면 관리자가 pet_species 등 수정해도 DB에 반영 안 됨

### 🟠 다음 구현
- [ ] **테스트 리뷰 100개** SQL (서울 유명병원 중심, 전국 일부)
  - 5개 테스트 계정 UUID 필요 (Supabase Auth → Users에서 확인)
- [ ] **뱃지 공개 프로필** (댓글 작성자 이름 옆 프로필 링크 → 뱃지 공개 페이지)
- [ ] **뽐내기 기능** (사진만, 별도 페이지, 메인 슬라이드)
- [ ] **마이펫 메인 배너** (첫 페이지에서 마이펫 사진 크게 보여주기)

### 🟡 비즈니스
- [ ] **카카오 비즈앱 전환** → 카카오 로그인 실제 사용자 가능
- [ ] **네이버 테스터 등록** (or 프로덕션 검수 제출) → 네이버 로그인 일반 사용자 가능
- [ ] **Play Store 등록** (PWABuilder + assetlinks.json + $25 계정)
  - 선행: 카카오/네이버 로그인 정상화 먼저

### 🟢 개선 아이디어
- [ ] 댓글 좋아요 많이 받은 뱃지 (5/10/20개)
- [ ] 병원 즐겨찾기 → 신규 리뷰 푸시 알림
- [ ] 검색 결과 지도 뷰 (Kakao Map JS SDK)
- [ ] sw.js `CACHE_NAME` 버전업 (현재 petreview-v2)
