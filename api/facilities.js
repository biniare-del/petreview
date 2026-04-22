// Vercel 서버리스 프록시 – 카카오 로컬 API 키워드 검색
// API 키를 서버 사이드에서 관리해 클라이언트에 노출되지 않습니다.
//
// 환경변수 (Vercel 대시보드 → Settings → Environment Variables):
//   KAKAO_REST_API_KEY : 카카오 REST API 키
//
// 호출 예시:
//   /api/facilities?category=hospital&region=마포구
//   /api/facilities?category=grooming&region=강남구

const KAKAO_REST_API_KEY =
  process.env.KAKAO_REST_API_KEY || "9e5930005d619cae98c2d710200b768f";

function extractDistrict(address) {
  const addr = String(address || "");
  const match = addr.match(/[가-힣]+[구군시](?!\s*[가-힣]+[구군시])/);
  return match ? match[0] : "";
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const category =
    req.query.category === "grooming" ? "grooming" : "hospital";
  const region = String(req.query.region || "").trim();
  const keyword = String(req.query.keyword || "").trim();

  const categoryKeyword = category === "grooming" ? "애견미용" : "동물병원";

  // [자동완성] keyword 있을 때: "키워드 동물병원" / "키워드 애견미용"
  // [일반 검색] keyword 없을 때: 기존 지역+카테고리 방식 유지
  const query = keyword
    ? `${keyword} ${categoryKeyword}`
    : region
    ? `${region} ${categoryKeyword}`
    : `${categoryKeyword}`;

  // Kakao size 최대 15 — 3페이지 × 15건 = 최대 45건 (is_end 시 조기 종료)
  const maxPages = 3;

  const allDocuments = [];
  try {
    for (let page = 1; page <= maxPages; page++) {
      const params = new URLSearchParams({ query, size: "15", page: String(page) });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      let apiRes;
      try {
        apiRes = await fetch(
          `https://dapi.kakao.com/v2/local/search/keyword.json?${params}`,
          {
            headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
            signal: controller.signal,
          }
        );
      } finally {
        clearTimeout(timeoutId);
      }

      if (!apiRes.ok) {
        throw new Error(`Kakao API HTTP ${apiRes.status} ${apiRes.statusText}`);
      }

      const json = await apiRes.json();
      const documents = json?.documents ?? [];
      allDocuments.push(...documents);

      // 마지막 페이지면 더 이상 요청하지 않음
      if (json?.meta?.is_end) break;
    }

    // 서버 정렬 제거 — 클라이언트에서 이름 일치 우선 정렬 처리
    const results = allDocuments.map((doc) => ({
      kakaoId: doc.id || "",
      name: doc.place_name,
      category,
      region: extractDistrict(doc.address_name || doc.road_address_name || ""),
      address: doc.road_address_name || doc.address_name || "",
      phone: doc.phone || "",
      lat: parseFloat(doc.y) || null,
      lng: parseFloat(doc.x) || null,
    }));

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ results });
  } catch (err) {
    console.error("[petreview proxy] Kakao API 요청 실패:", err.message);
    return res.status(502).json({ error: `Kakao API 요청 실패: ${err.message}` });
  }
}
