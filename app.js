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

// ===== 리뷰 폼 임시 저장 (로그인 리다이렉트 전후 데이터 유지) =====
const FORM_DRAFT_KEY = "petreview_form_draft";

function saveFormDraft() {
  try {
    const draft = {
      placeName:     document.getElementById("place-name")?.value ?? "",
      placeCategory: document.getElementById("place-category")?.value ?? "hospital",
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
    // 폼 값 복원
    if (d.placeName)     document.getElementById("place-name").value = d.placeName;
    if (d.placeCategory) document.getElementById("place-category").value = d.placeCategory;
    if (d.placeRegion)   document.getElementById("place-region").value = d.placeRegion;
    if (d.visitDate)     document.getElementById("visit-date").value = d.visitDate;
    if (d.serviceDetail) document.getElementById("service-detail").value = d.serviceDetail;
    if (d.totalPrice)    document.getElementById("total-price").value = d.totalPrice;
    if (d.shortReview)   document.getElementById("short-review").value = d.shortReview;

    // 카테고리 테마/토글 복원
    if (d.placeCategory) {
      selectedSearchCategory = d.placeCategory;
      document.body.dataset.theme = d.placeCategory === "grooming" ? "grooming" : "hospital";
      els.categoryButtons.forEach((btn) =>
        btn.classList.toggle("is-active", btn.dataset.category === d.placeCategory)
      );
      renderServiceTags(d.placeCategory);
    }

    // 서비스 태그 복원
    if (d.serviceTags?.length) {
      selectedServiceTags = new Set(d.serviceTags);
      document.querySelectorAll(".tag-btn").forEach((btn) =>
        btn.classList.toggle("is-selected", selectedServiceTags.has(btn.dataset.tag))
      );
    }

    // 복원 후 폼 섹션으로 스크롤
    document.getElementById("review-form-section")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch { /* ignore */ }
}
let searchPage = 1;
let hasSearched = false;
const PAGE_SIZE = 5;

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
        data-place-address="${escapeHtml(place.address || "")}"
        data-place-phone="${escapeHtml(place.phone || "")}"
      >
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
          <h3 class="place-name-ellipsis" style="flex:1;margin:0;">${escapeHtml(place.name)}</h3>
          <button class="favorite-btn" data-fav-name="${escapeHtml(place.name)}" data-fav-category="${escapeHtml(place.category)}" data-fav-region="${escapeHtml(place.region)}" data-fav-address="${escapeHtml(place.address || "")}" data-fav-phone="${escapeHtml(place.phone || "")}">♡ 단골</button>
        </div>
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

  searchFacilities.sort((a, b) => a.name.localeCompare(b.name, "ko"));
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
    const regionMatch = regionKeyword === "" || review.region.includes(regionKeyword);
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
    .map(
      (review) => `
      <article class="card${review.isVerified ? " card--verified" : ""}">
        <div class="review-card-header">
          <h3>${escapeHtml(review.placeName)} <small>(${CATEGORY_LABEL[review.category]})</small></h3>
          ${review.isVerified ? '<span class="verified-badge">✔ 영수증 인증</span>' : ""}
        </div>
        <p>지역: 서울특별시 ${escapeHtml(review.region)} · 방문일: ${escapeHtml(review.visitDate)}</p>
        <p>항목: ${escapeHtml(review.serviceDetail)}</p>
        <p>실결제: ₩ ${formatPrice(review.totalPrice)}</p>
        <p>후기: ${escapeHtml(review.shortReview)}</p>
        <div class="review-images">
          ${review.petPhoto ? `<img src="${escapeHtml(review.petPhoto)}" alt="반려동물 사진" class="review-thumb" />` : ""}
          ${review.receiptImage ? `<img src="${escapeHtml(review.receiptImage)}" alt="영수증" class="review-thumb" />` : ""}
        </div>
      </article>`
    )
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
    receiptPath: storagePath,            // 저장 경로 (private 버킷용)
    receiptImage: storagePath.startsWith("http") ? storagePath : "", // signed URL 생성 전 임시
    petPhoto: row.pet_photo_url || "",
    isVerified: row.is_verified || false,
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
    .order("is_verified", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[펫리뷰] 리뷰 로드 실패:", error);
    els.reviewList.innerHTML =
      '<p class="placeholder-text">리뷰를 불러오지 못했어요. (콘솔을 확인해 주세요)</p>';
    return;
  }

  const rawReviews = (data || []).map(rowToReview);

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
  renderReviewList();
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

function bindSearch() {
  els.searchButton.addEventListener("click", () => void renderSearchResults());
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
        is_verified: !!receiptPath,
        user_id: window.PetAuth?.currentUser?.id ?? null,
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
      const userId = window.PetAuth.currentUser.id;
      const placeName = favBtn.dataset.favName;
      if (favBtn.classList.contains("is-saved")) {
        await db.from("favorites").delete().eq("user_id", userId).eq("place_name", placeName);
        favBtn.classList.remove("is-saved");
        favBtn.textContent = "♡ 단골";
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
          favBtn.textContent = "♥ 단골";
        }
      }
      return;
    }

    const card = event.target.closest(".search-place-card");
    if (!card) return;

    const placeName = card.dataset.placeName || "";
    const placeCategory = card.dataset.placeCategory || selectedSearchCategory;
    const placeRegion = card.dataset.placeRegion || "";

    // 카드 데이터를 폼에 먼저 채움 (로그인 필요 시 저장 대상이 되도록)
    els.placeNameInput.value = placeName;
    els.placeCategorySelect.value = placeCategory;
    els.placeRegionInput.value = placeRegion;

    // 비로그인 상태에서 업체 선택 시 로그인 요구
    if (!window.PetAuth?.isLoggedIn()) {
      openLoginModal(); // saveFormDraft() 포함
      return;
    }

    const formSection = document.getElementById("review-form-section");
    formSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

// ===== 헤더 인증 UI =====
function updateHeaderAuth() {
  const area = document.getElementById("header-auth");
  if (!area) return;

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
  } else {
    area.innerHTML = `<button class="auth-login-btn" id="login-btn">로그인</button>`;
    document.getElementById("login-btn")?.addEventListener("click", openLoginModal);
  }
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

function init() {
  // PetAuth 초기화 — 실패해도 나머지 앱 기능은 정상 동작
  window.PetAuth?.init((event) => {
    updateHeaderAuth();
    // 로그인 완료 시 모달 닫기 (모달이 열려 있는 경우에만 실질적으로 동작)
    if (event === "SIGNED_IN" || event === "INITIAL_SESSION") closeLoginModal();
  })
  .then(() => updateHeaderAuth())
  .catch(() => updateHeaderAuth()); // 오류 발생해도 헤더는 렌더링

  bindLoginModal();
  // 초기 로그인 버튼 클릭 이벤트 (헤더 auth 영역)
  document.getElementById("login-btn")?.addEventListener("click", openLoginModal);

  bindCategoryToggle();
  bindSearchResultsSelection();
  bindSearch();
  bindReceiptPreview();
  bindPetPhotoPreview();
  bindReviewForm();
  bindReviewFilters();
  bindSmoothScroll();
  bindPlaceNameAutocomplete();
  renderServiceTags("hospital");
  bindServiceTags();
  void loadReviews();

  // 방문일: 오늘 이후 날짜 선택 불가
  const visitDateInput = document.getElementById("visit-date");
  if (visitDateInput) {
    visitDateInput.max = new Date().toISOString().slice(0, 10);
  }

  // 로그인 리다이렉트 후 돌아온 경우 폼 내용 복원
  restoreFormDraft();
}

init();
