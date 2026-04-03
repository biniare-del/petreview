(function () {
  // 업체 검색은 /api/facilities Vercel 프록시를 경유합니다.
  // 프록시가 카카오 로컬 API를 서버 사이드에서 호출하므로 API 키가 클라이언트에 노출되지 않습니다.
  //
  // 모드: "proxy" (기본값) | "mock"
  // 콘솔에서 window.PETREVIEW_DATA_MODE = "mock" 으로 강제 전환 가능합니다.
  //
  // GitHub Pages에서 사용할 경우 Vercel 배포 URL을 지정하세요:
  // window.PETREVIEW_PROXY_URL = "https://petreview.vercel.app";

  const MODE =
    typeof window.PETREVIEW_DATA_MODE === "string"
      ? window.PETREVIEW_DATA_MODE
      : "proxy";

  const PROXY_BASE =
    typeof window.PETREVIEW_PROXY_URL === "string"
      ? window.PETREVIEW_PROXY_URL.replace(/\/$/, "")
      : "";

  let lastSource = "unknown"; // "real" | "mock"
  let lastErrorMessage = "";

  // ===== 모의(Mock) 데이터 – 프록시 실패 시 폴백 =====
  const mockFacilities = [
    {
      name: "마포사랑 동물병원",
      category: "hospital",
      region: "마포구",
      address: "서울 마포구 월드컵로 000",
    },
    {
      name: "마포동물병원 24시",
      category: "hospital",
      region: "마포구",
      address: "서울 마포구 마포대로 000",
    },
    {
      name: "홍대동물의료센터",
      category: "hospital",
      region: "마포구",
      address: "서울 마포구 양화로 000",
    },
    {
      name: "행복펫 동물병원",
      category: "hospital",
      region: "강서구",
      address: "서울 강서구 공항대로 000",
    },
    {
      name: "포근포근 펫살롱",
      category: "grooming",
      region: "마포구",
      address: "서울 마포구 망원로 000",
    },
    {
      name: "몽글몽글 미용샵",
      category: "grooming",
      region: "강서구",
      address: "서울 강서구 덕양로 000",
    },
  ];

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function normalizeQuery(value) {
    return String(value || "").trim();
  }

  function containsByKeyword(text, keyword) {
    if (!keyword) return true;
    return String(text || "").includes(keyword);
  }

  function normalizeCategory(category) {
    if (category === "hospital" || category === "grooming") return category;
    return "hospital";
  }

  // ===== /api/facilities 프록시 호출 =====
  async function searchPlacesProxy({ category, regionKeyword }) {
    const params = new URLSearchParams({ category });
    if (regionKeyword) params.set("region", regionKeyword);

    const url = `${PROXY_BASE}/api/facilities?${params.toString()}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let res;
    try {
      res = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `프록시 응답 오류: ${res.status}`);
    }

    const json = await res.json();
    const results = json?.results;

    if (!Array.isArray(results) || results.length === 0) {
      throw new Error("검색 결과가 없습니다.");
    }

    return results;
  }

  // ===== 공통 제공자 API =====
  async function searchPlaces({ category, regionKeyword }) {
    const normalizedCategory = normalizeCategory(category);
    const normalizedRegionKeyword = normalizeQuery(regionKeyword);

    if (MODE === "proxy") {
      try {
        const result = await searchPlacesProxy({
          category: normalizedCategory,
          regionKeyword: normalizedRegionKeyword,
        });
        lastSource = "real";
        lastErrorMessage = "";
        return result;
      } catch (e) {
        console.warn("[펫리뷰] 프록시 폴백(Mock)으로 전환:", e.message);
        lastSource = "mock";
        lastErrorMessage = e?.message ? String(e.message) : "unknown error";
      }
    }

    // mock 폴백
    await sleep(250);
    return mockFacilities.filter((f) => {
      const categoryMatch = f.category === normalizedCategory;
      const regionMatch = containsByKeyword(f.region, normalizedRegionKeyword);
      return categoryMatch && regionMatch;
    });
  }

  window.PetReviewDataProvider = {
    searchPlaces,
    get mode() {
      return MODE;
    },
    get lastSource() {
      return lastSource;
    },
    get lastErrorMessage() {
      return lastErrorMessage;
    },
  };
})();
