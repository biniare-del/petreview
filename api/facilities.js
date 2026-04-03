/**
 * GET /api/facilities?category=hospital|grooming&region=마포구
 * 서울 열린데이터광장(LOCALDATA) 프록시 — 인증키는 Vercel 환경변수에만 둡니다.
 *
 * 환경변수:
 * - SEOUL_OPEN_API_KEY (필수): openapi.seoul.go.kr 인증키
 * - SEOUL_OPEN_API_BASE (선택): 기본 http://openapi.seoul.go.kr:8088
 */

const DEFAULT_BASE = "http://openapi.seoul.go.kr:8088";
const SERVICE_HOSPITAL = "LOCALDATA_020301";
const SERVICE_GROOMING = "LOCALDATA_020312";

const NAME_KEYS = [
  "사업장명",
  "상호명",
  "기관명",
  "병원명",
  "업소명",
  "명칭",
  "시설명",
  "BPLC_NM",
  "bplcNm",
];
const REGION_KEYS = [
  "시군명",
  "자치구명",
  "구명",
  "지역",
  "행정구역",
  "시도명",
];
const ADDRESS_KEYS = [
  "주소",
  "소재지",
  "도로명주소",
  "지번주소",
  "도로명",
  "지번",
  "RDN_WHL_ADDR",
  "rdnWhlAddr",
];

function normalizeCategory(q) {
  if (q === "grooming") return "grooming";
  return "hospital";
}

function normalizeGu(text) {
  const s = String(text || "").trim();
  if (!s) return "";
  const m = s.match(/[가-힣A-Za-z0-9]+구/);
  return m ? m[0] : s;
}

function pickField(row, keys) {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

function extractRows(payload, service) {
  const block = payload && payload[service];
  if (!block) return [];
  const row = block.row;
  if (!row) return [];
  return Array.isArray(row) ? row : [row];
}

function mapRow(row, category) {
  const name = pickField(row, NAME_KEYS);
  const region = normalizeGu(pickField(row, REGION_KEYS));
  const address = pickField(row, ADDRESS_KEYS);
  return {
    id: `${name || "unknown"}-${region || "unknown"}`,
    name,
    category,
    region,
    address,
  };
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const category = normalizeCategory(
    typeof req.query.category === "string" ? req.query.category : ""
  );
  const regionKeyword = String(req.query.region || "").trim();

  const key =
    process.env.SEOUL_OPEN_API_KEY ||
    process.env.PETREVIEW_SEOUL_CERT_KEY ||
    "";
  if (!key) {
    return res.status(503).json({
      error: "Server misconfiguration",
      message: "SEOUL_OPEN_API_KEY is not set",
      facilities: [],
    });
  }

  const base = (process.env.SEOUL_OPEN_API_BASE || DEFAULT_BASE).replace(
    /\/$/,
    ""
  );
  const service =
    category === "hospital" ? SERVICE_HOSPITAL : SERVICE_GROOMING;
  const start = 1;
  const end = 100;
  const url = `${base}/${key}/json/${service}/${start}/${end}/`;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12000);

  let upstream;
  try {
    upstream = await fetch(url, { method: "GET", signal: controller.signal });
  } catch (e) {
    clearTimeout(t);
    const msg = e && e.name === "AbortError" ? "Upstream timeout" : String(e);
    return res.status(502).json({
      error: "Upstream fetch failed",
      message: msg,
      facilities: [],
    });
  } finally {
    clearTimeout(t);
  }

  if (!upstream.ok) {
    return res.status(502).json({
      error: "Upstream error",
      status: upstream.status,
      facilities: [],
    });
  }

  let payload;
  try {
    payload = await upstream.json();
  } catch {
    return res.status(502).json({
      error: "Invalid JSON from upstream",
      facilities: [],
    });
  }

  const rows = extractRows(payload, service);
  let facilities = rows
    .map((row) => mapRow(row, category))
    .filter((x) => x.name);

  if (regionKeyword) {
    facilities = facilities.filter((x) =>
      String(x.region || "").includes(regionKeyword)
    );
  }

  facilities = facilities.slice(0, 24);

  return res.status(200).json({ facilities });
};
