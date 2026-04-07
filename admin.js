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
        if (btn.dataset.tab === "reviews") loadAllReviews();
        if (btn.dataset.tab === "users") loadUsers();
      });
    });
  }

  // ===== 통계 =====
  async function loadStats() {
    const db = window.supabaseClient;
    if (!db) return;

    const [pendingRes, reviewsRes, profilesRes] = await Promise.all([
      db.from("reviews").select("id", { count: "exact", head: true }).eq("is_verified", false).not("receipt_image_url", "is", null),
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

    // 영수증 업로드됐지만 미인증 리뷰
    const { data, error } = await db
      .from("reviews")
      .select("*")
      .not("receipt_image_url", "is", null)
      .neq("receipt_image_url", "")
      .eq("is_verified", false)
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
        const { error: updErr } = await db
          .from("reviews")
          .update({ is_verified: isApprove })
          .eq("id", id);
        if (updErr) { alert("처리 실패: " + updErr.message); return; }
        const card = container.querySelector(`[data-review-id="${id}"]`);
        if (card) {
          card.querySelector(".badge-pending").outerHTML = isApprove
            ? '<span class="badge-approved">✔ 인증 완료</span>'
            : '<span class="badge-rejected">✕ 반려됨</span>';
          card.querySelector(".card-actions").remove();
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

    container.innerHTML = data.map((r) => `
      <div class="admin-card" data-review-id="${escapeHtml(r.id)}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap;">
          <h3>${escapeHtml(r.place_name)} <small style="color:#aaa;">(${CATEGORY_LABEL[r.category] ?? r.category})</small></h3>
          ${r.is_verified
            ? '<span class="badge-approved">✔ 영수증 인증</span>'
            : '<span style="font-size:11px;color:#aaa;">미인증</span>'}
        </div>
        <p>지역: 서울특별시 ${escapeHtml(r.region ?? "")} · 방문일: ${escapeHtml(r.visit_date ?? "")}</p>
        <p>후기: ${escapeHtml(r.short_review ?? "")}</p>
        <p class="helper-text">등록일: ${escapeHtml(r.created_at?.slice(0, 10) ?? "")}</p>
        <div class="card-actions">
          <button class="btn-delete" data-review-id="${escapeHtml(r.id)}">삭제</button>
        </div>
      </div>`).join("");

    container.querySelectorAll(".btn-delete[data-review-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("이 리뷰를 삭제하시겠습니까?")) return;
        const { error: delErr } = await db.from("reviews").delete().eq("id", btn.dataset.reviewId);
        if (delErr) { alert("삭제 실패: " + delErr.message); return; }
        btn.closest(".admin-card").remove();
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

  // ===== 헤더 인증 =====
  function updateHeaderAuth() {
    const area = document.getElementById("header-auth");
    if (!area) return;
    const auth = window.PetAuth;
    if (!auth?.isLoggedIn()) {
      area.innerHTML = `<button class="auth-login-btn" onclick="window.location.href='index.html'">로그인</button>`;
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
