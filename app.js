const CATEGORY_LABEL = {
  hospital: "동물병원",
  grooming: "펫미용실",
};

const SERVICE_TAGS = {
  hospital: ["기본진료", "접종", "사상충", "심장사상충", "중성화", "스케일링", "수술", "입원", "기타"],
  grooming: ["전체미용", "부분미용", "목욕", "가위컷", "클리퍼컷", "위생미용", "기타"],
};

let selectedServiceTags = new Set();

let reviews = [];
let selectedSearchCategory = "hospital";  // 검색 탭용
let formCategory = "hospital";            // 리뷰 폼 업종 (독립)
let searchFacilities = [];

// ===== 리뷰 폼 임시 저장 (로그인 리다이렉트 전후 데이터 유지) =====
const FORM_DRAFT_KEY = "petreview_form_draft";

function saveFormDraft() {
  try {
    const step2Visible = !document.getElementById("form-step-2")?.hidden;
    const draft = {
      pendingOpenForm: true,
      formCategory:  formCategory,
      formStep:      step2Visible ? 2 : 1,
      placeName:     document.getElementById("place-name")?.value ?? "",
      placeCity:     document.getElementById("place-city")?.value ?? "서울",
      placeRegion:   document.getElementById("place-region")?.value ?? "",
      visitDate:     document.getElementById("visit-date")?.value ?? "",
      serviceDetail: document.getElementById("service-detail")?.value ?? "",
      totalPrice:    document.getElementById("total-price")?.value ?? "",
      shortReview:   document.getElementById("short-review")?.value ?? "",
      serviceTags:   [...selectedServiceTags],
    };
    sessionStorage.setItem(FORM_DRAFT_KEY, JSON.stringify(draft));
  } catch { /* ignore */ }
}

function restoreFormDraft() {
  const raw = sessionStorage.getItem(FORM_DRAFT_KEY);
  if (!raw) return;
  sessionStorage.removeItem(FORM_DRAFT_KEY);
  try {
    const d = JSON.parse(raw);
    if (!d.pendingOpenForm) return;

    // 폼 섹션으로 스크롤
    document.getElementById("review-form-section")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });

    // step 2 였으면 업종 선택 후 폼 복원
    if (d.formStep === 2 && d.formCategory) {
      selectFormCategory(d.formCategory);
      if (d.placeName)     document.getElementById("place-name").value = d.placeName;
      if (d.placeCity)   { const el = document.getElementById("place-city"); if (el) { el.value = d.placeCity; updateDistrictDatalist(d.placeCity, "place-region-datalist"); } }
      if (d.placeRegion)   document.getElementById("place-region").value = d.placeRegion;
      if (d.visitDate)     document.getElementById("visit-date").value = d.visitDate;
      if (d.serviceDetail) document.getElementById("service-detail").value = d.serviceDetail;
      if (d.totalPrice)    document.getElementById("total-price").value = d.totalPrice;
      if (d.shortReview)   document.getElementById("short-review").value = d.shortReview;
      if (d.serviceTags?.length) {
        selectedServiceTags = new Set(d.serviceTags);
        document.querySelectorAll(".tag-btn").forEach((btn) =>
          btn.classList.toggle("is-selected", selectedServiceTags.has(btn.dataset.tag))
        );
      }
    }
    // step 1이면 그냥 스크롤만 (카드 표시 상태 유지)
  } catch { /* ignore */ }
}
let searchPage = 1;
let hasSearched = false;
const PAGE_SIZE = 5;
let featuredPlaces = [];   // featured_places 테이블 (우수협력병원/이벤트)
let favCounts = {};        // { place_name: count }
let searchSortMode = 'fav'; // 'fav' | 'name'
let userFavs = new Set();  // 현재 유저가 즐겨찾기한 place_name 집합
let geoState = 'pending';  // 'pending' | 'granted' | 'denied'
let reviewLikes = {};            // { reviewId: likeCount }
let userLikedReviews = new Set(); // 현재 유저가 좋아요한 review ID 집합
let commentCounts = {};          // { reviewId: commentCount }
let filterPetSpecies = "all";    // 동물 종류 필터
let reviewSortMode = "verified"; // 리뷰 정렬 모드
let reportingReviewId = null;    // 신고 처리 중인 review ID
let selectedScores = {};         // 별점 입력 값 { score_kindness, score_price, score_facility, score_wait }
let selectedPetName = "";        // 선택된 마이펫 이름
let selectedPetSpecies = "";     // 선택된 마이펫 종류
let selectedPetPhotoUrl = "";    // 선택된 마이펫 저장 사진 URL
let selectedKakaoPlaceId = "";   // 자동완성에서 선택된 카카오 장소 ID

// 시/도별 구/시/군 목록 (datalist용)
const DISTRICT_MAP = {
  서울: ["강남구","강동구","강북구","강서구","관악구","광진구","구로구","금천구","노원구","도봉구","동대문구","동작구","마포구","서대문구","서초구","성동구","성북구","송파구","양천구","영등포구","용산구","은평구","종로구","중구","중랑구"],
  경기: ["수원시","성남시","고양시","용인시","부천시","안산시","안양시","남양주시","화성시","평택시","의정부시","시흥시","파주시","김포시","광명시","광주시","군포시","하남시","오산시","이천시","안성시","의왕시","양주시","구리시","여주시","동두천시","과천시","포천시","가평군","양평군","연천군"],
  인천: ["중구","동구","미추홀구","연수구","남동구","부평구","계양구","서구","강화군","옹진군"],
  부산: ["중구","서구","동구","영도구","부산진구","동래구","남구","북구","해운대구","사하구","금정구","강서구","연제구","수영구","사상구","기장군"],
  대구: ["중구","동구","서구","남구","북구","수성구","달서구","달성군","군위군"],
  광주: ["동구","서구","남구","북구","광산구"],
  대전: ["동구","중구","서구","유성구","대덕구"],
  울산: ["중구","남구","동구","북구","울주군"],
  세종: ["세종시"],
  강원: ["춘천시","원주시","강릉시","동해시","태백시","속초시","삼척시","홍천군","횡성군","영월군","평창군","정선군","철원군","화천군","양구군","인제군","고성군","양양군"],
  충북: ["청주시","충주시","제천시","보은군","옥천군","영동군","증평군","진천군","괴산군","음성군","단양군"],
  충남: ["천안시","공주시","보령시","아산시","서산시","논산시","계룡시","당진시","금산군","부여군","서천군","청양군","홍성군","예산군","태안군"],
  전북: ["전주시","군산시","익산시","정읍시","남원시","김제시","완주군","진안군","무주군","장수군","임실군","순창군","고창군","부안군"],
  전남: ["목포시","여수시","순천시","나주시","광양시","담양군","곡성군","구례군","고흥군","보성군","화순군","장흥군","강진군","해남군","영암군","무안군","함평군","영광군","장성군","완도군","진도군","신안군"],
  경북: ["포항시","경주시","김천시","안동시","구미시","영주시","영천시","상주시","문경시","경산시","의성군","청송군","영양군","영덕군","청도군","고령군","성주군","칠곡군","예천군","봉화군","울진군","울릉군"],
  경남: ["창원시","진주시","통영시","사천시","김해시","밀양시","거제시","양산시","의령군","함안군","창녕군","고성군","남해군","하동군","산청군","함양군","거창군","합천군"],
  제주: ["제주시","서귀포시"],
};

function updateDistrictDatalist(cityVal, targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;
  const districts = DISTRICT_MAP[cityVal] || [];
  if (el.tagName === "SELECT") {
    el.innerHTML = `<option value="">전체</option>` +
      districts.map(d => `<option value="${d}">${d}</option>`).join("");
  } else {
    // datalist (form용 텍스트 입력)
    el.innerHTML = districts.map(d => `<option value="${d}">`).join("");
  }
}

const els = {
  searchCity: document.getElementById("search-city"),
  searchRegion: document.getElementById("search-region"),
  searchButton: document.getElementById("search-button"),
  searchResults: document.getElementById("search-results"),
  sortToggle: document.getElementById("sort-toggle"),
  categoryButtons: document.querySelectorAll(".category-toggle .toggle-btn"),
  placeNameInput: document.getElementById("place-name"),
  placeCategorySelect: document.getElementById("place-category"),
  placeCity: document.getElementById("place-city"),
  placeRegionInput: document.getElementById("place-region"),
  reviewForm: document.getElementById("review-form"),
  receiptInput: document.getElementById("receipt-image"),
  receiptPreview: document.getElementById("receipt-preview"),
  petPhotoInput: document.getElementById("pet-photo"),
  petPhotoPreview: document.getElementById("pet-photo-preview"),
  reviewPhotosInput: document.getElementById("review-photos"),
  reviewPhotosPreview: document.getElementById("review-photos-preview"),
  ocrStatus: document.getElementById("ocr-status"),
  reviewList: document.getElementById("review-list"),
  filterCategory: document.getElementById("filter-category"),
  filterCity: document.getElementById("filter-city"),
  filterRegion: document.getElementById("filter-region"),
  ctaButton: document.querySelector("[data-scroll-target]"),
};

// 시/도 변경 시 구 목록 갱신 + 선택값 초기화
els.searchCity?.addEventListener("change", () => {
  updateDistrictDatalist(els.searchCity.value, "search-region");
  if (els.searchRegion) els.searchRegion.value = "";
});
els.placeCity?.addEventListener("change", () => {
  updateDistrictDatalist(els.placeCity.value, "place-region-datalist");
  const placeReg = document.getElementById("place-region");
  if (placeReg) placeReg.value = "";
});
els.filterCity?.addEventListener("change", () => {
  updateDistrictDatalist(els.filterCity.value, "filter-region");
  if (els.filterRegion) els.filterRegion.value = "";
  renderReviewList();
});
// 초기 구/시/군 목록
updateDistrictDatalist("서울", "search-region");
updateDistrictDatalist("서울", "place-region-datalist");
updateDistrictDatalist("", "filter-region"); // 전체

function formatPrice(amount) {
  return Number(amount).toLocaleString("ko-KR");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderSearchPage(page) {
  searchPage = page;
  const totalPages = Math.ceil(searchFacilities.length / PAGE_SIZE);
  const start = (page - 1) * PAGE_SIZE;
  const slice = searchFacilities.slice(start, start + PAGE_SIZE);

  const dataProvider = window.PetReviewDataProvider;
  const dataNotice =
    dataProvider?.lastSource === "mock"
      ? `<p class="helper-text">실데이터 요청에 실패해서 모의 데이터를 표시 중입니다.${
          dataProvider.lastErrorMessage ? " (" + escapeHtml(dataProvider.lastErrorMessage) + ")" : ""
        }</p>`
      : "";

  // 우수협력병원/이벤트 고정 노출 카드 (1페이지에만 표시)
  let featuredHtml = "";
  if (page === 1 && featuredPlaces.length) {
    featuredHtml = featuredPlaces.map((fp) => `
      <article class="card featured-place-card" style="cursor:pointer;" data-place-name="${escapeHtml(fp.place_name)}" data-place-category="${escapeHtml(fp.category)}" data-place-city="${escapeHtml(els.searchCity?.value || "서울")}" data-place-region="${escapeHtml(fp.region || "")}" data-place-address="${escapeHtml(fp.address || "")}" data-place-phone="${escapeHtml(fp.phone || "")}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
          <h3 class="place-name-ellipsis" style="flex:1;margin:0;">${escapeHtml(fp.place_name)}</h3>
          <span class="featured-tag${fp.tag === "이벤트" ? " tag-event" : ""}">${escapeHtml(fp.tag || "우수협력병원")}</span>
        </div>
        <p>${CATEGORY_LABEL[fp.category] || fp.category} · ${escapeHtml(fp.region || "")}</p>
        ${fp.address ? `<p class="helper-text">주소: ${escapeHtml(fp.address)}</p>` : ""}
        ${fp.phone ? `<p><a class="place-phone-link" href="tel:${escapeHtml(fp.phone)}">📞 ${escapeHtml(fp.phone)}</a></p>` : ""}
      </article>`).join("");
  }

  const cards = slice
    .map((place) => {
      const count = favCounts[place.name] || 0;
      const isSaved = userFavs.has(place.name);
      const favLabel = (isSaved ? "♥ 단골" : "♡ 단골") + (count > 0 ? ` ${count}` : "");
      // 리뷰 통계 (in-memory)
      const placeReviews = reviews.filter((r) => r.placeName === place.name && r.isVerified);
      const reviewBadge = placeReviews.length
        ? (() => {
            const avgPrice = Math.round(placeReviews.reduce((s, r) => s + (r.totalPrice || 0), 0) / placeReviews.length);
            return `<span class="place-review-badge">리뷰 ${placeReviews.length}건 · 평균 ₩${avgPrice.toLocaleString("ko-KR")}</span>`;
          })()
        : "";
      return `
      <article class="card search-place-card" style="cursor:pointer;" data-place-id="${escapeHtml(place.kakaoId || "")}" data-place-name="${escapeHtml(place.name)}" data-place-category="${escapeHtml(place.category)}" data-place-city="${escapeHtml(els.searchCity?.value || "서울")}" data-place-region="${escapeHtml(place.region)}" data-place-address="${escapeHtml(place.address || "")}" data-place-phone="${escapeHtml(place.phone || "")}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
          <h3 class="place-name-ellipsis" style="flex:1;margin:0;">${escapeHtml(place.name)}</h3>
          <button class="favorite-btn${isSaved ? " is-saved" : ""}" data-fav-id="${escapeHtml(place.kakaoId || "")}" data-fav-name="${escapeHtml(place.name)}" data-fav-category="${escapeHtml(place.category)}" data-fav-region="${escapeHtml(place.region)}" data-fav-address="${escapeHtml(place.address || "")}" data-fav-phone="${escapeHtml(place.phone || "")}">${escapeHtml(favLabel)}</button>
        </div>
        <p>${CATEGORY_LABEL[place.category]} · ${escapeHtml(place.region)}</p>
        ${place.address ? `<p class="helper-text">주소: ${escapeHtml(place.address)}</p>` : ""}
        ${place.phone ? `<p><a class="place-phone-link" href="tel:${escapeHtml(place.phone)}">📞 ${escapeHtml(place.phone)}</a></p>` : ""}
        <div class="card-place-actions">
          ${reviewBadge}
          <button class="place-share-btn" data-share-name="${escapeHtml(place.name)}" data-share-category="${escapeHtml(place.category)}" data-share-city="${escapeHtml(els.searchCity?.value || "서울")}" data-share-region="${escapeHtml(place.region)}" data-share-address="${escapeHtml(place.address || "")}" data-share-phone="${escapeHtml(place.phone || "")}">📤 공유</button>
        </div>
      </article>`;
    })
    .join("");

  const pagination =
    totalPages > 1
      ? `<div class="search-pagination">
          <button class="pagination-btn" id="page-prev" ${page <= 1 ? "disabled" : ""}>이전</button>
          <span class="page-info">${page} / ${totalPages}</span>
          <button class="pagination-btn" id="page-next" ${page >= totalPages ? "disabled" : ""}>다음</button>
        </div>`
      : "";

  els.searchResults.innerHTML = dataNotice + featuredHtml + cards + pagination;

  document.getElementById("page-prev")?.addEventListener("click", () => {
    renderSearchPage(searchPage - 1);
    document.getElementById("search-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.getElementById("page-next")?.addEventListener("click", () => {
    renderSearchPage(searchPage + 1);
    document.getElementById("search-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

async function renderSearchResults() {
  els.searchResults.innerHTML =
    '<p class="placeholder-text">업체 데이터를 불러오는 중...</p>';

  const cityVal = els.searchCity?.value || "서울";
  const regionVal = els.searchRegion?.value?.trim() || "";
  const regionKeyword = regionVal ? `${cityVal} ${regionVal}` : cityVal;

  try {
    if (!window.PetReviewDataProvider?.searchPlaces) {
      throw new Error("PetReviewDataProvider.searchPlaces를 찾을 수 없습니다.");
    }
    searchFacilities = await window.PetReviewDataProvider.searchPlaces({
      category: selectedSearchCategory,
      regionKeyword,
    });
  } catch (err) {
    console.error(err);
    els.searchResults.innerHTML =
      '<p class="placeholder-text">데이터를 불러오지 못했어요. (콘솔을 확인해 주세요)</p>';
    return;
  }

  if (!searchFacilities || searchFacilities.length === 0) {
    els.searchResults.innerHTML =
      '<p class="placeholder-text">조건에 맞는 업체가 없어요. 다른 지역/업종으로 검색해 보세요.</p>';
    return;
  }

  const db = window.supabaseClient;

  // 우수협력병원/이벤트 고정 노출 카드 (Supabase)
  featuredPlaces = [];
  if (db) {
    try {
      let q = db.from("featured_places")
        .select("*")
        .eq("category", selectedSearchCategory)
        .eq("is_active", true)
        .order("sort_order");
      if (regionKeyword) q = q.eq("region", regionKeyword);
      const { data: fp } = await q;
      featuredPlaces = fp || [];
    } catch { /* ignore */ }
  }

  // 즐겨찾기 수 집계
  favCounts = {};
  if (db) {
    try {
      const placeNames = searchFacilities.map((p) => p.name);
      const { data: favData } = await db
        .from("favorites")
        .select("place_name")
        .in("place_name", placeNames);
      (favData || []).forEach((f) => {
        favCounts[f.place_name] = (favCounts[f.place_name] || 0) + 1;
      });
    } catch { /* ignore */ }
  }

  // 로그인 유저의 즐겨찾기 목록
  userFavs = new Set();
  if (db && window.PetAuth?.isLoggedIn()) {
    try {
      const { data: ufData } = await db
        .from("favorites")
        .select("place_name")
        .eq("user_id", window.PetAuth.currentUser.id);
      (ufData || []).forEach((f) => userFavs.add(f.place_name));
    } catch { /* ignore */ }
  }

  // 정렬 적용
  if (searchSortMode === 'fav') {
    searchFacilities.sort((a, b) => {
      const diff = (favCounts[b.name] || 0) - (favCounts[a.name] || 0);
      return diff !== 0 ? diff : a.name.localeCompare(b.name, "ko");
    });
  } else {
    searchFacilities.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }

  // 정렬 토글 표시 및 활성 상태 갱신
  if (els.sortToggle) {
    els.sortToggle.style.display = 'flex';
    els.sortToggle.querySelectorAll('.sort-btn').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.sort === searchSortMode);
    });
  }

  hasSearched = true;
  renderSearchPage(1);
}

function renderImagePreview(file, previewEl) {
  if (!file || !previewEl) return;
  const url = URL.createObjectURL(file);
  previewEl.innerHTML = `<img src="${url}" alt="미리보기" />`;
}


function renderReviewList() {
  const category = els.filterCategory.value;
  const cityFilter = els.filterCity?.value || "";
  const regionKeyword = els.filterRegion?.value?.trim() || "";

  const filtered = reviews.filter((review) => {
    const categoryMatch = category === "all" || review.category === category;
    const cityMatch = !cityFilter || (review.city || "서울") === cityFilter;
    const regionMatch = !regionKeyword || (review.region ?? "").includes(regionKeyword);
    const speciesMatch = filterPetSpecies === "all" || (review.petSpecies || "").includes(filterPetSpecies);
    return categoryMatch && cityMatch && regionMatch && speciesMatch;
  });

  if (filtered.length === 0) {
    els.reviewList.innerHTML =
      '<p class="placeholder-text">조건에 맞는 리뷰가 없습니다. 필터를 바꿔보세요.</p>';
    return;
  }

  // 정렬
  const sorted = [...filtered].sort((a, b) => {
    if (reviewSortMode === "rating") {
      const aScore = [a.scoreKindness, a.scorePrice, a.scoreFacility, a.scoreWait].filter(Boolean);
      const bScore = [b.scoreKindness, b.scorePrice, b.scoreFacility, b.scoreWait].filter(Boolean);
      const aAvg = aScore.length ? aScore.reduce((s, v) => s + v, 0) / aScore.length : 0;
      const bAvg = bScore.length ? bScore.reduce((s, v) => s + v, 0) / bScore.length : 0;
      return bAvg - aAvg;
    }
    if (reviewSortMode === "price_asc") return a.totalPrice - b.totalPrice;
    if (reviewSortMode === "recent") return b.createdAt.localeCompare(a.createdAt);
    // default: verified first
    return b.isVerified - a.isVerified;
  });

  const items = sorted
    .map((review) => {
      const likeCount = reviewLikes[review.id] || 0;
      const isLiked = userLikedReviews.has(review.id);
      const scoresHtml = (review.scoreKindness || review.scorePrice || review.scoreFacility || review.scoreWait) ? `
        <div class="card-scores">
          ${review.scoreKindness ? `<div class="score-row"><span class="score-label">친절도</span><div class="score-bar-wrap"><div class="score-bar" style="width:${review.scoreKindness * 20}%"></div></div><span class="score-val">${review.scoreKindness}.0</span></div>` : ""}
          ${review.scorePrice ? `<div class="score-row"><span class="score-label">진료비</span><div class="score-bar-wrap"><div class="score-bar" style="width:${review.scorePrice * 20}%"></div></div><span class="score-val">${review.scorePrice}.0</span></div>` : ""}
          ${review.scoreFacility ? `<div class="score-row"><span class="score-label">시설</span><div class="score-bar-wrap"><div class="score-bar" style="width:${review.scoreFacility * 20}%"></div></div><span class="score-val">${review.scoreFacility}.0</span></div>` : ""}
          ${review.scoreWait ? `<div class="score-row"><span class="score-label">대기시간</span><div class="score-bar-wrap"><div class="score-bar" style="width:${review.scoreWait * 20}%"></div></div><span class="score-val">${review.scoreWait}.0</span></div>` : ""}
        </div>` : "";
      const hasPhotos = (review.reviewPhotoUrls || []).length > 0;
      const isGrooming = review.category === "grooming";
      return `
      <article class="card card--${review.category}${review.isVerified ? " card--verified" : ""}${hasPhotos ? " card--has-photos" : ""}" data-review-id="${escapeHtml(review.id)}" style="cursor:pointer;">
        <div class="card-place-info">
          <div>
            <span class="card-place-name">${escapeHtml(review.placeName)}</span>
            <span class="card-place-region">${escapeHtml(review.city || "서울")} ${escapeHtml(review.region)}</span>
          </div>
          <span class="category-tag category-tag--${review.category}">${CATEGORY_LABEL[review.category]}</span>
        </div>
        <div class="card-pet-header">
          <div class="card-pet-avatar">
            ${review.petPhoto
              ? `<img src="${escapeHtml(review.petPhoto)}" alt="${escapeHtml(review.petName || "")}" class="pet-avatar-img" />`
              : `<div class="pet-icon pet-icon--${review.petSpecies === "고양이" ? "cat" : "dog"}"></div>`
            }
          </div>
          <div class="card-pet-info">
            <div class="card-pet-name">
              ${review.petName ? escapeHtml(review.petName) : ""}
              ${review.petSpecies ? `<span class="card-pet-species">${escapeHtml(review.petSpecies)}</span>` : ""}
            </div>
            <div class="card-pet-owner">
              ${review.userNickname ? `<strong>${escapeHtml(review.userNickname)}</strong> · ` : ""}${escapeHtml(review.visitDate)}
              ${review.isVerified ? '<span class="verified-badge">✔ 영수증 인증</span>' : ""}
              ${review.reviewSeq ? `<span class="review-seq-badge">${review.reviewSeq}번째 리뷰</span>` : ""}
            </div>
          </div>
          <div class="card-badges-col">
            ${hasPhotos ? '<span class="photo-review-badge">📷 사진리뷰</span>' : ""}
          </div>
        </div>
        ${scoresHtml}
        <div class="card-price-row">
          <span class="card-price">₩ ${formatPrice(review.totalPrice)}</span>
          <span class="card-service-detail">${escapeHtml(review.serviceDetail)}</span>
        </div>
        <p class="card-review-text">${escapeHtml(review.shortReview)}</p>
        ${hasPhotos ? `
        <div class="review-images review-images--large">
          ${(review.reviewPhotoUrls).map(url => `<img src="${escapeHtml(url)}" alt="리뷰 사진" class="review-thumb review-thumb--large" />`).join("")}
        </div>` : ""}
        <div class="review-actions">
          <button class="like-btn${isLiked ? " is-liked" : ""}" data-review-id="${escapeHtml(review.id)}">👍 도움이 됐어요${likeCount > 0 ? ` <span class="like-count">${likeCount}</span>` : ""}</button>
          <span class="comment-count-badge">💬 ${commentCounts[review.id] || 0}</span>
          <button class="report-btn" data-review-id="${escapeHtml(review.id)}">🚨 신고</button>
          ${window.PetAuth?.isAdmin() ? `
          <button class="admin-hide-btn" data-review-id="${escapeHtml(review.id)}" data-hidden="${review.isHidden ? "1" : "0"}" title="관리자: 숨기기/공개">${review.isHidden ? "🔓 공개" : "🔒 숨기기"}</button>
          <button class="admin-delete-btn" data-review-id="${escapeHtml(review.id)}" title="관리자: 삭제">🗑️ 삭제</button>
          ` : ""}
        </div>
      </article>`;
    })
    .join("");

  els.reviewList.innerHTML = items;
}

// DB 행(snake_case) → 앱 객체(camelCase) 변환
function rowToReview(row) {
  const storagePath = row.receipt_image_url || "";
  return {
    id: row.id,
    userId: row.user_id || "",
    createdAt: row.created_at || "",
    placeName: row.place_name,
    category: row.category,
    city: row.city || "서울",
    region: row.region,
    visitDate: row.visit_date,
    serviceDetail: row.service_detail,
    totalPrice: row.total_price,
    shortReview: row.short_review,
    receiptPath: storagePath,
    receiptImage: storagePath.startsWith("http") ? storagePath : "",
    petPhoto: row.pet_photo_url || "",
    isVerified: row.is_verified || false,
    petName: row.pet_name || "",
    petSpecies: row.pet_species || "",
    scoreKindness: row.score_kindness || null,
    scorePrice: row.score_price || null,
    scoreFacility: row.score_facility || null,
    scoreWait: row.score_wait || null,
    reviewPhotoUrls: row.review_photo_urls || [],
    userNickname: row.profiles?.nickname || "",
    reviewSeq: 0, // 사용자별 누적 순번 (loadReviews에서 계산)
    isHidden: row.is_hidden || false,
    kakaoPlaceId: row.kakao_place_id || "",
  };
}

async function loadReviews() {
  els.reviewList.innerHTML = '<p class="placeholder-text">리뷰를 불러오는 중...</p>';

  const db = window.supabaseClient;
  if (!db) {
    reviews = [];
    renderReviewList();
    return;
  }

  let { data, error } = await db
    .from("reviews")
    .select("*")
    .or("status.eq.approved,status.is.null")
    .or("is_hidden.is.null,is_hidden.eq.false")
    .order("is_verified", { ascending: false })
    .order("created_at", { ascending: false });

  // is_hidden 컬럼이 아직 없을 경우(PGRST200) → 컬럼 없이 재시도
  if (error && (error.code === "PGRST200" || error.message?.includes("is_hidden"))) {
    ({ data, error } = await db
      .from("reviews")
      .select("*")
      .or("status.eq.approved,status.is.null")
      .order("is_verified", { ascending: false })
      .order("created_at", { ascending: false }));
  }

  if (error) {
    console.error("[펫리뷰] 리뷰 로드 실패:", error);
    els.reviewList.innerHTML =
      '<p class="placeholder-text">리뷰를 불러오지 못했어요. (콘솔을 확인해 주세요)</p>';
    return;
  }

  const rawReviews = (data || []).map(rowToReview);

  // 작성자 닉네임 별도 조회 (profiles FK join 우회)
  if (rawReviews.length) {
    try {
      const uids = [...new Set((data || []).map(r => r.user_id).filter(Boolean))];
      if (uids.length) {
        const { data: profilesData } = await db.from("profiles").select("id, nickname").in("id", uids);
        const profileMap = {};
        (profilesData || []).forEach(p => { profileMap[p.id] = p; });
        rawReviews.forEach(r => {
          const row = (data || []).find(d => d.id === r.id);
          if (row) r.userNickname = profileMap[row.user_id]?.nickname || "";
        });
      }
    } catch { /* ignore */ }
  }

  // private 버킷 영수증: 서명된 URL 생성 (1시간 유효)
  await Promise.all(
    rawReviews
      .filter((r) => r.receiptPath && !r.receiptPath.startsWith("http"))
      .map(async (r) => {
        const { data: signed } = await db.storage
          .from("receipts")
          .createSignedUrl(r.receiptPath, 3600);
        r.receiptImage = signed?.signedUrl || "";
      })
  );

  // 사용자별 누적 순번 계산 (오래된 리뷰부터 1번)
  const userSeqMap = {};
  [...rawReviews].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).forEach((r) => {
    if (!r.userId) return;
    userSeqMap[r.userId] = (userSeqMap[r.userId] || 0) + 1;
    r.reviewSeq = userSeqMap[r.userId];
  });

  reviews = rawReviews;
  await Promise.all([loadLikes(), loadCommentCounts()]);
  renderReviewList();
  renderRecentReviews();
  renderBestPlaces();
}

function renderRecentReviews() {
  const el = document.getElementById("recent-review-list");
  if (!el) return;

  // reviews는 DB에서 이미 created_at 내림차순으로 로드됨
  const recent = reviews.slice(0, 3);

  if (recent.length === 0) {
    el.innerHTML = '<p class="placeholder-text">아직 후기가 없습니다.</p>';
    return;
  }

  el.innerHTML = recent.map((review) => {
    const likeCount = reviewLikes[review.id] || 0;
    const isLiked = userLikedReviews.has(review.id);
    const scoresHtml = (review.scoreKindness || review.scorePrice || review.scoreFacility || review.scoreWait) ? `
      <div class="card-scores">
        ${review.scoreKindness ? `<div class="score-row"><span class="score-label">친절도</span><div class="score-bar-wrap"><div class="score-bar" style="width:${review.scoreKindness * 20}%"></div></div><span class="score-val">${review.scoreKindness}.0</span></div>` : ""}
        ${review.scorePrice ? `<div class="score-row"><span class="score-label">진료비</span><div class="score-bar-wrap"><div class="score-bar" style="width:${review.scorePrice * 20}%"></div></div><span class="score-val">${review.scorePrice}.0</span></div>` : ""}
        ${review.scoreFacility ? `<div class="score-row"><span class="score-label">시설</span><div class="score-bar-wrap"><div class="score-bar" style="width:${review.scoreFacility * 20}%"></div></div><span class="score-val">${review.scoreFacility}.0</span></div>` : ""}
        ${review.scoreWait ? `<div class="score-row"><span class="score-label">대기시간</span><div class="score-bar-wrap"><div class="score-bar" style="width:${review.scoreWait * 20}%"></div></div><span class="score-val">${review.scoreWait}.0</span></div>` : ""}
      </div>` : "";
    return `
    <article class="card${review.isVerified ? " card--verified" : ""}" data-review-id="${escapeHtml(review.id)}" style="cursor:pointer;">
      <div class="card-pet-header">
        <div class="card-pet-avatar">
          ${review.petPhoto
            ? `<img src="${escapeHtml(review.petPhoto)}" alt="${escapeHtml(review.petName || "반려동물")}" class="pet-avatar-img" />`
            : `<div class="pet-icon pet-icon--${review.petSpecies === "고양이" ? "cat" : "dog"}"></div>`
          }
        </div>
        <div class="card-pet-info">
          <div class="card-pet-name">
            ${review.petName ? escapeHtml(review.petName) : "반려동물"}
            <span class="card-pet-species">${review.petSpecies ? escapeHtml(review.petSpecies) : ""}</span>
          </div>
          <div class="card-pet-owner">
            ${review.userNickname ? escapeHtml(review.userNickname) + " · " : ""}${escapeHtml(review.visitDate)}
            ${review.isVerified ? '<span class="verified-badge">✔ 영수증 인증</span>' : ""}
          </div>
        </div>
        <span class="category-tag category-tag--${review.category}">${CATEGORY_LABEL[review.category]}</span>
      </div>
      <div class="card-place-info">
        <span class="card-place-name">${escapeHtml(review.placeName)}</span>
        <span class="card-place-region">서울 ${escapeHtml(review.region)}</span>
      </div>
      ${scoresHtml}
      <div class="card-price-row">
        <span class="card-price">₩ ${formatPrice(review.totalPrice)}</span>
        <span class="card-service-detail">${escapeHtml(review.serviceDetail)}</span>
      </div>
      <p class="card-review-text">${escapeHtml(review.shortReview)}</p>
      ${(review.reviewPhotoUrls || []).length > 0 ? `
      <div class="review-images">
        ${(review.reviewPhotoUrls || []).map(url => `<img src="${escapeHtml(url)}" alt="리뷰 사진" class="review-thumb" />`).join("")}
      </div>` : ""}
      <div class="review-actions">
        <button class="like-btn${isLiked ? " is-liked" : ""}" data-review-id="${escapeHtml(review.id)}">👍 도움이 됐어요${likeCount > 0 ? ` <span class="like-count">${likeCount}</span>` : ""}</button>
        <span class="comment-count-badge">💬 ${commentCounts[review.id] || 0}</span>
        <button class="report-btn" data-review-id="${escapeHtml(review.id)}">🚨 신고</button>
      </div>
    </article>`;
  }).join("");
}

// ===== 이달의 추천 =====
function renderBestPlaces() {
  const el = document.getElementById("best-places-list");
  if (!el) return;

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // 이달 인증 리뷰만
  const monthlyVerified = reviews.filter(
    (r) => r.isVerified && r.visitDate?.startsWith(thisMonth)
  );

  if (!monthlyVerified.length) {
    // 이달 데이터 없으면 전체 최근 기준
    const allVerified = reviews.filter((r) => r.isVerified);
    if (!allVerified.length) {
      el.innerHTML = '<p class="placeholder-text">아직 인증 후기가 없습니다.</p>';
      return;
    }
    renderBestFromList(el, allVerified, "최근 인증 후기 기준");
    return;
  }
  renderBestFromList(el, monthlyVerified, `${now.getMonth() + 1}월 기준`);
}

function renderBestFromList(el, list, label) {
  // place_name별 집계
  const placeMap = {};
  list.forEach((r) => {
    if (!placeMap[r.placeName]) {
      placeMap[r.placeName] = { name: r.placeName, category: r.category, city: r.city || "서울", region: r.region, scores: [], count: 0 };
    }
    const p = placeMap[r.placeName];
    p.count++;
    const avg = [r.scoreKindness, r.scorePrice, r.scoreFacility, r.scoreWait].filter(Boolean);
    if (avg.length) p.scores.push(avg.reduce((s, v) => s + v, 0) / avg.length);
  });

  const ranked = Object.values(placeMap)
    .map((p) => ({ ...p, avg: p.scores.length ? p.scores.reduce((s, v) => s + v, 0) / p.scores.length : 0 }))
    .filter((p) => p.count >= 1)
    .sort((a, b) => b.avg - a.avg || b.count - a.count)
    .slice(0, 5);

  if (!ranked.length) {
    el.innerHTML = '<p class="placeholder-text">추천 병원/미용샵이 없습니다.</p>';
    return;
  }

  const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
  el.innerHTML = ranked.map((p, i) => {
    const stars = p.avg > 0 ? "★".repeat(Math.round(p.avg)) + "☆".repeat(5 - Math.round(p.avg)) : "";
    const catLabel = CATEGORY_LABEL[p.category] || p.category;
    const hParams = new URLSearchParams({ name: p.name, city: p.city, region: p.region || "", category: p.category || "hospital" });
    return `
    <a href="hospital.html?${hParams}" class="best-place-card" style="text-decoration:none;">
      <span class="best-rank">${medals[i]}</span>
      <div class="best-info">
        <div class="best-name">${escapeHtml(p.name)}</div>
        <div class="best-meta">${escapeHtml(catLabel)} · ${escapeHtml(p.city)} ${escapeHtml(p.region || "")}</div>
        ${p.avg > 0 ? `<div class="best-stars" style="color:#f59e0b;font-size:13px;">${stars} <span style="color:#888;font-size:11px;">${p.avg.toFixed(1)} (${p.count}건)</span></div>` : `<div style="font-size:12px;color:#aaa;">${p.count}건 리뷰</div>`}
      </div>
    </a>`;
  }).join("");
}

// 영수증: private 버킷에 업로드 → 파일 경로 반환 (공개 URL 아님)
async function uploadReceiptImage(db, file) {
  if (!file || file.size === 0) return "";

  if (!db) return URL.createObjectURL(file); // 폴백

  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await db.storage
    .from("receipts")
    .upload(fileName, file, { contentType: file.type });

  if (error) {
    console.error("[펫리뷰] 영수증 업로드 실패:", error);
    return "";
  }

  // private 버킷: 파일 경로만 저장 (로드 시 signed URL 생성)
  return fileName;
}

// 리뷰 사진: public 버킷에 업로드 (최대 3장) → 공개 URL 배열 반환
async function uploadReviewPhotos(db, files) {
  const urls = [];
  if (!db || !files?.length) return urls;
  for (const file of Array.from(files).slice(0, 3)) {
    if (!file || file.size === 0) continue;
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `reviews/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await db.storage
      .from("pet-photos")
      .upload(fileName, file, { contentType: file.type });
    if (!error) {
      const { data: urlData } = db.storage.from("pet-photos").getPublicUrl(fileName);
      urls.push(urlData.publicUrl);
    }
  }
  return urls;
}

// 반려동물 사진: public 버킷에 업로드 → 공개 URL 반환
async function uploadPetPhoto(db, file) {
  if (!file || file.size === 0) return "";

  if (!db) return URL.createObjectURL(file);

  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await db.storage
    .from("pet-photos")
    .upload(fileName, file, { contentType: file.type });

  if (error) {
    console.error("[펫리뷰] 반려동물 사진 업로드 실패:", error);
    return "";
  }

  const { data: urlData } = db.storage.from("pet-photos").getPublicUrl(fileName);
  return urlData.publicUrl;
}

function bindCategoryToggle() {
  els.categoryButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedSearchCategory = btn.dataset.category;
      els.categoryButtons.forEach((item) => item.classList.remove("is-active"));
      btn.classList.add("is-active");
      document.body.dataset.theme = selectedSearchCategory === "grooming" ? "grooming" : "hospital";
      renderServiceTags(selectedSearchCategory);
      if (hasSearched) void renderSearchResults();
    });
  });
}

function bindTopCategoryTabs() {
  const tabs = document.querySelectorAll("#top-category-tabs .top-cat-btn");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const cat = tab.dataset.category;
      // 상단 탭 UI 동기화
      tabs.forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      // 기존 category toggle과 동기화
      els.categoryButtons.forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.category === cat);
      });
      selectedSearchCategory = cat;
      document.body.dataset.theme = cat === "grooming" ? "grooming" : "hospital";
      renderServiceTags(cat);
      if (hasSearched) void renderSearchResults();
      // 검색창 placeholder + 섹션 타이틀 동기화
      const nameInput = document.getElementById("search-name-input");
      const titleEl = document.getElementById("search-section-title");
      const subEl = document.getElementById("search-section-sub");
      if (cat === "grooming") {
        if (nameInput) nameInput.placeholder = "미용실 이름을 입력하세요 (예: 강남 아이러브펫)";
        if (titleEl) titleEl.textContent = "펫미용실 검색";
        if (subEl) subEl.textContent = "미용실 이름으로 바로 찾거나, 지역으로 둘러보세요.";
      } else {
        if (nameInput) nameInput.placeholder = "병원 이름을 입력하세요 (예: 압구정웰동물병원)";
        if (titleEl) titleEl.textContent = "동물병원 검색";
        if (subEl) subEl.textContent = "병원 이름으로 바로 찾거나, 지역으로 둘러보세요.";
      }
      // 검색 섹션으로 스크롤
      document.getElementById("search-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  // 기존 category toggle이 바뀔 때 상단 탭도 동기화
  els.categoryButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.category === btn.dataset.category));
    });
  });
}

function updateSearchBtn() {
  const btn = els.searchButton;
  if (!btn) return;
  // city가 선택돼 있으면 항상 검색 가능
  btn.disabled = false;
}

function bindSearch() {
  // 지역 검색 버튼
  els.searchButton?.addEventListener("click", () => void renderSearchResults());

  // 지역으로 찾기 토글
  const regionToggleBtn = document.getElementById("region-toggle-btn");
  const regionPanel = document.getElementById("region-search-panel");
  regionToggleBtn?.addEventListener("click", () => {
    const isOpen = !regionPanel.hidden;
    regionPanel.hidden = isOpen;
    regionToggleBtn.textContent = isOpen ? "🗺️ 지역으로 찾기" : "🗺️ 지역 검색 닫기";
  });

  // 이름 검색
  const nameInput = document.getElementById("search-name-input");
  const nameBtn = document.getElementById("search-name-btn");
  const autocompleteList = document.getElementById("search-autocomplete-list");

  async function doNameSearch() {
    const q = nameInput?.value.trim();
    if (!q) return;
    autocompleteList && (autocompleteList.hidden = true);
    const results = document.getElementById("search-results");
    if (results) results.innerHTML = '<p class="placeholder-text">검색 중...</p>';
    document.getElementById("sort-toggle").style.display = "none";

    try {
      const cat = selectedSearchCategory;
      const keyword = `${cat === "grooming" ? "펫미용 " : "동물병원 "}${q}`;
      const res = await fetch(`https://petreview.vercel.app/api/facilities?category=${cat}&city=전국&region=&keyword=${encodeURIComponent(q)}`);
      const data = await res.json();
      const places = data.places || [];

      if (!places.length) {
        if (results) results.innerHTML = `<p class="placeholder-text">"${q}" 검색 결과가 없습니다. 다른 이름으로 찾아보세요.</p>`;
        return;
      }
      searchFacilities = places;
      hasSearched = true;
      document.getElementById("sort-toggle").style.display = "";
      renderSearchResults();
    } catch {
      if (results) results.innerHTML = '<p class="placeholder-text">검색 중 오류가 발생했습니다.</p>';
    }
  }

  nameBtn?.addEventListener("click", doNameSearch);
  nameInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") doNameSearch(); });

  // 이름 검색 자동완성
  let acTimer;
  nameInput?.addEventListener("input", () => {
    clearTimeout(acTimer);
    const q = nameInput.value.trim();
    if (q.length < 2) { autocompleteList && (autocompleteList.hidden = true); return; }
    acTimer = setTimeout(() => void runNameAutocomplete(q), 300);
  });
  nameInput?.addEventListener("blur", () => setTimeout(() => { if (autocompleteList) autocompleteList.hidden = true; }, 200));
  nameInput?.addEventListener("focus", () => {
    if (nameInput.value.trim().length >= 2) runNameAutocomplete(nameInput.value.trim());
  });

  async function runNameAutocomplete(q) {
    try {
      const cat = selectedSearchCategory;
      const res = await fetch(`https://petreview.vercel.app/api/facilities?category=${cat}&city=전국&region=&keyword=${encodeURIComponent(q)}`);
      const data = await res.json();
      const places = (data.places || []).slice(0, 6);
      if (!places.length || !autocompleteList) return;
      autocompleteList.innerHTML = places.map((p) =>
        `<li data-name="${escapeHtml(p.name)}" data-addr="${escapeHtml(p.address || "")}" style="display:flex;flex-direction:column;padding:10px 14px;cursor:pointer;">
          <span style="font-weight:600;font-size:14px;">${escapeHtml(p.name)}</span>
          <span style="font-size:12px;color:#aaa;">${escapeHtml(p.address || p.region || "")}</span>
        </li>`
      ).join("");
      autocompleteList.hidden = false;
      autocompleteList.querySelectorAll("li").forEach((li) => {
        li.addEventListener("mousedown", () => {
          nameInput.value = li.dataset.name;
          autocompleteList.hidden = true;
          doNameSearch();
        });
      });
    } catch { /* ignore */ }
  }
}

async function initGeolocation() {
  const geoStatus = document.getElementById("geo-status");

  if (!navigator.geolocation) {
    geoState = 'denied';
    updateSearchBtn();
    els.searchRegion?.addEventListener("change", updateSearchBtn);
    return;
  }

  if (geoStatus) geoStatus.textContent = "📍 위치 확인 중...";

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      if (geoStatus) geoStatus.textContent = "";
      geoState = 'granted';
      try {
        const { latitude, longitude } = pos.coords;
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=ko`,
          { signal: AbortSignal.timeout(5000) }
        );
        const data = await res.json();
        const gu = data.address?.borough || data.address?.city_district;
        const state = data.address?.state || data.address?.city || "";
        // 시/도 매핑
        const cityMap = { "서울특별시": "서울", "경기도": "경기", "인천광역시": "인천", "부산광역시": "부산", "대구광역시": "대구", "광주광역시": "광주", "대전광역시": "대전", "울산광역시": "울산", "세종특별자치시": "세종", "강원특별자치도": "강원", "강원도": "강원", "충청북도": "충북", "충청남도": "충남", "전라북도": "전북", "전북특별자치도": "전북", "전라남도": "전남", "경상북도": "경북", "경상남도": "경남", "제주특별자치도": "제주" };
        const detectedCity = cityMap[state] || "서울";
        if (els.searchCity) els.searchCity.value = detectedCity;
        if (gu && els.searchRegion) els.searchRegion.value = gu;
        updateDistrictDatalist(detectedCity, "search-region-datalist");
      } catch { /* ignore */ }
      updateSearchBtn();
    },
    () => {
      if (geoStatus) geoStatus.textContent = "";
      geoState = 'denied';
      updateSearchBtn();
      els.searchRegion?.addEventListener("change", updateSearchBtn);
    },
    { timeout: 8000 }
  );
}

function bindReceiptPreview() {
  els.receiptInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      if (els.ocrStatus) els.ocrStatus.hidden = true;
      return;
    }

    // 업로드 중 표시
    if (els.ocrStatus) {
      els.ocrStatus.hidden = false;
      els.ocrStatus.className = "ocr-status is-loading";
      els.ocrStatus.textContent = "영수증 분석 중...";
    }

    renderImagePreview(file, els.receiptPreview);

    // 4초 후 완료 문구로 전환
    setTimeout(() => {
      if (els.ocrStatus) {
        els.ocrStatus.className = "ocr-status is-success";
        els.ocrStatus.textContent = "✅ 영수증 인증 접수 완료. 검수 후 인증 처리됩니다.";
      }
    }, 4000);
  });
}

function bindPetPhotoPreview() {
  els.petPhotoInput?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    renderImagePreview(file, els.petPhotoPreview);
  });
}

function bindReviewPhotosPreview() {
  els.reviewPhotosInput?.addEventListener("change", () => {
    const preview = els.reviewPhotosPreview;
    if (!preview) return;
    preview.innerHTML = "";
    const files = Array.from(els.reviewPhotosInput.files).slice(0, 3);
    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      const img = document.createElement("img");
      img.src = url;
      img.alt = "리뷰 사진 미리보기";
      img.style.cssText = "width:80px;height:80px;object-fit:cover;border-radius:8px;border:1px solid #f0e8e2;";
      preview.appendChild(img);
    });
    if (els.reviewPhotosInput.files.length > 3) {
      const note = document.createElement("p");
      note.style.cssText = "font-size:12px;color:#e57373;width:100%;margin:4px 0 0;";
      note.textContent = "처음 3장만 업로드됩니다.";
      preview.appendChild(note);
    }
  });
}

function bindTabBar() {
  const tabs = document.querySelectorAll(".tab-item[data-tab]");
  if (!tabs.length) return;

  function setActive(tabName) {
    tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.tab === tabName));
  }

  document.querySelector('.tab-item[data-tab="home"]')?.addEventListener("click", () => {
    setActive("home");
    document.getElementById("search-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.querySelector('.tab-item[data-tab="reviews"]')?.addEventListener("click", () => {
    setActive("reviews");
    document.getElementById("review-list-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.querySelector('.tab-item[data-tab="community"]')?.addEventListener("click", () => {
    window.location.href = "community.html";
  });

  document.querySelector('.tab-item[data-tab="mypage"]')?.addEventListener("click", () => {
    window.location.href = "mypage.html";
  });

  // 스크롤 위치에 따라 홈/후기 자동 전환
  const reviewSection = document.getElementById("review-list-section");
  if (reviewSection) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setActive(entry.isIntersecting ? "reviews" : "home");
        });
      },
      { threshold: 0.15 }
    );
    observer.observe(reviewSection);
  }
}

function bindStarSelects() {
  document.querySelectorAll(".star-select").forEach((group) => {
    const field = group.dataset.field;
    const buttons = Array.from(group.querySelectorAll("button"));
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = Number(btn.dataset.val);
        selectedScores[field] = val;
        buttons.forEach((b) => {
          b.classList.toggle("is-selected", Number(b.dataset.val) <= val);
        });
      });
    });
  });
}

function bindReviewForm() {
  els.reviewForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    // 로그인 필요
    if (!window.PetAuth?.isLoggedIn()) {
      openLoginModal();
      return;
    }

    // 별점 필수 체크
    const requiredScores = ["score_kindness", "score_price", "score_facility", "score_wait"];
    const missingScore = requiredScores.find((f) => !selectedScores[f]);
    if (missingScore) {
      const labelMap = { score_kindness: "친절도", score_price: "진료비 수준", score_facility: "시설 청결도", score_wait: "대기시간" };
      alert(`항목별 평가를 모두 입력해주세요.\n미입력: ${labelMap[missingScore]}`);
      document.querySelector(`.star-select[data-field="${missingScore}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const submitBtn = els.reviewForm.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "등록 중...";

    try {
      const formData = new FormData(els.reviewForm);
      const receiptFile = formData.get("receipt-image");
      const petPhotoFile = formData.get("pet-photo");
      const reviewPhotoFiles = els.reviewPhotosInput?.files;
      const db = window.supabaseClient;

      const [receiptPath, petPhotoUrl, reviewPhotoUrls] = await Promise.all([
        uploadReceiptImage(db, receiptFile),
        uploadPetPhoto(db, petPhotoFile),
        uploadReviewPhotos(db, reviewPhotoFiles),
      ]);

      const newRow = {
        place_name: String(formData.get("place-name")).trim(),
        kakao_place_id: selectedKakaoPlaceId || null,
        category: String(formData.get("place-category")),
        city: String(formData.get("place-city") || "서울").trim(),
        region: String(formData.get("place-region")).trim(),
        visit_date: String(formData.get("visit-date")),
        service_detail: String(formData.get("service-detail")).trim(),
        total_price: Number(formData.get("total-price")),
        short_review: String(formData.get("short-review")).trim(),
        receipt_image_url: receiptPath,
        pet_photo_url: petPhotoUrl || selectedPetPhotoUrl || null,
        review_photo_urls: reviewPhotoUrls.length ? reviewPhotoUrls : null,
        is_verified: false,
        status: receiptPath ? "pending" : "approved",
        user_id: window.PetAuth?.currentUser?.id ?? null,
        score_kindness: selectedScores.score_kindness || null,
        score_price: selectedScores.score_price || null,
        score_facility: selectedScores.score_facility || null,
        score_wait: selectedScores.score_wait || null,
        pet_name: selectedPetName || null,
        pet_species: selectedPetSpecies || null,
      };

      if (db) {
        const { data, error } = await db
          .from("reviews")
          .insert([newRow])
          .select()
          .single();

        if (error) {
          console.error("[펫리뷰] 리뷰 저장 실패:", error);
          alert("리뷰 저장에 실패했어요. 다시 시도해 주세요.");
          return;
        }

        reviews = [rowToReview(data), ...reviews];
      } else {
        reviews = [
          {
            id: Date.now(),
            placeName: newRow.place_name,
            category: newRow.category,
            region: newRow.region,
            visitDate: newRow.visit_date,
            serviceDetail: newRow.service_detail,
            totalPrice: newRow.total_price,
            shortReview: newRow.short_review,
            receiptPath: receiptPath,
            receiptImage: receiptPath.startsWith("http") ? receiptPath : "",
            petPhoto: petPhotoUrl,
            isVerified: newRow.is_verified,
          },
          ...reviews,
        ];
      }

      els.reviewForm.reset();
      els.receiptPreview.innerHTML = "";
      if (els.petPhotoPreview) els.petPhotoPreview.innerHTML = "";
      if (els.reviewPhotosPreview) els.reviewPhotosPreview.innerHTML = "";
      if (els.ocrStatus) els.ocrStatus.hidden = true;
      selectedScores = {};
      selectedPetName = "";
      selectedPetSpecies = "";
      selectedPetPhotoUrl = "";
      document.querySelectorAll(".star-select button").forEach((b) => b.classList.remove("is-selected"));
      renderServiceTags(selectedSearchCategory);
      renderReviewList();

      // 등록 완료 메시지 표시 (step 2 자리에)
      showFormStep(1);
      const step1 = document.getElementById("form-step-1");
      if (step1) {
        step1.innerHTML = `
          <div style="text-align:center;padding:32px 16px 24px;">
            <div style="font-size:52px;margin-bottom:12px;">🎉</div>
            <p style="font-size:18px;font-weight:700;color:#2a2520;margin:0 0 8px;">리뷰가 등록됐어요!</p>
            <p style="font-size:14px;color:#888;margin:0 0 6px;">영수증 검토 후 인증 뱃지가 부여됩니다.</p>
            <p style="font-size:13px;color:#ff8a65;margin:0 0 24px;">🏅 포인트 적립 &amp; 이벤트 기능이 곧 추가될 예정이에요!</p>
            <button type="button" class="primary-btn" id="write-another-btn">다른 리뷰 작성하기</button>
          </div>`;
        document.getElementById("write-another-btn")?.addEventListener("click", () => {
          step1.innerHTML = `
            <p class="form-step-hint">어떤 업종의 리뷰를 작성하시겠어요?</p>
            <div class="category-cards">
              <button type="button" class="category-card" data-category="hospital">
                <span class="category-card-icon">🏥</span>
                <strong class="category-card-name">동물병원</strong>
                <span class="category-card-desc">진료비 · 수술 · 건강검진</span>
              </button>
              <button type="button" class="category-card" data-category="grooming">
                <span class="category-card-icon">✂️</span>
                <strong class="category-card-name">미용샵</strong>
                <span class="category-card-desc">목욕 · 미용 · 가위컷</span>
              </button>
            </div>`;
        });
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "리뷰 등록하기";
    }
  });
}

function bindPlaceNameAutocomplete() {
  const input = els.placeNameInput;
  const dropdown = document.getElementById("place-name-dropdown");
  if (!input || !dropdown) return;

  let debounceTimer = null;
  let currentResults = [];
  let activeIndex = -1;

  function hideDropdown() {
    dropdown.hidden = true;
    dropdown.innerHTML = "";
    activeIndex = -1;
    currentResults = [];
  }

  function selectItem(place) {
    input.value = place.name;
    selectedKakaoPlaceId = place.kakaoId || "";
    if (place.region) els.placeRegionInput.value = place.region;
    if (place.category) els.placeCategorySelect.value = place.category;
    // address에서 시/도 추론
    if (place.address && els.placeCity) {
      const addr = place.address;
      const cityMatch = Object.keys(DISTRICT_MAP).concat(["인천","부산","대구","광주","대전","울산","세종","강원","충북","충남","전북","전남","경북","경남","제주"]).find(c => addr.includes(c));
      if (cityMatch) {
        els.placeCity.value = cityMatch;
        updateDistrictDatalist(cityMatch, "place-region-datalist");
      }
    }
    hideDropdown();
  }

  // 검색어 매칭 부분 강조
  function highlight(text, keyword) {
    if (!keyword) return escapeHtml(text);
    const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
    if (idx === -1) return escapeHtml(text);
    return (
      escapeHtml(text.slice(0, idx)) +
      `<mark class="autocomplete-highlight">${escapeHtml(text.slice(idx, idx + keyword.length))}</mark>` +
      escapeHtml(text.slice(idx + keyword.length))
    );
  }

  function renderDropdown(places, keyword) {
    if (!places.length) {
      dropdown.innerHTML = `
        <li class="autocomplete-empty">검색 결과가 없어요</li>
        <li class="autocomplete-direct" data-direct="${escapeHtml(keyword)}">
          <div class="autocomplete-name">✏️ "<strong>${escapeHtml(keyword)}</strong>" 직접 입력</div>
          <div class="autocomplete-meta">목록에 없는 업체도 등록 가능해요</div>
        </li>`;
      dropdown.hidden = false;
      return;
    }
    currentResults = places.slice(0, 8);
    dropdown.innerHTML = currentResults
      .map((p, i) => {
        const meta = [p.region ? escapeHtml(p.region) : "", escapeHtml(p.address || "")]
          .filter(Boolean).join(" · ");
        const badge = p.hasReview
          ? `<span class="autocomplete-review-badge">리뷰 있음</span>`
          : "";
        return `
          <li data-idx="${i}" role="option">
            <div class="autocomplete-name">${highlight(p.name, keyword)}${badge}</div>
            ${meta ? `<div class="autocomplete-meta">${meta}</div>` : ""}
          </li>`;
      })
      .join("");
    dropdown.hidden = false;
  }

  async function fetchFromKakao(keyword, category) {
    try {
      const url = `https://petreview.vercel.app/api/facilities?category=${encodeURIComponent(category)}&keyword=${encodeURIComponent(keyword)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return [];
      const json = await res.json();
      return json?.results ?? [];
    } catch {
      return [];
    }
  }

  async function fetchFromSupabase(keyword, category) {
    const db = window.supabaseClient;
    if (!db) return [];
    try {
      const { data } = await db
        .from("reviews")
        .select("place_name, region, category")
        .eq("category", category)
        .ilike("place_name", `%${keyword}%`)
        .limit(5);
      // 중복 제거 (같은 place_name)
      const seen = new Set();
      return (data || []).reduce((acc, r) => {
        if (!seen.has(r.place_name)) {
          seen.add(r.place_name);
          acc.push({ name: r.place_name, region: r.region, category: r.category, address: "", hasReview: true });
        }
        return acc;
      }, []);
    } catch {
      return [];
    }
  }

  async function fetchSuggestions(keyword) {
    const category = els.placeCategorySelect.value || "hospital";
    const [kakaoResults, supabaseResults] = await Promise.all([
      fetchFromKakao(keyword, category),
      fetchFromSupabase(keyword, category),
    ]);

    // 리뷰 있는 병원명 Set
    const reviewedNames = new Set(supabaseResults.map((r) => r.name));

    // Kakao 결과에 hasReview 플래그 추가
    const mergedKakao = kakaoResults.map((p) => ({ ...p, hasReview: reviewedNames.has(p.name) }));

    // Supabase 결과 중 Kakao에 없는 것만 추가 (리뷰만 있고 Kakao API에 없는 곳)
    const kakaoNames = new Set(kakaoResults.map((p) => p.name));
    const uniqueSupabase = supabaseResults.filter((p) => !kakaoNames.has(p.name));

    // 리뷰 있는 것 상단 정렬
    const combined = [...mergedKakao, ...uniqueSupabase];
    combined.sort((a, b) => (b.hasReview ? 1 : 0) - (a.hasReview ? 1 : 0));
    return combined;
  }

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const val = input.value.trim();
    if (val.length < 2) { hideDropdown(); return; }

    // 로딩 상태 표시
    dropdown.innerHTML = `<li class="autocomplete-empty">검색 중...</li>`;
    dropdown.hidden = false;

    debounceTimer = setTimeout(async () => {
      const places = await fetchSuggestions(val);
      renderDropdown(places, val);
    }, 150);
  });

  dropdown.addEventListener("mousedown", (e) => {
    // 직접 입력 선택
    const directLi = e.target.closest("li[data-direct]");
    if (directLi) {
      e.preventDefault();
      input.value = directLi.dataset.direct;
      hideDropdown();
      return;
    }
    const li = e.target.closest("li[data-idx]");
    if (!li) return;
    e.preventDefault();
    const idx = Number(li.dataset.idx);
    if (currentResults[idx]) selectItem(currentResults[idx]);
  });

  input.addEventListener("keydown", (e) => {
    if (dropdown.hidden) return;
    const items = dropdown.querySelectorAll("li[data-idx]");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      if (currentResults[activeIndex]) selectItem(currentResults[activeIndex]);
      return;
    } else if (e.key === "Escape") {
      hideDropdown();
      return;
    }
    items.forEach((item, i) =>
      item.classList.toggle("is-active", i === activeIndex)
    );
  });

  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      hideDropdown();
    }
  });
}

function renderServiceTags(category) {
  const group = document.getElementById("service-tag-group");
  const detailInput = document.getElementById("service-detail");
  if (!group) return;

  selectedServiceTags.clear();
  if (detailInput) detailInput.value = "";

  const tags = SERVICE_TAGS[category] ?? SERVICE_TAGS.hospital;
  group.innerHTML = tags
    .map((tag) => `<button type="button" class="tag-btn" data-tag="${tag}">${tag}</button>`)
    .join("");
}

function bindServiceTags() {
  const group = document.getElementById("service-tag-group");
  const detailInput = document.getElementById("service-detail");
  if (!group || !detailInput) return;

  group.addEventListener("click", (e) => {
    const btn = e.target.closest(".tag-btn");
    if (!btn) return;
    const tag = btn.dataset.tag;
    if (selectedServiceTags.has(tag)) {
      selectedServiceTags.delete(tag);
      btn.classList.remove("is-selected");
    } else {
      selectedServiceTags.add(tag);
      btn.classList.add("is-selected");
    }
    const nonEtc = [...selectedServiceTags].filter((t) => t !== "기타");
    detailInput.value = nonEtc.join(", ");
    if (selectedServiceTags.has("기타")) detailInput.focus();
  });
}

function bindReviewFilters() {
  // 업종 탭 버튼
  document.querySelectorAll(".category-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".category-tab-btn").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      els.filterCategory.value = btn.dataset.cat;
      // 테마 전환
      document.body.dataset.theme = btn.dataset.cat === "grooming" ? "grooming" : "hospital";
      renderReviewList();
      // 미용샵 탭: 이벤트 섹션 표시
      const evSection = document.getElementById("grooming-events-section");
      if (evSection) {
        if (btn.dataset.cat === "grooming") {
          evSection.hidden = false;
          loadGroomingEvents();
        } else {
          evSection.hidden = true;
        }
      }
    });
  });
  els.filterCategory.addEventListener("change", renderReviewList);
  els.filterCity?.addEventListener("change", renderReviewList);
  els.filterRegion?.addEventListener("input", renderReviewList);
}

async function loadGroomingEvents() {
  const db = window.supabaseClient;
  const listEl = document.getElementById("grooming-events-list");
  if (!db || !listEl) return;
  try {
    const { data } = await db
      .from("featured_places")
      .select("*")
      .eq("category", "grooming")
      .eq("tag", "이벤트")
      .eq("is_active", true)
      .order("sort_order");

    if (!data?.length) {
      listEl.innerHTML = `
        <div class="grooming-event-placeholder">
          <span class="banner-placeholder-label">이벤트</span>
          <span class="banner-placeholder-text">등록된 이벤트가 없습니다. 관리자에게 문의하세요.</span>
        </div>`;
      return;
    }
    listEl.innerHTML = data.map((fp) => `
      <div class="grooming-event-card">
        <strong class="grooming-event-name">${escapeHtml(fp.place_name)}</strong>
        <span class="grooming-event-region">서울 ${escapeHtml(fp.region || "")}</span>
        ${fp.address ? `<p class="helper-text" style="margin:4px 0 0;">${escapeHtml(fp.address)}</p>` : ""}
        ${fp.phone ? `<a href="tel:${escapeHtml(fp.phone)}" class="grooming-event-phone">📞 ${escapeHtml(fp.phone)}</a>` : ""}
      </div>`).join("");
  } catch { /* ignore */ }
}

function bindCtaButton() {
  document.getElementById("cta-review-btn")?.addEventListener("click", openReviewForm);
}

// ===== Web Share API 공통 함수 =====
// btn: 클립보드 복사 시 피드백 표시할 버튼 엘리먼트 (선택)
// 반환값: true → navigator.share 사용됨, false → 클립보드 복사됨
async function sharePlaceInfo(place, btn) {
  const cityStr = place.city || "서울";
  const catLabel = CATEGORY_LABEL[place.category] || place.category;
  const mapQ = encodeURIComponent(`${cityStr} ${place.region} ${place.name}`);
  const mapUrl = `https://map.naver.com/v5/search/${mapQ}`;

  const lines = [
    `📍 ${place.name}`,
    `${catLabel} · ${cityStr} ${place.region}`,
    place.address ? `주소: ${place.address}` : "",
    place.phone ? `전화: ${place.phone}` : "",
    `🗺️ ${mapUrl}`,
    `\n펫리뷰에서 실제 후기를 확인하세요 → https://biniare-del.github.io/petreview/`,
  ].filter(Boolean).join("\n");

  if (navigator.share) {
    try { await navigator.share({ title: `펫리뷰 - ${place.name}`, text: lines }); } catch { /* 취소 */ }
    return true;
  }
  try {
    await navigator.clipboard.writeText(lines);
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = "✅ 복사됨!";
      setTimeout(() => { btn.textContent = orig; }, 2000);
    }
  } catch { alert("공유 기능을 지원하지 않는 브라우저입니다."); }
  return false;
}

function bindSearchResultsSelection() {
  els.searchResults.addEventListener("click", async (event) => {
    // 전화 링크 클릭 시 폼으로 이동하지 않음
    if (event.target.closest(".place-phone-link")) return;

    // 공유 버튼 클릭 처리
    const shareBtn = event.target.closest(".place-share-btn");
    if (shareBtn) {
      event.stopPropagation();
      await sharePlaceInfo({
        name: shareBtn.dataset.shareName,
        category: shareBtn.dataset.shareCategory,
        city: shareBtn.dataset.shareCity,
        region: shareBtn.dataset.shareRegion,
        address: shareBtn.dataset.shareAddress,
        phone: shareBtn.dataset.sharePhone,
      }, shareBtn);
      return;
    }

    // 단골 버튼 클릭 처리
    const favBtn = event.target.closest(".favorite-btn");
    if (favBtn) {
      event.stopPropagation();
      if (!window.PetAuth?.isLoggedIn()) {
        openLoginModal();
        return;
      }
      const db = window.supabaseClient;
      const userId = requireAuthUserId();
      if (!userId) return;
      const placeName = favBtn.dataset.favName;
      if (favBtn.classList.contains("is-saved")) {
        const { error: delErr } = await db.from("favorites").delete().eq("user_id", userId).eq("place_name", placeName);
        if (delErr) { console.error("[펫리뷰] 단골 삭제 실패:", delErr.message); return; }
        favBtn.classList.remove("is-saved");
        userFavs.delete(placeName);
        favCounts[placeName] = Math.max(0, (favCounts[placeName] || 1) - 1);
        const cnt = favCounts[placeName];
        favBtn.textContent = cnt > 0 ? `♡ 단골 ${cnt}` : "♡ 단골";
      } else {
        const favInsert = {
          user_id: userId,
          place_name: placeName,
          category: favBtn.dataset.favCategory,
          region: favBtn.dataset.favRegion,
          address: favBtn.dataset.favAddress,
          phone: favBtn.dataset.favPhone,
        };
        if (favBtn.dataset.favId) favInsert.kakao_place_id = favBtn.dataset.favId;
        const { error } = await db.from("favorites").insert([favInsert]);
        if (!error) {
          favBtn.classList.add("is-saved");
          userFavs.add(placeName);
          favCounts[placeName] = (favCounts[placeName] || 0) + 1;
          const cnt = favCounts[placeName];
          favBtn.textContent = `♥ 단골 ${cnt}`;
        }
      }
      return;
    }

    // 병원 카드 클릭 → 상세 모달
    const card = event.target.closest(".search-place-card, .featured-place-card");
    if (card) {
      openPlaceDetail({
        kakaoId: card.dataset.placeId || "",
        name: card.dataset.placeName || "",
        category: card.dataset.placeCategory || selectedSearchCategory,
        city: card.dataset.placeCity || els.searchCity?.value || "서울",
        region: card.dataset.placeRegion || "",
        address: card.dataset.placeAddress || "",
        phone: card.dataset.placePhone || "",
      });
    }
  });
}

// ===== 배너 로드 =====
async function loadPetGreeting() {
  const greetingEl = document.getElementById("pet-greeting");
  const avatarEl = document.getElementById("pet-greeting-avatar");
  const textEl = document.getElementById("pet-greeting-text");
  if (!greetingEl || !avatarEl || !textEl) return;

  const db = window.supabaseClient;
  const userId = window.PetAuth?.currentUser?.id;

  // 비로그인: 로그인 CTA 표시
  if (!userId) {
    avatarEl.innerHTML = `<span>🐾</span>`;
    textEl.innerHTML = `<strong>펫리뷰에 오신 걸 환영해요!</strong><br>
      <span>소셜 로그인으로 리뷰 작성·마이펫 관리를 시작해보세요.</span><br>
      <span style="display:inline-flex;gap:6px;margin-top:6px;flex-wrap:wrap;">
        <button type="button" class="greeting-login-btn" id="greeting-google-btn"
          style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border:1.5px solid #ddd;border-radius:20px;background:#fff;font-size:12px;font-weight:600;cursor:pointer;">
          <svg width="14" height="14" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Google
        </button>
        <button type="button" class="greeting-login-btn" id="greeting-naver-btn"
          style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border:none;border-radius:20px;background:#03C75A;color:#fff;font-size:12px;font-weight:700;cursor:pointer;">
          <span style="font-weight:900;font-family:sans-serif;font-size:13px;line-height:1;">N</span>
          네이버
        </button>
        <button type="button" class="greeting-login-btn" id="greeting-all-btn"
          style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border:1.5px solid #16a34a;border-radius:20px;background:#f0fdf4;color:#16a34a;font-size:12px;font-weight:600;cursor:pointer;">
          전체 로그인 옵션 →
        </button>
      </span>`;
    greetingEl.hidden = false;
    greetingEl.onclick = (e) => {
      if (!e.target.closest(".greeting-login-btn")) openLoginModal();
    };

    document.getElementById("greeting-google-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      window.PetAuth?.signInWithGoogle();
    });
    document.getElementById("greeting-naver-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      window.PetAuth?.signInWithNaver();
    });
    document.getElementById("greeting-all-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      openLoginModal();
    });
    return;
  }

  // 로그인: 마이페이지로 이동
  greetingEl.onclick = () => { window.location.href = "mypage.html"; };

  if (!db) return;
  try {
    const { data: pets } = await db
      .from("pets")
      .select("name, species, photo_url")
      .eq("user_id", userId)
      .order("created_at")
      .limit(1);

    const nickRaw = window.PetAuth.getDisplayName?.() || "";
    const nick = nickRaw ? escapeHtml(nickRaw) : "보호자";

    const quickLinks = `<div class="greeting-quick-links">
      <a href="mypage.html#health" class="greeting-quick-btn" onclick="event.stopPropagation()">💊 건강기록</a>
      <a href="mypage.html#favorites" class="greeting-quick-btn" onclick="event.stopPropagation()">⭐ 단골병원</a>
      <a href="mypage.html" class="greeting-quick-btn" onclick="event.stopPropagation()">🐾 마이페이지</a>
    </div>`;

    if (!pets?.length) {
      avatarEl.innerHTML = `<span>🐾</span>`;
      textEl.innerHTML = `안녕하세요 <strong>${nick}님</strong>!<br><span style="color:#16a34a;font-weight:600;">반려동물을 등록해보세요 →</span>${quickLinks}`;
      greetingEl.hidden = false;
      return;
    }

    const pet = pets[0];
    avatarEl.innerHTML = pet.photo_url
      ? `<img src="${escapeHtml(pet.photo_url)}" alt="${escapeHtml(pet.name)}" />`
      : `<span>${pet.species === "고양이" ? "🐱" : "🐶"}</span>`;

    textEl.innerHTML = `안녕하세요 <strong>${nick}님</strong>! 🐾<br><span>${escapeHtml(pet.name)}와 함께 오셨군요</span>${quickLinks}`;
    greetingEl.hidden = false;
  } catch { /* ignore */ }
}

async function loadBanner() {
  const db = window.supabaseClient;
  const slot = document.getElementById("banner-slot");
  if (!db || !slot) return;

  const placeholderHtml = `
    <div class="banner-placeholder">
      <span class="banner-placeholder-label">ADS</span>
      <span class="banner-placeholder-text">광고 배너 모집 중 · 문의는 관리자에게</span>
    </div>`;

  try {
    const { data, error } = await db
      .from("banners")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .limit(1);

    slot.hidden = false;

    // 테이블 없거나 데이터 없으면 플레이스홀더
    if (error || !data?.length) {
      slot.innerHTML = placeholderHtml;
      return;
    }

    const b = data[0];
    const img = `<img src="${escapeHtml(b.image_url || "")}" alt="${escapeHtml(b.alt_text || "")}" class="banner-img" />`;
    slot.innerHTML = b.link_url
      ? `<a href="${escapeHtml(b.link_url)}" target="_blank" rel="noopener noreferrer">${img}</a>`
      : img;
  } catch {
    // 네트워크 오류 등 → 플레이스홀더라도 표시
    slot.hidden = false;
    slot.innerHTML = placeholderHtml;
  }
}

// ===== 헤더 인증 UI =====
function updateHeaderAuth() {
  const area = document.getElementById("header-auth");
  if (!area) return;
  bindHamburger();

  if (window.PetAuth?.isLoggedIn()) {
    const name = window.PetAuth.getDisplayName();
    const avatar = window.PetAuth.getAvatarUrl();
    const avatarHtml = avatar
      ? `<a href="mypage.html"><img src="${escapeHtml(avatar)}" class="header-avatar" alt="프로필" /></a>`
      : `<a href="mypage.html"><span class="header-avatar-placeholder">${escapeHtml(name[0] || "?")}</span></a>`;
    const adminLink = window.PetAuth.isAdmin()
      ? `<a href="admin.html" class="header-auth-link">관리자</a>`
      : "";
    area.innerHTML = `
      ${avatarHtml}
      <span class="header-username">${escapeHtml(name)}</span>
      <a href="mypage.html" class="header-auth-link">마이페이지</a>
      ${adminLink}
      <button class="header-logout-btn" id="logout-btn">로그아웃</button>`;
    document.getElementById("logout-btn")?.addEventListener("click", async () => {
      await window.PetAuth.signOut();
    });
    const mobileAdminLink = window.PetAuth.isAdmin()
      ? `<a href="admin.html" class="mobile-nav-link">관리자 페이지</a>` : "";
    updateMobileAuthArea(`
      <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f0e8e2;">
        ${avatarHtml}<span style="font-weight:600;font-size:14px;">${escapeHtml(name)}</span>
      </div>
      <a href="mypage.html" class="mobile-nav-link">마이페이지</a>
      ${mobileAdminLink}
      <button class="mobile-logout-btn" id="mobile-logout-btn">로그아웃</button>`);
    document.getElementById("mobile-logout-btn")?.addEventListener("click", async () => {
      await window.PetAuth.signOut();
    });
  } else {
    area.innerHTML = `<button class="auth-login-btn" id="login-btn">로그인</button>`;
    document.getElementById("login-btn")?.addEventListener("click", openLoginModal);
    updateMobileAuthArea(`<button class="auth-login-btn" id="mobile-login-btn" style="margin-top:8px;">로그인</button>`);
    document.getElementById("mobile-login-btn")?.addEventListener("click", openLoginModal);
  }
}

// ===== 리뷰 폼 플로우 =====

// CTA 버튼 → 로그인 체크 → 폼 step 1 열기
function openReviewForm() {
  if (!window.PetAuth?.isLoggedIn()) {
    openLoginModal(); // saveFormDraft() 포함 → 로그인 후 복원
    return;
  }
  document.getElementById("review-form-section")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
  showFormStep(1);
}

function showFormStep(step) {
  document.getElementById("form-step-1").hidden = step !== 1;
  document.getElementById("form-step-2").hidden = step !== 2;
}

// 업종 카드 선택 → step 2 표시 + 테마 + 서비스 태그 설정
function selectFormCategory(category) {
  formCategory = category;

  // hidden input 값 설정
  const catInput = document.getElementById("place-category");
  if (catInput) catInput.value = category;

  // 폼 영역 테마
  const step2 = document.getElementById("form-step-2");
  if (step2) step2.dataset.formTheme = category;

  // 선택 업종 뱃지 렌더링
  const badge = document.getElementById("form-selected-category");
  if (badge) {
    const label = category === "grooming" ? "✂️ 펫미용실" : "🏥 동물병원";
    badge.innerHTML = `
      <span class="form-category-badge ${category}">${label}</span>
      <button type="button" class="form-category-change-btn" id="form-category-change-btn">
        업종 변경
      </button>`;
    document.getElementById("form-category-change-btn")
      ?.addEventListener("click", () => {
        showFormStep(1);
      });
  }

  // 서비스 태그 재렌더링
  renderServiceTags(category);
  showFormStep(2);

  // 마이펫 선택 UI 로드
  loadPetSelector();
}

async function loadPetSelector() {
  const container = document.getElementById("pet-selector-list");
  if (!container) return;

  const db = window.supabaseClient;
  const userId = window.PetAuth?.currentUser?.id;
  if (!db || !userId) {
    container.innerHTML = `<a href="mypage.html#pets" style="font-size:13px;color:#0f6e56;">+ 마이페이지에서 반려동물 등록하기 →</a>`;
    return;
  }

  const { data: pets } = await db.from("pets").select("id, name, species, photo_url").eq("user_id", userId);

  selectedPetName = "";
  selectedPetSpecies = "";
  selectedPetPhotoUrl = "";

  const addInlineBtn = `<button type="button" class="pet-add-inline-btn" id="pet-add-inline-toggle">＋ 마이펫 추가</button>`;
  const inlineForm = `
    <div id="pet-inline-form" class="pet-inline-form" hidden>
      <input type="text" id="pet-inline-name" placeholder="이름 (예: 보리)" maxlength="20" class="pet-inline-input" />
      <select id="pet-inline-species" class="pet-inline-select">
        <option value="강아지">🐶 강아지</option>
        <option value="고양이">🐱 고양이</option>
        <option value="기타">기타</option>
      </select>
      <button type="button" id="pet-inline-save" class="pet-inline-save-btn">등록</button>
    </div>`;

  if (!pets?.length) {
    container.innerHTML = addInlineBtn + inlineForm;
    bindPetInlineForm(container, userId);
    return;
  }

  container.innerHTML = pets.map(p => {
    const icon = p.species === "고양이" ? "🐱" : "🐶";
    const photoAttr = p.photo_url ? ` data-photo="${escapeHtml(p.photo_url)}"` : "";
    return `<button type="button" class="pet-select-btn" data-name="${escapeHtml(p.name)}" data-species="${escapeHtml(p.species || "")}"${photoAttr}>${icon} ${escapeHtml(p.name)}</button>`;
  }).join("") + addInlineBtn + inlineForm;

  bindPetInlineForm(container, userId);

  container.querySelectorAll(".pet-select-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".pet-select-btn").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      selectedPetName = btn.dataset.name;
      selectedPetSpecies = btn.dataset.species;
      selectedPetPhotoUrl = btn.dataset.photo || "";

      // 펫 사진이 있으면 미리보기에 반영 (새 파일 업로드 없는 경우 사용)
      const previewEl = document.getElementById("pet-photo-preview");
      const fileInput = document.getElementById("pet-photo");
      if (previewEl && selectedPetPhotoUrl && (!fileInput?.files?.length)) {
        previewEl.innerHTML = `<img src="${escapeHtml(selectedPetPhotoUrl)}" style="width:72px;height:72px;object-fit:cover;border-radius:14px;box-shadow:0 2px 8px rgba(0,0,0,0.1);" />`;
      }
    });
  });
}

function bindPetInlineForm(container, userId) {
  const toggle = container.querySelector("#pet-add-inline-toggle");
  const form = container.querySelector("#pet-inline-form");
  if (!toggle || !form) return;

  toggle.addEventListener("click", () => {
    form.hidden = !form.hidden;
    if (!form.hidden) container.querySelector("#pet-inline-name")?.focus();
  });

  container.querySelector("#pet-inline-save")?.addEventListener("click", async () => {
    const name = container.querySelector("#pet-inline-name")?.value.trim();
    const species = container.querySelector("#pet-inline-species")?.value;
    if (!name) { container.querySelector("#pet-inline-name").focus(); return; }

    const db = window.supabaseClient;
    const saveBtn = container.querySelector("#pet-inline-save");
    saveBtn.disabled = true;
    saveBtn.textContent = "저장 중...";

    const { data, error } = await db.from("pets").insert([{ user_id: userId, name, species }]).select().single();
    if (error) {
      saveBtn.disabled = false;
      saveBtn.textContent = "등록";
      alert("등록 실패: " + error.message);
      return;
    }
    // 등록 성공 → 셀렉터 새로고침
    await loadPetSelector();
    // 방금 등록한 펫 자동 선택
    container.querySelectorAll(".pet-select-btn").forEach(btn => {
      if (btn.dataset.name === name) btn.click();
    });
  });
}

function bindCategorySelection() {
  document.getElementById("form-step-1")?.addEventListener("click", (e) => {
    const card = e.target.closest(".category-card[data-category]");
    if (!card) return;
    selectFormCategory(card.dataset.category);
  });
}

// ===== 햄버거 메뉴 =====
let _hamburgerBound = false;
function bindSortToggle() {
  els.sortToggle?.addEventListener('click', (e) => {
    const btn = e.target.closest('.sort-btn');
    if (!btn || btn.dataset.sort === searchSortMode) return;
    searchSortMode = btn.dataset.sort;
    els.sortToggle.querySelectorAll('.sort-btn').forEach(b => {
      b.classList.toggle('is-active', b.dataset.sort === searchSortMode);
    });
    if (searchSortMode === 'fav') {
      searchFacilities.sort((a, b) => {
        const diff = (favCounts[b.name] || 0) - (favCounts[a.name] || 0);
        return diff !== 0 ? diff : a.name.localeCompare(b.name, "ko");
      });
    } else {
      searchFacilities.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    }
    renderSearchPage(1);
  });
}

function bindHamburger() {
  if (_hamburgerBound) return;
  const btn = document.getElementById("header-hamburger-btn");
  const nav = document.getElementById("header-mobile-nav");
  if (!btn || !nav) return;
  _hamburgerBound = true;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = nav.classList.toggle("is-open");
    btn.setAttribute("aria-expanded", open);
    btn.textContent = open ? "✕" : "☰";
  });
  document.addEventListener("click", (e) => {
    if (nav.classList.contains("is-open") && !nav.contains(e.target) && e.target !== btn) {
      nav.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
      btn.textContent = "☰";
    }
  });
  // 모바일 메뉴 내 링크 클릭 시 닫기
  nav.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      nav.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
      btn.textContent = "☰";
    }
  });
}

function updateMobileAuthArea(html) {
  const el = document.getElementById("mobile-auth-content");
  if (el) el.innerHTML = html;
}

// ===== 세션 만료 공통 처리 =====
// 로그인 필요 작업 전 userId 확인. 세션 만료 시 모달 열고 null 반환.
function requireAuthUserId() {
  const userId = window.PetAuth?.currentUser?.id;
  if (!userId) { openLoginModal(); return null; }
  return userId;
}

// ===== 로그인 모달 =====
function openLoginModal() {
  const modal = document.getElementById("login-modal");
  if (modal) {
    saveFormDraft(); // 로그인 리다이렉트 전에 폼 내용 저장
    modal.hidden = false;
  }
}

function closeLoginModal() {
  const modal = document.getElementById("login-modal");
  if (modal) modal.hidden = true;
}

function bindLoginModal() {
  document.getElementById("modal-close")?.addEventListener("click", closeLoginModal);
  document.getElementById("login-modal")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeLoginModal();
  });
  document.getElementById("btn-kakao")?.addEventListener("click", () => window.PetAuth?.signInWithKakao());
  document.getElementById("btn-naver")?.addEventListener("click", () => window.PetAuth?.signInWithNaver());
  document.getElementById("btn-google")?.addEventListener("click", () => window.PetAuth?.signInWithGoogle());
}

// ===== 좋아요 로드 =====
async function loadLikes() {
  const db = window.supabaseClient;
  if (!db || !reviews.length) return;

  const ids = reviews.map((r) => r.id).filter(Boolean);
  if (!ids.length) return;

  try {
    const { data } = await db.from("review_likes").select("review_id").in("review_id", ids);
    reviewLikes = {};
    (data || []).forEach((l) => {
      reviewLikes[l.review_id] = (reviewLikes[l.review_id] || 0) + 1;
    });
  } catch { /* ignore */ }

  userLikedReviews = new Set();
  if (window.PetAuth?.isLoggedIn()) {
    try {
      const { data } = await db
        .from("review_likes")
        .select("review_id")
        .eq("user_id", window.PetAuth.currentUser.id)
        .in("review_id", ids);
      (data || []).forEach((l) => userLikedReviews.add(l.review_id));
    } catch { /* ignore */ }
  }
}

// ===== 댓글 수 로드 =====
async function loadCommentCounts() {
  const db = window.supabaseClient;
  if (!db || !reviews.length) return;
  const ids = reviews.map((r) => r.id).filter(Boolean);
  if (!ids.length) return;
  try {
    const { data } = await db.from("review_comments").select("review_id").in("review_id", ids);
    commentCounts = {};
    (data || []).forEach((c) => {
      commentCounts[c.review_id] = (commentCounts[c.review_id] || 0) + 1;
    });
  } catch { /* ignore */ }
}

// ===== 좋아요 처리 =====
async function handleLike(reviewId, btn) {
  const db = window.supabaseClient;
  if (!db) return;
  const userId = requireAuthUserId();
  if (!userId) return;

  try {
    if (userLikedReviews.has(reviewId)) {
      const { error } = await db.from("review_likes").delete().eq("review_id", reviewId).eq("user_id", userId);
      if (error) { console.error("[펫리뷰] 좋아요 취소 실패:", error.message); return; }
      userLikedReviews.delete(reviewId);
      reviewLikes[reviewId] = Math.max(0, (reviewLikes[reviewId] || 1) - 1);
      btn.classList.remove("is-liked");
      const cnt = reviewLikes[reviewId];
      const countEl = btn.querySelector(".like-count");
      if (cnt > 0) {
        if (countEl) countEl.textContent = cnt;
        else btn.insertAdjacentHTML("beforeend", ` <span class="like-count">${cnt}</span>`);
      } else {
        countEl?.remove();
      }
    } else {
      const { error } = await db.from("review_likes").insert([{ review_id: reviewId, user_id: userId }]);
      if (error) { console.error("[펫리뷰] 좋아요 추가 실패:", error.message); return; }
      userLikedReviews.add(reviewId);
      reviewLikes[reviewId] = (reviewLikes[reviewId] || 0) + 1;
      const cnt = reviewLikes[reviewId];
      btn.classList.add("is-liked");
      const countEl = btn.querySelector(".like-count");
      if (countEl) countEl.textContent = cnt;
      else btn.insertAdjacentHTML("beforeend", ` <span class="like-count">${cnt}</span>`);
    }
  } catch (err) {
    console.error("[펫리뷰] 좋아요 처리 중 오류:", err);
  }
}

// ===== 리뷰 액션 이벤트 바인딩 (좋아요 / 신고) =====
function bindReviewActions() {
  async function handleReviewClick(e) {
    const likeBtn = e.target.closest(".like-btn");
    if (likeBtn) {
      if (!window.PetAuth?.isLoggedIn()) { openLoginModal(); return; }
      await handleLike(likeBtn.dataset.reviewId, likeBtn);
      return;
    }
    const reportBtn = e.target.closest(".report-btn");
    if (reportBtn) {
      if (!window.PetAuth?.isLoggedIn()) { openLoginModal(); return; }
      openReportModal(reportBtn.dataset.reviewId);
      return;
    }
    // 관리자: 숨기기/공개
    const hideBtn = e.target.closest(".admin-hide-btn");
    if (hideBtn && window.PetAuth?.isAdmin()) {
      const db = window.supabaseClient;
      const reviewId = hideBtn.dataset.reviewId;
      const isHidden = hideBtn.dataset.hidden === "1";
      const { error } = await db.from("reviews").update({ is_hidden: !isHidden }).eq("id", reviewId);
      if (!error) {
        hideBtn.dataset.hidden = isHidden ? "0" : "1";
        hideBtn.textContent = isHidden ? "🔒 숨기기" : "🔓 공개";
        const review = reviews.find(r => r.id === reviewId);
        if (review) review.isHidden = !isHidden;
      }
      return;
    }
    // 관리자: 삭제
    const deleteBtn = e.target.closest(".admin-delete-btn");
    if (deleteBtn && window.PetAuth?.isAdmin()) {
      if (!confirm("리뷰를 완전히 삭제하시겠습니까?")) return;
      const db = window.supabaseClient;
      const reviewId = deleteBtn.dataset.reviewId;
      const { error } = await db.from("reviews").delete().eq("id", reviewId);
      if (!error) {
        reviews = reviews.filter(r => r.id !== reviewId);
        renderReviewList();
      }
      return;
    }
    // 카드 클릭 → 리뷰 상세 모달
    const card = e.target.closest(".card[data-review-id]");
    if (card) openReviewDetailModal(card.dataset.reviewId);
  }
  els.reviewList.addEventListener("click", handleReviewClick);
  document.getElementById("recent-review-list")?.addEventListener("click", handleReviewClick);
}

// ===== 신고 모달 =====
function openReportModal(reviewId) {
  reportingReviewId = reviewId;
  // 라디오 초기화
  document.querySelectorAll("input[name='report-reason']").forEach((r) => r.checked = false);
  const modal = document.getElementById("report-modal");
  if (modal) modal.hidden = false;
}

function bindReportModal() {
  document.getElementById("report-modal-close")?.addEventListener("click", () => {
    document.getElementById("report-modal").hidden = true;
  });
  document.getElementById("report-modal")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) e.currentTarget.hidden = true;
  });
  document.getElementById("report-submit-btn")?.addEventListener("click", async () => {
    const reason = document.querySelector("input[name='report-reason']:checked")?.value;
    if (!reason) { alert("신고 사유를 선택해주세요."); return; }
    const db = window.supabaseClient;
    if (!db || !reportingReviewId) return;
    const userId = requireAuthUserId();
    if (!userId) { document.getElementById("report-modal").hidden = true; return; }
    const { error } = await db.from("review_reports").insert([{
      review_id: reportingReviewId,
      user_id: userId,
      reason,
    }]);
    if (error) {
      alert(error.code === "23505" ? "이미 신고한 리뷰입니다." : "신고 처리 중 오류가 발생했습니다.");
    } else {
      alert("신고가 접수되었습니다. 검토 후 처리해드리겠습니다.");
    }
    document.getElementById("report-modal").hidden = true;
  });
}

// ===== 리뷰 상세 모달 =====
async function openReviewDetailModal(reviewId) {
  const review = reviews.find(r => r.id === reviewId);
  if (!review) return;

  const modal = document.getElementById("review-detail-modal");
  if (!modal) return;
  modal.hidden = false;
  document.body.style.overflow = "hidden";

  // 리뷰 내용 렌더링
  const scoresHtml = (review.scoreKindness || review.scorePrice || review.scoreFacility || review.scoreWait) ? `
    <div class="card-scores" style="margin:12px 0;">
      ${review.scoreKindness ? `<div class="score-row"><span class="score-label">친절도</span><div class="score-bar-wrap"><div class="score-bar" style="width:${review.scoreKindness*20}%"></div></div><span class="score-val">${review.scoreKindness}.0</span></div>` : ""}
      ${review.scorePrice ? `<div class="score-row"><span class="score-label">진료비</span><div class="score-bar-wrap"><div class="score-bar" style="width:${review.scorePrice*20}%"></div></div><span class="score-val">${review.scorePrice}.0</span></div>` : ""}
      ${review.scoreFacility ? `<div class="score-row"><span class="score-label">시설</span><div class="score-bar-wrap"><div class="score-bar" style="width:${review.scoreFacility*20}%"></div></div><span class="score-val">${review.scoreFacility}.0</span></div>` : ""}
      ${review.scoreWait ? `<div class="score-row"><span class="score-label">대기</span><div class="score-bar-wrap"><div class="score-bar" style="width:${review.scoreWait*20}%"></div></div><span class="score-val">${review.scoreWait}.0</span></div>` : ""}
    </div>` : "";

  document.getElementById("review-detail-content").innerHTML = `
    <div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:14px;">
      <div class="card-pet-avatar" style="width:72px;height:72px;font-size:36px;border-radius:20px;flex-shrink:0;">
        ${review.petPhoto ? `<img src="${escapeHtml(review.petPhoto)}" style="width:100%;height:100%;object-fit:cover;border-radius:20px;" />` : `<div class="pet-icon pet-icon--${review.petSpecies === "고양이" ? "cat" : "dog"}"></div>`}
      </div>
      <div>
        <div style="font-size:20px;font-weight:800;color:#1a1a1a;">${review.petName ? escapeHtml(review.petName) : "반려동물"} <span style="font-size:13px;font-weight:400;color:#999;">${escapeHtml(review.petSpecies || "")}</span></div>
        <div style="font-size:13px;color:#aaa;margin-top:3px;">${review.userNickname ? escapeHtml(review.userNickname) + " · " : ""}${escapeHtml(review.visitDate || "")}${review.isVerified ? ' <span class="verified-badge" style="font-size:10px;">✔ 영수증 인증</span>' : ""}</div>
      </div>
    </div>
    ${scoresHtml}
    <div style="display:flex;align-items:center;gap:8px;margin:8px 0;">
      <span class="card-price">₩ ${formatPrice(review.totalPrice)}</span>
      <span style="font-size:12px;color:#888;">${escapeHtml(review.serviceDetail || "")}</span>
    </div>
    <p style="font-size:15px;line-height:1.6;color:#333;margin:10px 0;">${escapeHtml(review.shortReview || "")}</p>
    ${(review.reviewPhotoUrls || []).length ? `<div class="review-images">${(review.reviewPhotoUrls).map(u => `<img src="${escapeHtml(u)}" class="review-thumb" />`).join("")}</div>` : ""}`;

  // 병원 정보
  const mapQ = encodeURIComponent(`${review.city || "서울"} ${review.region} ${review.placeName}`);
  document.getElementById("review-detail-place").innerHTML = `
    <div style="background:#f6fdf9;border-radius:12px;padding:12px 14px;">
      <div style="font-size:15px;font-weight:700;color:#0f6e56;">${escapeHtml(review.placeName)}</div>
      <div style="font-size:12px;color:#aaa;margin-top:2px;">${escapeHtml(review.city || "서울")} ${escapeHtml(review.region || "")}</div>
      <a href="https://map.naver.com/v5/search/${mapQ}" target="_blank" rel="noopener noreferrer" class="map-link-btn" style="margin-top:10px;display:inline-block;">🗺️ 지도 보기</a>
    </div>`;

  // 댓글 로드
  loadReviewComments(reviewId);
}

function closeReviewDetailModal() {
  document.getElementById("review-detail-modal").hidden = true;
  document.body.style.overflow = "";
}

async function loadReviewComments(reviewId) {
  const db = window.supabaseClient;
  const countEl = document.getElementById("review-detail-comment-count");
  const listEl = document.getElementById("review-detail-comments");
  const formEl = document.getElementById("review-detail-comment-form");

  if (!db) { listEl.innerHTML = ""; return; }

  const { data, error } = await db
    .from("review_comments")
    .select("*")
    .eq("review_id", reviewId)
    .order("created_at", { ascending: true });

  if (error) { listEl.innerHTML = '<p class="placeholder-text">댓글을 불러올 수 없습니다.</p>'; return; }

  let comments = data || [];
  const currentUserId = window.PetAuth?.currentUser?.id || null;

  // 닉네임 조회
  if (comments.length) {
    const uids = [...new Set(comments.map(c => c.user_id).filter(Boolean))];
    if (uids.length) {
      const { data: pd } = await db.from("profiles").select("id, nickname").in("id", uids);
      const pm = {};
      (pd || []).forEach(p => { pm[p.id] = p; });
      comments = comments.map(c => ({ ...c, nickname: pm[c.user_id]?.nickname || "익명" }));
    }
  }

  // 댓글 좋아요 조회
  let commentLikeCounts = {};
  let userLikedComments = new Set();
  if (comments.length) {
    const cids = comments.map(c => c.id);
    const { data: likes } = await db.from("comment_likes").select("comment_id, user_id").in("comment_id", cids);
    (likes || []).forEach(l => {
      commentLikeCounts[l.comment_id] = (commentLikeCounts[l.comment_id] || 0) + 1;
      if (l.user_id === currentUserId) userLikedComments.add(l.comment_id);
    });
  }

  if (countEl) countEl.textContent = comments.length;

  listEl.innerHTML = comments.length === 0
    ? '<p class="placeholder-text">첫 댓글을 남겨보세요.</p>'
    : comments.map(c => {
        const likeCount = commentLikeCounts[c.id] || 0;
        const isLiked = userLikedComments.has(c.id);
        const isOwn = currentUserId && c.user_id === currentUserId;
        return `
          <div class="comment-item" data-comment-id="${escapeHtml(c.id)}">
            <div class="comment-header">
              <span class="comment-author">${escapeHtml(c.nickname || "익명")}</span>
              <span class="comment-date">${(c.created_at || "").slice(0, 10)}</span>
            </div>
            <p class="comment-content">${escapeHtml(c.content)}</p>
            <div class="comment-actions">
              <button class="comment-like-btn${isLiked ? " is-liked" : ""}" data-comment-id="${escapeHtml(c.id)}">
                ❤️ ${likeCount > 0 ? likeCount : "좋아요"}
              </button>
              ${isOwn ? `<button class="comment-delete-btn" data-comment-id="${escapeHtml(c.id)}">삭제</button>` : ""}
            </div>
          </div>`;
      }).join("");

  listEl.querySelectorAll(".comment-like-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!currentUserId) { if (typeof openLoginModal === "function") openLoginModal(); return; }
      const cid = btn.dataset.commentId;
      const liked = btn.classList.contains("is-liked");
      if (liked) {
        await db.from("comment_likes").delete().eq("comment_id", cid).eq("user_id", currentUserId);
      } else {
        await db.from("comment_likes").insert([{ comment_id: cid, user_id: currentUserId }]);
      }
      loadReviewComments(reviewId);
    });
  });

  listEl.querySelectorAll(".comment-delete-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("댓글을 삭제하시겠습니까?")) return;
      await db.from("review_comments").delete().eq("id", btn.dataset.commentId).eq("user_id", currentUserId);
      loadReviewComments(reviewId);
    });
  });

  // 댓글 폼
  const isLoggedIn = window.PetAuth?.isLoggedIn();
  if (formEl) {
    if (isLoggedIn) {
      formEl.innerHTML = `
        <div style="display:flex;gap:8px;margin-top:4px;">
          <input id="review-comment-input" type="text" placeholder="댓글을 입력하세요." maxlength="300"
            style="flex:1;padding:8px 12px;border:1px solid #e0e0e0;border-radius:20px;font-size:14px;font-family:inherit;outline:none;" />
          <button id="review-comment-submit" class="primary-btn" style="padding:8px 16px;font-size:13px;border-radius:20px;">등록</button>
        </div>`;
      const submitBtn = document.getElementById("review-comment-submit");
      const input = document.getElementById("review-comment-input");
      const doSubmit = async () => {
        const content = input.value.trim();
        if (!content) return;
        const userId = window.PetAuth.currentUser.id;
        submitBtn.disabled = true;
        const { error: insErr } = await db.from("review_comments").insert([{ review_id: reviewId, user_id: userId, content }]);
        if (insErr) { alert("댓글 등록 실패: " + insErr.message); submitBtn.disabled = false; return; }
        input.value = "";
        submitBtn.disabled = false;
        loadReviewComments(reviewId);
      };
      submitBtn.addEventListener("click", doSubmit);
      input.addEventListener("keydown", e => { if (e.key === "Enter") doSubmit(); });
    } else {
      formEl.innerHTML = `<p style="font-size:13px;color:#aaa;text-align:center;padding:10px 0;">댓글을 달려면 <button onclick="openLoginModal()" style="background:none;border:none;color:#0f6e56;font-weight:600;font-size:13px;cursor:pointer;padding:0;">로그인</button>이 필요합니다.</p>`;
    }
  }
}

function bindReviewDetailModal() {
  document.getElementById("review-detail-close")?.addEventListener("click", closeReviewDetailModal);
  document.getElementById("review-detail-modal")?.addEventListener("click", e => {
    if (e.target === e.currentTarget) closeReviewDetailModal();
  });
}

// ===== 병원 상세 모달 =====
function bindPlaceDetailModal() {
  document.getElementById("place-detail-close")?.addEventListener("click", () => {
    document.getElementById("place-detail-modal").hidden = true;
  });
  document.getElementById("place-detail-modal")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) e.currentTarget.hidden = true;
  });
}

async function openPlaceDetail(place) {
  const modal = document.getElementById("place-detail-modal");
  if (!modal) return;

  // 기본 정보 렌더링
  document.getElementById("detail-place-name").textContent = place.name;
  const cityStr = place.city || "서울";
  document.getElementById("detail-place-meta").textContent =
    `${CATEGORY_LABEL[place.category] || place.category} · ${cityStr} ${place.region}`;

  const addrEl = document.getElementById("detail-place-address");
  addrEl.textContent = place.address || "";
  addrEl.style.display = place.address ? "" : "none";

  const phoneEl = document.getElementById("detail-place-phone");
  if (place.phone) {
    phoneEl.href = `tel:${place.phone}`;
    phoneEl.textContent = `📞 ${place.phone}`;
    phoneEl.style.display = "";
  } else {
    phoneEl.style.display = "none";
  }

  const mapBtn = document.getElementById("detail-map-btn");
  const q = encodeURIComponent(`${cityStr} ${place.region} ${place.name}`);
  const mapUrl = `https://map.naver.com/v5/search/${q}`;
  if (mapBtn) mapBtn.href = mapUrl;

  // 상세 페이지 링크
  const detailPageBtn = document.getElementById("detail-page-btn");
  if (detailPageBtn) {
    const hParams = new URLSearchParams({
      name: place.name,
      city: cityStr,
      region: place.region || "",
      category: place.category || "hospital",
      address: place.address || "",
      phone: place.phone || "",
    });
    if (place.kakaoId) hParams.set("kakao_id", place.kakaoId);
    detailPageBtn.href = `hospital.html?${hParams}`;
  }

  // 공유 버튼 (Web Share API)
  const shareBtn = document.getElementById("detail-share-btn");
  if (shareBtn) {
    shareBtn.onclick = () => sharePlaceInfo(place, shareBtn);
  }

  document.getElementById("detail-reviews-list").innerHTML = '<p class="placeholder-text">불러오는 중...</p>';
  document.getElementById("detail-price-table").innerHTML = "";
  modal.hidden = false;

  const db = window.supabaseClient;
  if (!db) {
    document.getElementById("detail-reviews-list").innerHTML = '<p class="placeholder-text">리뷰를 불러올 수 없습니다.</p>';
    return;
  }

  let data;
  try {
    const buildQuery = (useKakaoId) => {
      let q = db.from("reviews").select("*");
      if (useKakaoId && place.kakaoId) {
        q = q.eq("kakao_place_id", place.kakaoId);
      } else {
        q = q.eq("place_name", place.name);
      }
      return q.eq("is_verified", true).eq("status", "approved")
        .or("is_hidden.is.null,is_hidden.eq.false")
        .order("created_at", { ascending: false });
    };

    let { data: rows, error } = await buildQuery(true);
    // kakao_place_id 컬럼 없으면 place_name fallback
    if (error && (error.code === "PGRST200" || error.message?.includes("kakao_place_id"))) {
      ({ data: rows, error } = await buildQuery(false));
    }
    // is_hidden 컬럼 없으면 재시도
    if (error && (error.code === "PGRST200" || error.message?.includes("is_hidden"))) {
      let q = db.from("reviews").select("*");
      if (place.kakaoId) { q = q.eq("kakao_place_id", place.kakaoId); }
      else { q = q.eq("place_name", place.name); }
      ({ data: rows, error } = await q.eq("is_verified", true).eq("status", "approved")
        .order("created_at", { ascending: false }));
    }
    if (error) throw error;
    data = rows;
  } catch (err) {
    console.error("[펫리뷰] 병원 상세 리뷰 로드 실패:", err);
    document.getElementById("detail-reviews-list").innerHTML =
      '<p class="placeholder-text">리뷰를 불러오지 못했습니다.</p>';
    return;
  }

  if (!data?.length) {
    document.getElementById("detail-reviews-list").innerHTML =
      '<p class="placeholder-text">이 병원에 대한 인증된 리뷰가 없습니다.</p>';
    return;
  }

  // 진료항목별 진료비 (3건 이상인 항목만)
  const serviceGroups = {};
  data.forEach((r) => {
    if (r.service_detail && r.total_price) {
      if (!serviceGroups[r.service_detail]) serviceGroups[r.service_detail] = [];
      serviceGroups[r.service_detail].push(Number(r.total_price));
    }
  });

  const priceRows = Object.entries(serviceGroups)
    .filter(([, prices]) => prices.length >= 3)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([service, prices]) => {
      const avg = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const rangeHtml = min !== max
        ? `<span style="font-size:11px;color:#aaa;display:block;margin-top:2px;">₩ ${min.toLocaleString("ko-KR")} ~ ${max.toLocaleString("ko-KR")}</span>`
        : "";
      return `<tr>
        <td>${escapeHtml(service)}</td>
        <td>₩ ${avg.toLocaleString("ko-KR")}${rangeHtml}</td>
        <td>${prices.length}건</td>
      </tr>`;
    });

  // 전체 진료비 범위 (리뷰 1건 이상이면 항상 표시)
  const allPrices = data.filter(r => r.total_price).map(r => Number(r.total_price));
  let overallRangeHtml = "";
  if (allPrices.length) {
    const minP = Math.min(...allPrices);
    const maxP = Math.max(...allPrices);
    overallRangeHtml = minP === maxP
      ? `<p style="font-size:13px;color:#555;margin:0 0 10px;">1회 방문 기준 <strong>₩ ${minP.toLocaleString("ko-KR")}</strong></p>`
      : `<p style="font-size:13px;color:#555;margin:0 0 10px;">1회 방문 기준 <strong>₩ ${minP.toLocaleString("ko-KR")} ~ ${maxP.toLocaleString("ko-KR")}</strong></p>`;
  }

  const priceContainer = document.getElementById("detail-price-table");
  if (priceRows.length) {
    priceContainer.innerHTML = `
      <h4 style="font-size:14px;font-weight:700;color:#555;margin:0 0 8px;">진료항목별 진료비</h4>
      ${overallRangeHtml}
      <table class="price-table">
        <thead><tr><th>항목</th><th>평균 (범위)</th><th>리뷰 수</th></tr></thead>
        <tbody>${priceRows.join("")}</tbody>
      </table>`;
  } else if (overallRangeHtml) {
    priceContainer.innerHTML = `
      <h4 style="font-size:14px;font-weight:700;color:#555;margin:0 0 8px;">진료비</h4>
      ${overallRangeHtml}
      <p style="font-size:12px;color:#bbb;margin:0;">항목별 평균은 같은 항목 리뷰 3건 이상 쌓이면 표시됩니다.</p>`;
  }

  // 다항목 별점 평균
  const scoreFields = [
    { key: "score_kindness", label: "친절도" },
    { key: "score_price",    label: "진료비 수준" },
    { key: "score_facility", label: "시설 청결도" },
    { key: "score_wait",     label: "대기시간" },
  ];
  const scoreSums = {};
  const scoreCounts = {};
  data.forEach((r) => {
    scoreFields.forEach(({ key }) => {
      if (r[key]) {
        scoreSums[key] = (scoreSums[key] || 0) + r[key];
        scoreCounts[key] = (scoreCounts[key] || 0) + 1;
      }
    });
  });
  const scoreRows = scoreFields
    .filter(({ key }) => scoreCounts[key] > 0)
    .map(({ key, label }) => {
      const avg = (scoreSums[key] / scoreCounts[key]).toFixed(1);
      return `
        <div class="score-row">
          <span class="score-label">${label}</span>
          <div class="score-bar-wrap"><div class="score-bar" style="width:${avg * 20}%"></div></div>
          <span class="score-val">${avg}</span>
        </div>`;
    });

  const scoreContainer = document.getElementById("detail-score-section");
  if (scoreContainer) {
    scoreContainer.innerHTML = scoreRows.length
      ? `<h4 style="font-size:14px;font-weight:700;color:#555;margin:0 0 10px;">별점 평균</h4>
         <div class="card-scores">${scoreRows.join("")}</div>`
      : "";
  }

  // 리뷰 목록
  document.getElementById("detail-reviews-list").innerHTML = data.map((r, i) => `
    ${i > 0 ? '<hr style="border:none;border-top:1px solid #f0e8e2;margin:0;">' : ""}
    <div class="detail-review-item">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span class="verified-badge">✔ 영수증 인증</span>
        <span style="font-size:12px;color:#aaa;">${escapeHtml(r.visit_date || "")}</span>
      </div>
      <p style="margin:3px 0;font-size:13px;color:#666;">항목: ${escapeHtml(r.service_detail || "")}</p>
      <p style="margin:3px 0;font-size:13px;color:#666;">실결제: ₩ ${Number(r.total_price || 0).toLocaleString("ko-KR")}</p>
      <p style="margin:6px 0 0;font-size:14px;color:#333;">${escapeHtml(r.short_review || "")}</p>
      ${r.pet_photo_url ? `<img src="${escapeHtml(r.pet_photo_url)}" class="review-thumb" alt="반려동물 사진" style="margin-top:8px;" />` : ""}
    </div>`).join("");
}

// ===== 동물 종류 필터 =====
function bindPetSpeciesFilter() {
  document.querySelectorAll(".species-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      filterPetSpecies = btn.dataset.species;
      document.querySelectorAll(".species-btn").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      renderReviewList();
    });
  });
}

// ===== 리뷰 정렬 =====
function bindReviewSort() {
  const sel = document.getElementById("review-sort-select");
  if (!sel) return;
  sel.addEventListener("change", () => {
    reviewSortMode = sel.value;
    renderReviewList();
  });
}

// ===== 이미지 확대 뷰어 (lightbox) =====
function bindLightbox() {
  const lb = document.getElementById("lightbox");
  const lbImg = document.getElementById("lightbox-img");
  if (!lb || !lbImg) return;

  document.addEventListener("click", (e) => {
    const thumb = e.target.closest(".review-thumb");
    if (!thumb) return;
    lbImg.src = thumb.src;
    lb.classList.add("is-open");
    document.body.style.overflow = "hidden";
  });

  document.getElementById("lightbox-close")?.addEventListener("click", closeLightbox);
  lb.addEventListener("click", (e) => { if (e.target === lb) closeLightbox(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeLightbox(); });
}

function closeLightbox() {
  const lb = document.getElementById("lightbox");
  if (!lb) return;
  lb.classList.remove("is-open");
  document.body.style.overflow = "";
}

function init() {
  // PetAuth 초기화 — 실패해도 나머지 앱 기능은 정상 동작
  window.PetAuth?.init((event) => {
    updateHeaderAuth();
    if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
      closeLoginModal();
      if (window.PetAuth?.isLoggedIn()) restoreFormDraft();
      loadPetGreeting();
    } else if (event === "SIGNED_OUT") {
      loadPetGreeting();
    }
  })
  .then(() => {
    updateHeaderAuth();
    loadPetGreeting();
  })
  .catch(() => {
    updateHeaderAuth();
    loadPetGreeting();
  });

  bindLoginModal();
  document.getElementById("login-btn")?.addEventListener("click", openLoginModal);

  bindCtaButton();
  bindCategorySelection();
  bindCategoryToggle();
  bindTopCategoryTabs();
  bindSearchResultsSelection();
  bindSearch();
  bindSortToggle();
  bindTabBar();
  bindReceiptPreview();
  bindPetPhotoPreview();
  bindReviewPhotosPreview();
  bindStarSelects();
  bindReviewForm();
  bindReviewFilters();
  bindReviewActions();
  bindReportModal();
  bindPlaceDetailModal();
  bindReviewDetailModal();
  bindPlaceNameAutocomplete();
  bindServiceTags();
  bindPetSpeciesFilter();
  bindReviewSort();
  bindLightbox();
  void loadReviews();
  void loadBanner();
  void initGeolocation();

  // 방문일: 오늘 이후 날짜 선택 불가 + 클릭 시 달력 자동 펼치기
  const visitDateInput = document.getElementById("visit-date");
  if (visitDateInput) {
    visitDateInput.max = new Date().toISOString().slice(0, 10);
    visitDateInput.addEventListener("click", () => {
      try { visitDateInput.showPicker(); } catch { /* 지원 안 하는 브라우저 무시 */ }
    });
  }

  // URL prefill (hospital.html → "후기 남기기" 버튼 경유)
  const urlP = new URLSearchParams(location.search);
  const prefillName = urlP.get("prefill_name");
  if (prefillName) {
    const prefillCategory = urlP.get("prefill_category") || "hospital";
    selectFormCategory(prefillCategory);
    document.getElementById("place-name").value = prefillName;
    const prefillKakaoId = urlP.get("prefill_kakao_id") || "";
    selectedKakaoPlaceId = prefillKakaoId;
    const prefillCity = urlP.get("prefill_city") || "서울";
    const prefillRegion = urlP.get("prefill_region") || "";
    const placeCity = document.getElementById("place-city");
    if (placeCity) { placeCity.value = prefillCity; updateDistrictDatalist(prefillCity, "place-region-datalist"); }
    if (prefillRegion) {
      const placeRegion = document.getElementById("place-region");
      if (placeRegion) placeRegion.value = prefillRegion;
    }
    setTimeout(() => {
      document.getElementById("review-form-section")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);
    // URL 파라미터 정리 (뒤로 가기 시 중복 실행 방지)
    history.replaceState(null, "", location.pathname);
  }
}

init();
