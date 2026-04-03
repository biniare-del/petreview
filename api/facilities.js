// Vercel 서버리스 프록시 – 서울 열린데이터광장 동물병원/미용업 API
// CORS 문제를 서버 사이드에서 해결합니다.
//
// 환경변수 (Vercel 대시보드 → Settings → Environment Variables):
//   SEOUL_CERT_KEY  : 서울 열린데이터광장 인증키

const SEOUL_API_BASE = "http://openapi.seoul.go.kr:8088";

const SERVICE_ID = {
  hospital: "LOCALDATA_020301",
  grooming: "LOCALDATA_020312",
};

function extractGu(address) {
  const match = String(address || "").match(/[가-힣]+구/);
  return match ? match[0] : "";
}

export default async function handler(req, res) {
  // CORS 헤더 (GitHub Pages 등 외부 도메인에서도 호출 가능)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const certKey = process.env.SEOUL_CERT_KEY;
  if (!certKey) {
    return res.status(500).json({
      error: "SEOUL_CERT_KEY 환경변수가 설정되지 않았습니다. Vercel 대시보드 → Settings → Environment Variables에서 추가해 주세요.",
    });
  }

  const category =
    req.query.category === "grooming" ? "grooming" : "hospital";
  const region = String(req.query.region || "").trim();
  const service = SERVICE_ID[category];

  // 서울 25개 구 전체를 커버하기 위해 1000건 요청
  const apiUrl = `${SEOUL_API_BASE}/${certKey}/json/${service}/1/1000/`;

  let rows = [];
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let apiRes;
    try {
      apiRes = await fetch(apiUrl, { signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!apiRes.ok) {
      throw new Error(`Seoul API HTTP ${apiRes.status} ${apiRes.statusText}`);
    }

    const json = await apiRes.json();
    rows = json?.[service]?.row ?? [];

    if (!Array.isArray(rows)) {
      throw new Error("Seoul API 응답 형식이 예상과 다릅니다.");
    }
  } catch (err) {
    console.error("[petreview proxy] Seoul API 요청 실패:", err.message);
    return res.status(502).json({ error: `Seoul API 요청 실패: ${err.message}` });
  }

  const results = rows
    .filter((row) => {
      // 폐업(03)/취소(04) 업체 제외
      const state = String(row.TRDSTATEGBN || "");
      if (state === "03" || state === "04") return false;

      // 지역 키워드 필터
      if (region) {
        const addr = String(row.SITEWHLADDR || row.RDNWHLADDR || "");
        return addr.includes(region);
      }
      return true;
    })
    .map((row) => ({
      name: String(row.BPLCNM || "").trim(),
      category,
      region: extractGu(row.SITEWHLADDR || row.RDNWHLADDR || ""),
      address: String(row.RDNWHLADDR || row.SITEWHLADDR || "").trim(),
    }))
    .filter((item) => item.name)
    .slice(0, 30);

  // 응답 캐싱 (1시간 CDN 캐시)
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  return res.status(200).json({ results });
}
