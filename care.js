"use strict";

const CARE_DEFAULTS = {
  dog: {
    full_grooming:  { label: "전체 미용",        default_days: 42, icon: "✂️" },
    brushing:       { label: "브러싱",            default_days: 3,  icon: "🐾" },
    nail_trim:      { label: "발톱 정리",         default_days: 21, icon: "💅" },
    teeth_brushing: { label: "양치",              default_days: 1,  icon: "🦷" },
    ear_cleaning:   { label: "귀세척",            default_days: 30, icon: "👂" },
    anal_gland:     { label: "항문낭 관리",       default_days: 90, icon: "💊" },
    heartworm:      { label: "심장사상충 예방",   default_days: 30, icon: "💊" },
    flea_tick:      { label: "벼룩·진드기 예방", default_days: 30, icon: "🛡️" },
    deworming:      { label: "구충제",            default_days: 90, icon: "💊" },
    vaccine_dhpp:   { label: "종합백신 (DHPP)",   default_days: 1095, icon: "💉" },
    vaccine_rabies: { label: "광견병 백신",       default_days: 1095, icon: "💉" },
    walk:           { label: "산책",              default_days: 1,    icon: "🦮" },
  },
  cat: {
    full_grooming:  { label: "전체 미용",         default_days: 60,   icon: "✂️" },
    brushing:       { label: "브러싱",             default_days: 3,    icon: "🐾" },
    nail_trim:      { label: "발톱 정리",          default_days: 14,   icon: "💅" },
    teeth_brushing: { label: "양치",               default_days: 1,    icon: "🦷" },
    ear_cleaning:   { label: "귀세척",             default_days: 30,   icon: "👂" },
    heartworm:      { label: "심장사상충 예방",    default_days: 30,   icon: "💊" },
    flea_tick:      { label: "벼룩·진드기 예방",  default_days: 30,   icon: "🛡️" },
    deworming:      { label: "구충제",             default_days: 90,   icon: "💊" },
    vaccine_fvrcp:  { label: "종합백신 (FVRCP)",   default_days: 1095, icon: "💉" },
    vaccine_rabies: { label: "광견병 백신",        default_days: 1095, icon: "💉" },
    vaccine_felv:   { label: "고양이백혈병 (FeLV)", default_days: 365, icon: "💉" },
    walk:           { label: "산책",               default_days: 1,   icon: "🐾" },
  },
};

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function formatDateShort(isoStr) {
  if (!isoStr) return "기록 없음";
  const d = new Date(isoStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function calcDday(lastDoneAt, intervalDays) {
  if (!lastDoneAt || !intervalDays) return null;
  const done = new Date(lastDoneAt);
  const nextDue = new Date(done.getTime() + intervalDays * 86_400_000);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  nextDue.setHours(0, 0, 0, 0);
  return Math.round((nextDue - today) / 86_400_000);
}

function ddayBadge(dday) {
  if (dday === null) return `<span class="care-dday care-dday--unknown">미기록</span>`;
  if (dday < 0)  return `<span class="care-dday care-dday--overdue">D+${Math.abs(dday)} 지남</span>`;
  if (dday === 0) return `<span class="care-dday care-dday--today">D-Day</span>`;
  if (dday <= 3)  return `<span class="care-dday care-dday--urgent">D-${dday}</span>`;
  if (dday <= 7)  return `<span class="care-dday care-dday--soon">D-${dday}</span>`;
  return `<span class="care-dday care-dday--ok">D-${dday}</span>`;
}

function speciesKey(species) {
  if (species === "고양이") return "cat";
  return "dog"; // 강아지 + 기타 → dog defaults
}

function speciesEmoji(species) {
  if (species === "고양이") return "🐱";
  if (species === "강아지") return "🐶";
  return "🐾";
}

function renderCareItem(key, item, lastDoneAt, dday) {
  const isOverdue = dday !== null && dday < 0;
  const isToday = dday === 0;
  return `
    <div class="care-item-card ${isOverdue ? "care-item--overdue" : isToday ? "care-item--today" : ""}" data-key="${escapeHtml(key)}">
      <span class="care-item-icon">${item.icon}</span>
      <div class="care-item-body">
        <div class="care-item-name">${escapeHtml(item.label)}</div>
        <div class="care-item-meta">
          ${lastDoneAt ? `마지막: ${formatDateShort(lastDoneAt)}` : "기록 없음"}
          &nbsp;·&nbsp; ${item.default_days >= 365 ? `${Math.round(item.default_days / 365)}년` : `${item.default_days}일`} 주기
        </div>
      </div>
      <div class="care-item-right">
        ${ddayBadge(dday)}
        <button class="care-done-btn" data-key="${escapeHtml(key)}" data-label="${escapeHtml(item.label)}">완료</button>
      </div>
    </div>`;
}

function renderCareSection(container, pet, careItems) {
  const urgent = careItems.filter(({ dday }) => dday !== null && dday <= 3);
  const rest = careItems.filter(({ dday }) => dday === null || dday > 3);

  let html = `<div class="care-pet-summary">
    <span class="care-pet-avatar">${pet.photo_url ? `<img src="${escapeHtml(pet.photo_url)}" alt="${escapeHtml(pet.name)}"/>` : speciesEmoji(pet.species)}</span>
    <div>
      <strong class="care-pet-name">${escapeHtml(pet.name)}</strong>
      <span class="care-pet-species">${escapeHtml(pet.species ?? "")}${pet.breed ? ` · ${escapeHtml(pet.breed)}` : ""}</span>
    </div>
  </div>`;

  if (urgent.length) {
    html += `<div class="care-section-header care-section-header--urgent">
      <span>🚨 지금 챙겨주세요</span>
      <span class="care-urgent-count">${urgent.length}건</span>
    </div>`;
    urgent.forEach(({ key, item, lastDoneAt, dday }) => {
      html += renderCareItem(key, item, lastDoneAt, dday);
    });
  }

  if (rest.length) {
    html += `<div class="care-section-header">📅 케어 스케줄</div>`;
    rest.forEach(({ key, item, lastDoneAt, dday }) => {
      html += renderCareItem(key, item, lastDoneAt, dday);
    });
  }

  container.innerHTML = html;
}

async function loadCareForPet(pet, db, container) {
  container.innerHTML = `<p class="care-loading">불러오는 중...</p>`;

  const defaults = CARE_DEFAULTS[speciesKey(pet.species)] ?? CARE_DEFAULTS.dog;

  // Load last done dates per care_key
  let lastDoneMap = {};
  try {
    const { data: logs } = await db
      .from("pet_care_logs")
      .select("care_key, done_at")
      .eq("pet_id", pet.id)
      .order("done_at", { ascending: false });

    (logs ?? []).forEach((log) => {
      if (!lastDoneMap[log.care_key]) lastDoneMap[log.care_key] = log.done_at;
    });
  } catch {
    // Table may not exist yet — show items with unknown state
  }

  const careItems = Object.entries(defaults).map(([key, item]) => {
    const lastDoneAt = lastDoneMap[key] ?? null;
    const dday = calcDday(lastDoneAt, item.default_days);
    return { key, item, lastDoneAt, dday };
  });

  // Sort: overdue first, then by dday asc, then unknown last
  careItems.sort((a, b) => {
    if (a.dday === null && b.dday === null) return 0;
    if (a.dday === null) return 1;
    if (b.dday === null) return -1;
    return a.dday - b.dday;
  });

  renderCareSection(container, pet, careItems);

  // Bind done buttons
  container.querySelectorAll(".care-done-btn").forEach((btn) => {
    btn.addEventListener("click", () => markDone(pet, btn.dataset.key, btn.dataset.label, db, container));
  });
}

async function markDone(pet, careKey, label, db, container) {
  const userId = window.PetAuth?.currentUser?.id;
  if (!userId) { alert("로그인이 필요합니다."); return; }

  const btn = container.querySelector(`.care-done-btn[data-key="${careKey}"]`);
  if (btn) { btn.disabled = true; btn.textContent = "저장 중..."; }

  const { error } = await db.from("pet_care_logs").insert({
    user_id: userId,
    pet_id: pet.id,
    care_key: careKey,
    done_at: new Date().toISOString(),
  });

  if (error) {
    if (error.code === "42P01") {
      alert("케어 기록 테이블이 아직 없어요.\nSupabase에서 supabase-care.sql을 실행해 주세요.");
    } else {
      alert(`저장 실패: ${error.message}`);
    }
    if (btn) { btn.disabled = false; btn.textContent = "완료"; }
    return;
  }

  // Reload care items
  await loadCareForPet(pet, db, container);
}

async function init() {
  const db = window.supabaseClient;
  const content = document.getElementById("care-content");

  // Wait for auth init (up to 2s)
  const user = await new Promise((resolve) => {
    let tries = 0;
    const check = () => {
      const u = window.PetAuth?.currentUser;
      if (u !== undefined || tries >= 10) { resolve(u ?? null); return; }
      tries++;
      setTimeout(check, 200);
    };
    check();
  });

  if (!user) {
    content.innerHTML = `
      <div class="care-empty-state">
        <div class="care-empty-icon">🔒</div>
        <p class="care-empty-title">로그인이 필요해요</p>
        <p class="care-empty-desc">로그인 후 반려동물 케어 스케줄을 관리할 수 있어요.</p>
        <button class="care-login-btn" onclick="window.location.href='index.html'">로그인하러 가기</button>
      </div>`;
    return;
  }

  const { data: pets } = await db
    .from("pets")
    .select("id, name, species, breed, photo_url")
    .eq("user_id", user.id)
    .order("created_at");

  if (!pets?.length) {
    content.innerHTML = `
      <div class="care-empty-state">
        <div class="care-empty-icon">🐾</div>
        <p class="care-empty-title">반려동물을 등록해주세요</p>
        <p class="care-empty-desc">마이페이지에서 반려동물을 등록하면 케어 스케줄이 자동으로 설정돼요.</p>
        <a class="care-login-btn" href="mypage.html?tab=pets">반려동물 등록하기 →</a>
      </div>`;
    return;
  }

  // Build pet tabs + care content areas
  let tabsHtml = `<div class="care-pet-tabs" id="care-pet-tabs">`;
  let areasHtml = ``;

  pets.forEach((pet, i) => {
    const isActive = i === 0 ? "is-active" : "";
    tabsHtml += `<button class="care-pet-tab ${isActive}" data-pet-idx="${i}">
      ${pet.photo_url ? `<img class="care-pet-tab-img" src="${escapeHtml(pet.photo_url)}" alt="${escapeHtml(pet.name)}"/>` : speciesEmoji(pet.species)}
      <span>${escapeHtml(pet.name)}</span>
    </button>`;
    areasHtml += `<div class="care-area" id="care-area-${i}" ${i !== 0 ? "hidden" : ""}></div>`;
  });

  tabsHtml += `</div>`;
  content.innerHTML = tabsHtml + areasHtml;

  // Load first pet
  const firstArea = document.getElementById("care-area-0");
  await loadCareForPet(pets[0], db, firstArea);
  document.getElementById("care-history-btn")?.removeAttribute("hidden");

  // Pet tab switching
  document.getElementById("care-pet-tabs")?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".care-pet-tab");
    if (!btn) return;
    const idx = parseInt(btn.dataset.petIdx, 10);

    document.querySelectorAll(".care-pet-tab").forEach((t) => t.classList.toggle("is-active", t === btn));
    document.querySelectorAll(".care-area").forEach((a, i) => { a.hidden = i !== idx; });

    const area = document.getElementById(`care-area-${idx}`);
    if (area && area.innerHTML === "") {
      await loadCareForPet(pets[idx], db, area);
    }
  });

  // Care history button
  document.getElementById("care-history-btn")?.addEventListener("click", () => {
    const activePetIdx = parseInt(
      document.querySelector(".care-pet-tab.is-active")?.dataset.petIdx ?? "0", 10
    );
    const pet = pets[activePetIdx];
    showCareHistory(pet, db);
  });
}

async function showCareHistory(pet, db) {
  const { data: logs } = await db
    .from("pet_care_logs")
    .select("care_key, done_at, notes")
    .eq("pet_id", pet.id)
    .order("done_at", { ascending: false })
    .limit(50);

  const defaults = { ...CARE_DEFAULTS.dog, ...CARE_DEFAULTS.cat };

  const rows = (logs ?? []).map((log) => {
    const item = defaults[log.care_key];
    const label = item?.label ?? log.care_key;
    const icon = item?.icon ?? "📋";
    return `<div class="care-history-row">
      <span>${icon} ${escapeHtml(label)}</span>
      <span class="care-history-date">${formatDateShort(log.done_at)}</span>
    </div>`;
  }).join("") || `<p class="care-empty-desc" style="padding:16px;">아직 기록이 없어요.</p>`;

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-height:80vh;overflow-y:auto;">
      <button class="modal-close" style="font-size:20px;background:none;border:none;float:right;cursor:pointer;padding:4px 8px;">✕</button>
      <h2 class="modal-title" style="font-size:16px;margin-bottom:16px;">📋 ${escapeHtml(pet.name)}의 케어 기록</h2>
      ${rows}
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector(".modal-close").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
}

document.addEventListener("DOMContentLoaded", init);
