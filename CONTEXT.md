# 펫리뷰 프로젝트 컨텍스트

## 나에 대해
- 병원 마케팅 담당자 (로코코성형외과), 장기 부업 파이프라인 만드는 중
- GitHub: biniare-del
- 바이브코딩으로 작업 (코드 직접 안 짬)
- 말티즈 두 마리: 보리, 타미
- 말투: 직설적, 쉬운 방법 먼저, 칭찬하지 말 것, 모르면 모른다고 할 것

## 펫리뷰 현재 상태
- GitHub: biniare-del/petreview
- 배포 URL: https://biniare-del.github.io/petreview/
- Vercel 프록시: https://petreview.vercel.app
- 작업 브랜치: claude/add-supabase-backend-0x2yb

### 완료된 기능
- 카카오 로컬 API 연동 (Vercel 프록시)
- Supabase 리뷰 저장/조회
- 구글 소셜 로그인 (OAuth PKCE)
- 카카오 로그인 임시 비활성 (비즈니스 채널 설정 필요)
- 로그인 모달 (로그인 리다이렉트 전 폼 draft 세션 저장/복원)
- 헤더 인증 영역 (아바타, 마이페이지 링크, 관리자 링크, 로그아웃)
- mypage.html (내 리뷰, 단골병원, 마이펫, 프로필 탭)
- admin.html (영수증 검수, 리뷰 관리, 회원 관리, 광고 관리 탭)
- 리뷰 작성 2단계 플로우 (업종 선택 카드 → 폼)
- 리뷰 폼: 미래 날짜 선택 불가, 업종별 서비스 태그, 영수증 업로드
- 검색 결과 페이지네이션
- 병원명 자동완성 (Kakao API + Supabase 리뷰 병렬 조회, 리뷰 있는 곳 상단 노출, 검색어 강조, 리뷰 있음 뱃지)
- 즐겨찾기(♥) 버튼 + 카운트 표시 + 즐겨찾기 수 기준 검색 결과 정렬
- 광고 배너 슬롯 (메인 히어로 하단, Supabase banners 테이블)
- 우수협력병원/이벤트 고정 노출 카드 (검색 결과 1페이지 상단)
- 미용샵 탭 핑크/보라 테마
- 전화번호 표시 + tel: 링크

### Supabase 테이블
- profiles (id, nickname, avatar_url, is_admin)
- reviews (place_name, category, region, visit_date, service_detail, total_price, short_review, receipt_image_url, pet_photo_url, is_verified, user_id)
- favorites (user_id, place_name, category, region, address, phone)
- pets (user_id, name, species, breed, birth_date, photo_url)
- banners (image_url, link_url, alt_text, is_active, sort_order)
- featured_places (place_name, category, region, address, phone, tag, is_active, sort_order)

### Supabase Storage
- receipts 버킷: private (signed URL)
- pet-photos 버킷: public

## 기술 스택
- HTML, CSS, Vanilla JS
- Supabase (Auth, DB, Storage)
- GitHub Pages (정적 호스팅)
- Vercel (서버리스 함수: 카카오 API 프록시)

## Git
- push 전 항상 PAT로 remote URL 설정 필요 (Claude Code 세션 시작 시)
- 형식: git remote set-url origin https://<PAT>@github.com/biniare-del/petreview.git

## 다음 작업 후보
- 병원별 진료항목별 평균 진료비 표시
- 반려동물 프로필 (pets 테이블 연동)
- 카카오 로그인 비즈니스 채널 설정 후 활성화
- 리뷰 상세 페이지 (별점, 댓글 등)
