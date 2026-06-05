"use strict";

// ── 단골병원 관리 ──────────────────────────────────────────────
// favorites 테이블: id, user_id, place_name, category, region, address, phone, created_at
// hospital_visits 테이블: id, user_id, favorite_id, visit_date, cost, content, vet_name

const db     = window.supabaseClient;
let userId   = null;
let favorites = [];
let editingId = null;
let visitFavoriteId = null;

function escH(v) {
  return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
function formatDate(s) {
  if (!s) return "";
  const d = new Date(s);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
}
function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// ── 병원 목록 렌더 ────────────────────────────────────────────
async function loadHospitals() {
  const listEl = document.getElementById("hospital-list");
  if (!userId) {
    listEl.innerHTML = `<div style="text-align:center;padding:48px 0;">
      <p style="font-size:15px;font-weight:700;color:#444;margin-bottom:8px;">로그인이 필요합니다</p>
      <button onclick="window.PetAuth?.signInWithGoogle()" style="padding:10px 24px;background:#16a34a;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;">구글로 로그인</button>
    </div>`;
    return;
  }

  let visits = [];
  try {
    const [favRes, visitRes] = await Promise.all([
      db.from("favorites").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      db.from("hospital_visits").select("favorite_id, visit_date, cost").eq("user_id", userId).order("visit_date", { ascending: false }),
    ]);
    favorites = favRes.data ?? [];
    visits    = visitRes.data ?? [];
  } catch {
    try {
      const { data } = await db.from("favorites").select("*").eq("user_id", userId).order("created_at", { ascending: false });
      favorites = data ?? [];
    } catch { favorites = []; }
  }

  if (!favorites.length) {
    listEl.innerHTML = `<div style="text-align:center;padding:56px 16px;">
      <div style="font-size:52px;margin-bottom:12px;">🏥</div>
      <p style="font-size:16px;font-weight:800;color:#1a1a1a;margin-bottom:6px;">단골병원을 등록해보세요</p>
      <p style="font-size:13px;color:#888;line-height:1.6;margin-bottom:20px;">자주 가는 병원을 저장하고<br>방문 기록과 진료비를 관리하세요.</p>
      <button onclick="openHospitalForm()" style="padding:12px 28px;background:#16a34a;color:#fff;border:none;border-radius:14px;font-size:14px;font-weight:700;cursor:pointer;">+ 첫 병원 등록하기</button>
    </div>`;
    return;
  }

  const visitMap = {};
  visits.forEach(v => {
    if (!visitMap[v.favorite_id]) visitMap[v.favorite_id] = { count: 0, lastDate: null, totalCost: 0 };
    visitMap[v.favorite_id].count++;
    visitMap[v.favorite_id].totalCost += v.cost || 0;
    if (!visitMap[v.favorite_id].lastDate || v.visit_date > visitMap[v.favorite_id].lastDate) {
      visitMap[v.favorite_id].lastDate = v.visit_date;
    }
  });

  listEl.innerHTML = favorites.map(fav => {
    const vm = visitMap[fav.id] || { count: 0, lastDate: null, totalCost: 0 };
    return `
    <div class="hospital-card">
      <div class="hospital-card-top">
        <div class="hospital-card-icon">🏥</div>
        <div class="hospital-card-info">
          <div class="hospital-card-name">${escH(fav.place_name)}</div>
          <div class="hospital-card-meta">
            <span class="hospital-cat-badge">${escH(fav.category || "동물병원")}</span>
            ${fav.address ? `<span>${escH(fav.address)}</span>` : ""}
          </div>
          ${fav.phone ? `<div class="hospital-card-phone"><a href="tel:${escH(fav.phone)}" onclick="event.stopPropagation()">📞 ${escH(fav.phone)}</a></div>` : ""}
        </div>
        <button class="hospital-card-delete" data-fav-id="${escH(fav.id)}">🗑</button>
      </div>
      <div class="hospital-card-stats">
        <div class="hospital-stat"><span class="hospital-stat-label">방문</span><span class="hospital-stat-val">${vm.count}회</span></div>
        <div class="hospital-stat"><span class="hospital-stat-label">마지막 방문</span><span class="hospital-stat-val">${vm.lastDate ? formatDate(vm.lastDate) : "없음"}</span></div>
        <div class="hospital-stat"><span class="hospital-stat-label">누적 진료비</span><span class="hospital-stat-val">${vm.totalCost ? vm.totalCost.toLocaleString()+"원" : "-"}</span></div>
      </div>
      ${fav.memo ? `<div class="hospital-card-memo">${escH(fav.memo)}</div>` : ""}
      <div class="hospital-card-actions">
        <button class="hospital-action-btn" data-fav-id="${escH(fav.id)}" data-action="visit">📅 방문 기록</button>
        <button class="hospital-action-btn hospital-action-btn--outline" data-fav-id="${escH(fav.id)}" data-action="detail">📋 기록 보기</button>
      </div>
    </div>`;
  }).join("");

  // data-* 속성으로 이벤트 위임 (inline onclick의 단따옴표 XSS 방지)
  listEl.querySelectorAll(".hospital-card-delete[data-fav-id]").forEach(btn => {
    btn.addEventListener("click", () => deleteHospital(btn.dataset.favId));
  });
  listEl.querySelectorAll("[data-action='visit']").forEach(btn => {
    const fav = favorites.find(f => f.id === btn.dataset.favId);
    if (fav) btn.addEventListener("click", () => openVisitForm(fav.id, fav.place_name));
  });
  listEl.querySelectorAll("[data-action='detail']").forEach(btn => {
    const fav = favorites.find(f => f.id === btn.dataset.favId);
    if (fav) btn.addEventListener("click", () => openHospitalDetail(fav.id, fav.place_name));
  });
}

async function deleteHospital(favId) {
  if (!confirm("이 병원을 목록에서 삭제할까요?")) return;
  const { error } = await db.from("favorites").delete().eq("id", favId).eq("user_id", userId);
  if (error) { alert("삭제 실패: " + error.message); return; }
  await loadHospitals();
}

// ── 병원 추가 폼 ──────────────────────────────────────────────
function openHospitalForm(fav) {
  editingId = fav?.id ?? null;
  document.getElementById("hospital-form-title").textContent = fav ? "병원 수정" : "병원 추가";
  document.getElementById("h-name").value     = fav?.place_name || "";
  document.getElementById("h-category").value = fav?.category  || "동물병원";
  document.getElementById("h-address").value  = fav?.address   || "";
  document.getElementById("h-phone").value    = fav?.phone     || "";
  document.getElementById("h-memo").value     = fav?.memo      || "";
  document.getElementById("hospital-form-error").textContent = "";
  document.getElementById("hospital-form-overlay").hidden = false;
  document.body.style.overflow = "hidden";
}

async function saveHospital() {
  const name     = document.getElementById("h-name").value.trim();
  const category = document.getElementById("h-category").value;
  const address  = document.getElementById("h-address").value.trim();
  const phone    = document.getElementById("h-phone").value.trim();
  const memo     = document.getElementById("h-memo").value.trim();
  const errEl    = document.getElementById("hospital-form-error");
  if (!name) { errEl.textContent = "병원 이름을 입력해주세요."; return; }
  errEl.textContent = "";

  const btn = document.getElementById("hospital-form-save");
  btn.disabled = true; btn.textContent = "저장 중...";

  try {
    if (editingId) {
      const { error } = await db.from("favorites").update({ place_name: name, category, address: address||null, phone: phone||null, memo: memo||null }).eq("id", editingId).eq("user_id", userId);
      if (error) throw error;
    } else {
      const { error } = await db.from("favorites").insert({ user_id: userId, place_name: name, category, address: address||null, phone: phone||null, memo: memo||null });
      if (error) throw error;
    }
    document.getElementById("hospital-form-overlay").hidden = true;
    document.body.style.overflow = "";
    await loadHospitals();
  } catch (err) {
    errEl.textContent = `저장 실패: ${err.message || "다시 시도해주세요."}`;
  } finally {
    btn.disabled = false; btn.textContent = "저장";
  }
}

// ── 방문 기록 폼 ──────────────────────────────────────────────
function openVisitForm(favId, name) {
  visitFavoriteId = favId;
  document.getElementById("visit-hospital-name").textContent = `🏥 ${name}`;
  document.getElementById("v-date").value    = todayIso();
  document.getElementById("v-cost").value    = "";
  document.getElementById("v-content").value = "";
  document.getElementById("v-vet").value     = "";
  document.getElementById("visit-form-overlay").hidden = false;
  document.body.style.overflow = "hidden";
}

async function saveVisit() {
  if (!visitFavoriteId) return;
  const date    = document.getElementById("v-date").value;
  const cost    = parseFloat(document.getElementById("v-cost").value) || 0;
  const content = document.getElementById("v-content").value.trim();
  const vet     = document.getElementById("v-vet").value.trim();
  if (!date) { alert("방문일을 선택해주세요."); return; }

  const btn = document.getElementById("visit-form-save");
  btn.disabled = true; btn.textContent = "저장 중...";

  try {
    await db.from("hospital_visits").insert({
      user_id: userId, favorite_id: visitFavoriteId,
      visit_date: date, cost: cost || null, content: content || null, vet_name: vet || null,
    });
  } catch {
    // hospital_visits not created yet → fall back to pet_health_records
    const fav  = favorites.find(f => f.id === visitFavoriteId);
    const note = [fav?.place_name ? `병원: ${fav.place_name}` : "", content, vet ? `담당: ${vet}` : "", cost ? `진료비: ${cost.toLocaleString()}원` : ""].filter(Boolean).join(" / ");
    await db.from("pet_health_records").insert({ user_id: userId, pet_id: null, record_type: "병원방문", content: note, record_date: date }).catch(() => {});
  }

  btn.disabled = false; btn.textContent = "저장";
  document.getElementById("visit-form-overlay").hidden = true;
  document.body.style.overflow = "";
  await loadHospitals();
}

// ── 병원 상세 / 방문 기록 목록 ────────────────────────────────
async function openHospitalDetail(favId, name) {
  document.getElementById("hd-name").textContent = name;
  const detailEl = document.getElementById("hospital-detail-content");
  detailEl.innerHTML = '<p style="padding:20px 0;color:#aaa;font-size:13px;">불러오는 중...</p>';
  document.getElementById("hospital-detail-overlay").classList.add("is-open");
  document.body.style.overflow = "hidden";

  let visits = [];
  try {
    const { data } = await db.from("hospital_visits").select("*").eq("favorite_id", favId).order("visit_date", { ascending: false });
    visits = data ?? [];
  } catch { visits = []; }

  const totalCost = visits.reduce((s, v) => s + (v.cost || 0), 0);

  detailEl.innerHTML = `
    <div style="display:flex;gap:10px;margin-bottom:16px;">
      <div style="flex:1;background:#f8f4f0;border-radius:12px;padding:12px;text-align:center;">
        <div style="font-size:11px;color:#888;margin-bottom:2px;">총 방문</div>
        <div style="font-size:22px;font-weight:900;color:#1a1a1a;">${visits.length}회</div>
      </div>
      <div style="flex:1;background:#f8f4f0;border-radius:12px;padding:12px;text-align:center;">
        <div style="font-size:11px;color:#888;margin-bottom:2px;">누적 진료비</div>
        <div style="font-size:16px;font-weight:800;color:#1a1a1a;">${totalCost ? totalCost.toLocaleString()+"원" : "-"}</div>
      </div>
    </div>
    <button class="care-sheet-done-btn" id="hd-add-visit-btn" style="margin-bottom:16px;">+ 방문 기록 추가</button>
    ${visits.length ? visits.map(v => `
      <div style="background:#faf7f5;border-radius:10px;padding:12px;margin-bottom:8px;position:relative;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-size:13px;font-weight:700;">${formatDate(v.visit_date)}</span>
          ${v.cost ? `<span style="font-size:13px;font-weight:700;color:#16a34a;">${v.cost.toLocaleString()}원</span>` : ""}
        </div>
        ${v.content ? `<div style="font-size:13px;color:#444;line-height:1.4;">${escH(v.content)}</div>` : ""}
        ${v.vet_name ? `<div style="font-size:11px;color:#888;margin-top:3px;">담당: ${escH(v.vet_name)}</div>` : ""}
        <button data-visit-id="${escH(v.id)}" class="hd-delete-visit-btn" style="position:absolute;right:10px;top:10px;background:none;border:none;font-size:13px;cursor:pointer;color:#ccc;">✕</button>
      </div>`).join("") : `<p style="font-size:13px;color:#aaa;padding:12px 0;">아직 방문 기록이 없어요.</p>`}`;

  detailEl.querySelector("#hd-add-visit-btn")?.addEventListener("click", () => openVisitForm(favId, name));
  detailEl.querySelectorAll(".hd-delete-visit-btn").forEach(btn => {
    btn.addEventListener("click", () => deleteVisit(btn.dataset.visitId, favId, name));
  });
}

async function deleteVisit(visitId, favId, name) {
  if (!confirm("삭제할까요?")) return;
  const { error } = await db.from("hospital_visits").delete().eq("id", visitId);
  if (error) { alert("삭제 실패: " + error.message); return; }
  await openHospitalDetail(favId, name);
}

// ── 이벤트 바인딩 ──────────────────────────────────────────────
document.getElementById("hospital-add-btn")?.addEventListener("click", () => openHospitalForm());

document.getElementById("hospital-form-close")?.addEventListener("click", () => {
  document.getElementById("hospital-form-overlay").hidden = true;
  document.body.style.overflow = "";
});
document.getElementById("hospital-form-overlay")?.addEventListener("click", e => {
  if (e.target.id === "hospital-form-overlay") { e.currentTarget.hidden = true; document.body.style.overflow = ""; }
});
document.getElementById("hospital-form-save")?.addEventListener("click", saveHospital);

document.getElementById("visit-form-close")?.addEventListener("click", () => {
  document.getElementById("visit-form-overlay").hidden = true;
  document.body.style.overflow = "";
});
document.getElementById("visit-form-overlay")?.addEventListener("click", e => {
  if (e.target.id === "visit-form-overlay") { e.currentTarget.hidden = true; document.body.style.overflow = ""; }
});
document.getElementById("visit-form-save")?.addEventListener("click", saveVisit);

document.getElementById("hospital-detail-close")?.addEventListener("click", () => {
  document.getElementById("hospital-detail-overlay").classList.remove("is-open");
  document.body.style.overflow = "";
});
document.getElementById("hospital-detail-overlay")?.addEventListener("click", e => {
  if (e.target === document.getElementById("hospital-detail-overlay")) {
    e.currentTarget.classList.remove("is-open");
    document.body.style.overflow = "";
  }
});

// ── 초기화 ────────────────────────────────────────────────────
(async () => {
  if (!db) return;
  await window.PetAuth?.init().catch(() => {});
  userId = window.PetAuth?.currentUser?.id ?? null;
  await loadHospitals();
})();
