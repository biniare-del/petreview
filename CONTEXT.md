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
- 작업 브랜치: `claude/fix-community-modal-close-6eTry`

---

## 현재 구현 상태 요약

### 인증 / 계정
- 구글 OAuth 로그인 (Supabase PKCE) ✅
- 네이버 로그인 (Vercel 서버리스 커스텀 OAuth) ✅
- 카카오 로그인 코드 완료, **비즈니스 앱 등록 전까지 비활성** ⚠️
- 인앱 브라우저(카카오톡, 인스타 등) 감지 → Chrome 열기 유도 모달 ✅
- 세션 만료 자동 감지 → 로그인 모달
- 관리자 계정 (profiles.is_admin)

### 메인 페이지 (index.html)
- 히어로 섹션
- **이달의 추천** 섹션 — 이달 인증 후기 기준 상위 5개 병원/미용샵 (클릭 시 상세 페이지) ✅
- 최근 후기 3개 프리뷰
- **최상단 카테고리 탭** (동물병원/미용샵 sticky 탭) ✅
- **마이펫 인사바** — 로그인+펫 등록 시 이름 표시, 미등록 시 등록 유도, 클릭 시 마이페이지 ✅
- 카카오 API 병원/미용샵 검색 (Vercel 프록시, 전국)
- 검색 결과 정렬 토글: 단골순/가나다순
- **검색 카드에 리뷰 수 + 평균 가격 배지** ✅
- 업체 자동완성: 카카오+Supabase 병렬, 최소 2글자, 리뷰 있는 병원 상단
- 위치정보 → 구 자동 선택 (Nominatim)
- 전국 지역 선택 (시/도 select + 구/시/군 select, 시/도 변경 시 구 자동 초기화)
- 병원 상세 모달 (진료비 통계, 다항목 별점, 인증 리뷰, 지도 링크, 상세 페이지 링크)
- **병원/미용샵 상세 페이지** (hospital.html) — URL 파라미터 기반, 별점/진료비/리뷰 집계 ✅
- 리뷰 작성 폼 (CTA → 로그인 → 업종선택 → 폼, draft 저장/복원)
  - 마이펫 선택 UI
  - 다항목 별점 입력 (친절도/진료비/시설/대기시간)
  - 영수증 업로드 → pending 검수 플로우
- 리뷰 카드: 다항목 별점, 닉네임, **댓글 수 뱃지 💬 N** ✅
- **리뷰 필터**: 업종 탭 + 지역(전국) + **동물 종류(강아지/고양이)** ✅
- **리뷰 정렬**: 인증순/별점순/가격낮은순/최신순 ✅
- **이미지 확대 뷰어 (lightbox)** — 리뷰 사진 탭하면 전체 화면 ✅
- 리뷰 좋아요, 신고 (소프트 삭제)
- 배너 광고 (banners 테이블)
- 하단 탭바 (≤480px)
- PWA (manifest.json, Service Worker, 홈화면 설치)
- 푸시 알림 (VAPID, 구독/해제 UI, Vercel 전송, 크론 알림)

### 커뮤니티 (community.html)
- 태그 필터, 글 목록, 글 작성/수정/상세/댓글
- 글 좋아요 (post_likes)
- 헤더 아바타 클릭 → 마이페이지 ✅

### 마이페이지 (mypage.html)
- 내 리뷰 목록 (삭제 가능)
- 단골병원 즐겨찾기
- 마이펫 등록/수정/삭제 (사진 포함)
- 건강 기록: 진료메모(C3), 심장사상충(C4), 예방접종(C5)
- 프로필 (닉네임 변경)
- 푸시 알림 구독/해제

### 관리자 (admin.html)
- 영수증 검수, 전체 리뷰 관리, 신고 관리, 회원 관리, 광고 관리

### 기타 페이지
- 문의하기 (contact.html), 이용약관 (terms.html), 개인정보처리방침 (privacy.html)

---

## Supabase 테이블 목록

| 테이블 | 용도 |
|--------|------|
| reviews | 리뷰 (is_verified, status, is_hidden, city 컬럼 포함) |
| review_comments | 리뷰 댓글 (SELECT 전체 허용 RLS 필수) |
| review_likes | 리뷰 좋아요 |
| review_reports | 리뷰 신고 |
| profiles | 사용자 프로필 (nickname, is_admin) |
| pets | 마이펫 |
| pet_health_records | 건강 기록 (진료메모/심장사상충/예방접종) |
| favorites | 단골병원 |
| banners | 광고 배너 |
| featured_places | 우수협력병원/이벤트 |
| contacts | 문의하기 |
| push_subscriptions | 푸시 알림 구독 |
| post_likes | 커뮤니티 글 좋아요 |

---

## SQL 실행 필요 목록

| 파일 | 상태 |
|------|------|
| supabase/add_is_hidden.sql | 실행 필요 확인 |
| supabase/add_pet_health_records.sql | 실행 완료 |
| supabase/create_review_comments.sql | **실행 필요** — SELECT 전체 허용 RLS 포함 |
| supabase/create_banners.sql | 실행 필요 확인 |

---

## 알려진 갭 / 주의사항

| 항목 | 내용 |
|------|------|
| 카카오 로그인 | 비즈앱 전환 전까지 비활성 |
| 댓글 사라짐 | review_comments RLS SELECT 정책 없으면 비로그인 조회 불가 → supabase/create_review_comments.sql 실행 완료 |
| 자동완성 | Vercel 프록시 느릴 때 5초 대기. 카카오에 없는 업체 → "직접 입력" 항목 제공 |
| 없는 업체 리뷰 | 자동완성 결과 없을 때 "✏️ 직접 입력" 선택지 표시. 자유 입력 후 제출 가능 |
| PWA 캐시 | 배포마다 sw.js의 CACHE_NAME 버전 올려야 사용자 앱 갱신됨 (현재 v2). 새 버전 감지 시 상단 업데이트 배너 자동 표시 |
| 모바일 강제 새로고침 | PWA 설치 시 ?v=2 파라미터 무효 (SW가 캐시 우선). 업데이트 배너 또는 앱 삭제 후 재설치 필요 |
| api/ocr.js | 미사용 파일 |

---

## 결정 완료

| 결정 | 선택 |
|------|------|
| 검색 정렬 | 단골순/가나다순 UI 토글 |
| 지역 범위 | 전국 (17 시/도 + 구/시/군) |
| 병원 상세 페이지 | hospital.html (URL 파라미터, Supabase 조회) |
| 리뷰 정렬 | 인증순/별점순/가격순/최신순 드롭다운 |
| 카테고리 탭 | 최상단 sticky 탭 + 기존 검색 toggle 동기화 |
| 커뮤니티 로그인 | 로그인 필수 |

## 미결 결정사항

| 결정 필요 | 선택지 |
|-----------|--------|
| 포인트/이벤트 시스템 | A) 포인트 적립 / B) 단순 배너 / C) 미구현 유지 |
| 병원 즐겨찾기 신규 리뷰 알림 | 단골 등록한 병원에 새 리뷰 오면 푸시 알림 연동 |
