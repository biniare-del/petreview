/**
 * Petreview Test Agent
 *
 * Uses Claude with tool use to autonomously:
 *   A) Review source code for bugs and quality issues
 *   B) Run headless browser tests against the production site
 *   C) Validate Supabase tables, RLS policies, and storage
 *   D) Suggest design improvements, new feature ideas, UX enhancements
 *
 * Usage:
 *   node index.js               → full check (all modes)
 *   node index.js --code        → code review only
 *   node index.js --browser     → browser UI only
 *   node index.js --db          → DB/Supabase only
 *   node index.js --ideas       → design & feature ideas only (uses Opus)
 *   node index.js --model claude-opus-4-7  → override model
 */

import Anthropic from "@anthropic-ai/sdk";
import { TOOL_DEFINITIONS, runTool, browser_close } from "./tools.js";

// Support ANTHROPIC_API_KEY (x-api-key header) or ANTHROPIC_AUTH_TOKEN (Bearer header)
const client = new Anthropic();

const args = process.argv.slice(2);
const modeIdx = args.indexOf("--model");
const MODEL_OVERRIDE = modeIdx !== -1 ? args[modeIdx + 1] : null;

const RUN_IDEAS   = args.includes("--ideas");
const RUN_CODE    = args.includes("--code");
const RUN_BROWSER = args.includes("--browser");
const RUN_DB      = args.includes("--db");

// If no mode flags at all, run everything
const NO_FLAGS = !RUN_IDEAS && !RUN_CODE && !RUN_BROWSER && !RUN_DB;

const FINAL_CODE    = RUN_CODE    || NO_FLAGS;
const FINAL_BROWSER = RUN_BROWSER || NO_FLAGS;
const FINAL_DB      = RUN_DB      || NO_FLAGS;
const FINAL_IDEAS   = RUN_IDEAS   || NO_FLAGS;

// Ideas mode uses Opus by default (better suggestions). Others default to Haiku.
const DEFAULT_MODEL = FINAL_IDEAS && !FINAL_CODE && !FINAL_BROWSER && !FINAL_DB
  ? "claude-opus-4-7"
  : "claude-haiku-4-5";
const MODEL = MODEL_OVERRIDE || process.env.AGENT_MODEL || DEFAULT_MODEL;

function buildSystemPrompt() {
  const parts = [
    `You are a senior product engineer and UX consultant for "petreview" — a Korean PWA for pet owners to review animal hospitals.`,
    `Site: https://biniare-del.github.io/petreview`,
    `Stack: HTML/CSS/JS frontend, Supabase (DB/Auth/Storage), Vercel serverless, GitHub Pages hosting.`,
    ``,
    `Available tools: read source files, run headless browser, query Supabase DB.`,
    ``,
    `Tasks for this run:`,
  ];

  if (FINAL_CODE) {
    parts.push(
      ``,
      `[A] CODE REVIEW`,
      `Read the core source files: index.html, app.js, brag.html, mypage.html, mypage.js, style.css.`,
      `Look for: JS exceptions, missing error handling, broken references, XSS risks, dead code, obvious bugs.`,
      `Focus on: brag.html photo navigation, mypage.js expense date validation, app.js loadBragPreview().`,
    );
  }
  if (FINAL_BROWSER) {
    parts.push(
      ``,
      `[B] BROWSER TESTS`,
      `Navigate to the production site. Check: home page loads, key sections exist`,
      `(#brag-preview-section, bottom nav), no JS console errors, PWA manifest referenced.`,
      `Take screenshots at each step.`,
    );
  }
  if (FINAL_DB) {
    parts.push(
      ``,
      `[C] DB VALIDATION`,
      `Check tables exist (pets, reviews, hospitals, brag_posts, pet_expenses, community_posts).`,
      `Verify RLS blocks unauthenticated writes on sensitive tables. Check storage buckets.`,
    );
  }
  if (FINAL_IDEAS) {
    parts.push(
      ``,
      `[D] DESIGN & FEATURE IDEAS`,
      `Read the main files (index.html, app.js, brag.html, mypage.html, style.css) carefully.`,
      `Then think like a product manager and UX designer. Provide:`,
      `  1. 디자인 개선 아이디어: UI/UX improvements with specific suggestions (colors, layout, interactions)`,
      `  2. 신기능 아이디어: New features that would make the app more useful/engaging for Korean pet owners`,
      `  3. 사용성 개선: Flows that feel awkward or confusing, and how to fix them`,
      `  4. 성장 전략: Ideas to grow user engagement and retention`,
      `  5. 경쟁 앱 비교: What features do similar Korean apps (네이버지도, 카카오맵 리뷰) have that petreview is missing`,
      `Be specific and actionable. For each idea, explain WHY it would help.`,
    );
  }

  parts.push(
    ``,
    `Write the final report in Korean with these sections:`,
    FINAL_CODE    ? `  ## 코드 리뷰 결과` : ``,
    FINAL_BROWSER ? `  ## 브라우저 테스트 결과` : ``,
    FINAL_DB      ? `  ## DB 검증 결과` : ``,
    FINAL_IDEAS   ? `  ## 디자인 & 기능 아이디어` : ``,
    `  ## 우선순위 요약 (가장 중요한 것 Top 5)`,
    ``,
    `Be specific — mention file names, line numbers, or UI element names where relevant.`,
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
  console.log(`모드: ${modeLabels}\n`);
  console.log("─".repeat(60));

  const messages = [
    {
      role: "user",
      content: `petreview 앱 점검 및 분석을 시작해줘. 모드: ${modeLabels}. 각 항목 완료 후 최종 보고서를 한국어로 작성해줘.`,
    },
  ];

  let iteration = 0;
  const MAX_ITERATIONS = 60;

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
