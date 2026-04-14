const CATEGORY_LABEL = {
  hospital: "동물병원",
  grooming: "미용샵",
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
let reportingReviewId = null;    // 신고 처리 중인 review ID
let selectedScores = {};         // 별점 입력 값 { score_kindness, score_price, score_facility, score_wait }
let selectedPetName = "";        // 선택된 마이펫 이름
let selectedPetSpecies = "";     // 선택된 마이펫 종류

const els = {
  searchRegion: document.getElementById("search-region"),
  searchButton: document.getElementById("search-button"),
  searchResults: document.getElementById("search-results"),
  sortToggle: document.getElementById("sort-toggle"),
  categoryButtons: document.querySelectorAll(".category-toggle .toggle-btn"),
  placeNameInput: document.getElementById("place-name"),
  placeCategorySelect: document.getElementById("place-category"),
  placeRegionInput: document.getElementById("place-region"),
  reviewForm: document.getElementById("review-form"),
  receiptInput: document.getElementById("receipt-image"),
  receiptPreview: document.getElementById("receipt-preview"),
  petPhotoInput: document.getElementById("pet-photo"),
  petPhotoPreview: document.getElementById("pet-photo-preview"),
  ocrStatus: document.getElementById("ocr-status"),
  reviewList: document.getElementById("review-list"),
  filterCategory: document.getElementById("filter-category"),
  filterRegion: document.getElementById("filter-region"),
  ctaButton: document.querySelector("[data-scroll-target]"),
};

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
      <article class="card featured-place-card" style="cursor:pointer;" data-place-name="${escapeHtml(fp.place_name)}" data-place-category="${escapeHtml(fp.category)}" data-place-region="${escapeHtml(fp.region || "")}" data-place-address="${escapeHtml(fp.address || "")}" data-place-phone="${escapeHtml(fp.phone || "")}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
          <h3 class="place-name-ellipsis" style="flex:1;margin:0;">${escapeHtml(fp.place_name)}</h3>
          <span class="featured-tag${fp.tag === "이벤트" ? " tag-event" : ""}">${escapeHtml(fp.tag || "우수협력병원")}</span>
        </div>
        <p>${CATEGORY_LABEL[fp.category] || fp.category} · 서울특별시 ${escapeHtml(fp.region || "")}</p>
        ${fp.address ? `<p class="helper-text">주소: ${escapeHtml(fp.address)}</p>` : ""}
        ${fp.phone ? `<p><a class="place-phone-link" href="tel:${escapeHtml(fp.phone)}">📞 ${escapeHtml(fp.phone)}</a></p>` : ""}
      </article>`).join("");
  }

  const cards = slice
    .map((place) => {
      const count = favCounts[place.name] || 0;
      const isSaved = userFavs.has(place.name);
      const favLabel = (isSaved ? "♥ 단골" : "♡ 단골") + (count > 0 ? ` ${count}` : "");
      return `
      <article class="card search-place-card" style="cursor:pointer;" data-place-name="${escapeHtml(place.name)}" data-place-category="${escapeHtml(place.category)}" data-place-region="${escapeHtml(place.region)}" data-place-address="${escapeHtml(place.address || "")}" data-place-phone="${escapeHtml(place.phone || "")}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
          <h3 class="place-name-ellipsis" style="flex:1;margin:0;">${escapeHtml(place.name)}</h3>
          <button class="favorite-btn${isSaved ? " is-saved" : ""}" data-fav-name="${escapeHtml(place.name)}" data-fav-category="${escapeHtml(place.category)}" data-fav-region="${escapeHtml(place.region)}" data-fav-address="${escapeHtml(place.address || "")}" data-fav-phone="${escapeHtml(place.phone || "")}">${escapeHtml(favLabel)}</button>
        </div>
        <p>${CATEGORY_LABEL[place.category]} · 서울특별시 ${escapeHtml(place.region)}</p>
        ${place.address ? `<p class="helper-text">주소: ${escapeHtml(place.address)}</p>` : ""}
        ${place.phone ? `<p><a class="place-phone-link" href="tel:${escapeHtml(place.phone)}">📞 ${escapeHtml(place.phone)}</a></p>` : ""}
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

  const regionKeyword = els.searchRegion.value.trim();

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
  const regionKeyword = els.filterRegion.value.trim();

  const filtered = reviews.filter((review) => {
    const categoryMatch = category === "all" || review.category === category;
    const regionMatch = regionKeyword === "" || (review.region ?? "").includes(regionKeyword);
    return categoryMatch && regionMatch;
  });

  if (filtered.length === 0) {
    els.reviewList.innerHTML =
      '<p class="placeholder-text">조건에 맞는 리뷰가 없습니다. 필터를 바꿔보세요.</p>';
    return;
  }

  // 영수증 인증 리뷰 상단 노출
  const sorted = [...filtered].sort((a, b) => b.isVerified - a.isVerified);

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
      return `
      <article class="card${review.isVerified ? " card--verified" : ""}">
        <div class="card-pet-header">
          <div class="card-pet-avatar">
            <div class="pet-icon pet-icon--${review.petSpecies === "고양이" ? "cat" : "dog"}"></div>
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
        <div class="review-images">
          ${review.petPhoto ? `<img src="${escapeHtml(review.petPhoto)}" alt="반려동물 사진" class="review-thumb" />` : ""}
        </div>
        <div class="review-actions">
          <button class="like-btn${isLiked ? " is-liked" : ""}" data-review-id="${escapeHtml(review.id)}">👍 도움이 됐어요${likeCount > 0 ? ` <span class="like-count">${likeCount}</span>` : ""}</button>
          <button class="report-btn" data-review-id="${escapeHtml(review.id)}">🚨 신고</button>
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
    placeName: row.place_name,
    category: row.category,
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
    userNickname: row.profiles?.nickname || "",
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

  const { data, error } = await db
    .from("reviews")
    .select("*")
    .or("status.eq.approved,status.is.null")
    .order("is_verified", { ascending: false })
    .order("created_at", { ascending: false });

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

  reviews = rawReviews;
  await loadLikes();
  renderReviewList();
  renderRecentReviews();
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
    <article class="card${review.isVerified ? " card--verified" : ""}">
      <div class="card-pet-header">
        <div class="card-pet-avatar">
          <div class="pet-icon pet-icon--${review.petSpecies === "고양이" ? "cat" : "dog"}"></div>
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
      <div class="review-images">
        ${review.petPhoto ? `<img src="${escapeHtml(review.petPhoto)}" alt="반려동물 사진" class="review-thumb" />` : ""}
      </div>
      <div class="review-actions">
        <button class="like-btn${isLiked ? " is-liked" : ""}" data-review-id="${escapeHtml(review.id)}">👍 도움이 됐어요${likeCount > 0 ? ` <span class="like-count">${likeCount}</span>` : ""}</button>
        <button class="report-btn" data-review-id="${escapeHtml(review.id)}">🚨 신고</button>
      </div>
    </article>`;
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

function updateSearchBtn() {
  const btn = els.searchButton;
  const region = els.searchRegion;
  if (!btn || !region) return;
  btn.disabled = geoState === 'denied' && !region.value;
}

function bindSearch() {
  els.searchButton.addEventListener("click", () => {
    if (geoState === 'denied' && !els.searchRegion.value) {
      const geoStatus = document.getElementById("geo-status");
      if (geoStatus) {
        geoStatus.textContent = "구를 선택해주세요";
        geoStatus.className = "geo-status is-error";
        setTimeout(() => {
          geoStatus.textContent = "";
          geoStatus.className = "geo-status";
        }, 3000);
      }
      return;
    }
    void renderSearchResults();
  });
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
        if (gu && els.searchRegion) {
          const match = Array.from(els.searchRegion.options).find(o => o.value === gu);
          if (match) els.searchRegion.value = gu;
        }
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

    const submitBtn = els.reviewForm.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "등록 중...";

    try {
      const formData = new FormData(els.reviewForm);
      const receiptFile = formData.get("receipt-image");
      const petPhotoFile = formData.get("pet-photo");
      const db = window.supabaseClient;

      const [receiptPath, petPhotoUrl] = await Promise.all([
        uploadReceiptImage(db, receiptFile),
        uploadPetPhoto(db, petPhotoFile),
      ]);

      const newRow = {
        place_name: String(formData.get("place-name")).trim(),
        category: String(formData.get("place-category")),
        region: String(formData.get("place-region")).trim(),
        visit_date: String(formData.get("visit-date")),
        service_detail: String(formData.get("service-detail")).trim(),
        total_price: Number(formData.get("total-price")),
        short_review: String(formData.get("short-review")).trim(),
        receipt_image_url: receiptPath,
        pet_photo_url: petPhotoUrl || null,
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
      if (els.ocrStatus) els.ocrStatus.hidden = true;
      selectedScores = {};
      document.querySelectorAll(".star-select button").forEach((b) => b.classList.remove("is-selected"));
      renderServiceTags(selectedSearchCategory);
      renderReviewList();
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
    if (place.region) els.placeRegionInput.value = place.region;
    if (place.category) els.placeCategorySelect.value = place.category;
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
      dropdown.innerHTML = `<li class="autocomplete-empty">검색 결과가 없어요</li>`;
      dropdown.hidden = false;
      return;
    }
    currentResults = places.slice(0, 8);
    dropdown.innerHTML = currentResults
      .map((p, i) => {
        const meta = [p.region ? `서울 ${escapeHtml(p.region)}` : "", escapeHtml(p.address || "")]
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
    if (val.length < 1) { hideDropdown(); return; }

    // 로딩 상태 표시
    dropdown.innerHTML = `<li class="autocomplete-empty">검색 중...</li>`;
    dropdown.hidden = false;

    debounceTimer = setTimeout(async () => {
      const places = await fetchSuggestions(val);
      renderDropdown(places, val);
    }, 150);
  });

  dropdown.addEventListener("mousedown", (e) => {
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
    detailInput.value = [...selectedServiceTags].join(", ");
  });
}

function bindReviewFilters() {
  els.filterCategory.addEventListener("change", renderReviewList);
  els.filterRegion.addEventListener("change", renderReviewList);
}

function bindCtaButton() {
  document.getElementById("cta-review-btn")?.addEventListener("click", openReviewForm);
}

function bindSearchResultsSelection() {
  els.searchResults.addEventListener("click", async (event) => {
    // 전화 링크 클릭 시 폼으로 이동하지 않음
    if (event.target.closest(".place-phone-link")) return;

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
        const { error } = await db.from("favorites").insert([{
          user_id: userId,
          place_name: placeName,
          category: favBtn.dataset.favCategory,
          region: favBtn.dataset.favRegion,
          address: favBtn.dataset.favAddress,
          phone: favBtn.dataset.favPhone,
        }]);
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
        name: card.dataset.placeName || "",
        category: card.dataset.placeCategory || selectedSearchCategory,
        region: card.dataset.placeRegion || "",
        address: card.dataset.placeAddress || "",
        phone: card.dataset.placePhone || "",
      });
    }
  });
}

// ===== 배너 로드 =====
async function loadBanner() {
  const db = window.supabaseClient;
  const slot = document.getElementById("banner-slot");
  if (!db || !slot) return;
  try {
    const { data } = await db
      .from("banners")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .limit(1);
    if (!data?.length) return;
    const b = data[0];
    slot.hidden = false;
    const img = `<img src="${escapeHtml(b.image_url || "")}" alt="${escapeHtml(b.alt_text || "")}" class="banner-img" />`;
    slot.innerHTML = b.link_url
      ? `<a href="${escapeHtml(b.link_url)}" target="_blank" rel="noopener noreferrer">${img}</a>`
      : img;
  } catch { /* ignore */ }
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
      ? `<img src="${escapeHtml(avatar)}" class="header-avatar" alt="프로필" />`
      : `<span class="header-avatar-placeholder">${escapeHtml(name[0] || "?")}</span>`;
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
    const label = category === "grooming" ? "✂️ 미용샵" : "🏥 동물병원";
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

  const { data: pets } = await db.from("pets").select("id, name, species").eq("user_id", userId);
  if (!pets?.length) {
    container.innerHTML = `<a href="mypage.html#pets" style="font-size:13px;color:#0f6e56;">+ 마이페이지에서 반려동물 등록하기 →</a>`;
    return;
  }

  selectedPetName = "";
  selectedPetSpecies = "";

  container.innerHTML = pets.map(p => {
    const icon = p.species === "고양이" ? "🐱" : "🐶";
    return `<button type="button" class="pet-select-btn" data-name="${escapeHtml(p.name)}" data-species="${escapeHtml(p.species || "")}">${icon} ${escapeHtml(p.name)}</button>`;
  }).join("");

  container.querySelectorAll(".pet-select-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".pet-select-btn").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      selectedPetName = btn.dataset.name;
      selectedPetSpecies = btn.dataset.species;
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
  els.reviewList.addEventListener("click", async (e) => {
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
    }
  });
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
  document.getElementById("detail-place-meta").textContent =
    `${CATEGORY_LABEL[place.category] || place.category} · 서울특별시 ${place.region}`;

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
  if (mapBtn) {
    const q = encodeURIComponent(`서울 ${place.region} ${place.name}`);
    mapBtn.href = `https://map.kakao.com/link/search/${q}`;
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
    const { data: rows, error } = await db
      .from("reviews")
      .select("*")
      .eq("place_name", place.name)
      .eq("is_verified", true)
      .eq("status", "approved")
      .order("created_at", { ascending: false });
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

  // 진료항목별 평균 진료비 (3건 이상인 항목만)
  const serviceGroups = {};
  data.forEach((r) => {
    if (r.service_detail && r.total_price) {
      if (!serviceGroups[r.service_detail]) serviceGroups[r.service_detail] = [];
      serviceGroups[r.service_detail].push(Number(r.total_price));
    }
  });

  const priceRows = Object.entries(serviceGroups)
    .filter(([, prices]) => prices.length >= 3)
    .map(([service, prices]) => {
      const avg = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length);
      return `<tr><td>${escapeHtml(service)}</td><td>₩ ${avg.toLocaleString("ko-KR")}</td><td>${prices.length}건</td></tr>`;
    });

  const priceContainer = document.getElementById("detail-price-table");
  if (priceRows.length) {
    priceContainer.innerHTML = `
      <h4 style="font-size:14px;font-weight:700;color:#555;margin:0 0 8px;">진료항목별 평균 진료비</h4>
      <table class="price-table">
        <thead><tr><th>항목</th><th>평균 금액</th><th>리뷰 수</th></tr></thead>
        <tbody>${priceRows.join("")}</tbody>
      </table>`;
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

function init() {
  // PetAuth 초기화 — 실패해도 나머지 앱 기능은 정상 동작
  window.PetAuth?.init((event) => {
    updateHeaderAuth();
    if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
      closeLoginModal();
      // 로그인 완료 후 대기 중이던 폼 복원
      if (window.PetAuth?.isLoggedIn()) restoreFormDraft();
    }
  })
  .then(() => updateHeaderAuth())
  .catch(() => updateHeaderAuth());

  bindLoginModal();
  document.getElementById("login-btn")?.addEventListener("click", openLoginModal);

  bindCtaButton();
  bindCategorySelection();
  bindCategoryToggle();
  bindSearchResultsSelection();
  bindSearch();
  bindSortToggle();
  bindTabBar();
  bindReceiptPreview();
  bindPetPhotoPreview();
  bindStarSelects();
  bindReviewForm();
  bindReviewFilters();
  bindReviewActions();
  bindReportModal();
  bindPlaceDetailModal();
  bindPlaceNameAutocomplete();
  bindServiceTags();
  void loadReviews();
  void loadBanner();
  void initGeolocation();

  // 방문일: 오늘 이후 날짜 선택 불가
  const visitDateInput = document.getElementById("visit-date");
  if (visitDateInput) {
    visitDateInput.max = new Date().toISOString().slice(0, 10);
  }
}

init();
