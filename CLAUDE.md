# 우쭈쭈 (PetReview) 프로젝트 지침

## 프로젝트 개요

* 반려동물 케어 매니저 PWA — 케어루틴·건강기록·식습관·집사영수증
* URL: https://biniare-del.github.io/petreview/care.html
* 프론트엔드: GitHub Pages 정적 호스팅 (빌드 툴 없음)
* 백엔드 DB: Supabase (PostgreSQL + Auth + RLS)
* 백엔드 프록시: Vercel 서버리스 (API 키 보호, AI 조언, 알림 등)

## 아키텍처 핵심 규칙

* 프론트는 순수 정적 파일 (HTML/CSS/Vanilla JS) — 프레임워크 추가 시 먼저 협의
* Supabase는 supabase-client.js를 통해서만 호출 (anon key 노출 최소화)
* AI, OCR 등 민감한 API 키는 절대 프론트에 하드코딩 금지 — Vercel 환경변수 사용
* 환경변수는 Vercel 대시보드에서 관리

## 실제 파일 구조

```
/
├── index.html          ← care.html로 리다이렉트 (meta refresh + JS)
├── care.html           ← 메인 앱 (케어/식단/건강/지출 탭)
├── care.js             ← 메인 앱 로직 (1300+ 줄)
├── social.html/js      ← 커뮤니티 (피드·댓글·좋아요)
├── mypage.html/js      ← 마이페이지 (펫 관리·알림·로그아웃)
├── hospital.html/js    ← 단골병원 관리
├── style.css           ← 전체 스타일 (5200+ 줄)
├── auth.js             ← Google OAuth, 세션 관리
├── supabase-client.js  ← Supabase 초기화
├── sw.js               ← 서비스 워커 (CACHE_NAME: petreview-v7)
├── app.js              ← 동물병원 찾기/리뷰 (index.html용, 기존 기능)
├── dataProvider.js     ← 병원 데이터 제공
├── manifest.json
├── api/                ← Vercel 서버리스 함수
│   ├── ai-care.js      ← AI 케어/식단 조언 (claude-haiku-4-5, 스트리밍)
│   ├── facilities.js   ← 병원 시설 검색
│   ├── ocr.js          ← 영수증 OCR
│   ├── push-send.js    ← 웹 푸시 발송
│   ├── push-cron.js    ← 케어 알림 cron
│   └── keep-alive.js   ← DB 연결 유지
└── CLAUDE.md
```

## Supabase 테이블 구조

```
pets               — id, user_id, name, species, breed, photo_url, created_at
pet_care_logs      — id, user_id, pet_id, care_key, done_at
pet_diet_settings  — id, user_id, pet_id, meals_per_day, food_name, food_amount_g
pet_diet_logs      — id, user_id, pet_id, log_type(meal/water/snack), meal_order, water_ml, note, logged_at
pet_weights        — id, user_id, pet_id, weight, recorded_at
pet_health_records — id, user_id, pet_id, record_type, content, record_date
pet_expenses       — id, user_id, pet_id, category, amount, expense_date, memo, source
favorites          — id, user_id, name, address, phone, memo (단골병원)
push_subscriptions — id, user_id, subscription(JSON)
```

## 케어 항목 (CARE_ITEMS)

9종: 목욕·심장사상충·예방접종·미용·양치·귀청소·발톱·구충제·건강검진
강아지/고양이 각각 기본 주기 다름. 품종별 맞춤 주기(BREED_INTERVALS) 별도 정의.

## 칼로리 계산

RER = 70 × 체중^0.75 / DER = RER × 계수(강아지 중성화 1.6·미중성화 1.8, 고양이 1.2·1.4)
칼로리 설정은 localStorage(`cal_${petId}`)에 저장: weight_kg, neutered, kcal_per_100g

## git/배포 워크플로

* 배포 브랜치: `main` (GitHub Pages 기준)
* 작업 브랜치: `claude/petreview-push-commits-YnOzC`
* 매 세션 push 전: `git remote set-url origin https://biniare-del:$(cat .pat)@github.com/biniare-del/petreview.git`
* push 순서: `git push -u origin claude/petreview-push-commits-YnOzC && git push origin HEAD:main`

## 코딩 규칙

* 함수/변수명 영어, 주석 한국어
* CSS 클래스명은 BEM-lite (컴포넌트-요소--상태)
* 기존 로직 삭제 전 반드시 설명 먼저
* 보안: XSS 방지용 escapeHtml() 함수 항상 사용

## 협업 원칙 (빈느님)

* 다음 뭐할지 묻지 말고 순서대로 진행
* 의견에 무조건 동의/칭찬 금지 — 장단점 냉정하게 분석
* 더 나은 아이디어 있으면 먼저 제시
* 모든 작업은 main까지 push 완료

## 완료된 주요 기능

- [x] 케어루틴 탭: 9종 케어 그리드, D-day 상태, 완료 기록, 히스토리
- [x] 건강기록 탭: 체중 추적(트렌드), 진료·처방 기록, 다중 펫 필터
- [x] 식습관 탭: 식사/수분/간식 기록, RER/DER 칼로리 계산
- [x] 집사영수증 탭: 월별 지출 통계, 카테고리 분류, 공유 분배
- [x] 다중 펫 지원: 펫 탭 전환, 통합 현황 배너
- [x] 품종별 맞춤 케어 주기: 강아지 20종·고양이 9종
- [x] AI 케어/식단 조언: 스트리밍, Haiku 4.5, prompt caching
- [x] 비로그인 데모 + 온보딩 + Google 로그인
- [x] 단골병원 관리 (즐겨찾기)
- [x] 커뮤니티 (소셜 피드)
- [x] PWA (서비스워커 v7, 오프라인 캐시)
- [x] 성능 최적화: defer 스크립트, preconnect, stale-while-revalidate
- [x] 케어 푸시 알림: Vercel cron + Web Push API, D-day 당일 알림
- [x] 소셜 UI 개선: FAB·카드 hover·태그바 색상·모달 드래그핸들·본문 미리보기
- [x] 마이페이지 UI 개선: 프로필 히어로 카드·탭 그린화·펫카드 hover·설정 로그아웃 버튼
- [x] 병원 후기 탭 접근성: care.html 헤더 상시 링크 + 루틴탭 바로가기 카드 2개

## 남은 작업 (우선순위순)

1. **AI 조언 고도화** — 건강기록·체중 추이 데이터도 프롬프트에 포함
2. **앱 아이콘 / 스플래시** — PWA manifest 아이콘 실제 이미지 적용
3. **오프라인 UX** — 네트워크 없을 때 안내 토스트 / 캐시 응답 구분

## 주의사항

* GitHub Pages 서버사이드 불가 — 백엔드 로직은 반드시 Vercel api/ 로
* Supabase 스키마 변경 신중히 — 변경 전 현재 구조 확인
* care.js는 defer 로드되므로 DOMContentLoaded 이후에만 실행됨
* 수분 추적은 ml 수치가 아닌 good/ok/low 정성 레벨로 저장됨
