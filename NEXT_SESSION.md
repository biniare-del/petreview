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
| `supabase/create_post_reports.sql` | 커뮤니티 글 신고 테이블 | ✅ 완료 |
| `supabase/add_is_hidden.sql` | reviews.is_hidden 컬럼 | ✅ 완료 |
| `supabase/add_kakao_place_id.sql` | reviews.kakao_place_id 컬럼 | ✅ 완료 |
| `supabase/add_review_photo_urls.sql` | reviews.review_photo_urls 컬럼 | ✅ 완료 |
| `supabase/create_banners.sql` | banners 테이블 | ✅ 완료 |

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
- [x] 헤더 1줄 단순화
- [x] 이달의 추천, 최근 후기, 검색, 리뷰 작성, 리뷰 목록
- [x] 리뷰 필터 (업종/지역/동물/정렬)
- [x] 이미지 확대 뷰어 (lightbox)
- [x] 리뷰 좋아요/신고/댓글/댓글좋아요
- [x] 배너 광고, PWA, 푸시 알림, 공유버튼, 즐겨찾기

### 병원찾기 검색 (app.js)
- [x] 통합 검색 바 `[전국▼][입력][검색]`
- [x] 이름 검색 결과 이름 일치 우선 정렬 (`_lastNameQuery`)
- [x] 검색 결과 정렬 (단골순/가나다순)
- [x] 검색 카드에 리뷰 수 + 평균 가격 배지
- [x] 지도 핀 토글
- [x] 자동완성: Supabase 즉시 표시 → Kakao API 결과 병합

### api/facilities.js (Vercel 서버리스)
- [x] size=15 × 3페이지 = 최대 45건 (is_end 시 조기종료)
- [x] 서버 사이드 정렬 제거

### 병원 상세 모달 (index.html / app.js)
- [x] 카테고리 배지, 병원명, 주소/전화 정보 블록
- [x] 액션 버튼 4개: 📞전화 / 🗺️지도(네이버) / 🧭길찾기(카카오내비) / 📤공유
- [x] ✏️ 리뷰 쓰기 버튼
- [x] 진료비 통계, 별점 평균, 인증 리뷰 목록
- [x] 상담예약 "준비 중" 안내

### 홈화면 마이펫 케어 카드 (app.js + style.css)
- [x] 펫 아바타 72px (그림자 + 녹색 링), 이름·종·품종·나이
- [x] 생일 D-day 배지 (30일 이내)
- [x] 건강 통계 3행: ⚖️ 최근 체중 / 🦟 심장사상충 D-day / 💉 예방접종 D-day
- [x] 퀵액션 3개: 병원찾기 · 건강기록 · 후기쓰기
- [x] 멀티펫 탭, 비로그인 CTA 카드, 펫 미등록 카드

### 마이페이지 (mypage.html)
- [x] 건강기록 모달 탭 구조 (체중/진료이력/처방투약/예방접종)
- [x] 펫 헤더: 아바타 + 이름 + 종류·나이·D-day 메타
- [x] 체중/진료/심장사상충/예방접종 기록
- [x] 단골병원 즐겨찾기, 내 리뷰/댓글/커뮤니티글 탭
- [x] 프로필 닉네임 변경, 뱃지 시스템, 푸시 알림 구독/해제

### 커뮤니티 (community.html)
- [x] 태그 필터, 글 목록, 글 작성/수정/상세/댓글
- [x] 글/댓글 좋아요, 신고

### 관리자 (admin.html)
- [x] 영수증 검수, 리뷰 수정/삭제, 신고관리, 회원관리, 광고관리, 건의함

---

## 2. 할 일 (우선순위 순)

### 🔴 다음 작업
- [ ] **뽐내기 코너** — 사진 업로드 전용 피드 (별도 페이지)

### 🟠 단기
- [ ] **반려동물 가계부** (아이디어 상세 섹션 참고)
- [ ] **뱃지 시스템 확장** — 모든 카테고리에 다양한 뱃지
- [ ] **영수증 없이도 리뷰 가능 UX 명확화** — 폼에 "영수증 없어도 돼요" 안내 텍스트
- [ ] **리뷰 작성 시 마이펫 인라인 빠른 추가** — 펫 없을 때 인라인 등록 UI
- [ ] **영수증 OCR** — 영수증 사진 → 금액/항목 자동 추출

### 🟡 중기
- [ ] **사장님(병원/샵) 계정** — 자기 업체 리뷰에 댓글 권한 (트래픽 확보 후)
- [ ] **예방접종/처방 푸시 알림** 크론잡 연동
- [ ] **개성 테스트** (내 반려견은 어떤 타입?) — 바이럴 유입
- [ ] **병원별 고정 URL** — SEO + 카카오 OG 미리보기 (MAU 5만+ 이후)

### ❌ 하지 않을 것
- 정보성 콘텐츠 (사료/훈련법/위급상황) — 포털/AI와 경쟁 불가
- 상담예약 버튼 — 추후 서비스 제공 시 추가

---

## 3. 아이디어 상세 스펙

### 반려동물 가계부
- 리뷰 작성 시 입력한 진료비 데이터 자동 포함
- 간식비, 사료비, 미용비, 용품 등 직접 입력도 가능
- 반려동물별 분리 + 한 계정 내 합산
- 뷰: 주간 / 월간 / 연간 선택
- 카테고리별 (진료비 / 사료 / 간식 / 미용 / 용품 / 기타)
- Supabase `pet_expenses` 테이블 추가
- 마이페이지 또는 별도 탭에서 차트 + 목록 표시

### 병원 상세 모달 추후 개선 (사장님 계정 연동 후)
- 병원 소개글 (사장님이 직접 입력)
- 운영시간
- 전문 진료 분야 태그
- 사장님 댓글 (리뷰에 답변)
- 주차 여부 정보

### 뽐내기 코너
- 사진 업로드 전용 피드 (별도 페이지)
- 반려동물 자랑 사진 + 짧은 코멘트
- 좋아요 / 댓글

---

## 4. 앱 포지셔닝 (확정)

**핵심 차별점:**
1. **내 반려동물 개인 의료·건강 기록** — AI도 포털도 못 해주는 것
2. **실제 영수증 기반 진료비 투명화** — "강남 슬개골 수술 평균 얼마?" 데이터
3. **영수증 인증 리뷰** — 인증 뱃지로 신뢰도 차별화

**재방문 동기:**
- 알림: 심장사상충·예방접종·생일 → 앱 열게 됨
- 기록: 체중/진료 기록할 때마다 접속
- 검색: "비슷한 증상 후기 있나?" → 리뷰 탐색

**수익 모델 (장기):**
- 우수협력병원/이벤트 광고 배너 (이미 banners 테이블 있음)
- 병원 상단 노출 유료화 (트래픽 확보 후)
- Google AdSense 연동

**콘텐츠 시딩:**
- 보리/타미 실제 후기 10개 이상 직접 작성
- 베타 유저 2~3명 후기 요청

---

## 5. 인프라 스케일링 계획

| MAU | 액션 | 비용 |
|-----|------|------|
| ~1만 | 현재 스택 유지 (GitHub Pages + Supabase Free + Vercel Free) | 0원 |
| 1~5만 | Supabase Pro 업그레이드 | $25/월 |
| 5만~ | Next.js + Vercel Pro 마이그레이션 (SEO 본격화) | $45~70/월 |

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
| pets | 마이펫 (birth_date, breed) |
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
