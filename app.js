const CATEGORY_LABEL = {
  hospital: "동물병원",
  grooming: "미용샵",
};

let reviews = [
  {
    id: Date.now() - 2,
    placeName: "마포사랑 동물병원",
    category: "hospital",
    region: "마포구",
    visitDate: "2026-03-28",
    serviceDetail: "피부 진료 + 약 처방",
    totalPrice: 58000,
    shortReview: "설명이 자세하고 과잉진료 느낌이 없었어요.",
    receiptImage: "",
  },
  {
    id: Date.now() - 1,
    placeName: "포근포근 펫살롱",
    category: "grooming",
    region: "마포구",
    visitDate: "2026-03-25",
    serviceDetail: "목욕 + 부분 미용",
    totalPrice: 45000,
    shortReview: "아이가 스트레스 받지 않게 잘 케어해줬어요.",
    receiptImage: "",
  },
];

let selectedSearchCategory = "hospital";

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

async function renderSearchResults() {
  els.searchResults.innerHTML =
    '<p class="placeholder-text">업체 데이터를 불러오는 중...</p>';

  const regionKeyword = els.searchRegion.value.trim();

  let facilities = [];
  try {
    if (!window.PetReviewDataProvider?.searchPlaces) {
      throw new Error("PetReviewDataProvider.searchPlaces를 찾을 수 없습니다.");
    }
    facilities = await window.PetReviewDataProvider.searchPlaces({
      category: selectedSearchCategory,
      regionKeyword,
    });
  } catch (err) {
    console.error(err);
    els.searchResults.innerHTML =
      '<p class="placeholder-text">데이터를 불러오지 못했어요. (콘솔을 확인해 주세요)</p>';
    return;
  }

  if (!facilities || facilities.length === 0) {
    els.searchResults.innerHTML =
      '<p class="placeholder-text">조건에 맞는 업체가 없어요. 다른 지역/업종으로 검색해 보세요.</p>';
    return;
  }

  const dataProvider = window.PetReviewDataProvider;
  const lastSource = dataProvider?.lastSource;
  const lastErrorMessage = dataProvider?.lastErrorMessage;
  const dataNotice =
    lastSource === "mock"
      ? `<p class="helper-text">실데이터 요청에 실패해서 모의 데이터를 표시 중입니다.${
          lastErrorMessage ? " (" + escapeHtml(lastErrorMessage) + ")" : ""
        }</p>`
      : "";

  const cards = facilities
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
        <h3>${escapeHtml(place.name)}</h3>
        <p>${CATEGORY_LABEL[place.category]} · 서울특별시 ${escapeHtml(place.region)}</p>
        ${
          place.address
            ? `<p class="helper-text">주소: ${escapeHtml(place.address)}</p>`
            : ""
        }
        <p class="helper-text">클릭해서 리뷰 작성 폼에 채워 넣기</p>
      </article>
    `
    )
    .join("");

  els.searchResults.innerHTML = dataNotice + cards;
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

function bindCategoryToggle() {
  els.categoryButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedSearchCategory = btn.dataset.category;
      els.categoryButtons.forEach((item) => item.classList.remove("is-active"));
      btn.classList.add("is-active");
      void renderSearchResults();
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
  els.reviewForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(els.reviewForm);
    const file = formData.get("receipt-image");
    const receiptImage = file && file.size > 0 ? URL.createObjectURL(file) : "";

    const newReview = {
      id: Date.now(),
      placeName: String(formData.get("place-name")).trim(),
      category: String(formData.get("place-category")),
      region: String(formData.get("place-region")).trim(),
      visitDate: String(formData.get("visit-date")),
      serviceDetail: String(formData.get("service-detail")).trim(),
      totalPrice: Number(formData.get("total-price")),
      shortReview: String(formData.get("short-review")).trim(),
      receiptImage,
    };

    reviews = [newReview, ...reviews];
    els.reviewForm.reset();
    els.receiptPreview.innerHTML = "";
    renderReviewList();
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
  void renderSearchResults();
  renderReviewList();
}

init();
