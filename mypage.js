(function () {
  "use strict";

  function escapeHtml(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  const CATEGORY_LABEL = { hospital: "동물병원", grooming: "미용샵" };

  function calcAge(birthDate) {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    const now = new Date();
    const totalMonths = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
    if (totalMonths < 1) return "1개월 미만";
    if (totalMonths < 12) return `${totalMonths}개월`;
    return `${Math.floor(totalMonths / 12)}세`;
  }

  function speciesEmoji(species) {
    if (species === "강아지") return "🐕";
    if (species === "고양이") return "🐈";
    if (species === "토끼") return "🐇";
    if (species === "햄스터") return "🐹";
    return "🐾";
  }

  // ===== 탭 전환 =====
  function bindTabs() {
    document.querySelectorAll(".mypage-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".mypage-tab").forEach((b) => b.classList.remove("is-active"));
        document.querySelectorAll(".mypage-panel").forEach((p) => p.classList.remove("is-active"));
        btn.classList.add("is-active");
        const panel = document.getElementById("panel-" + btn.dataset.tab);
        if (panel) panel.classList.add("is-active");
        if (btn.dataset.tab === "favorites") loadFavorites();
        if (btn.dataset.tab === "pets") loadPets();
      });
    });

    // URL 해시로 탭 직접 이동 (예: mypage.html#pets)
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      const targetBtn = document.querySelector(`.mypage-tab[data-tab="${hash}"]`);
      if (targetBtn) targetBtn.click();
    }
  }

  // ===== 내 리뷰 =====
  async function loadMyReviews() {
    const container = document.getElementById("my-reviews-list");
    if (!container) return;
    container.innerHTML = '<p class="placeholder-text">불러오는 중...</p>';
    const db = window.supabaseClient;
    const userId = window.PetAuth?.currentUser?.id;
    if (!db || !userId) { container.innerHTML = '<p class="placeholder-text">리뷰를 불러올 수 없습니다.</p>'; return; }

    const { data, error } = await db
      .from("reviews")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error || !data?.length) {
      container.innerHTML = '<p class="placeholder-text">작성한 리뷰가 없습니다.</p>';
      return;
    }

    container.innerHTML = data.map((r) => `
      <div class="mypage-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <h3>${escapeHtml(r.place_name)} <small style="color:#aaa;font-size:13px;">(${CATEGORY_LABEL[r.category] ?? r.category})</small></h3>
          ${r.is_verified ? '<span class="verified-badge">✔ 영수증 인증</span>' : ""}
        </div>
        <p>지역: 서울특별시 ${escapeHtml(r.region)} · 방문일: ${escapeHtml(r.visit_date ?? "")}</p>
        <p>항목: ${escapeHtml(r.service_detail ?? "")}</p>
        <p>결제: ₩ ${Number(r.total_price ?? 0).toLocaleString("ko-KR")}</p>
        <p>후기: ${escapeHtml(r.short_review ?? "")}</p>
        <div class="card-actions">
          <button class="btn-delete" data-review-id="${escapeHtml(r.id)}">삭제</button>
        </div>
      </div>`).join("");

    container.querySelectorAll(".btn-delete[data-review-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("리뷰를 삭제하시겠습니까?")) return;
        const { error: delErr } = await db.from("reviews").delete().eq("id", btn.dataset.reviewId);
        if (delErr) { alert("삭제 실패: " + delErr.message); return; }
        btn.closest(".mypage-card").remove();
        if (!container.querySelector(".mypage-card"))
          container.innerHTML = '<p class="placeholder-text">작성한 리뷰가 없습니다.</p>';
      });
    });
  }

  // ===== 단골병원 =====
  async function loadFavorites() {
    const container = document.getElementById("favorites-list");
    if (!container) return;
    container.innerHTML = '<p class="placeholder-text">불러오는 중...</p>';
    const db = window.supabaseClient;
    const userId = window.PetAuth?.currentUser?.id;
    if (!db || !userId) { container.innerHTML = '<p class="placeholder-text">불러올 수 없습니다.</p>'; return; }

    const { data, error } = await db
      .from("favorites")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error || !data?.length) {
      container.innerHTML = '<p class="placeholder-text">저장된 단골병원이 없습니다.</p>';
      return;
    }

    container.innerHTML = data.map((f) => `
      <div class="mypage-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <h3>${escapeHtml(f.place_name)}</h3>
          <button class="btn-delete" data-fav-id="${escapeHtml(f.id)}">삭제</button>
        </div>
        <p>${CATEGORY_LABEL[f.category] ?? f.category} · 서울특별시 ${escapeHtml(f.region ?? "")}</p>
        ${f.address ? `<p class="helper-text">주소: ${escapeHtml(f.address)}</p>` : ""}
        ${f.phone ? `<p><a href="tel:${escapeHtml(f.phone)}" style="color:#ff7043;font-weight:600;text-decoration:none;">📞 ${escapeHtml(f.phone)}</a></p>` : ""}
      </div>`).join("");

    container.querySelectorAll(".btn-delete[data-fav-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("단골병원 목록에서 삭제하시겠습니까?")) return;
        const { error: delErr } = await db.from("favorites").delete().eq("id", btn.dataset.favId);
        if (delErr) { alert("삭제 실패: " + delErr.message); return; }
        btn.closest(".mypage-card").remove();
        if (!container.querySelector(".mypage-card"))
          container.innerHTML = '<p class="placeholder-text">저장된 단골병원이 없습니다.</p>';
      });
    });
  }

  // ===== 마이펫 =====
  async function loadPets() {
    const grid = document.getElementById("pets-grid");
    if (!grid) return;
    grid.innerHTML = '<p class="placeholder-text">불러오는 중...</p>';
    const db = window.supabaseClient;
    const userId = window.PetAuth?.currentUser?.id;
    if (!db || !userId) { grid.innerHTML = '<p class="placeholder-text">불러올 수 없습니다.</p>'; return; }

    const { data, error } = await db
      .from("pets")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    const cards = (data || []).map((pet) => {
      const age = calcAge(pet.birth_date);
      const infoLines = [
        pet.species && pet.breed ? `${escapeHtml(pet.species)} · ${escapeHtml(pet.breed)}` : escapeHtml(pet.species ?? ""),
        [pet.gender ? escapeHtml(pet.gender) : "", pet.is_neutered != null ? (pet.is_neutered ? "중성화 완료" : "중성화 미완료") : ""].filter(Boolean).join(" · "),
        age ? `${age}${pet.birth_date ? ` (${escapeHtml(pet.birth_date)})` : ""}` : "",
        pet.weight != null ? `${pet.weight}kg` : "",
        pet.notes ? escapeHtml(pet.notes) : "",
      ].filter(Boolean);

      return `
      <div class="pet-card" data-pet-id="${escapeHtml(pet.id)}">
        <div class="pet-avatar">
          ${pet.photo_url ? `<img src="${escapeHtml(pet.photo_url)}" alt="${escapeHtml(pet.name)}" />` : speciesEmoji(pet.species)}
        </div>
        <h4>${escapeHtml(pet.name)}</h4>
        ${infoLines.map((l) => `<p>${l}</p>`).join("")}
        ${pet.registration_no ? `<p style="font-size:11px;color:#bbb;">등록번호: ${escapeHtml(pet.registration_no)}</p>` : ""}
        <div class="card-actions" style="justify-content:center;margin-top:10px;">
          <button class="btn-edit" data-pet-id="${escapeHtml(pet.id)}">수정</button>
          <button class="btn-delete" data-pet-id="${escapeHtml(pet.id)}">삭제</button>
        </div>
      </div>`;
    }).join("");

    grid.innerHTML = cards + `
      <button class="add-pet-btn" id="add-pet-btn">
        <span class="plus-icon">➕</span>
        반려동물 등록
      </button>`;

    // 삭제
    grid.querySelectorAll(".btn-delete[data-pet-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("반려동물을 삭제하시겠습니까?")) return;
        const { error: delErr } = await db.from("pets").delete().eq("id", btn.dataset.petId);
        if (delErr) { alert("삭제 실패: " + delErr.message); return; }
        await loadPets();
      });
    });

    // 수정 — 해당 row 데이터 가져와서 모달 열기
    grid.querySelectorAll(".btn-edit[data-pet-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const pet = (data || []).find((p) => p.id === btn.dataset.petId);
        if (pet) openPetModal(pet);
      });
    });

    document.getElementById("add-pet-btn")?.addEventListener("click", () => openPetModal(null));
  }

  // ===== 펫 모달 =====
  let editingPetId = null;

  function openPetModal(pet) {
    editingPetId = pet?.id ?? null;
    const form = document.getElementById("pet-form");
    const title = document.getElementById("pet-modal-title");
    const submitBtn = document.getElementById("pet-submit-btn");

    form.reset();

    // 생년월일 최대값 = 오늘 (미래 날짜 방지)
    const birthInput = document.getElementById("pet-birth-date");
    if (birthInput) birthInput.max = new Date().toISOString().split("T")[0];

    if (pet) {
      title.textContent = "반려동물 수정";
      submitBtn.textContent = "수정하기";
      document.getElementById("pet-name").value = pet.name ?? "";
      document.getElementById("pet-species").value = pet.species ?? "";
      document.getElementById("pet-breed").value = pet.breed ?? "";
      document.getElementById("pet-gender").value = pet.gender ?? "";
      document.getElementById("pet-birth-date").value = pet.birth_date ?? "";
      document.getElementById("pet-is-neutered").value =
        pet.is_neutered == null ? "" : String(pet.is_neutered);
      document.getElementById("pet-weight").value = pet.weight ?? "";
      document.getElementById("pet-registration-no").value = pet.registration_no ?? "";
      document.getElementById("pet-notes").value = pet.notes ?? "";
    } else {
      title.textContent = "반려동물 등록";
      submitBtn.textContent = "등록하기";
    }

    document.getElementById("pet-modal").hidden = false;
  }

  function closePetModal() {
    document.getElementById("pet-modal").hidden = true;
  }

  function bindPetModal() {
    document.getElementById("pet-modal-close")?.addEventListener("click", closePetModal);
    document.getElementById("pet-modal")?.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closePetModal();
    });

    document.getElementById("pet-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const db = window.supabaseClient;
      const userId = window.PetAuth?.currentUser?.id;
      if (!db || !userId) return;

      // JS 유효성 검사
      const name = document.getElementById("pet-name").value.trim();
      const species = document.getElementById("pet-species").value;
      const breed = document.getElementById("pet-breed").value.trim();
      const gender = document.getElementById("pet-gender").value;
      const neuteredVal = document.getElementById("pet-is-neutered").value;
      const birthVal = document.getElementById("pet-birth-date").value;

      if (!name) { alert("이름을 입력해주세요."); document.getElementById("pet-name").focus(); return; }
      if (!species) { alert("종류를 선택해주세요."); document.getElementById("pet-species").focus(); return; }
      if (!breed) { alert("품종을 입력해주세요."); document.getElementById("pet-breed").focus(); return; }
      if (!gender) { alert("성별을 선택해주세요."); document.getElementById("pet-gender").focus(); return; }
      if (neuteredVal === "") { alert("중성화 여부를 선택해주세요."); document.getElementById("pet-is-neutered").focus(); return; }

      if (birthVal) {
        const today = new Date().toISOString().split("T")[0];
        if (birthVal > today) { alert("생년월일은 오늘 이전 날짜여야 합니다."); document.getElementById("pet-birth-date").focus(); return; }
      }

      const submitBtn = document.getElementById("pet-submit-btn");
      submitBtn.disabled = true;
      submitBtn.textContent = "저장 중...";

      try {
        const photoFile = document.getElementById("pet-photo-input").files?.[0];
        let photoUrl = null;

        if (photoFile) {
          const ext = photoFile.name.split(".").pop() || "jpg";
          const fileName = `${userId}/${Date.now()}.${ext}`;
          const { error: upErr } = await db.storage
            .from("pet-photos")
            .upload(fileName, photoFile, { contentType: photoFile.type });
          if (!upErr) {
            const { data: urlData } = db.storage.from("pet-photos").getPublicUrl(fileName);
            photoUrl = urlData.publicUrl;
          }
        }

        const weightVal = document.getElementById("pet-weight").value;

        const row = {
          user_id: userId,
          name,
          species: species || null,
          breed: breed || null,
          gender: gender || null,
          birth_date: birthVal || null,
          is_neutered: neuteredVal === "" ? null : neuteredVal === "true",
          weight: weightVal ? Number(weightVal) : null,
          registration_no: document.getElementById("pet-registration-no").value.trim() || null,
          notes: document.getElementById("pet-notes").value.trim() || null,
        };
        if (photoUrl) row.photo_url = photoUrl;

        let error;
        if (editingPetId) {
          ({ error } = await db.from("pets").update(row).eq("id", editingPetId));
        } else {
          ({ error } = await db.from("pets").insert([row]));
        }

        if (error) { alert("저장 실패: " + error.message); return; }
        closePetModal();
        await loadPets();
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = editingPetId ? "수정하기" : "등록하기";
      }
    });
  }

  // ===== 프로필 =====
  async function loadProfile() {
    const auth = window.PetAuth;
    if (!auth) return;

    const name = auth.getDisplayName();
    const avatar = auth.getAvatarUrl();

    const greetingEl = document.getElementById("mypage-greeting");
    if (greetingEl) greetingEl.textContent = `안녕하세요, ${name}님!`;

    const nicknameDisplay = document.getElementById("profile-nickname-display");
    if (nicknameDisplay) nicknameDisplay.textContent = name;

    const avatarBig = document.getElementById("profile-avatar-big");
    if (avatarBig) {
      avatarBig.innerHTML = avatar
        ? `<img src="${escapeHtml(avatar)}" alt="프로필" />`
        : escapeHtml(name[0] || "?");
    }

    const nicknameInput = document.getElementById("profile-nickname");
    if (nicknameInput) nicknameInput.value = auth.currentProfile?.nickname ?? "";
  }

  function bindProfile() {
    document.getElementById("save-profile-btn")?.addEventListener("click", async () => {
      const db = window.supabaseClient;
      const userId = window.PetAuth?.currentUser?.id;
      if (!db || !userId) return;

      const nickname = document.getElementById("profile-nickname")?.value.trim();
      if (!nickname) { document.getElementById("profile-save-msg").textContent = "닉네임을 입력해주세요."; return; }

      const { error } = await db.from("profiles").upsert({ id: userId, nickname });
      const msg = document.getElementById("profile-save-msg");
      if (error) {
        msg.textContent = "저장 실패: " + error.message;
        msg.style.color = "#e57373";
      } else {
        msg.textContent = "저장되었습니다!";
        msg.style.color = "#22c55e";
        if (window.PetAuth.currentProfile) window.PetAuth.currentProfile.nickname = nickname;
        document.getElementById("profile-nickname-display").textContent = nickname;
        updateHeaderAuth();
      }
    });

    document.getElementById("logout-btn-profile")?.addEventListener("click", async () => {
      await window.PetAuth?.signOut();
      window.location.href = "index.html";
    });
  }

  // ===== 햄버거 메뉴 =====
  let _hamburgerBound = false;
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
    nav.addEventListener("click", (e) => {
      if (e.target.tagName === "A") {
        nav.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
        btn.textContent = "☰";
      }
    });
  }

  // ===== 헤더 인증 =====
  function updateHeaderAuth() {
    const area = document.getElementById("header-auth");
    if (!area) return;
    const auth = window.PetAuth;
    bindHamburger();
    if (!auth?.isLoggedIn()) {
      area.innerHTML = `<button class="auth-login-btn" onclick="window.location.href='index.html'">로그인</button>`;
      const el = document.getElementById("mobile-auth-content");
      if (el) el.innerHTML = `<button class="auth-login-btn" onclick="window.location.href='index.html'" style="margin-top:8px;">로그인</button>`;
      return;
    }
    const name = auth.getDisplayName();
    const avatar = auth.getAvatarUrl();
    const avatarHtml = avatar
      ? `<img src="${escapeHtml(avatar)}" class="header-avatar" alt="프로필" />`
      : `<span class="header-avatar-placeholder">${escapeHtml(name[0] || "?")}</span>`;
    area.innerHTML = `
      ${avatarHtml}
      <span class="header-username">${escapeHtml(name)}</span>
      <button class="header-logout-btn" id="header-logout-btn">로그아웃</button>`;
    document.getElementById("header-logout-btn")?.addEventListener("click", async () => {
      await auth.signOut();
      window.location.href = "index.html";
    });
    const el = document.getElementById("mobile-auth-content");
    if (el) {
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f0e8e2;">
          ${avatarHtml}<span style="font-weight:600;font-size:14px;">${escapeHtml(name)}</span>
        </div>
        <button class="mobile-logout-btn" id="mobile-logout-mypage">로그아웃</button>`;
      document.getElementById("mobile-logout-mypage")?.addEventListener("click", async () => {
        await auth.signOut();
        window.location.href = "index.html";
      });
    }
  }

  // ===== 초기화 =====
  async function init() {
    await window.PetAuth?.init((event) => {
      if (event === "SIGNED_OUT") window.location.href = "index.html";
      updateHeaderAuth();
    });

    updateHeaderAuth();

    const isLoggedIn = window.PetAuth?.isLoggedIn();
    const requiredBanner = document.getElementById("login-required-banner");
    const content = document.getElementById("mypage-content");

    if (!isLoggedIn) {
      if (requiredBanner) requiredBanner.hidden = false;
      if (content) content.hidden = true;
      return;
    }

    if (content) content.hidden = false;
    if (requiredBanner) requiredBanner.hidden = true;

    await loadProfile();
    bindTabs();
    bindPetModal();
    bindProfile();
    await loadMyReviews();
  }

  init();
})();
