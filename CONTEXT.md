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
- 작업 브랜치: claude/add-supabase-backend-0x2yb

## 파일 구조
```
petreview/
├── index.html          # 메인 페이지 (검색, 리뷰 작성, 리뷰 목록)
├── mypage.html         # 마이페이지 (내 리뷰, 단골병원, 마이펫, 프로필)
├── admin.html          # 관리자 페이지 (영수증 검수, 리뷰/회원/광고 관리)
├── style.css           # 전체 스타일
├── app.js              # 메인 앱 로직
├── auth.js             # 인증 공통 모듈 (window.PetAuth)
├── supabase-client.js  # Supabase 클라이언트 초기화 (window.supabaseClient)
├── dataProvider.js     # 카카오 API 검색 (window.PetReviewDataProvider)
├── mypage.js           # 마이페이지 전용 JS
├── admin.js            # 관리자 페이지 전용 JS
├── api/
│   ├── facilities.js   # Vercel 함수: 카카오 로컬 API 프록시 (병원/미용샵 검색)
│   └── ocr.js          # Vercel 함수: OCR (미사용)
├── vercel.json         # Vercel 라우팅 설정
├── supabase-setup.sql  # 초기 DB 설정 SQL
├── supabase-auth.sql   # Auth 관련 테이블 SQL (profiles, favorites, pets)
├── supabase-update.sql # DB 업데이트 SQL
├── featured-ads.sql    # 광고 관련 테이블 SQL (banners, featured_places)
└── CONTEXT.md          # 이 파일
```

## 환경변수 / 설정값
| 위치 | 키 | 값/설명 |
|------|-----|---------|
| supabase-client.js | SUPABASE_URL | https://hguzornmqxayylmagook.supabase.co |
| supabase-client.js | SUPABASE_ANON_KEY | sb_publishable_V_W2cWncw9PB1omx7V1MgQ_7zUfv_da |
| auth.js | SITE_URL | https://biniare-del.github.io/petreview/ |
| api/facilities.js | KAKAO_REST_API_KEY | Vercel 환경변수로 주입 |

## 주요 전역 객체
| 객체 | 파일 | 역할 |
|------|------|------|
| `window.supabaseClient` | supabase-client.js | Supabase JS 클라이언트 |
| `window.PetAuth` | auth.js | 인증 모듈 |
| `window.PetReviewDataProvider` | dataProvider.js | 카카오 API 검색 래퍼 |

## 주요 함수 목록

### auth.js (window.PetAuth)
| 함수 | 역할 |
|------|------|
| `PetAuth.init(onAuthChange)` | 세션 복원 + onAuthStateChange 등록 |
| `PetAuth.signInWithGoogle()` | 구글 OAuth 로그인 |
| `PetAuth.signInWithKakao()` | 카카오 OAuth (현재 비활성) |
| `PetAuth.signOut()` | 로그아웃 |
| `PetAuth.isLoggedIn()` | 로그인 여부 |
| `PetAuth.isAdmin()` | 관리자 여부 (profiles.is_admin) |
| `PetAuth.getDisplayName()` | 표시 이름 |
| `PetAuth.getAvatarUrl()` | 프로필 이미지 URL |

### app.js
| 함수 | 역할 |
|------|------|
| `init()` | 앱 초기화 |
| `renderSearchResults()` | 검색 실행 (featured_places, favCounts, userFavs 포함) |
| `renderSearchPage(page)` | 검색 결과 페이지 렌더링 |
| `loadBanner()` | 메인 배너 로드 (banners 테이블) |
| `loadReviews()` | 리뷰 목록 로드 |
| `openReviewForm()` | 리뷰 작성 폼 열기 (로그인 체크) |
| `openLoginModal()` | 로그인 모달 열기 + 폼 draft 저장 |
| `selectFormCategory(category)` | 업종 선택 → step 2 표시 |
| `showFormStep(step)` | 폼 step 1/2 전환 |
| `saveFormDraft()` | 폼 내용 sessionStorage 저장 |
| `restoreFormDraft()` | 로그인 후 폼 내용 복원 |
| `updateHeaderAuth()` | 헤더 인증 영역 갱신 |
| `bindPlaceNameAutocomplete()` | 업체명 자동완성 (Kakao + Supabase 병렬) |

### admin.js
| 함수 | 역할 |
|------|------|
| `loadStats()` | 검수 대기/전체 리뷰/회원 수 집계 |
| `loadReceipts()` | 영수증 검수 대기 목록 |
| `loadAllReviews()` | 전체 리뷰 관리 |
| `loadUsers()` | 회원 관리 (관리자 지정/해제) |
| `loadAdsTab()` | 광고 관리 탭 로드 |
| `loadBannersAdmin()` | 배너 목록 + 활성화/삭제 |
| `loadFeaturedAdmin()` | 우수협력병원/이벤트 목록 + 관리 |

## Supabase 테이블 구조
| 테이블 | 주요 컬럼 |
|--------|-----------|
| profiles | id, nickname, avatar_url, is_admin |
| reviews | id, user_id, place_name, category, region, visit_date, service_detail, total_price, short_review, receipt_image_url, pet_photo_url, is_verified, created_at |
| favorites | id, user_id, place_name, category, region, address, phone |
| pets | id, user_id, name, species, breed, birth_date, photo_url |
| banners | id, image_url, link_url, alt_text, is_active, sort_order |
| featured_places | id, place_name, category, region, address, phone, tag('우수협력병원'/'이벤트'), is_active, sort_order |

### Supabase Storage
- `receipts` 버킷: private, signed URL로 접근 (createSignedUrl 1시간)
- `pet-photos` 버킷: public, getPublicUrl 사용

## 주요 상태 변수 (app.js)
| 변수 | 역할 |
|------|------|
| `reviews` | 로드된 리뷰 배열 |
| `selectedSearchCategory` | 검색 탭 선택 업종 ('hospital'/'grooming') |
| `formCategory` | 리뷰 폼 업종 (검색 탭과 독립) |
| `searchFacilities` | 검색 결과 배열 |
| `featuredPlaces` | 고정 노출 업체 배열 |
| `favCounts` | 즐겨찾기 수 { place_name: count } |
| `userFavs` | 현재 유저 즐겨찾기 Set |
| `FORM_DRAFT_KEY` | sessionStorage 키 ('petreview_form_draft') |

## 기술 스택
- HTML, CSS, Vanilla JS (프레임워크 없음)
- Supabase (Auth PKCE, PostgreSQL, Storage)
- GitHub Pages (정적 호스팅)
- Vercel (서버리스: 카카오 API 프록시)

## Git
- push 전 항상 PAT로 remote URL 설정 필요 (Claude Code 세션 시작 시)
- 형식: git remote set-url origin https://<PAT>@github.com/biniare-del/petreview.git

## 다음 작업 후보
- 병원별 진료항목별 평균 진료비 표시
- 반려동물 프로필 (pets 테이블 연동, mypage.html 마이펫 탭)
- 카카오 로그인 비즈니스 채널 설정 후 활성화
- 리뷰 상세 페이지 (별점, 댓글 등)
