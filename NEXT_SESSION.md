# 다음 세션 시작 시 자동 실행 목록

> 이 파일을 보고 있다면: 아래 순서대로 바로 실행할 것.

---

## 0. 세션 시작 시 필수 (매번)

```bash
git remote set-url origin https://<PAT_TOKEN>@github.com/biniare-del/petreview.git
```

⚠️ **배포**: 작업 완료 후 main 머지 + 푸시해야 사이트 반영됨.
```bash
git checkout main && git merge claude/finish-map-pin-feature-otjfU --no-edit
git push origin main
git checkout claude/finish-map-pin-feature-otjfU
```

작업 브랜치: `claude/finish-map-pin-feature-otjfU`

⚠️ **배포할 때마다** `sw.js`의 `CACHE_NAME` 버전 올릴 것 (현재 `petreview-v2`)

---

## ⚠️ Supabase SQL 실행 필요 (수동 실행)

| 파일 | 내용 | 상태 |
|------|------|------|
| `supabase/create_review_comments.sql` | review_comments 테이블 + RLS | ✅ 완료 |
| `supabase/create_feedbacks.sql` | 건의함 테이블 | ✅ 완료 |
| `supabase/create_comment_likes.sql` | 댓글 좋아요 테이블 | ✅ 완료 |
| `supabase/admin_rls_bypass.sql` | 관리자 리뷰 수정/삭제 RLS | ✅ 완료 |
| `supabase/create_post_reports.sql` | 커뮤니티 글 신고 테이블 | ❓ 확인 필요 |
| `supabase/add_is_hidden.sql` | reviews.is_hidden 컬럼 | ❓ 확인 필요 |
| `supabase/add_kakao_place_id.sql` | reviews.kakao_place_id 컬럼 | ❓ 확인 필요 |
| `supabase/add_review_photo_urls.sql` | reviews.review_photo_urls 컬럼 | ❓ 확인 필요 |
| `supabase/create_banners.sql` | banners 테이블 | ❓ 확인 필요 |

---

## 1. 구현 완료 목록

### 인증 / 계정
- [x] 구글 OAuth 로그인 (Supabase PKCE)
- [x] 네이버 로그인 (Vercel 서버리스 커스텀 OAuth)
- [x] 인앱 브라우저 감지 → Chrome 유도 모달
- [x] 비로그인 인사바 → 소셜 로그인 CTA

### 메인 UX (index.html / app.js)
- [x] 히어로 슬로건만 (CTA 버튼 제거)
- [x] 하단 탭바 5개 (홈/병원찾기/후기쓰기중앙강조/커뮤니티/마이)
- [x] 헤더 1줄 단순화 (nav·햄버거 제거)
- [x] 이달의 추천, 최근 후기, 검색, 리뷰 작성, 리뷰 목록
- [x] 리뷰 필터 (업종/지역/동물/정렬)
- [x] 이미지 확대 뷰어 (lightbox)
- [x] 리뷰 좋아요/신고/댓글/댓글좋아요
- [x] 배너 광고, PWA, 푸시 알림, 공유버튼, 즐겨찾기

### 병원찾기 검색 (app.js)
- [x] 통합 검색 바 `[전국▼][입력][검색]` — 지역 선택 + 이름 검색 한 곳에
- [x] 이름 검색 결과 이름 일치 우선 정렬 (`_lastNameQuery`)
- [x] 지역 검색 (카테고리 탭 변경 시 자동 재검색)
- [x] 검색 결과 정렬 (단골순/가나다순)
- [x] 검색 카드에 리뷰 수 + 평균 가격 배지
- [x] 지도 핀 토글 (🗺️ 지도 버튼 — 정렬 바 우측)
- [x] 자동완성: Supabase 즉시 표시 → Kakao API 결과 병합

### api/facilities.js (Vercel 서버리스)
- [x] size=15 × 3페이지 = 최대 45건 (keyword/지역 동일, is_end 시 조기종료)
- [x] 서버 사이드 정렬 제거 (클라이언트 이름 일치 우선 정렬 활용)

### 홈화면 마이펫 케어 카드 (app.js + style.css)
- [x] 펫 아바타 72px (그림자 + 녹색 링), 이름·종·품종·나이
- [x] 생일 D-day 배지 (30일 이내, 당일은 핑크 강조)
- [x] 건강 통계 3행: ⚖️ 최근 체중 / 🦟 심장사상충 D-day / 💉 예방접종 D-day
- [x] 퀵액션 3개: 🏥 병원찾기(그린) · 📋 건강기록(오렌지) · ✏️ 후기쓰기(블루)
- [x] 멀티펫 탭: 2마리 이상 시 상단 가로 스크롤 탭
- [x] 비로그인: Google/네이버/전체옵션 CTA 카드
- [x] 펫 미등록: 등록 유도 카드

### 마이페이지 (mypage.html)
- [x] 마이펫 탭 첫 번째 + 기본 활성
- [x] 건강기록 모달 탭 구조 (체중/진료이력/처방투약/예방접종)
- [x] 펫 헤더: 아바타 + 이름 + 종류·나이·D-day 메타
- [x] 체중 탭 최근 체중 강조 표시 박스
- [x] 펫 카드 생일 D-day 뱃지 (30일 이내) + 당일 토스트 알림
- [x] 체중 기록, 진료 이력, 진료메모, 심장사상충, 예방접종
- [x] 단골병원 즐겨찾기
- [x] 내 리뷰/댓글/커뮤니티글 탭
- [x] 프로필 닉네임 변경, 뱃지 시스템
- [x] 푸시 알림 구독/해제

### 커뮤니티 (community.html)
- [x] 태그 필터, 글 목록, 글 작성/수정/상세/댓글
- [x] 글/댓글 좋아요, 신고

### 관리자 (admin.html)
- [x] 영수증 검수, 리뷰 수정/삭제, 신고관리, 회원관리, 광고관리, 건의함

---

## 2. 할 일 (우선순위 순)

### 🔴 지금 작업 중
- [ ] **병원 상세 모달 개선** (아래 상세 스펙 참고)

### 🔴 다음 작업
- [ ] **뽐내기 코너** — 사진 업로드 전용 피드 (별도 페이지)

### 🟠 단기
- [ ] **반려동물 전용 가계부** (아이디어 상세 아래 참고)
- [ ] **뱃지 시스템 확장** — 모든 카테고리에 다양한 뱃지
- [ ] **영수증 OCR** — 영수증 사진 → 금액/항목 자동 추출
- [ ] **자동완성 개선** — 검색창 입력 내용과 병원명 일치 우선 정렬 (추가 튜닝)

### 🟡 중기
- [ ] **사장님(병원/샵) 계정** — 자기 업체 리뷰에 댓글 권한 부여 (트래픽 확보 후)
- [ ] **예방접종/처방 푸시 알림** 크론잡 연동
- [ ] **개성 테스트** (개비티아이, 내 반려견은?) — 바이럴 유입

### ❌ 하지 않을 것
- 정보성 콘텐츠 (사료/훈련법/위급상황) — 포털/AI와 경쟁 불가
- 상담예약 버튼 — 추후 상담예약 서비스 제공 시 추가 예정

---

## 3. 병원 상세 모달 개선 스펙

검색 결과 카드 클릭 시 나타나는 모달(또는 바텀시트) 개선 내용:

### 필수
- 병원명 + 카테고리 태그
- 주소 (전체 주소)
- 📞 전화연결 버튼 (tel: 링크)
- 🗺️ 네이버지도로 보기 (현재 이미 있음)
- 🧭 네비게이션 연결 — 카카오내비 / 네이버지도 앱 딥링크
- 🅿️ 주차 여부 — 카카오 장소 데이터에서 파싱 or 수동 입력 고려
- 해당 병원 리뷰 목록 (평균 별점, 리뷰 수, 최근 리뷰 3건)
- 리뷰 쓰기 버튼 (해당 병원 선택 후 폼으로 이동)

### 추후 (사장님 계정 연동 후)
- 병원 소개글 (사장님이 직접 입력)
- 운영시간
- 전문 진료 분야 태그
- 사장님 댓글 (리뷰에 답변)

---

## 4. 반려동물 가계부 아이디어 스펙

### 개요
- 리뷰 작성 시 입력한 진료비 데이터 자동 포함
- 간식비, 사료비, 미용비, 용품 구매 등 직접 입력 지출도 추가 가능
- 반려동물별로 분리해서 볼 수 있고, 한 계정 내 합산도 가능

### 뷰 종류
- 주간 / 월간 / 연간 선택
- 카테고리별 (진료비 / 사료 / 간식 / 미용 / 용품 / 기타)
- 반려동물별 필터

### 구현 방향
- Supabase에 `pet_expenses` 테이블 추가
- 리뷰 제출 시 `reviews.total_price` → `pet_expenses` 자동 연동
- 마이페이지 또는 별도 탭에서 차트 + 목록 형태로 표시

---

## 5. 앱 포지셔닝 (확정)

**핵심 차별점:**
1. **내 반려동물 개인 의료·건강 기록** — AI도 포털도 못 해주는 것. 내 데이터가 여기 있어야 재방문.
2. **실제 영수증 기반 진료비 투명화** — "강남 슬개골 수술 평균 얼마?" 데이터 있는 곳은 여기뿐.

**재방문 동기:**
- 알림: 심장사상충·예방접종·생일 → 앱 열게 됨
- 기록: 체중/진료 기록할 때마다 접속
- 검색: "비슷한 증상 후기 있나?" → 리뷰 탐색

---

## 6. Supabase 테이블 현황

| 테이블 | 용도 |
|--------|------|
| reviews | 리뷰 (is_verified, status, is_hidden, city, kakao_place_id) |
| review_comments | 리뷰 댓글 |
| review_likes | 리뷰 좋아요 |
| review_reports | 리뷰 신고 |
| comment_likes | 댓글 좋아요 |
| profiles | 사용자 프로필 (nickname, is_admin) |
| pets | 마이펫 (birth_date, breed 컬럼 있음) |
| pet_health_records | 건강 기록 (record_type: 심장사상충/예방접종, next_due_date) |
| pet_weight_logs | 체중 기록 (weight, recorded_at) |
| favorites | 단골병원 |
| banners | 광고 배너 |
| featured_places | 우수협력병원/이벤트 |
| contacts | 문의하기 |
| push_subscriptions | 푸시 알림 구독 |
| post_likes | 커뮤니티 글 좋아요 |
| feedbacks | 건의함 |
| post_reports | 커뮤니티 신고 |
