# 우쭈쭈 (Ujuju) — 세션 인계 문서

> 이 파일을 보고 있다면: 아래 **세션 시작 명령**부터 실행할 것.

---

## 0. 세션 시작 시 필수 (매번)

```bash
PAT=$(cat /home/user/petreview/.pat)
git remote set-url origin https://${PAT}@github.com/biniare-del/petreview.git
```

> PAT: `/home/user/petreview/.pat` (gitignore, 만료 없음)  
> 작업 브랜치: `claude/fix-turn-failure-6aAuK`  
> ⚠️ 배포 시 `sw.js`의 `CACHE_NAME` 버전 올릴 것 (현재 `petreview-v5`)

---

## 1. 앱 개요

| 항목 | 내용 |
|------|------|
| **이름** | 우쭈쭈 (Ujuju) |
| **영문** | Peternity (후보) |
| **방향** | 반려동물 헬스케어 올인원 |
| **스택** | HTML/CSS/JS, Supabase, Vercel, GitHub Pages |
| **도메인** | biniare-del.github.io/petreview |

### 핵심 방향 (기존 → 변경)

| 기존 | 변경 |
|------|------|
| 병원 리뷰 플랫폼 | 펫 헬스케어 올인원 |
| 병원찾기 탭 | 케어 탭 |
| 영수증 인증 중심 | 케어 사이클 + 건강 관리 중심 |

병원 찾기 / 리뷰 기능은 유지하되 **서브 기능**으로, 메인은 **마이펫 케어**로 전환.

---

## 2. 탭 구조 (변경 완료)

| 탭 | 페이지 | 설명 |
|----|--------|------|
| 🏠 홈 | index.html | 홈, 검색, 리뷰 목록 |
| 🩺 케어 | **care.html (NEW)** | 케어 스케줄 D-day |
| ✍️ 후기쓰기 | index.html (form) | 병원/미용 리뷰 |
| ⭐ 오늘의 펫 | brag.html | 사진 피드 |
| 👤 마이 | mypage.html | 마이펫, 건강기록, 설정 |

---

## 3. 완료된 기능 전체 목록

### Phase 0 — 기반 (이전 세션들)
- [x] 구글 / 네이버 OAuth 로그인 (Supabase PKCE + Vercel serverless)
- [x] 인앱 브라우저 감지 → Chrome 유도 모달
- [x] PWA (manifest / service worker / 푸시알림)
- [x] 하단 탭바 5개
- [x] 리뷰 작성 (영수증 업로드, 별점, 사진, 태그)
- [x] 리뷰 좋아요 / 신고 / 댓글 / 댓글좋아요
- [x] 병원 검색 (카카오 API + 자동완성 + 지도 핀)
- [x] 병원 상세 모달 (전화 / 지도 / 길찾기 / 공유 / 리뷰)
- [x] 마이펫 케어 카드 (아바타 / D-day / 건강통계 / 퀵액션)
- [x] 건강기록 (체중 / 진료이력 / 처방 / 예방접종)
- [x] 커뮤니티 (글 / 댓글 / 좋아요 / 신고 / 태그필터)
- [x] 관리자 (영수증검수 / 리뷰관리 / 신고 / 회원 / 광고 / 건의함)
- [x] 오늘의 펫 (사진 피드 / 좋아요 / 라이트박스 / 무한스크롤)
- [x] 가계부 (월별 / 항목별 / 비교 / 직접입력 / 6개월 트렌드 차트)
- [x] 연간 펫 리포트
- [x] 진료비 알아보기 (품종·진료별 통계)
- [x] 24시간·특수병원 찾기 (모달, 6개 프리셋)
- [x] 단골병원 신규 리뷰 푸시 알림 (Vercel 매시간 cron)
- [x] 배너 광고 시스템
- [x] 제보하기 폼 (feedbacks 테이블)
- [x] 영수증 인증 vs 일반 후기 시각적 차별화
- [x] 리뷰 잠금 (3건 무료 → 리뷰 작성 후 전체 해제)
- [x] Supabase keep-alive cron (5분 주기)
- [x] 자동완성 공통 함수 (`fetchPlaceSuggestions`, `highlightKeyword`)
- [x] CSS :root 변수 정리, 중복 제거

### Phase 1 — 케어 탭 (이번 세션)
- [x] **앱 리브랜딩**: 펫리뷰 → 우쭈쭈 (전체 파일 일괄 변경)
- [x] **케어 탭 신설**: 탭바 병원찾기 → 케어 (모든 페이지)
- [x] **care.html + care.js**: 케어 스케줄 페이지
  - 강아지 11종 / 고양이 11종 케어 항목
  - D-day 색상 뱃지 (초록/노랑/주황/빨강/미기록)
  - 펫별 탭 전환
  - 완료 기록 버튼 (Supabase pet_care_logs 저장)
  - 기록 히스토리 모달
- [x] **supabase-care.sql**: pet_care_logs 테이블 정의
- [x] **care-cycles.json**: 수의학 기반 케어 주기 데이터 (639줄)

---

## 4. 우선순위 할 일

### 🔴 즉시 필요 (배포 전)

1. **Supabase에서 supabase-care.sql 실행**
   - Supabase 대시보드 → SQL Editor → supabase-care.sql 내용 붙여넣고 실행
   - `pet_care_logs` 테이블 생성됨

2. **케어 탭 동작 확인** (실제 접속해서)
   - 로그인 → 케어 탭 → 펫 목록 표시 → D-day 표시 → 완료 버튼 동작

### 🟠 Phase 2 — 식단 관리

- [ ] **식사 기록**: 1일 1식/2식/3식 설정, 사료 종류, 급여량, 급수량
- [ ] **칼로리 계산**: 체중 기반 RER/DER 자동 계산
- [ ] **식단 기록 테이블**: `pet_diet_logs` (Supabase)
- [ ] **홈 위젯**: 오늘 식사 기록 퀵 체크

DB 설계 (예상):
```sql
CREATE TABLE pet_diet_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  pet_id UUID REFERENCES pets(id),
  meal_type TEXT, -- 'breakfast', 'lunch', 'dinner', 'snack'
  food_name TEXT,
  amount_g NUMERIC,
  water_ml NUMERIC,
  calories NUMERIC,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 🟡 Phase 3 — AI 솔루션

- [ ] **Claude API 연동**: 케어 일정 기반 개인화 추천
  - "심장사상충 5일 지났어요. 오늘 먹이는 게 좋아요!"
  - 체중 변화 패턴 분석
  - 식단 개선 추천
- [ ] **AI 추천 뱃지**: 케어 항목 옆 AI 제안 표시
- [ ] **모델**: `claude-opus-4-7` (adaptive thinking)

### 🟡 케어 탭 고도화

- [ ] **케어 홈 위젯**: 홈 탭에 "오늘 해야 할 케어" 배너
- [ ] **푸시 알림**: 케어 D-day 알림 (Vercel cron + push API)
  - `/api/push-care-cron.js` 새 파일 필요
- [ ] **맞춤 주기**: 품종/모질/체형별 주기 개인화
  - e.g. 장모 말티즈 → 브러싱 1일 → 브러싱 권장 주기 자동 설정
- [ ] **케어 통계**: 월별 케어 이행률 차트

### 🟡 기존 기능 보완

- [ ] **시드 데이터 100건+** — SUPABASE_SERVICE_KEY로 `node test-agent/seed.js`
- [ ] **네이버/카카오 비즈니스 앱 등록** (사용자 직접)
- [ ] **수동 테스트** (아래 체크리스트 참고)

---

## 5. DB 테이블 현황

| 테이블 | 상태 | 설명 |
|--------|------|------|
| reviews | ✅ | 리뷰 |
| pets | ✅ | 반려동물 |
| health_records | ✅ | 건강기록 |
| expenses | ✅ | 가계부 |
| community_posts | ✅ | 커뮤니티 |
| brag_posts | ✅ | 오늘의 펫 |
| push_subscriptions | ✅ | 푸시알림 구독 |
| feedbacks | ✅ | 건의/제보 |
| banners | ✅ | 광고 배너 |
| **pet_care_logs** | ⚠️ **SQL 실행 필요** | 케어 완료 기록 |
| pet_diet_logs | ❌ 미구현 | Phase 2 |

---

## 6. 인프라 / 설정

| 항목 | 값 |
|------|-----|
| GitHub Pages | biniare-del.github.io/petreview |
| Vercel | petreview.vercel.app (API 서버리스) |
| Supabase | hguzornmqxayylmagook.supabase.co |
| 카카오 앱키 | 9e5930005d619cae98c2d710200b768f (JS) |
| CACHE_NAME | petreview-v5 |
| Vercel crons | push-cron (매일 0시), push-favorites-cron (매시간), keep-alive (5분) |

---

## 7. 수동 테스트 체크리스트

| # | 기능 | 체크 |
|---|------|------|
| 1 | 케어 탭 → 로그인 필요 화면 | |
| 2 | 로그인 → 케어 탭 → 펫 표시 | |
| 3 | 케어 완료 버튼 → DB 저장 | |
| 4 | D-day 재계산 | |
| 5 | 기록 보기 모달 | |
| 6 | 병원 검색 (홈 탭 내) | |
| 7 | 리뷰 작성 | |
| 8 | 푸시알림 수신 | |

---

## 8. 앱 포지셔닝

### 경쟁 우위

| 기능 | 우쭈쭈 | 기존 앱 |
|------|--------|---------|
| 케어 스케줄 D-day | ✅ | ❌ |
| 케어 완료 기록 | ✅ | ❌ |
| AI 맞춤 추천 (예정) | ✅ | ❌ |
| 식단 관리 (예정) | ✅ | ❌ |
| 영수증 인증 리뷰 | ✅ | ❌ |
| 진료비 데이터 | ✅ | ❌ |
| 건강기록 | ✅ | ❌ |

### 수익 모델 (장기)
- 협력 동물병원 광고 배너
- 케어 용품 제휴 (심장사상충약 구매 링크)
- AI 프리미엄 구독

---

## 9. 스케일링

| MAU | 액션 | 비용 |
|-----|------|------|
| ~1만 | 현재 스택 유지 | 0원 |
| 1~5만 | Supabase Pro | $25/월 |
| 5만~ | Next.js 마이그레이션 | $45~70/월 |
