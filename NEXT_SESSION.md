# 다음 세션 시작 시 자동 실행 목록

> 이 파일을 보고 있다면: 아래 순서대로 바로 실행할 것.

---

## 0. 세션 시작 시 필수 (매번)

```bash
git remote set-url origin https://<PAT_TOKEN>@github.com/biniare-del/petreview.git
```
> PAT 토큰은 GitHub Settings → Developer settings → Personal access tokens에서 확인.

⚠️ **배포**: 작업 완료 후 main 머지 + 푸시해야 사이트 반영됨.
```bash
git checkout main && git merge claude/fix-community-modal-close-6eTry --no-edit && git push origin main
git checkout claude/fix-community-modal-close-6eTry
```

작업 브랜치: `claude/fix-community-modal-close-6eTry`

⚠️ **배포할 때마다** `sw.js`의 `CACHE_NAME` 버전 올릴 것 (현재 `petreview-v2`)
→ 안 올리면 PWA 설치 사용자가 구버전 캐시 계속 사용함

---

---

## 1. 다음 우선순위 기능 (할 것)

### [ ] 단골병원 새 리뷰 푸시 알림 (D3)
- 즐겨찾기(favorites)한 병원에 새 approved 리뷰 등록 시 알림
- `api/push-cron.js`에 favorites + push_subscriptions 조인 로직 추가

### [ ] 커뮤니티 댓글 달리면 글쓴이 푸시 알림 (D4/F3)
- 내 커뮤니티 글에 댓글 달리면 알림
- `api/push-cron.js` 또는 Supabase Trigger로 구현

### [ ] 검색 결과 지도 뷰
- 카드 목록 외에 지도 핀으로 보기
- Kakao Map JS SDK 활용 (이미 API 키 있음)

---

## 2. 나중에 할 것 (규모 크거나 트래픽 필요)

| 항목 | 이유 |
|------|------|
| E1~E4 병원 관리자 계정 | 별도 role, 규모 커지면 |
| B3 카카오 OG 태그 | Vercel Edge Function 필요 |
| I2 신고자 처리결과 알림 | PWA 안정화 후 |
| Google AdSense | Analytics 붙이면서 같이 |

---

## 3. 완료된 항목 (참고용)

- [x] 병원/미용샵 상세 페이지 (hospital.html + hospital.js)
- [x] kakao_place_id 정규화 (병원 canonical ID)
- [x] 커뮤니티 신고 모달 (라디오 버튼)
- [x] 관리자 커뮤니티 글 신고 관리
- [x] 관리자 인라인 버튼 (🔒숨기기 / 🗑️삭제)
- [x] 신고처리 버튼 3개 분리 (신고만처리/리뷰숨김/리뷰삭제)
- [x] 마이펫 인라인 등록 (리뷰폼 내 이탈 없이 등록)
- [x] 영수증 없어도 됩니다 안내 (초록 박스)
- [x] 리뷰 사진 안내 문구
- [x] 업종 탭 큰 버튼 (동물병원/미용샵 테마 전환)
- [x] 마이펫 사진 메인 인사바
- [x] 미용샵 이벤트 섹션
- [x] 마이펫 사진 → 리뷰 아바타
- [x] 병원별 URL (hospital.html?kakao_id=...)
- [x] PWA (manifest, SW, 홈화면 설치)
- [x] 푸시 알림 인프라 (VAPID, push-cron.js, 구독/해제)
- [x] 건강기록 C1~C5 (진료이력/체중/처방/심장사상충/예방접종)
- [x] 병원 예약일 등록 D1
- [x] 즐겨찾기 + kakao_place_id
- [x] 커뮤니티 글/댓글 신고 (post_reports, comment_reports)
- [x] 배너/우수협력병원 테이블 (banners, partner_hospitals)
- [x] 검색 카드에 리뷰 수 + 평균 가격
- [x] 리뷰 정렬/필터 (인증순/별점순/가격순/최신순 + 동물 종류)
- [x] 이미지 확대 lightbox
- [x] 이달의 추천 섹션
- [x] 전국 시/도 + 구 검색
- [x] 마이페이지 (프로필/리뷰/커뮤니티글/마이펫/즐겨찾기)
- [x] 관리자 (영수증 검수/리뷰/신고/회원/광고 관리)
- [x] 리뷰 댓글 + 좋아요/신고/소프트삭제
- [x] Web Share API 공유 버튼
- [x] 인앱 브라우저 Google 로그인 차단 → Chrome 유도
- [x] 카카오/네이버/구글 소셜 로그인 (auth.js signInWithOAuth)
