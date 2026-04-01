const CATEGORY_LABEL = {
  hospital: "동물병원",
  grooming: "미용샵",
};

let reviews = [];  // ← 하드코딩 샘플 제거, Supabase에서 로드

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

// (renderSearchResults, renderReceiptPreview, renderReviewList 기존과 동일)

// ── 새로 추가된 함수들 ──────────────────────────────

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
    return URL.createObjectURL(file);  // 폴백: 메모리 blob URL
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

// ── 수정된 bindReviewForm ──────────────────────────

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
        // Supabase 미설정 시 메모리 폴백
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

// ── init: renderReviewList() → loadReviews() 로 변경 ──

function init() {
  bindCategoryToggle();
  bindSearchResultsSelection();
  bindSearch();
  bindReceiptPreview();
  bindReviewForm();
  bindReviewFilters();
  bindSmoothScroll();
  void renderSearchResults();
  void loadReviews();  // ← 변경
}

init();
