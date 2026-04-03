(function () {
  // 카카오 로컬 API로 동물병원/미용샵을 검색합니다.
  // 모드: "kakao" (기본값) | "mock"
  // 콘솔에서 window.PETREVIEW_DATA_MODE = "mock" 으로 강제 전환 가능합니다.

  const KAKAO_REST_API_KEY = "9e5930005d619cae98c2d710200b768f";

  const MODE =
    typeof window.PETREVIEW_DATA_MODE === "string"
      ? window.PETREVIEW_DATA_MODE
      : "kakao";

  let lastSource = "unknown"; // "real" | "mock"
  let lastErrorMessage = "";

  // ===== 모의(Mock) 데이터 – Kakao API 실패 시 폴백 =====
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

  function extractGu(address) {
    const match = String(address || "").match(/[가-힣]+구/);
    return match ? match[0] : "";
  }

  // ===== 카카오 로컬 API 키워드 검색 =====
  // 카카오 개발자 콘솔(developers.kakao.com) → 내 애플리케이션 → 플랫폼 → Web에
  // 배포 도메인(예: https://biniare-del.github.io, https://petreview.vercel.app)을
  // 등록해야 브라우저에서 정상 호출됩니다.
  async function searchPlacesKakao({ category, regionKeyword }) {
    const params = new URLSearchParams({ category });
    if (regionKeyword) params.set("region", regionKeyword);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let res;
    try {
      res = await fetch(
        `https://petreview.vercel.app/api/facilities?${params}`,
        { signal: controller.signal }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      throw new Error(`Kakao API HTTP ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    const results = json?.results ?? [];

    if (!results.length) {
      throw new Error("검색 결과가 없습니다.");
    }

    return results;
  }

  // ===== 공통 제공자 API =====
  async function searchPlaces({ category, regionKeyword }) {
    const normalizedCategory = normalizeCategory(category);
    const normalizedRegionKeyword = normalizeQuery(regionKeyword);

    if (MODE === "kakao") {
      try {
        const result = await searchPlacesKakao({
          category: normalizedCategory,
          regionKeyword: normalizedRegionKeyword,
        });
        lastSource = "real";
        lastErrorMessage = "";
        return result;
      } catch (e) {
        console.warn("[펫리뷰] Kakao API 폴백(Mock)으로 전환:", e.message);
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
