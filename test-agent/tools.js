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
const SUPABASE_ANON_KEY = "sb_publishable_V_W2cWncw9PB1omx7V1MgQ_7zUfv_da";

// ─── A. Code Review Tools ────────────────────────────────────────────────────

export function read_file({ file_path }) {
  const abs = path.join(PROJECT_ROOT, file_path);
  if (!fs.existsSync(abs)) return { error: `File not found: ${file_path}` };
  const content = fs.readFileSync(abs, "utf-8");
  return { file_path, content: content.slice(0, 30000) }; // cap to avoid token explosion
}

export function list_files({ directory = "", extensions = [] }) {
  const abs = path.join(PROJECT_ROOT, directory);
  if (!fs.existsSync(abs)) return { error: `Directory not found: ${directory}` };

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let files = [];
    for (const e of entries) {
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
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
  // Uses information_schema via RPC or known table names
  const knownTables = [
    "pets",
    "reviews",
    "hospitals",
    "brag_posts",
    "brag_post_likes",
    "pet_expenses",
    "community_posts",
    "community_comments",
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
  // Tries to insert a row without auth — should fail with RLS error
  const supabase = getSupabase();
  const dummyRow = { id: "00000000-0000-0000-0000-000000000000" };
  const { error } = await supabase.from(table).insert(dummyRow);
  const rlsBlocking = error?.message?.includes("row-level security") || error?.code === "42501" || error?.code === "PGRST301";
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
    description: "Read a source file from the petreview project. Use to inspect HTML, JS, CSS, SQL files for code review.",
    input_schema: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "Relative path from project root, e.g. 'app.js' or 'brag.html'" },
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
        directory: { type: "string", description: "Subdirectory relative to project root (empty = root)" },
        extensions: { type: "array", items: { type: "string" }, description: "e.g. ['.js', '.html']" },
      },
    },
  },
  {
    name: "browser_navigate",
    description: "Navigate the headless browser to a URL. Defaults to the petreview production site.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full URL to navigate to (optional, defaults to production site)" },
      },
    },
  },
  {
    name: "browser_screenshot",
    description: "Take a screenshot of the current browser page and return it as base64 PNG.",
    input_schema: {
      type: "object",
      properties: {
        label: { type: "string", description: "Label for this screenshot" },
      },
    },
  },
  {
    name: "browser_click",
    description: "Click an element by CSS selector or visible text.",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector" },
        text: { type: "string", description: "Visible text to find and click" },
      },
    },
  },
  {
    name: "browser_get_text",
    description: "Get the inner text of an element.",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector" },
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
        selectors: { type: "array", items: { type: "string" }, description: "List of CSS selectors to check" },
      },
      required: ["selectors"],
    },
  },
  {
    name: "browser_evaluate",
    description: "Run a JavaScript expression in the browser page context and return the result.",
    input_schema: {
      type: "object",
      properties: {
        script: { type: "string", description: "JS expression string, e.g. 'document.title' or 'localStorage.getItem(\"sb-token\")'" },
      },
      required: ["script"],
    },
  },
  {
    name: "db_list_tables",
    description: "List known Supabase tables and their row counts (using anon key, so RLS applies).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "db_query",
    description: "Query rows from a Supabase table.",
    input_schema: {
      type: "object",
      properties: {
        table: { type: "string", description: "Table name" },
        select: { type: "string", description: "Columns to select (default *)" },
        limit: { type: "number", description: "Max rows (default 5)" },
        filters: { type: "object", description: "Key-value equality filters" },
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
    browser_screenshot,
    browser_click,
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
