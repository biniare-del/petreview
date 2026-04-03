module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed", results: [] });
  }

  const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY || "";
  if (!KAKAO_REST_API_KEY) {
    return res.status(503).json({
      error: "KAKAO_REST_API_KEY is not set",
      results: [],
    });
  }

  const category = req.query.category === "grooming" ? "grooming" : "hospital";
  const region = String(req.query.region || "").trim();
  const categoryKeyword = category === "grooming" ? "동물미용" : "동물병원";
  const query = region ? `서울 ${region} ${categoryKeyword}` : `서울 ${categoryKeyword}`;

  const params = new URLSearchParams({ query, size: "15" });

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 10000);

  let upstream;
  try {
    upstream = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?${params}`,
      {
        headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
        signal: controller.signal,
      }
    );
  } catch (e) {
    clearTimeout(t);
    return res.status(502).json({ error: "Kakao API 요청 실패", results: [] });
  } finally {
    clearTimeout(t);
  }

  if (!upstream.ok) {
    return res.status(502).json({ error: `Kakao API ${upstream.status}`, results: [] });
  }

  const json = await upstream.json();
  const documents = json?.documents ?? [];

  const results = documents.map((doc) => ({
    name: doc.place_name,
    category,
    region: (doc.address_name || "").match(/[가-힣]+구/)?.[0] || "",
    address: doc.road_address_name || doc.address_name || "",
  }));

  return res.status(200).json({ results });
};
