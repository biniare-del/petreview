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
let selectedSearchCategory = "hospital";
let searchFacilities = [];
let searchPage = 1;
let hasSearched = false;
const PAGE_SIZE = 10;

const els = {
  searchRegion: document.getElementById("search-region"),
  searchButton: document.getElementById("search-button"),
  searchResults: document.getElementById("search-results"),
  categoryButtons: document.querySelectorAll(".category-toggle .toggle-btn"),
  placeNameInput: document.getElementById("place-name"),
  placeCategorySelect: document.getElementById("place-category"),
  placeRegionInput: document.getElementById("place-region"),
  reviewForm: document.getElementById("review-form"),
  receiptInput: document.getElementById("receipt-image"),
  receiptPreview: document.getElementById("receipt-preview"),
  reviewList: document.getElementById("review-list"),
  filterCategory: document.getElementById("filter-category"),
  filterRegion: document.getElementById("filter-region"),
  ctaButton: document.querySelector("[data-scroll-target]"),
};

function formatPrice(amount) {
  return Number(amount).toLocaleString("ko-KR");
}

function escapeHtml(value) {
  return String(value)
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

  const cards = slice
    .map(
      (place) => `
      <article
        class="card search-place-card"
        role="button"
        tabindex="0"
        data-place-name="${escapeHtml(place.name)}"
        data-place-category="${escapeHtml(place.category)}"
        data-place-region="${escapeHtml(place.region)}"
      >
        <h3 class="place-name-ellipsis">${escapeHtml(place.name)}</h3>
        <p>${CATEGORY_LABEL[place.category]} · 서울특별시 ${escapeHtml(place.region)}</p>
        ${place.address ? `<p class="helper-text">주소: ${escapeHtml(place.address)}</p>` : ""}
        ${place.phone ? `<p><a class="place-phone-link" href="tel:${escapeHtml(place.phone)}">📞 ${escapeHtml(place.phone)}</a></p>` : ""}
        <p class="helper-text">클릭해서 리뷰 작성 폼에 채워 넣기</p>
      </article>`
    )
    .join("");

  const pagination =
    totalPages > 1
      ? `<div class="search-pagination">
          <button class="pagination-btn" id="page-prev" ${page <= 1 ? "disabled" : ""}>이전</button>
          <span class="page-info">${page} / ${totalPages}</span>
          <button class="pagination-btn" id="page-next" ${page >= totalPages ? "disabled" : ""}>다음</button>
        </div>`
      : "";

  els.searchResults.innerHTML = dataNotice + cards + pagination;

  document.getElementById("page-prev")?.addEventListener("click", () => renderSearchPage(searchPage - 1));
  document.getElementById("page-next")?.addEventListener("click", () => renderSearchPage(searchPage + 1));
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

  searchFacilities.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  hasSearched = true;
  renderSearchPage(1);
}

function renderReceiptPreview(file) {
  if (!file) {
    els.receiptPreview.innerHTML = "";
    return;
  }

  const previewUrl = URL.createObjectURL(file);
  els.receiptPreview.innerHTML = `<img src="${previewUrl}" alt="영수증 미리보기" />`;
}

function renderReviewList() {
  const category = els.filterCategory.value;
  const regionKeyword = els.filterRegion.value.trim();

  const filtered = reviews.filter((review) => {
    const categoryMatch = category === "all" || review.category === category;
    const regionMatch = regionKeyword === "" || review.region.includes(regionKeyword);
    return categoryMatch && regionMatch;
  });

  if (filtered.length === 0) {
    els.reviewList.innerHTML =
      '<p class="placeholder-text">조건에 맞는 리뷰가 없습니다. 필터를 바꿔보세요.</p>';
    return;
  }

  const items = filtered
    .map(
      (review) => `
      <article class="card">
        <h3>${escapeHtml(review.placeName)} <small>(${CATEGORY_LABEL[review.category]})</small></h3>
        <p>지역: 서울특별시 ${escapeHtml(review.region)} · 방문일: ${escapeHtml(review.visitDate)}</p>
        <p>항목: ${escapeHtml(review.serviceDetail)}</p>
        <p>실결제: ₩ ${formatPrice(review.totalPrice)}</p>
        <p>후기: ${escapeHtml(review.shortReview)}</p>
        ${
          review.receiptImage
            ? `<img src="${review.receiptImage}" alt="업로드된 영수증" style="max-width: 140px; border-radius: 10px;" />`
            : ""
        }
      </article>
    `
    )
    .join("");

  els.reviewList.innerHTML = items;
}

// DB 행(snake_case) → 앱 객체(camelCase) 변환
function rowToReview(row) {
  return {
    id: row.id,
    placeName: row.place_name,
    category: row.category,
    region: row.region,
    visitDate: row.visit_date,
    serviceDetail: row.service_detail,
    totalPrice: row.total_price,
    shortReview: row.short_review,
    receiptImage: row.receipt_image_url || "",
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
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[펫리뷰] 리뷰 로드 실패:", error);
    els.reviewList.innerHTML =
      '<p class="placeholder-text">리뷰를 불러오지 못했어요. (콘솔을 확인해 주세요)</p>';
    return;
  }

  reviews = (data || []).map(rowToReview);
  renderReviewList();
}

async function uploadReceiptImage(db, file) {
  if (!file || file.size === 0) return "";

  if (!db) {
    // Supabase 미설정 시 로컬 blob URL로 폴백 (새로고침 시 사라짐)
    return URL.createObjectURL(file);
  }

  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await db.storage
    .from("receipts")
    .upload(fileName, file, { contentType: file.type });

  if (error) {
    console.error("[펫리뷰] 이미지 업로드 실패:", error);
    return "";
  }

  const { data: urlData } = db.storage.from("receipts").getPublicUrl(fileName);
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

function bindSearch() {
  els.searchButton.addEventListener("click", () => void renderSearchResults());
}

function bindReceiptPreview() {
  els.receiptInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    renderReceiptPreview(file);
  });
}

function bindReviewForm() {
  els.reviewForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitBtn = els.reviewForm.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "등록 중...";

    try {
      const formData = new FormData(els.reviewForm);
      const file = formData.get("receipt-image");
      const db = window.supabaseClient;

      const receiptImageUrl = await uploadReceiptImage(db, file);

      const newRow = {
        place_name: String(formData.get("place-name")).trim(),
        category: String(formData.get("place-category")),
        region: String(formData.get("place-region")).trim(),
        visit_date: String(formData.get("visit-date")),
        service_detail: String(formData.get("service-detail")).trim(),
        total_price: Number(formData.get("total-price")),
        short_review: String(formData.get("short-review")).trim(),
        receipt_image_url: receiptImageUrl,
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
        // Supabase 미설정 시 메모리에만 추가 (새로고침 시 사라짐)
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
            receiptImage: receiptImageUrl,
          },
          ...reviews,
        ];
      }

      els.reviewForm.reset();
      els.receiptPreview.innerHTML = "";
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

  function renderDropdown(places) {
    if (!places.length) { hideDropdown(); return; }
    currentResults = places.slice(0, 8);
    dropdown.innerHTML = currentResults
      .map((p, i) => `
        <li data-idx="${i}" role="option">
          <div class="autocomplete-name">${escapeHtml(p.name)}</div>
          <div class="autocomplete-meta">${
            [p.region ? `서울 ${escapeHtml(p.region)}` : "", escapeHtml(p.address || "")]
              .filter(Boolean).join(" · ")
          }</div>
        </li>`)
      .join("");
    dropdown.hidden = false;
  }

  async function fetchSuggestions(keyword) {
    const category = els.placeCategorySelect.value || "hospital";
    const url = `https://petreview.vercel.app/api/facilities?category=${encodeURIComponent(category)}&keyword=${encodeURIComponent(keyword)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const json = await res.json();
    return json?.results ?? [];
  }

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const val = input.value.trim();
    if (val.length < 2) { hideDropdown(); return; }
    debounceTimer = setTimeout(async () => {
      try {
        const places = await fetchSuggestions(val);
        renderDropdown(places);
      } catch {
        hideDropdown();
      }
    }, 300);
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
    const items = dropdown.querySelectorAll("li");
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

function bindSmoothScroll() {
  if (!els.ctaButton) return;
  els.ctaButton.addEventListener("click", () => {
    const target = document.querySelector(els.ctaButton.dataset.scrollTarget);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function bindSearchResultsSelection() {
  els.searchResults.addEventListener("click", (event) => {
    // 전화 링크 클릭 시 폼으로 이동하지 않음
    if (event.target.closest(".place-phone-link")) return;
    const card = event.target.closest(".search-place-card");
    if (!card) return;

    const placeName = card.dataset.placeName || "";
    const placeCategory = card.dataset.placeCategory || selectedSearchCategory;
    const placeRegion = card.dataset.placeRegion || "";

    els.placeNameInput.value = placeName;
    els.placeCategorySelect.value = placeCategory;
    els.placeRegionInput.value = placeRegion;

    const formSection = document.getElementById("review-form-section");
    formSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function init() {
  bindCategoryToggle();
  bindSearchResultsSelection();
  bindSearch();
  bindReceiptPreview();
  bindReviewForm();
  bindReviewFilters();
  bindSmoothScroll();
  bindPlaceNameAutocomplete();
  renderServiceTags("hospital");
  bindServiceTags();
  void loadReviews();
}

init();
