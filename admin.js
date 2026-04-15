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

  // ===== 탭 전환 =====
  function bindTabs() {
    document.querySelectorAll(".admin-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".admin-tab").forEach((b) => b.classList.remove("is-active"));
        document.querySelectorAll(".admin-panel").forEach((p) => p.classList.remove("is-active"));
        btn.classList.add("is-active");
        const panel = document.getElementById("panel-" + btn.dataset.tab);
        if (panel) panel.classList.add("is-active");
        if (btn.dataset.tab === "receipts") loadReceipts();
        if (btn.dataset.tab === "reviews") loadAllReviews();
        if (btn.dataset.tab === "reports") loadReports();
        if (btn.dataset.tab === "users") loadUsers();
        if (btn.dataset.tab === "ads") loadAdsTab();
      });
    });
  }

  // ===== 통계 =====
  async function loadStats() {
    const db = window.supabaseClient;
    if (!db) return;

    const [pendingRes, reviewsRes, profilesRes] = await Promise.all([
      db.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
      db.from("reviews").select("id", { count: "exact", head: true }),
      db.from("profiles").select("id", { count: "exact", head: true }),
    ]);

    const statPending = document.getElementById("stat-pending");
    const statReviews = document.getElementById("stat-reviews");
    const statUsers = document.getElementById("stat-users");
    if (statPending) statPending.textContent = pendingRes.count ?? "-";
    if (statReviews) statReviews.textContent = reviewsRes.count ?? "-";
    if (statUsers) statUsers.textContent = profilesRes.count ?? "-";
  }

  // ===== 영수증 검수 =====
  async function loadReceipts() {
    const container = document.getElementById("receipts-list");
    if (!container) return;
    container.innerHTML = '<p class="placeholder-text">불러오는 중...</p>';

    const db = window.supabaseClient;
    if (!db) return;

    // 검수 대기 리뷰 (status = 'pending' AND receipt_image_url IS NOT NULL)
    const { data, error } = await db
      .from("reviews")
      .select("*")
      .eq("status", "pending")
      .not("receipt_image_url", "is", null)
      .order("created_at", { ascending: false });

    if (error) { container.innerHTML = `<p class="placeholder-text">오류: ${escapeHtml(error.message)}</p>`; return; }
    if (!data?.length) { container.innerHTML = '<p class="placeholder-text">검수 대기 영수증이 없습니다.</p>'; return; }

    // signed URL 생성
    const items = await Promise.all(data.map(async (r) => {
      let imgUrl = "";
      if (r.receipt_image_url && !r.receipt_image_url.startsWith("http")) {
        const { data: signed } = await db.storage.from("receipts").createSignedUrl(r.receipt_image_url, 3600);
        imgUrl = signed?.signedUrl ?? "";
      } else {
        imgUrl = r.receipt_image_url ?? "";
      }
      return { ...r, signedUrl: imgUrl };
    }));

    container.innerHTML = items.map((r) => `
      <div class="admin-card" data-review-id="${escapeHtml(r.id)}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap;">
          <h3>${escapeHtml(r.place_name)} <small style="color:#aaa;">(${CATEGORY_LABEL[r.category] ?? r.category})</small></h3>
          <span class="badge-pending">검수 대기</span>
        </div>
        <p>지역: 서울특별시 ${escapeHtml(r.region ?? "")} · 방문일: ${escapeHtml(r.visit_date ?? "")}</p>
        <p>항목: ${escapeHtml(r.service_detail ?? "")}</p>
        <p>결제: ₩ ${Number(r.total_price ?? 0).toLocaleString("ko-KR")}</p>
        <p>후기: ${escapeHtml(r.short_review ?? "")}</p>
        ${r.signedUrl ? `<img src="${escapeHtml(r.signedUrl)}" class="receipt-thumb-admin" alt="영수증" />` : '<p class="helper-text">영수증 이미지 없음</p>'}
        <div class="card-actions">
          <button class="btn-approve" data-action="approve" data-id="${escapeHtml(r.id)}">✔ 인증 승인</button>
          <button class="btn-reject" data-action="reject" data-id="${escapeHtml(r.id)}">✕ 반려</button>
        </div>
      </div>`).join("");

    container.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const isApprove = btn.dataset.action === "approve";
        const updateData = isApprove
          ? { is_verified: true, status: "approved" }
          : { status: "rejected" };
        const { error: updErr } = await db
          .from("reviews")
          .update(updateData)
          .eq("id", id);
        if (updErr) { alert("처리 실패: " + updErr.message); return; }
        const card = container.querySelector(`[data-review-id="${id}"]`);
        if (card) card.remove();
        if (!container.querySelector(".admin-card")) {
          container.innerHTML = '<p class="placeholder-text">검수 대기 영수증이 없습니다.</p>';
        }
        loadStats();
      });
    });
  }

  // ===== 전체 리뷰 관리 =====
  async function loadAllReviews() {
    const container = document.getElementById("all-reviews-list");
    if (!container) return;
    container.innerHTML = '<p class="placeholder-text">불러오는 중...</p>';
    const db = window.supabaseClient;
    if (!db) return;

    const { data, error } = await db
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) { container.innerHTML = `<p class="placeholder-text">오류: ${escapeHtml(error.message)}</p>`; return; }
    if (!data?.length) { container.innerHTML = '<p class="placeholder-text">리뷰가 없습니다.</p>'; return; }

    container.innerHTML = data.map((r) => {
      const status = r.status ?? (r.is_verified ? "approved" : "approved");
      let badgeHtml;
      let cardStyle = "";
      if (status === "approved" && r.is_verified) {
        badgeHtml = '<span class="badge-approved">✔ 영수증 인증</span>';
      } else if (status === "approved") {
        badgeHtml = '<span class="badge-approved">✔ 승인</span>';
      } else if (status === "pending") {
        badgeHtml = '<span class="badge-pending">⏳ 검수 대기</span>';
        cardStyle = ' style="background:#2a2520;"';
      } else if (status === "rejected") {
        badgeHtml = '<span class="badge-rejected">✕ 반려</span>';
      } else {
        badgeHtml = '<span style="font-size:11px;color:#aaa;">미인증</span>';
      }
      return `
      <div class="admin-card" data-review-id="${escapeHtml(r.id)}"${cardStyle}>
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap;">
          <h3>${escapeHtml(r.place_name)} <small style="color:#aaa;">(${CATEGORY_LABEL[r.category] ?? r.category})</small></h3>
          ${badgeHtml}
        </div>
        <p>지역: 서울특별시 ${escapeHtml(r.region ?? "")} · 방문일: ${escapeHtml(r.visit_date ?? "")}</p>
        <p>후기: ${escapeHtml(r.short_review ?? "")}</p>
        <p class="helper-text">등록일: ${escapeHtml(r.created_at?.slice(0, 10) ?? "")}</p>
        <div class="card-actions">
          <button class="btn-approve review-approve-btn" data-id="${escapeHtml(r.id)}">인증승인</button>
          <button class="btn-pending review-pending-btn" data-id="${escapeHtml(r.id)}">보류</button>
          <button class="btn-delete review-delete-btn" data-id="${escapeHtml(r.id)}">삭제</button>
        </div>
      </div>`;
    }).join("");

    container.querySelectorAll(".review-approve-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const { error: updErr } = await db.from("reviews").update({ is_verified: true, status: "approved" }).eq("id", btn.dataset.id);
        if (updErr) { alert("처리 실패: " + updErr.message); return; }
        const card = container.querySelector(`[data-review-id="${btn.dataset.id}"]`);
        if (card) {
          card.removeAttribute("style");
          const badge = card.querySelector(".badge-approved, .badge-pending, .badge-rejected, [style*='color:#aaa']");
          if (badge) badge.outerHTML = '<span class="badge-approved">✔ 영수증 인증</span>';
        }
        loadStats();
      });
    });

    container.querySelectorAll(".review-pending-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const { error: updErr } = await db.from("reviews").update({ status: "pending" }).eq("id", btn.dataset.id);
        if (updErr) { alert("처리 실패: " + updErr.message); return; }
        const card = container.querySelector(`[data-review-id="${btn.dataset.id}"]`);
        if (card) {
          card.style.background = "#2a2520";
          const badge = card.querySelector(".badge-approved, .badge-pending, .badge-rejected, [style*='color:#aaa']");
          if (badge) badge.outerHTML = '<span class="badge-pending">⏳ 검수 대기</span>';
        }
        loadStats();
      });
    });

    container.querySelectorAll(".review-delete-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("이 리뷰를 삭제하시겠습니까?")) return;
        const { error: delErr } = await db.from("reviews").delete().eq("id", btn.dataset.id);
        if (delErr) { alert("삭제 실패: " + delErr.message); return; }
        container.querySelector(`[data-review-id="${btn.dataset.id}"]`)?.remove();
        loadStats();
      });
    });
  }

  // ===== 신고 관리 =====
  async function loadReports() {
    const container = document.getElementById("reports-list");
    if (!container) return;
    container.innerHTML = '<p class="placeholder-text">불러오는 중...</p>';
    const db = window.supabaseClient;
    if (!db) return;

    const { data, error } = await db
      .from("review_reports")
      .select("*, reviews(place_name, short_review, region)")
      .eq("is_resolved", false)
      .order("created_at", { ascending: false });

    if (error) { container.innerHTML = `<p class="placeholder-text">오류: ${escapeHtml(error.message)}</p>`; return; }
    if (!data?.length) { container.innerHTML = '<p class="placeholder-text">미처리 신고가 없습니다.</p>'; return; }

    container.innerHTML = data.map((r) => `
      <div class="admin-card" data-report-id="${escapeHtml(r.id)}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap;">
          <h3>${escapeHtml(r.reviews?.place_name || "(알 수 없음)")}</h3>
          <span class="badge-pending">처리 대기</span>
        </div>
        <p>신고 사유: <strong>${escapeHtml(r.reason)}</strong></p>
        <p>리뷰 내용: ${escapeHtml(r.reviews?.short_review || "")}</p>
        <p class="helper-text">신고일: ${escapeHtml(r.created_at?.slice(0, 10) ?? "")}</p>
        <div class="card-actions">
          <button class="btn-approve resolve-report-btn" data-id="${escapeHtml(r.id)}">처리 완료</button>
          <button class="btn-reject delete-reported-review-btn" data-review-id="${escapeHtml(r.review_id)}" data-report-id="${escapeHtml(r.id)}">리뷰 삭제</button>
        </div>
      </div>`).join("");

    container.querySelectorAll(".resolve-report-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const { error: updErr } = await db.from("review_reports").update({ is_resolved: true }).eq("id", btn.dataset.id);
        if (updErr) { alert("처리 실패: " + updErr.message); return; }
        btn.closest(".admin-card").remove();
        if (!container.querySelector(".admin-card")) {
          container.innerHTML = '<p class="placeholder-text">미처리 신고가 없습니다.</p>';
        }
      });
    });

    container.querySelectorAll(".delete-reported-review-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("리뷰를 삭제하시겠습니까?")) return;
        const { error: delErr } = await db.from("reviews").delete().eq("id", btn.dataset.reviewId);
        if (delErr) { alert("삭제 실패: " + delErr.message); return; }
        await db.from("review_reports").update({ is_resolved: true }).eq("id", btn.dataset.reportId);
        btn.closest(".admin-card").remove();
        if (!container.querySelector(".admin-card")) {
          container.innerHTML = '<p class="placeholder-text">미처리 신고가 없습니다.</p>';
        }
        loadStats();
      });
    });
  }

  // ===== 회원 관리 =====
  async function loadUsers() {
    const container = document.getElementById("users-list");
    if (!container) return;
    container.innerHTML = '<p class="placeholder-text">불러오는 중...</p>';
    const db = window.supabaseClient;
    if (!db) return;

    const { data, error } = await db
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) { container.innerHTML = `<p class="placeholder-text">오류: ${escapeHtml(error.message)}</p>`; return; }
    if (!data?.length) { container.innerHTML = '<p class="placeholder-text">가입 회원이 없습니다.</p>'; return; }

    container.innerHTML = data.map((p) => `
      <div class="admin-card">
        <div class="user-row">
          <div class="user-info">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              ${p.avatar_url ? `<img src="${escapeHtml(p.avatar_url)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" alt=""/>` : `<span style="width:32px;height:32px;border-radius:50%;background:#ffb998;display:inline-flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:14px;flex-shrink:0;">${escapeHtml((p.nickname ?? "?")[0])}</span>`}
              <strong>${escapeHtml(p.nickname ?? "(닉네임 없음)")}</strong>
              ${p.is_admin ? '<span style="font-size:11px;background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:999px;font-weight:700;margin-left:4px;">관리자</span>' : ""}
            </div>
            <p style="margin:0 0 2px;font-size:12px;color:#aaa;">가입일: ${escapeHtml(p.created_at?.slice(0, 10) ?? "")}</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn-approve toggle-admin-btn" data-uid="${escapeHtml(p.id)}" data-is-admin="${p.is_admin ? "1" : "0"}">
              ${p.is_admin ? "관리자 해제" : "관리자 지정"}
            </button>
          </div>
        </div>
      </div>`).join("");

    container.querySelectorAll(".toggle-admin-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const isAdmin = btn.dataset.isAdmin === "1";
        const { error: updErr } = await db.from("profiles").update({ is_admin: !isAdmin }).eq("id", btn.dataset.uid);
        if (updErr) { alert("변경 실패: " + updErr.message); return; }
        await loadUsers();
      });
    });
  }

  // ===== 광고 관리 =====
  async function loadAdsTab() {
    await Promise.all([loadBannersAdmin(), loadFeaturedAdmin()]);
    bindAdsForm();
  }

  async function loadBannersAdmin() {
    const container = document.getElementById("banners-list");
    if (!container) return;
    container.innerHTML = '<p class="placeholder-text">불러오는 중...</p>';
    const db = window.supabaseClient;
    if (!db) return;

    const { data, error } = await db
      .from("banners")
      .select("*")
      .order("sort_order");

    if (error) {
      const isNoTable = error.message?.includes("schema cache") || error.code === "PGRST200";
      container.innerHTML = isNoTable
        ? `<p class="placeholder-text">banners 테이블이 아직 생성되지 않았습니다.<br><small style="color:#aaa;">Supabase에서 테이블을 먼저 생성해주세요.</small></p>`
        : `<p class="placeholder-text">오류: ${escapeHtml(error.message)}</p>`;
      return;
    }

    container.innerHTML = data.map((b) => `
      <div class="admin-card" style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div style="flex:1;min-width:160px;">
          <p style="margin:0 0 4px;font-weight:600;font-size:13px;">${escapeHtml(b.alt_text || "(텍스트 없음)")}</p>
          ${b.image_url ? `<img src="${escapeHtml(b.image_url)}" style="max-width:200px;max-height:80px;border-radius:8px;object-fit:cover;display:block;margin-top:6px;" alt="${escapeHtml(b.alt_text || "")}" />` : ""}
          ${b.link_url ? `<p class="helper-text" style="word-break:break-all;">→ ${escapeHtml(b.link_url)}</p>` : ""}
          <p class="helper-text">상태: ${b.is_active ? "노출 중" : "비활성"}</p>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn-approve toggle-banner-btn" data-id="${escapeHtml(b.id)}" data-active="${b.is_active ? "1" : "0"}">${b.is_active ? "비활성화" : "활성화"}</button>
          <button class="btn-delete delete-banner-btn" data-id="${escapeHtml(b.id)}">삭제</button>
        </div>
      </div>`).join("");

    container.querySelectorAll(".toggle-banner-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const isActive = btn.dataset.active === "1";
        const { error } = await db.from("banners").update({ is_active: !isActive }).eq("id", btn.dataset.id);
        if (error) { alert("변경 실패: " + error.message); return; }
        loadBannersAdmin();
      });
    });

    container.querySelectorAll(".delete-banner-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("배너를 삭제하시겠습니까?")) return;
        const { error } = await db.from("banners").delete().eq("id", btn.dataset.id);
        if (error) { alert("삭제 실패: " + error.message); return; }
        loadBannersAdmin();
      });
    });
  }

  async function loadFeaturedAdmin() {
    const container = document.getElementById("featured-list");
    if (!container) return;
    container.innerHTML = '<p class="placeholder-text">불러오는 중...</p>';
    const db = window.supabaseClient;
    if (!db) return;

    const { data, error } = await db
      .from("featured_places")
      .select("*")
      .order("sort_order");

    if (error) {
      const isNoTable = error.message?.includes("schema cache") || error.code === "PGRST200";
      container.innerHTML = isNoTable
        ? `<p class="placeholder-text">featured_places 테이블이 아직 생성되지 않았습니다.<br><small style="color:#aaa;">Supabase에서 테이블을 먼저 생성해주세요.</small></p>`
        : `<p class="placeholder-text">오류: ${escapeHtml(error.message)}</p>`;
      return;
    }

    container.innerHTML = data.map((fp) => `
      <div class="admin-card" style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div style="flex:1;min-width:160px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <strong style="font-size:14px;">${escapeHtml(fp.place_name)}</strong>
            <span style="font-size:11px;padding:2px 8px;border-radius:999px;background:${fp.tag === "이벤트" ? "#fef3c7" : "#dcfce7"};color:${fp.tag === "이벤트" ? "#92400e" : "#166534"};font-weight:700;">${escapeHtml(fp.tag || "우수협력병원")}</span>
          </div>
          <p class="helper-text">${CATEGORY_LABEL[fp.category] || fp.category} · ${escapeHtml(fp.region || "")}</p>
          ${fp.address ? `<p class="helper-text">${escapeHtml(fp.address)}</p>` : ""}
          <p class="helper-text">상태: ${fp.is_active ? "노출 중" : "비활성"}</p>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn-approve toggle-fp-btn" data-id="${escapeHtml(fp.id)}" data-active="${fp.is_active ? "1" : "0"}">${fp.is_active ? "비활성화" : "활성화"}</button>
          <button class="btn-delete delete-fp-btn" data-id="${escapeHtml(fp.id)}">삭제</button>
        </div>
      </div>`).join("");

    container.querySelectorAll(".toggle-fp-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const isActive = btn.dataset.active === "1";
        const { error } = await db.from("featured_places").update({ is_active: !isActive }).eq("id", btn.dataset.id);
        if (error) { alert("변경 실패: " + error.message); return; }
        loadFeaturedAdmin();
      });
    });

    container.querySelectorAll(".delete-fp-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("고정 노출 업체를 삭제하시겠습니까?")) return;
        const { error } = await db.from("featured_places").delete().eq("id", btn.dataset.id);
        if (error) { alert("삭제 실패: " + error.message); return; }
        loadFeaturedAdmin();
      });
    });
  }

  let adsFormBound = false;
  function bindAdsForm() {
    if (adsFormBound) return;
    adsFormBound = true;
    const db = window.supabaseClient;
    if (!db) return;

    document.getElementById("btn-add-banner")?.addEventListener("click", async () => {
      const imageUrl = document.getElementById("banner-image-url")?.value.trim();
      if (!imageUrl) { alert("이미지 URL을 입력해주세요."); return; }
      const { error } = await db.from("banners").insert([{
        image_url: imageUrl,
        link_url: document.getElementById("banner-link-url")?.value.trim() || null,
        alt_text: document.getElementById("banner-alt-text")?.value.trim() || null,
      }]);
      if (error) { alert("등록 실패: " + error.message); return; }
      ["banner-image-url", "banner-link-url", "banner-alt-text"].forEach((id) => {
        const el = document.getElementById(id); if (el) el.value = "";
      });
      loadBannersAdmin();
    });

    document.getElementById("btn-add-featured")?.addEventListener("click", async () => {
      const placeName = document.getElementById("fp-place-name")?.value.trim();
      const region = document.getElementById("fp-region")?.value.trim();
      if (!placeName || !region) { alert("업체 이름과 지역을 입력해주세요."); return; }
      const { error } = await db.from("featured_places").insert([{
        place_name: placeName,
        category: document.getElementById("fp-category")?.value || "hospital",
        region,
        address: document.getElementById("fp-address")?.value.trim() || null,
        phone: document.getElementById("fp-phone")?.value.trim() || null,
        tag: document.getElementById("fp-tag")?.value || "우수협력병원",
      }]);
      if (error) { alert("등록 실패: " + error.message); return; }
      ["fp-place-name", "fp-region", "fp-address", "fp-phone"].forEach((id) => {
        const el = document.getElementById(id); if (el) el.value = "";
      });
      loadFeaturedAdmin();
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
        <button class="mobile-logout-btn" id="mobile-logout-admin">로그아웃</button>`;
      document.getElementById("mobile-logout-admin")?.addEventListener("click", async () => {
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

    const deniedBanner = document.getElementById("access-denied-banner");
    const content = document.getElementById("admin-content");

    if (!window.PetAuth?.isLoggedIn() || !window.PetAuth?.isAdmin()) {
      if (deniedBanner) deniedBanner.hidden = false;
      if (content) content.hidden = true;
      return;
    }

    if (content) content.hidden = false;
    if (deniedBanner) deniedBanner.hidden = true;

    bindTabs();
    await loadStats();
    await loadReceipts();
  }

  init();
})();
