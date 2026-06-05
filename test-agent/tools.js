/**
 * Tool implementations for the petreview test agent.
 * Three categories: code review, browser UI, Supabase DB.
 */

import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const SITE_URL = "https://biniare-del.github.io/petreview";
const SUPABASE_URL = "https://hguzornmqxayylmagook.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_V_W2cWncw9PB1omx7V1MgQ_7zUfv_da";

// ─── A. Code Review Tools ────────────────────────────────────────────────────

export function read_file({ file_path }) {
  const abs = path.join(PROJECT_ROOT, file_path);
  if (!fs.existsSync(abs)) return { error: `File not found: ${file_path}` };
  const content = fs.readFileSync(abs, "utf-8");
  return { file_path, content: content.slice(0, 30000) };
}

export function list_files({ directory = "", extensions = [] }) {
  const abs = path.join(PROJECT_ROOT, directory);
  if (!fs.existsSync(abs)) return { error: `Directory not found: ${directory}` };

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let files = [];
    for (const e of entries) {
      if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "test-agent") continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) files = files.concat(walk(full));
      else files.push(path.relative(PROJECT_ROOT, full));
    }
    return files;
  }

  let files = walk(abs);
  if (extensions.length > 0) {
    files = files.filter((f) => extensions.some((ext) => f.endsWith(ext)));
  }
  return { files };
}

// ─── B. Browser UI Tools ─────────────────────────────────────────────────────

let _browser = null;
let _page = null;
let _browserUnavailable = false;

async function getBrowserPage() {
  if (_browserUnavailable) throw new Error("Browser not available (run: npm run install-browsers)");
  if (!_browser) {
    const execPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
    _browser = await chromium.launch({ headless: true, executablePath: execPath }).catch((e) => {
      _browserUnavailable = true;
      throw new Error(`Browser launch failed: ${e.message}. Run: cd test-agent && npm run install-browsers`);
    });
  }
  if (!_page || _page.isClosed()) {
    const ctx = await _browser.newContext({
      viewport: { width: 390, height: 844 }, // iPhone 14 Pro
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    _page = await ctx.newPage();
  }
  return _page;
}

export async function browser_navigate({ url }) {
  const page = await getBrowserPage();
  const target = url || SITE_URL;
  const resp = await page.goto(target, { waitUntil: "networkidle", timeout: 30000 }).catch((e) => ({ error: e.message }));
  if (resp?.error) return resp;
  const title = await page.title();
  const currentUrl = page.url();
  return { navigated_to: currentUrl, title };
}

export async function browser_screenshot({ label = "screenshot" }) {
  const page = await getBrowserPage();
  const buffer = await page.screenshot({ fullPage: false });
  const b64 = buffer.toString("base64");
  return {
    label,
    image_base64: b64,
    url: page.url(),
    note: "PNG screenshot encoded as base64",
  };
}

export async function browser_click({ selector, text }) {
  const page = await getBrowserPage();
  try {
    if (text) {
      await page.getByText(text, { exact: false }).first().click({ timeout: 8000 });
    } else {
      await page.locator(selector).first().click({ timeout: 8000 });
    }
    await page.waitForTimeout(800);
    return { clicked: selector || text, url: page.url() };
  } catch (e) {
    return { error: e.message };
  }
}

export async function browser_fill({ selector, value }) {
  const page = await getBrowserPage();
  try {
    await page.locator(selector).first().fill(value, { timeout: 8000 });
    await page.waitForTimeout(300);
    return { filled: selector, value };
  } catch (e) {
    return { error: e.message };
  }
}

export async function browser_wait_for({ selector, timeout = 8000 }) {
  const page = await getBrowserPage();
  try {
    await page.locator(selector).first().waitFor({ state: "visible", timeout });
    return { appeared: selector };
  } catch (e) {
    return { error: `Timed out waiting for: ${selector}` };
  }
}

export async function browser_get_text({ selector }) {
  const page = await getBrowserPage();
  try {
    const el = page.locator(selector).first();
    const text = await el.innerText({ timeout: 5000 });
    return { selector, text };
  } catch (e) {
    return { error: e.message };
  }
}

export async function browser_check_elements({ selectors }) {
  const page = await getBrowserPage();
  const results = {};
  for (const sel of selectors) {
    try {
      const count = await page.locator(sel).count();
      const visible = count > 0 ? await page.locator(sel).first().isVisible() : false;
      results[sel] = { count, visible };
    } catch (e) {
      results[sel] = { error: e.message };
    }
  }
  return { url: page.url(), elements: results };
}

export async function browser_evaluate({ script }) {
  const page = await getBrowserPage();
  try {
    const result = await page.evaluate(script);
    return { result };
  } catch (e) {
    return { error: e.message };
  }
}

// Supabase 이메일/패스워드로 로그인해서 브라우저 세션에 주입
export async function browser_login({ email, password }) {
  const resolvedEmail    = email    || process.env.TEST_EMAIL;
  const resolvedPassword = password || process.env.TEST_PASSWORD;
  if (!resolvedEmail || !resolvedPassword) {
    return { error: "TEST_EMAIL / TEST_PASSWORD 환경변수가 없습니다." };
  }

  // Supabase REST API로 직접 로그인
  try {
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: resolvedEmail, password: resolvedPassword }),
    });
    const session = await resp.json();
    if (session.error || !session.access_token) {
      return { error: session.error_description || session.error || "로그인 실패" };
    }

    // 브라우저 localStorage에 Supabase 세션 주입
    const page = await getBrowserPage();
    const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
    const storageKey = `sb-${projectRef}-auth-token`;
    await page.evaluate(({ key, val }) => {
      localStorage.setItem(key, JSON.stringify(val));
    }, { key: storageKey, val: session });

    // 페이지 리로드해서 세션 적용
    await page.reload({ waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(1000);

    return { logged_in: true, email: resolvedEmail };
  } catch (e) {
    return { error: e.message };
  }
}

export async function browser_close() {
  if (_browser) {
    await _browser.close();
    _browser = null;
    _page = null;
  }
  return { closed: true };
}

// ─── C. Supabase / DB Tools ──────────────────────────────────────────────────

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export async function db_list_tables() {
  const knownTables = [
    "pets",
    "pet_care_logs",
    "pet_diet_settings",
    "pet_diet_logs",
    "pet_weights",
    "pet_health_records",
    "pet_expenses",
    "favorites",
    "push_subscriptions",
    "posts",
    "post_likes",
    "comments",
    "profiles",
  ];
  const supabase = getSupabase();
  const results = {};
  for (const table of knownTables) {
    const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
    results[table] = error ? { error: error.message } : { row_count: count };
  }
  return { tables: results };
}

export async function db_query({ table, select = "*", limit = 5, filters = {} }) {
  const supabase = getSupabase();
  let q = supabase.from(table).select(select).limit(limit);
  for (const [col, val] of Object.entries(filters)) {
    q = q.eq(col, val);
  }
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { table, rows: data, count: data?.length };
}

export async function db_check_rls({ table }) {
  const supabase = getSupabase();
  const dummyRow = { id: "00000000-0000-0000-0000-000000000000" };
  const { error } = await supabase.from(table).insert(dummyRow);
  const rlsBlocking =
    error?.message?.includes("row-level security") ||
    error?.code === "42501" ||
    error?.code === "PGRST301";
  return {
    table,
    rls_blocking_unauthenticated_insert: rlsBlocking,
    error_message: error?.message || null,
  };
}

export async function storage_list_buckets() {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.listBuckets();
  if (error) return { error: error.message };
  return { buckets: data?.map((b) => ({ id: b.id, name: b.name, public: b.public })) };
}

// ─── Tool dispatcher ─────────────────────────────────────────────────────────

export const TOOL_DEFINITIONS = [
  {
    name: "read_file",
    description: "Read a source file from the petreview project.",
    input_schema: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "Relative path from project root, e.g. 'care.js' or 'social.html'" },
      },
      required: ["file_path"],
    },
  },
  {
    name: "list_files",
    description: "List files in the project directory, optionally filtered by extension.",
    input_schema: {
      type: "object",
      properties: {
        directory: { type: "string" },
        extensions: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "browser_navigate",
    description: "Navigate the headless browser to a URL.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string" },
      },
    },
  },
  {
    name: "browser_login",
    description: "Supabase 이메일/패스워드로 로그인해서 브라우저 세션에 주입. 로그인이 필요한 기능 테스트 전에 반드시 호출.",
    input_schema: {
      type: "object",
      properties: {
        email:    { type: "string", description: "테스트 계정 이메일 (미입력시 TEST_EMAIL 환경변수 사용)" },
        password: { type: "string", description: "테스트 계정 비밀번호 (미입력시 TEST_PASSWORD 환경변수 사용)" },
      },
    },
  },
  {
    name: "browser_screenshot",
    description: "Take a screenshot of the current browser page.",
    input_schema: {
      type: "object",
      properties: {
        label: { type: "string" },
      },
    },
  },
  {
    name: "browser_click",
    description: "Click an element by CSS selector or visible text.",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        text:     { type: "string" },
      },
    },
  },
  {
    name: "browser_fill",
    description: "Fill an input field with a value.",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector for the input element" },
        value:    { type: "string", description: "Value to type into the field" },
      },
      required: ["selector", "value"],
    },
  },
  {
    name: "browser_wait_for",
    description: "Wait for a CSS selector to appear and be visible.",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        timeout:  { type: "number", description: "Milliseconds (default 8000)" },
      },
      required: ["selector"],
    },
  },
  {
    name: "browser_get_text",
    description: "Get the inner text of an element.",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string" },
      },
      required: ["selector"],
    },
  },
  {
    name: "browser_check_elements",
    description: "Check if multiple CSS selectors exist and are visible on the page.",
    input_schema: {
      type: "object",
      properties: {
        selectors: { type: "array", items: { type: "string" } },
      },
      required: ["selectors"],
    },
  },
  {
    name: "browser_evaluate",
    description: "Run a JavaScript expression in the browser page context.",
    input_schema: {
      type: "object",
      properties: {
        script: { type: "string" },
      },
      required: ["script"],
    },
  },
  {
    name: "db_list_tables",
    description: "List known Supabase tables and their row counts.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "db_query",
    description: "Query rows from a Supabase table.",
    input_schema: {
      type: "object",
      properties: {
        table:   { type: "string" },
        select:  { type: "string" },
        limit:   { type: "number" },
        filters: { type: "object" },
      },
      required: ["table"],
    },
  },
  {
    name: "db_check_rls",
    description: "Check if a table's RLS blocks unauthenticated inserts.",
    input_schema: {
      type: "object",
      properties: {
        table: { type: "string" },
      },
      required: ["table"],
    },
  },
  {
    name: "storage_list_buckets",
    description: "List Supabase Storage buckets.",
    input_schema: { type: "object", properties: {} },
  },
];

export async function runTool(name, input) {
  const toolMap = {
    read_file,
    list_files,
    browser_navigate,
    browser_login,
    browser_screenshot,
    browser_click,
    browser_fill,
    browser_wait_for,
    browser_get_text,
    browser_check_elements,
    browser_evaluate,
    db_list_tables,
    db_query,
    db_check_rls,
    storage_list_buckets,
  };
  const fn = toolMap[name];
  if (!fn) return { error: `Unknown tool: ${name}` };
  try {
    return await fn(input);
  } catch (e) {
    return { error: e.message };
  }
}
