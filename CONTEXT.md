# 펫리뷰 프로젝트 컨텍스트

## 나에 대해
- 병원 마케팅 담당자 (로코코성형외과), 장기 부업 파이프라인 만드는 중
- GitHub: biniare-del
- 바이브코딩으로 작업 (코드 직접 안 짬)
- 말티즈 두 마리: 보리, 타미
- 말투: 직설적, 쉬운 방법 먼저, 칭찬하지 말 것, 모르면 모른다고 할 것

## 프로젝트 기본 정보
- GitHub: biniare-del/petreview
- 배포 URL: https://biniare-del.github.io/petreview/
- Vercel 프록시: https://petreview.vercel.app
- 작업 브랜치: claude/review-context-md-zsvkI

---

## 현재 구현 상태 요약

### 인증 / 계정
- 구글 OAuth 로그인 (Supabase PKCE) ✅
- 네이버 로그인 (Vercel 서버리스 커스텀 OAuth) ✅
- 카카오 로그인 코드 구현 완료, 단 **비즈니스 앱 등록 전까지 미작동** ⚠️
  - 카카오 KOE205 에러: account_email 권한은 비즈 앱만 허용
  - 앱 출시 전 카카오 비즈니스 채널 등록 + 비즈 앱 전환 필요
  - 등록 후 카카오 동의항목에서 이메일 활성화하면 정상 동작
- 세션 만료 자동 감지 → 로그인 모달 (requireAuthUserId 헬퍼)
- 관리자 계정 (profiles.is_admin)
- 비로그인 상태에서 로그인 필요한 액션 → signInWithGoogle() 직접 호출 (redirect 아님)

### 메인 페이지 (index.html)
- 히어로 섹션 (서비스 소개)
- 최근 후기 3개 프리뷰 섹션 (히어로 바로 아래)
- 카카오 API 병원/미용샵 검색 (Vercel 프록시)
- 검색 결과 정렬 토글 UI: 단골순 / 가나다순
- 업체 자동완성: 카카오 + Supabase 병렬, 리뷰 있는 병원 상단
- 위치정보 → 구 자동 선택 (Nominatim 역지오코딩)
- 병원 상세 모달 (진료항목별 평균 진료비, 다항목 별점 평균, 인증 리뷰 목록, 카카오지도 링크)
- 리뷰 작성 폼 (CTA → 로그인 → 업종선택 → 폼, draft 저장/복원)
  - 마이펫 선택 UI (등록된 반려동물 버튼, 없으면 마이페이지 링크 → #pets 해시로 바로 이동)
  - 다항목 별점 입력 (친절도/진료비/시설/대기시간, 선택)
  - 방문일 max=오늘 (미래 날짜 입력 불가)
- 리뷰 등록 완료 → 성공 메시지 화면 + 포인트/이벤트 예고 문구
- 영수증 업로드 → pending 검수 플로우
- 리뷰 카드: 다항목 별점 바, 작성자 닉네임 표시 (profiles 별도 조회)
- 리뷰 좋아요 (review_likes), 신고 (review_reports)
- 배너 광고 (banners 테이블)
- 하단 탭바 (홈/후기/커뮤니티/마이, ≤480px)
- 모바일 햄버거 메뉴

### 커뮤니티 (community.html)
- 태그 필터 (병원추천/질문/자랑/정보/전체)
- 글 목록 (posts 테이블, profiles 별도 조회, 댓글 수, 좋아요 수)
- 글 작성 / 수정 / 상세 모달 / 댓글
- 글 좋아요 (post_likes 테이블)
- 비로그인 → 글쓰기/댓글/좋아요 클릭 시 signInWithGoogle() 직접 호출
- 헤더 로그인 버튼 → signInWithGoogle() 직접 호출
- 헤더/모바일 메뉴 로그아웃 버튼 있음

### 마이페이지 (mypage.html)
- 내 리뷰 목록 (삭제 가능)
- 단골병원 즐겨찾기 (favorites 테이블)
- 마이펫 등록/수정/삭제
  - 필수: 이름, 종류, 품종, 성별, 중성화 여부
  - 선택: 생년월일(max=오늘), 몸무게, 동물등록번호, 특이사항, 사진
  - 사진: 앨범+카메라 선택 가능 (capture 속성 제거)
  - URL 해시로 탭 직접 이동 가능 (mypage.html#pets 등)
- 프로필 (닉네임 변경)
- 로그아웃

### 관리자 페이지 (admin.html)
- 영수증 검수 (pending → approved/rejected)
- 전체 리뷰 관리 (상태 뱃지, 승인/보류/삭제)
- 신고 관리 (처리완료/리뷰삭제)
- 회원 관리 (관리자 지정/해제)
- 광고 관리 (배너, 우수협력병원/이벤트)

### 기타 페이지
- 문의하기 (contact.html, contacts 테이블)
- 이용약관 (terms.html), 개인정보처리방침 (privacy.html)

---

## 알려진 갭 / 주의사항

| 항목 | 내용 |
|------|------|
| **카카오 로그인** | 비즈앱 전환 전까지 비활성 상태 |
| **api/ocr.js** | 미사용 파일 (삭제 검토 가능) |
| **리뷰 사진 첨부** | 현재 반려동물 사진만 가능, 리뷰 전용 사진 첨부 미구현 (백로그) |

---

## 결정 완료

| 결정 사항 | 선택 | 이유 |
|-----------|------|------|
| 검색 정렬 방식 | UI 토글 (단골순/가나다순) | 단골순이 서비스 차별점, 기본값 유지 |
| 홈 최근 리뷰 | 프리뷰 컴포넌트 추가 | 기존 섹션 구조 덜 깨서 안전 |
| 다항목 별점 스키마 | reviews 테이블에 컬럼 추가 | 단순, 조인 불필요, NULL 허용으로 기존 리뷰 호환 |
| 커뮤니티 로그인 | 로그인 필수 | 신고/관리 간편, 어뷰징 방지 |
| 리뷰에 마이펫 연결 | review 작성 시 pet 선택 버튼 UI | 강제 아님, 선택적 연결 |
| 커뮤니티 글 수정 | 수정 기능 추가 | 삭제 후 재작성보다 UX 좋음 |
| 마이펫 필수 항목 | 이름/종류/품종/성별/중성화 | 등록번호, 체중은 선택 |

---

## 미결 결정사항

| 결정 필요 | 선택지 | 현재 상태 |
|-----------|--------|-----------|
| 진료비 범위 표시 형식 | A) `₩10,000 ~ ₩70,000` 단순 범위 / B) 항목별 평균 (현재 3건 이상일 때만 표시) | 미결 |
| 포인트/이벤트 시스템 | A) 리뷰 작성 시 포인트 적립 / B) 단순 이벤트 배너 / C) 미구현 유지 | 미결 |

---

## 작업 백로그

### 1순위 — 지금 해야 할 것

| 항목 | 상태 |
|------|------|
| 리뷰 사진 첨부 (전용 이미지, pet-photos 버킷 재활용) | 미완 |
| 진료비 범위 표시 개선 | 미완 |

### 2순위 — 다음 라운드

| 항목 | 비고 |
|------|------|
| 반려동물 종별 필터 (강아지/고양이/기타) | 마이펫 데이터 쌓이면 의미 생김 |
| 병원 상세 - 별점 레이더/바 시각화 고도화 | 현재 텍스트 평균만 표시 |
| 포인트/이벤트 시스템 | 결정 후 |

### 3순위 — 커뮤니티 활성화 후

- 우리 동네 병원 랭킹 (위치 기반 + 다항목 별점)
- 이달의 베스트 리뷰어 (관리자 선정 → 메인 노출)
- 병원 사장님 답변
- 수의사 인증 뱃지
- 유기견 입양/임보 게시판

### 4순위 — 장기 로드맵

- 커스텀 도메인
- 카카오/네이버 로그인 (비즈앱 전환 후)
- 병원 상단 노출 유료화 (트래픽 생기면)
- PWA → 네이티브 앱
- 반려동물 용품 쇼핑 탭

---

## 파일 구조

```
petreview/
├── index.html          # 메인 (히어로, 검색, 최근후기, 리뷰목록)
├── community.html      # 커뮤니티 (태그필터, 글목록, 글쓰기/수정/상세 모달)
├── mypage.html         # 마이페이지 (내 리뷰, 단골병원, 마이펫, 프로필)
├── admin.html          # 관리자 (영수증검수, 리뷰/회원/광고/신고 관리)
├── contact.html        # 문의하기
├── terms.html          # 이용약관
├── privacy.html        # 개인정보처리방침
├── style.css           # 전체 스타일
├── app.js              # 메인 앱 로직
├── auth.js             # 인증 공통 모듈 (window.PetAuth)
├── supabase-client.js  # Supabase 클라이언트 초기화 (window.supabaseClient)
├── dataProvider.js     # 카카오 API 검색 (window.PetReviewDataProvider)
├── mypage.js           # 마이페이지 전용 JS
├── admin.js            # 관리자 페이지 전용 JS
├── api/
│   ├── facilities.js   # Vercel 함수: 카카오 로컬 API 프록시
│   └── ocr.js          # Vercel 함수: OCR (미사용, 삭제 검토)
├── vercel.json         # Vercel 라우팅 설정
├── supabase-setup.sql  # 초기 DB 설정 SQL
├── supabase-auth.sql   # Auth 관련 테이블 (profiles, favorites, pets)
├── supabase-update.sql # DB 업데이트 SQL (영수증, 신고, 좋아요, 커뮤니티 등)
├── featured-ads.sql    # 광고 관련 테이블 (banners, featured_places)
└── CONTEXT.md          # 이 파일
```

---

## 환경변수 / 설정값

| 위치 | 키 | 값/설명 |
|------|-----|---------|
| supabase-client.js | SUPABASE_URL | https://hguzornmqxayylmagook.supabase.co |
| supabase-client.js | SUPABASE_ANON_KEY | sb_publishable_V_W2cWncw9PB1omx7V1MgQ_7zUfv_da |
| auth.js | SITE_URL | https://biniare-del.github.io/petreview/ |
| api/facilities.js | KAKAO_REST_API_KEY | Vercel 환경변수로 주입 |

---

## 주요 전역 객체

| 객체 | 파일 | 역할 |
|------|------|------|
| `window.supabaseClient` | supabase-client.js | Supabase JS 클라이언트 |
| `window.PetAuth` | auth.js | 인증 모듈 |
| `window.PetReviewDataProvider` | dataProvider.js | 카카오 API 검색 래퍼 |

---

## 주요 패턴 / 주의사항

### profiles join 이슈
PostgREST가 `profiles(nickname)` FK join을 거부하는 경우가 있음 (PGRST200 오류).
모든 닉네임 조회는 **별도 쿼리 패턴**으로 처리:
```js
const { data: profilesData } = await db.from("profiles").select("id, nickname").in("id", userIds);
const profileMap = {};
(profilesData || []).forEach(p => { profileMap[p.id] = p; });
```

### 비로그인 UX 패턴
로그인 필요 액션(글쓰기, 좋아요, 댓글) → `window.PetAuth?.signInWithGoogle()` 직접 호출.
index.html에서만 로그인 모달 사용 (openLoginModal), 나머지 페이지는 직접 OAuth.

### git push
매 세션마다 PAT로 remote URL 재설정 필요:
```
git remote set-url origin https://<PAT>@github.com/biniare-del/petreview.git
git push origin <작업브랜치>:main
```

---

## Supabase 테이블 구조

| 테이블 | 주요 컬럼 |
|--------|-----------|
| profiles | id, nickname, avatar_url, is_admin |
| reviews | id, user_id, place_name, category, region, visit_date, service_detail, total_price, short_review, receipt_image_url, pet_photo_url, pet_name, pet_species, is_verified, status, score_kindness, score_price, score_facility, score_wait, created_at |
| favorites | id, user_id, place_name, category, region, address, phone |
| pets | id, user_id, name, species, breed, gender, birth_date, is_neutered, weight, registration_no, notes, photo_url |
| review_likes | id, review_id, user_id, created_at (UNIQUE review_id+user_id) |
| review_reports | id, review_id, user_id, reason, is_resolved, created_at |
| contacts | id, name, email, type, content, is_resolved, created_at |
| banners | id, image_url, link_url, alt_text, is_active, sort_order |
| featured_places | id, place_name, category, region, address, phone, tag, is_active, sort_order |
| posts | id, user_id, tag, title, content, created_at |
| comments | id, post_id, user_id, content, created_at |
| post_likes | id, post_id, user_id, created_at (UNIQUE post_id+user_id) |

### reviews.status
- `pending`: 영수증 첨부 후 검수 대기 (메인 미표시)
- `approved`: 인증 완료 또는 영수증 없는 일반 리뷰 (메인 표시)
- `rejected`: 관리자 반려 (메인 미표시)
- 영수증 없이 등록 → 바로 `approved`
- 영수증 첨부 등록 → `pending`, 관리자 승인 시 `approved`

### Supabase Storage
- `receipts` 버킷: private, signed URL (createSignedUrl 1시간)
- `pet-photos` 버킷: public, getPublicUrl 사용

---

## 기술 스택
- HTML, CSS, Vanilla JS (프레임워크 없음)
- Supabase (Auth PKCE, PostgreSQL, Storage)
- GitHub Pages (정적 호스팅)
- Vercel (서버리스: 카카오 API 프록시)
