/**
 * Petreview Test Agent
 *
 * Uses Claude (Haiku by default — cheap) with tool use to autonomously:
 *   A) Review source code for bugs and quality issues
 *   B) Run headless browser tests against the production site
 *   C) Validate Supabase tables, RLS policies, and storage
 *
 * Usage:
 *   node index.js                        → full check (all three)
 *   node index.js --code                 → code review only
 *   node index.js --browser              → browser UI only
 *   node index.js --db                   → DB/Supabase only
 *   node index.js --model claude-opus-4-7 → use a specific model
 *
 * API key:
 *   export ANTHROPIC_API_KEY=sk-ant-...  (from console.anthropic.com)
 *   Running with the Claude Code session token shares the session rate limit.
 */

import Anthropic from "@anthropic-ai/sdk";
import { TOOL_DEFINITIONS, runTool, browser_close } from "./tools.js";

const client = new Anthropic();

const args = process.argv.slice(2);
const MODE_CODE    = args.includes("--code")    || (!args.includes("--browser") && !args.includes("--db") && args.every(a => a.startsWith("--model") || args[args.indexOf(a)-1]==="--model"));
const MODE_BROWSER = args.includes("--browser") || (!args.includes("--code") && !args.includes("--db") && args.every(a => a.startsWith("--model") || args[args.indexOf(a)-1]==="--model"));
const MODE_DB      = args.includes("--db")      || (!args.includes("--code") && !args.includes("--browser") && args.every(a => a.startsWith("--model") || args[args.indexOf(a)-1]==="--model"));

const modeIdx = args.indexOf("--model");
const MODEL = modeIdx !== -1 ? args[modeIdx + 1] : (process.env.AGENT_MODEL || "claude-haiku-4-5");

// When no mode flag given, run all three
const NO_MODE_FLAGS = !args.includes("--code") && !args.includes("--browser") && !args.includes("--db");
const RUN_CODE    = args.includes("--code")    || NO_MODE_FLAGS;
const RUN_BROWSER = args.includes("--browser") || NO_MODE_FLAGS;
const RUN_DB      = args.includes("--db")      || NO_MODE_FLAGS;

function buildSystemPrompt() {
  const parts = [
    `You are a thorough QA engineer and code reviewer for "petreview", a Korean pet review PWA.`,
    `The project lives at https://biniare-del.github.io/petreview`,
    `Source code is in the project root (HTML/CSS/JS + Supabase SQL files).`,
    `Supabase project: https://hguzornmqxayylmagook.supabase.co`,
    ``,
    `You have tools to:`,
    `  - Read source files (read_file, list_files)`,
    `  - Control a headless browser (browser_navigate, browser_screenshot, browser_click, etc.)`,
    `  - Query the live Supabase DB (db_list_tables, db_query, db_check_rls, storage_list_buckets)`,
    ``,
    `Your job today:`,
  ];

  if (RUN_CODE) {
    parts.push(
      `A. CODE REVIEW: Read the main source files (index.html, app.js, brag.html, mypage.html, mypage.js, style.css).`,
      `   Look for: JS errors/exceptions, missing error handling, broken references, XSS risks,`,
      `   accessibility issues, dead code, and any obvious bugs. Pay special attention to:`,
      `   - brag.html photo upload and navigation logic`,
      `   - mypage.js expense tracker (date validation, category logic)`,
      `   - app.js loadBragPreview() and pet stats`,
    );
  }
  if (RUN_BROWSER) {
    parts.push(
      `B. BROWSER TESTS: Navigate to the production site and check:`,
      `   1. Home page loads with correct sections visible`,
      `   2. Navigation links work (뽐내기, 마이페이지 tabs)`,
      `   3. Key UI elements exist (#brag-preview-section, .brag-pv-card, etc.)`,
      `   4. No JavaScript console errors visible via evaluate`,
      `   5. PWA manifest is referenced`,
      `   Take screenshots at each major step.`,
    );
  }
  if (RUN_DB) {
    parts.push(
      `C. DB VALIDATION: Check:`,
      `   1. All expected tables exist and are readable (or correctly RLS-blocked)`,
      `   2. RLS is enabled on sensitive tables (pets, reviews, brag_posts, pet_expenses)`,
      `   3. Storage buckets exist (pet-photos)`,
      `   4. Public tables (hospitals) are readable without auth`,
    );
  }

  parts.push(
    ``,
    `After completing all checks, write a structured report with sections:`,
    `  ## 코드 리뷰 결과` + (RUN_CODE ? "" : " (skipped)"),
    `  ## 브라우저 테스트 결과` + (RUN_BROWSER ? "" : " (skipped)"),
    `  ## DB 검증 결과` + (RUN_DB ? "" : " (skipped)"),
    `  ## 발견된 버그/이슈 요약 (numbered list)`,
    `  ## 권장 수정사항`,
    ``,
    `Use Korean for the report. Be specific — include file names and line ranges when relevant.`,
  );

  return parts.join("\n");
}

async function runAgent() {
  console.log("🐾 Petreview Test Agent 시작\n");
  console.log(`모델: ${MODEL}`);
  console.log(`모드: ${[RUN_CODE && "코드리뷰", RUN_BROWSER && "브라우저", RUN_DB && "DB검증"].filter(Boolean).join(" + ")}\n`);
  console.log("─".repeat(60));

  const messages = [
    {
      role: "user",
      content: "petreview 앱 전체 점검을 시작해줘. 설정된 모드에 따라 코드리뷰, 브라우저 테스트, DB 검증을 순서대로 진행하고 최종 보고서를 한국어로 작성해줘.",
    },
  ];

  let iteration = 0;
  const MAX_ITERATIONS = 50;

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    const useThinking = MODEL.includes("opus") || MODEL.includes("sonnet");
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 4096,
      ...(useThinking ? { thinking: { type: "adaptive" } } : {}),
      system: buildSystemPrompt(),
      tools: TOOL_DEFINITIONS,
      messages,
    });

    // Stream text output live
    stream.on("text", (text) => process.stdout.write(text));

    const response = await stream.finalMessage();

    // Append assistant response to conversation
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

    // Execute all tool calls
    const toolResults = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;

      const { id, name, input } = block;
      console.log(`\n🔧 [${name}] ${JSON.stringify(input).slice(0, 120)}`);

      const result = await runTool(name, input);

      // Don't log full file contents — just a summary
      if (name === "read_file" && result.content) {
        console.log(`   → ${result.content.split("\n").length} lines read`);
      } else if (name === "browser_screenshot") {
        console.log(`   → screenshot captured (${result.image_base64?.length || 0} bytes base64)`);
      } else {
        const preview = JSON.stringify(result).slice(0, 200);
        console.log(`   → ${preview}`);
      }

      const content =
        name === "browser_screenshot" && result.image_base64
          ? [
              {
                type: "image",
                source: { type: "base64", media_type: "image/png", data: result.image_base64 },
              },
              { type: "text", text: `Screenshot taken. URL: ${result.url}` },
            ]
          : JSON.stringify(result);

      toolResults.push({ type: "tool_result", tool_use_id: id, content });
    }

    messages.push({ role: "user", content: toolResults });
  }

  if (iteration >= MAX_ITERATIONS) {
    console.log("\n⚠️ 최대 반복 횟수 도달. 에이전트 중단.");
  }

  await browser_close();
}

runAgent().catch((err) => {
  console.error("에이전트 오류:", err);
  process.exit(1);
});
