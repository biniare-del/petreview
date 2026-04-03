(function () {
  // 기본은 API 키 없이 동작하는 "모의(Mock)" 모드입니다.
  // 나중에 실제 API를 붙일 때는 아래 전역변수 2개만 채우고
  // PETREVIEW_DATA_MODE을 "real"로 바꾸면 app.js는 그대로 동작합니다.
  //
  // window.PETREVIEW_DATA_MODE = "real";
  // window.PETREVIEW_DATA_CONFIG = {
  //   serviceKey: "여기에_실제_API_키",
  //   endpointUrl: "https://.../openapi.do",
  //   responseType: "xml" | "json",
  //
  //   // 요청 파라미터(사이트/데이터셋마다 다름)
  //   // 아래 예시처럼 params에 필요한 값들을 채워주세요.
  //   params: {
  //     // 예: "serviceKey": "{{serviceKey}}" 처럼 템플릿을 쓰고 싶으면
  //     // 아래 buildParams에서 처리하도록 커스터마이즈할 수 있습니다.
  //     // 일단은 "serviceKeyParamName"과 "serviceKey"를 분리 제공하는 방식으로 둡니다.
  //     // serviceKey는 자동으로 추가됩니다.
  //   },
  //   serviceKeyParamName: "serviceKey",
  //
  //   // 응답 파싱 설정(데이터셋마다 필드명이 다르므로 매핑을 제공합니다)
  //   xml: {
  //     itemTagName: "item",
  //     fields: {
  //       name: "사업장명",
  //       region: "시군명",
  //       address: "주소",
  //     },
  //   },
  //   json: {
  //     itemsPath: ["response", "body", "items", "item"], // 예시
  //     fields: {
  //       name: "사업장명",
  //       region: "시군명",
  //       address: "주소",
  //     },
  //   },
  // };

  // 기본 모드: "proxy" (Vercel 서버리스 함수를 통해 CORS 없이 실데이터 조회)
  // "mock"  : 모의 데이터만 사용
  // "real"  : 브라우저에서 Seoul API 직접 호출 (CORS 문제 발생 가능)
  // "proxy" : /api/facilities Vercel 프록시 경유 (기본값)
  const DEFAULT_MODE = "proxy";
  const MODE =
    typeof window.PETREVIEW_DATA_MODE === "string"
      ? window.PETREVIEW_DATA_MODE
      : DEFAULT_MODE;

  // Vercel 프록시 엔드포인트 (같은 오리진이면 상대경로, 외부면 절대경로)
  // GitHub Pages에서 사용할 경우 window.PETREVIEW_PROXY_URL 로 Vercel URL 지정:
  // window.PETREVIEW_PROXY_URL = "https://petreview.vercel.app";
  const PROXY_BASE =
    typeof window.PETREVIEW_PROXY_URL === "string"
      ? window.PETREVIEW_PROXY_URL.replace(/\/$/, "")
      : "";

  // ===== 모의(Mock) 데이터 =====
  let lastSource = "unknown"; // "real" | "mock"
  let lastErrorMessage = "";

  const mockFacilities = [
    {
      id: "mock-1",
      name: "마포사랑 동물병원",
      category: "hospital",
      region: "마포구",
      address: "서울 마포구 월드컵로 000",
    },
    {
      id: "mock-5",
      name: "마포동물병원 24시",
      category: "hospital",
      region: "마포구",
      address: "서울 마포구 마포대로 000",
    },
    {
      id: "mock-6",
      name: "홍대동물의료센터",
      category: "hospital",
      region: "마포구",
      address: "서울 마포구 양화로 000",
    },
    {
      id: "mock-7",
      name: "합정 따뜻한 동물병원",
      category: "hospital",
      region: "마포구",
      address: "서울 마포구 월드컵북로 000",
    },
    {
      id: "mock-2",
      name: "행복펫 동물병원",
      category: "hospital",
      region: "강서구",
      address: "서울 강서구 공항대로 000",
    },
    {
      id: "mock-3",
      name: "포근포근 펫살롱",
      category: "grooming",
      region: "마포구",
      address: "서울 마포구 망원로 000",
    },
    {
      id: "mock-4",
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

  // ===== 서울 열린데이터광장 동물병원(LOCALDATA_020301) 연동 =====
  // 요청에서 주신 샘플URL:
  // http://openapi.seoul.go.kr:8088/[인증키]/xml/LOCALDATA_020301/1/5/
  // 동물병원/동물미용업 데이터셋이 같은 OpenAPI 호스트/포맷을 따른다는 가정 하에 기본값을 둡니다.
  // 만약 localdata.go.kr 전용 엔드포인트를 사용해야 한다면, 브라우저에서 아래 전역변수를 오버라이드하세요.
  // window.PETREVIEW_OPENAPI_BASE = "http://{host}:8088";
  const SEOUL_OPENAPI_BASE =
    typeof window.PETREVIEW_OPENAPI_BASE === "string"
      ? window.PETREVIEW_OPENAPI_BASE
      : "http://openapi.seoul.go.kr:8088";
  // 인증키는 코드에 하드코딩하지 않습니다.
  // 로컬에서만 아래 전역변수로 주입하세요.
  // window.PETREVIEW_SEOUL_CERT_KEY = "실제 인증키";
  const SEOUL_CERT_KEY =
    typeof window.PETREVIEW_SEOUL_CERT_KEY === "string"
      ? window.PETREVIEW_SEOUL_CERT_KEY
      : "";
  // 기본 서비스(동물병원)
  const SEOUL_SERVICE_HOSPITAL =
    typeof window.PETREVIEW_SEOUL_SERVICE_HOSPITAL === "string"
      ? window.PETREVIEW_SEOUL_SERVICE_HOSPITAL
      : "LOCALDATA_020301";

  // 추가 서비스(동물미용업)
  const SEOUL_SERVICE_GROOMING =
    typeof window.PETREVIEW_SEOUL_SERVICE_GROOMING === "string"
      ? window.PETREVIEW_SEOUL_SERVICE_GROOMING
      : "LOCALDATA_020312";

  function getTextByAnyTagNames(node, tagNames) {
    for (const tagName of tagNames) {
      const el = node.getElementsByTagName(tagName)[0];
      const text = el ? el.textContent.trim() : "";
      if (text) return text;
    }
    return "";
  }

  function normalizeRegionToGu(regionText) {
    const s = String(regionText || "").trim();
    if (!s) return "";

    // "서울 마포구" / "마포구" / "서울특별시 마포구" 같이 섞여도 구 이름만 추출
    const m = s.match(/[가-힣A-Za-z0-9]+구/);
    return m ? m[0] : s;
  }

  function extractRowsFromXml(dom) {
    // 데이터셋마다 row/item 같은 태그명이 다를 수 있어서, 몇 개 후보로 먼저 시도합니다.
    const candidates = [
      "row",
      "ROW",
      "item",
      "ITEM",
      "data",
      "DATA",
      "list",
      "LIST",
    ];

    for (const tagName of candidates) {
      const nodes = Array.from(dom.getElementsByTagName(tagName));
      if (nodes.length) return nodes;
    }

    return [];
  }

  async function searchPlacesReal({ category, regionKeyword }) {
    const normalizedCategory = normalizeCategory(category);
    if (normalizedCategory !== "hospital" && normalizedCategory !== "grooming") {
      return [];
    }

    if (!SEOUL_CERT_KEY) {
      throw new Error("실제 API 인증키가 설정되어 있지 않습니다 (window.PETREVIEW_SEOUL_CERT_KEY).");
    }

    // MVP에서는 첫 페이지 일부만 가져와 프론트에서 필터링합니다.
    const start = 1;
    const end = 100;

    const service =
      normalizedCategory === "hospital"
        ? SEOUL_SERVICE_HOSPITAL
        : SEOUL_SERVICE_GROOMING;

    const url = `${SEOUL_OPENAPI_BASE}/${SEOUL_CERT_KEY}/xml/${service}/${start}/${end}/`;

    const controller = new AbortController();
    const timeoutMs = 8000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let res;
    try {
      res = await fetch(url, { method: "GET", signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!res.ok) {
      throw new Error(`Real API 요청 실패: ${res.status} ${res.statusText}`);
    }

    const rawText = await res.text();
    const dom = new DOMParser().parseFromString(rawText, "text/xml");

    const rows = extractRowsFromXml(dom);
    if (!rows.length) return [];

    const nameTagCandidates = [
      "사업장명",
      "상호명",
      "기관명",
      "병원명",
      "업소명",
      "명칭",
      "시설명",
    ];

    const regionTagCandidates = [
      "시군명",
      "자치구명",
      "구명",
      "지역",
      "행정구역",
      "시도명",
    ];

    const addressTagCandidates = [
      "주소",
      "소재지",
      "도로명주소",
      "지번주소",
      "도로명",
      "지번",
    ];

    const items = rows
      .map((node) => {
        const name = getTextByAnyTagNames(node, nameTagCandidates);
        const regionRaw = getTextByAnyTagNames(node, regionTagCandidates);
        const region = normalizeRegionToGu(regionRaw);
        const address = getTextByAnyTagNames(node, addressTagCandidates);

        return {
          id: `${name || "unknown"}-${region || "unknown"}`,
          name,
          category: normalizedCategory,
          region,
          address,
        };
      })
      .filter((x) => x.name); // 이름 없는 row는 제외

    // regionKeyword는 시군/구 문자열 일부 포함 기반으로 프론트에서 필터링합니다.
    const normalizedRegionKeyword = normalizeQuery(regionKeyword);
    return items
      .filter((x) => containsByKeyword(x.region, normalizedRegionKeyword))
      .slice(0, 24);
  }

  // ===== Vercel 프록시 호출 =====
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
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `프록시 응답 오류: ${res.status}`);
    }

    const json = await res.json();
    const results = json?.results;
    if (!Array.isArray(results) || results.length === 0) {
      throw new Error("프록시 결과가 비어 있습니다.");
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

    if (MODE === "real") {
      try {
        const result = await searchPlacesReal({
          category: normalizedCategory,
          regionKeyword: normalizedRegionKeyword,
        });
        lastSource = "real";
        lastErrorMessage = "";
        if (!Array.isArray(result) || result.length === 0) {
          throw new Error("Real API 파싱 결과가 비어 있습니다.");
        }
        return result;
      } catch (e) {
        console.warn("[펫리뷰] Real API 폴백(Mock)으로 전환:", e.message);
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

