/**
 * Petreview Test Agent
 *
 * Claude tool use로 자율적으로:
 *   A) 소스코드 버그·품질 리뷰
 *   B) 헤드리스 브라우저 UI 테스트 (비로그인 + 로그인)
 *   C) Supabase 테이블·RLS·스토리지 검증
 *   D) 디자인·기능 아이디어 제안
 *
 * Usage:
 *   node index.js               → 전체 (A+B+C)
 *   node index.js --code        → 코드 리뷰만
 *   node index.js --browser     → 브라우저 테스트만
 *   node index.js --db          → DB 검증만
 *   node index.js --ideas       → 아이디어 제안만 (Opus 사용)
 *   node index.js --model claude-opus-4-8  → 모델 오버라이드
 */

import Anthropic from "@anthropic-ai/sdk";
import { TOOL_DEFINITIONS, runTool, browser_close } from "./tools.js";

const client = new Anthropic();

const args = process.argv.slice(2);
const modeIdx = args.indexOf("--model");
const MODEL_OVERRIDE = modeIdx !== -1 ? args[modeIdx + 1] : null;

const RUN_IDEAS   = args.includes("--ideas");
const RUN_CODE    = args.includes("--code");
const RUN_BROWSER = args.includes("--browser");
const RUN_DB      = args.includes("--db");

const NO_FLAGS = !RUN_IDEAS && !RUN_CODE && !RUN_BROWSER && !RUN_DB;

const FINAL_CODE    = RUN_CODE    || NO_FLAGS;
const FINAL_BROWSER = RUN_BROWSER || NO_FLAGS;
const FINAL_DB      = RUN_DB      || NO_FLAGS;
const FINAL_IDEAS   = RUN_IDEAS;

const DEFAULT_MODEL = RUN_IDEAS ? "claude-opus-4-8" : "claude-haiku-4-5-20251001";
const MODEL = MODEL_OVERRIDE || process.env.AGENT_MODEL || DEFAULT_MODEL;

const HAS_TEST_ACCOUNT = !!(process.env.TEST_EMAIL && process.env.TEST_PASSWORD);

function buildSystemPrompt() {
  const parts = [
    `당신은 "우쭈쭈(petreview)" PWA의 선임 QA 엔지니어입니다.`,
    ``,
    `## 앱 정보`,
    `- 사이트: https://biniare-del.github.io/petreview/care.html`,
    `- 스택: HTML/CSS/Vanilla JS 프론트엔드, Supabase(DB/Auth/Storage), Vercel 서버리스, GitHub Pages 호스팅`,
    ``,
    `## 주요 페이지`,
    `- care.html: 메인 앱 (케어루틴·식단·건강기록·집사영수증 탭)`,
    `- social.html: 커뮤니티 피드 (글쓰기·댓글·좋아요)`,
    `- mypage.html: 마이페이지 (펫 관리·체중 기록·건강기록·알림 설정)`,
    `- hospital.html: 단골병원 관리`,
    `- index.html: 동물병원 찾기 (리뷰 기능)`,
    ``,
    `## Supabase 테이블`,
    `pets, pet_care_logs, pet_diet_settings, pet_diet_logs, pet_weights,`,
    `pet_health_records, pet_expenses, favorites, push_subscriptions,`,
    `posts, post_likes, comments, profiles`,
    ``,
    `## 주요 기능 (테스트 대상)`,
    `1. 비로그인 데모 모드: care.html 접속 시 데모 펫으로 UI 확인 가능`,
    `2. 케어루틴 탭: 9종 케어 항목 그리드, D-day 상태, 완료 버튼`,
    `3. 식단 탭: 식사/수분/간식 기록, 칼로리 계산, 식단 설정 저장`,
    `4. 건강기록 탭: 체중 추가, 라인 차트, 진료 기록`,
    `5. 집사영수증 탭: 지출 추가, 월별 통계`,
    `6. 소셜 피드: 글 목록, 태그 필터, 글쓰기 모달`,
    `7. 마이페이지: 펫 추가, 프로필 히어로 카드`,
    ``,
    `## 테스트 계정`,
    HAS_TEST_ACCOUNT
      ? `TEST_EMAIL / TEST_PASSWORD 환경변수가 설정되어 있습니다. browser_login 도구로 로그인 후 인증 필요 기능을 테스트하세요.`
      : `테스트 계정 없음. 비로그인 범위만 테스트합니다.`,
  ];

  if (FINAL_CODE) {
    parts.push(
      ``,
      `## [A] 코드 리뷰 지침`,
      `아래 파일들을 읽고 버그·보안 취약점·성능 문제를 찾으세요:`,
      `- care.js: renderDietSection, saveDietSettings, fetchPetHealthData, fetchAiAdvice`,
      `- mypage.js: loadWeightLogs, renderWeightChart, loadHealthRecords`,
      `- social.js: compressImage, submitPost`,
      `- auth.js: signInWithGoogle, _initOfflineUX`,
      `중점 확인: null 접근, 테이블명 오타, async/await 누락, XSS 위험, 테이블명 불일치`,
    );
  }

  if (FINAL_BROWSER) {
    parts.push(
      ``,
      `## [B] 브라우저 테스트 지침`,
      ``,
      `### 비로그인 테스트 (항상 실행)`,
      `1. care.html 접속 → 데모 모드 진입 확인`,
      `2. 케어루틴 탭: 케어 그리드 9개 항목 표시 확인`,
      `3. 식단 탭: 식사 버튼 표시 확인`,
      `4. social.html 접속 → 피드 로드 확인`,
      `5. 각 페이지 JS 콘솔 에러 없는지 browser_evaluate로 확인`,
      ``,
      HAS_TEST_ACCOUNT ? `### 로그인 테스트 (browser_login 사용)
6. care.html 로그인 → 실제 펫 탭 표시 확인
7. 식단 탭: 식단 설정 저장 → 리로드 후 유지 확인
8. mypage.html → 프로필 히어로 카드 표시 확인
9. hospital.html → 단골병원 목록 표시 확인` : `로그인 테스트: 환경변수 없어서 생략`,
      ``,
      `각 단계마다 browser_screenshot으로 스크린샷 찍고 이상 여부 판단하세요.`,
      `browser_evaluate로 console.error 확인: window.__errors = []; window.onerror = (m) => window.__errors.push(m);`,
    );
  }

  if (FINAL_DB) {
    parts.push(
      ``,
      `## [C] DB 검증 지침`,
      `1. db_list_tables로 모든 테이블 접근성 확인`,
      `2. 민감 테이블 RLS 확인: pets, pet_expenses, pet_health_records, push_subscriptions`,
      `3. storage_list_buckets로 스토리지 버킷 확인 (pet-photos 등)`,
      `4. posts 테이블 최근 데이터 샘플 조회`,
    );
  }

  if (FINAL_IDEAS) {
    parts.push(
      ``,
      `## [D] 아이디어 지침`,
      `소스 파일을 읽은 뒤 아래 관점에서 구체적 개선안을 제안하세요:`,
      `1. UX 개선: 어색한 플로우, 접근성 문제`,
      `2. 신기능: 한국 반려동물 앱 사용자에게 유용한 기능`,
      `3. 성능: 렌더링 병목, 불필요한 API 호출`,
      `4. 경쟁 분석: 유사 앱 대비 차별화 포인트`,
    );
  }

  parts.push(
    ``,
    `## 최종 보고서 형식 (한국어)`,
    FINAL_CODE    ? `### 코드 리뷰 결과\n심각도별 이슈 목록 (높음/중간/낮음), 파일명·줄번호 포함` : "",
    FINAL_BROWSER ? `### 브라우저 테스트 결과\n페이지별 ✅ 정상 / ❌ 오류 / ⚠️ 경고` : "",
    FINAL_DB      ? `### DB 검증 결과\n테이블 접근성·RLS 상태 표` : "",
    FINAL_IDEAS   ? `### 아이디어 제안\n우선순위순 Top 5` : "",
    `### 우선순위 요약\n가장 중요한 액션 아이템 Top 5`,
  );

  return parts.filter(Boolean).join("\n");
}

async function runAgent() {
  const modeLabels = [
    FINAL_CODE    && "코드리뷰",
    FINAL_BROWSER && "브라우저",
    FINAL_DB      && "DB검증",
    FINAL_IDEAS   && "아이디어",
  ].filter(Boolean).join(" + ");

  console.log("🐾 Petreview Test Agent 시작\n");
  console.log(`모델: ${MODEL}`);
  console.log(`모드: ${modeLabels}`);
  console.log(`테스트 계정: ${HAS_TEST_ACCOUNT ? "✅ 있음" : "❌ 없음 (비로그인만 테스트)"}\n`);
  console.log("─".repeat(60));

  const messages = [
    {
      role: "user",
      content: `petreview 앱 점검을 시작해줘. 모드: ${modeLabels}. 각 항목 완료 후 최종 보고서를 한국어로 작성해줘.`,
    },
  ];

  let iteration = 0;
  const MAX_ITERATIONS = 80;

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    const useThinking = MODEL.includes("opus") || MODEL.includes("sonnet");
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 8192,
      ...(useThinking ? { thinking: { type: "adaptive" } } : {}),
      system: buildSystemPrompt(),
      tools: TOOL_DEFINITIONS,
      messages,
    });

    stream.on("text", (text) => process.stdout.write(text));

    const response = await stream.finalMessage();
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") {
      console.log("\n\n" + "─".repeat(60));
      console.log("✅ 에이전트 작업 완료");
      break;
    }

    if (response.stop_reason !== "tool_use") {
      console.log(`\n⚠️ Unexpected stop_reason: ${response.stop_reason}`);
      break;
    }

    const toolResults = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;

      const { id, name, input } = block;
      console.log(`\n🔧 [${name}] ${JSON.stringify(input).slice(0, 120)}`);

      const result = await runTool(name, input);

      if (name === "read_file" && result.content) {
        console.log(`   → ${result.content.split("\n").length} lines read`);
      } else if (name === "browser_screenshot") {
        console.log(`   → screenshot captured`);
      } else {
        console.log(`   → ${JSON.stringify(result).slice(0, 200)}`);
      }

      const content =
        name === "browser_screenshot" && result.image_base64
          ? [
              { type: "image", source: { type: "base64", media_type: "image/png", data: result.image_base64 } },
              { type: "text", text: `Screenshot taken. URL: ${result.url}` },
            ]
          : JSON.stringify(result);

      toolResults.push({ type: "tool_result", tool_use_id: id, content });
    }

    messages.push({ role: "user", content: toolResults });
  }

  if (iteration >= MAX_ITERATIONS) {
    console.log("\n⚠️ 최대 반복 횟수 도달.");
  }

  await browser_close();
}

runAgent().catch((err) => {
  console.error("에이전트 오류:", err);
  process.exit(1);
});
