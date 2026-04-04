const CATEGORY_LABEL = {
  hospital: "동물병원",
  grooming: "미용샵",
};

let reviews = [];

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

  facilities.sort((a, b) => a.name.localeCompare(b.name, "ko"));

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
      renderReviewList();
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "리뷰 등록하기";
    }
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
  void loadReviews();
}

init();
