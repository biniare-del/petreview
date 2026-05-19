"use strict";

// ─── 케어 기본 데이터 ────────────────────────────────────────
const CARE_DEFAULTS = {
  dog: {
    walk:           { label: "산책",              default_days: 1,    icon: "🦮" },
    teeth_brushing: { label: "양치",              default_days: 1,    icon: "🦷" },
    brushing:       { label: "브러싱",            default_days: 3,    icon: "🐾" },
    nail_trim:      { label: "발톱 정리",         default_days: 21,   icon: "💅" },
    ear_cleaning:   { label: "귀세척",            default_days: 30,   icon: "👂" },
    full_grooming:  { label: "전체 미용",         default_days: 42,   icon: "✂️" },
    heartworm:      { label: "심장사상충 예방",   default_days: 30,   icon: "💊" },
    flea_tick:      { label: "벼룩·진드기 예방", default_days: 30,   icon: "🛡️" },
    deworming:      { label: "구충제",            default_days: 90,   icon: "💊" },
    anal_gland:     { label: "항문낭 관리",       default_days: 90,   icon: "💊" },
    vaccine_dhpp:   { label: "종합백신 (DHPP)",   default_days: 1095, icon: "💉" },
    vaccine_rabies: { label: "광견병 백신",       default_days: 1095, icon: "💉" },
  },
  cat: {
    teeth_brushing: { label: "양치",               default_days: 1,    icon: "🦷" },
    brushing:       { label: "브러싱",             default_days: 3,    icon: "🐾" },
    nail_trim:      { label: "발톱 정리",          default_days: 14,   icon: "💅" },
    ear_cleaning:   { label: "귀세척",             default_days: 30,   icon: "👂" },
    full_grooming:  { label: "전체 미용",          default_days: 60,   icon: "✂️" },
    heartworm:      { label: "심장사상충 예방",    default_days: 30,   icon: "💊" },
    flea_tick:      { label: "벼룩·진드기 예방",  default_days: 30,   icon: "🛡️" },
    deworming:      { label: "구충제",             default_days: 90,   icon: "💊" },
    vaccine_fvrcp:  { label: "종합백신 (FVRCP)",   default_days: 1095, icon: "💉" },
    vaccine_rabies: { label: "광견병 백신",        default_days: 1095, icon: "💉" },
    vaccine_felv:   { label: "고양이백혈병 (FeLV)", default_days: 365, icon: "💉" },
    walk:           { label: "산책",               default_days: 1,   icon: "🐾" },
  },
};

// ─── 상태 ────────────────────────────────────────────────────
let _pets = [];
let _db = null;
let _activePetIdx = 0;
let _activeSubtab = "care"; // "care" | "diet"

// ─── 유틸 ────────────────────────────────────────────────────
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

function getTodayKST() {
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function calcDday(lastDoneAt, intervalDays) {
  if (!lastDoneAt || !intervalDays) return null;
  const nextDue = new Date(new Date(lastDoneAt).getTime() + intervalDays * 86_400_000);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  nextDue.setHours(0, 0, 0, 0);
  return Math.round((nextDue - today) / 86_400_000);
}

function ddayBadge(dday) {
  if (dday === null) return `<span class="care-dday care-dday--unknown">미기록</span>`;
  if (dday < 0)   return `<span class="care-dday care-dday--overdue">D+${Math.abs(dday)} 지남</span>`;
  if (dday === 0) return `<span class="care-dday care-dday--today">D-Day</span>`;
  if (dday <= 3)  return `<span class="care-dday care-dday--urgent">D-${dday}</span>`;
  if (dday <= 7)  return `<span class="care-dday care-dday--soon">D-${dday}</span>`;
  return `<span class="care-dday care-dday--ok">D-${dday}</span>`;
}

function speciesKey(species) { return species === "고양이" ? "cat" : "dog"; }
function speciesEmoji(species) {
  return species === "고양이" ? "🐱" : species === "강아지" ? "🐶" : "🐾";
}

// ─── 렌더링 진입점 ────────────────────────────────────────────
async function renderActiveArea() {
  const mainArea = document.getElementById("care-main-area");
  if (!mainArea || !_pets.length) return;
  const pet = _pets[_activePetIdx];
  mainArea.innerHTML = `<p class="care-loading">불러오는 중...</p>`;
  if (_activeSubtab === "care") {
    await loadCareForPet(pet, _db, mainArea);
  } else {
    await loadDietSection(pet, _db, mainArea);
  }
}

// ─── 케어 섹션 ────────────────────────────────────────────────
async function loadCareForPet(pet, db, container) {
  const defaults = CARE_DEFAULTS[speciesKey(pet.species)] ?? CARE_DEFAULTS.dog;
  let lastDoneMap = {};
  try {
    const { data: logs } = await db
      .from("pet_care_logs").select("care_key, done_at")
      .eq("pet_id", pet.id).order("done_at", { ascending: false });
    (logs ?? []).forEach((l) => { if (!lastDoneMap[l.care_key]) lastDoneMap[l.care_key] = l.done_at; });
  } catch { /* table may not exist */ }

  const careItems = Object.entries(defaults).map(([key, item]) => {
    const lastDoneAt = lastDoneMap[key] ?? null;
    return { key, item, lastDoneAt, dday: calcDday(lastDoneAt, item.default_days) };
  }).sort((a, b) => {
    if (a.dday === null && b.dday === null) return 0;
    if (a.dday === null) return 1;
    if (b.dday === null) return -1;
    return a.dday - b.dday;
  });

  const urgent = careItems.filter(({ dday }) => dday !== null && dday <= 3);
  const rest   = careItems.filter(({ dday }) => dday === null || dday > 3);

  let html = `<div class="care-pet-summary">
    <span class="care-pet-avatar">${pet.photo_url ? `<img src="${escapeHtml(pet.photo_url)}" alt="${escapeHtml(pet.name)}"/>` : speciesEmoji(pet.species)}</span>
    <div>
      <strong class="care-pet-name">${escapeHtml(pet.name)}</strong>
      <span class="care-pet-species">${escapeHtml(pet.species ?? "")}${pet.breed ? ` · ${escapeHtml(pet.breed)}` : ""}</span>
    </div>
  </div>`;

  if (urgent.length) {
    html += `<div class="care-section-header care-section-header--urgent"><span>🚨 지금 챙겨주세요</span><span class="care-urgent-count">${urgent.length}건</span></div>`;
    urgent.forEach(({ key, item, lastDoneAt, dday }) => { html += renderCareItem(key, item, lastDoneAt, dday); });
  }
  if (rest.length) {
    html += `<div class="care-section-header">📅 케어 스케줄</div>`;
    rest.forEach(({ key, item, lastDoneAt, dday }) => { html += renderCareItem(key, item, lastDoneAt, dday); });
  }

  html += `<div class="ai-advice-block" id="ai-advice-block">
    <button class="ai-advice-btn" id="ai-advice-btn">🤖 AI 조언 받기</button>
    <div class="ai-advice-result" id="ai-advice-result" hidden></div>
  </div>`;

  container.innerHTML = html;
  container.querySelectorAll(".care-done-btn").forEach((btn) => {
    btn.addEventListener("click", () => markCareDone(pet, btn.dataset.key, btn.dataset.label, db, container));
  });

  // AI 버튼 — 케어 데이터 전달
  container.querySelector("#ai-advice-btn")?.addEventListener("click", () => {
    const items = careItems.map(({ item, dday }) => ({ label: item.label, dday }));
    fetchAiAdvice(pet, items, null, null);
  });
}

function renderCareItem(key, item, lastDoneAt, dday) {
  const isOverdue = dday !== null && dday < 0;
  const isToday   = dday === 0;
  return `<div class="care-item-card ${isOverdue ? "care-item--overdue" : isToday ? "care-item--today" : ""}">
    <span class="care-item-icon">${item.icon}</span>
    <div class="care-item-body">
      <div class="care-item-name">${escapeHtml(item.label)}</div>
      <div class="care-item-meta">${lastDoneAt ? `마지막: ${formatDateShort(lastDoneAt)}` : "기록 없음"}&nbsp;·&nbsp;${item.default_days >= 365 ? `${Math.round(item.default_days / 365)}년` : `${item.default_days}일`} 주기</div>
    </div>
    <div class="care-item-right">
      ${ddayBadge(dday)}
      <button class="care-done-btn" data-key="${escapeHtml(key)}" data-label="${escapeHtml(item.label)}">완료</button>
    </div>
  </div>`;
}

async function fetchAiAdvice(pet, careItems, dietToday, dietSettings) {
  const btn    = document.getElementById("ai-advice-btn");
  const result = document.getElementById("ai-advice-result");
  if (!btn || !result) return;

  btn.disabled = true;
  btn.textContent = "분석 중...";
  result.hidden = true;

  try {
    const res = await fetch("/api/ai-care", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pet, careItems, dietToday, dietSettings }),
    });
    const data = await res.json();
    if (data.text) {
      result.textContent = data.text;
      result.hidden = false;
    } else {
      result.textContent = "조언을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
      result.hidden = false;
    }
  } catch {
    result.textContent = "네트워크 오류가 발생했어요.";
    result.hidden = false;
  }

  btn.disabled = false;
  btn.textContent = btn.id === "ai-advice-btn" && _activeSubtab === "diet" ? "🤖 AI 식단 조언 받기" : "🤖 AI 조언 받기";
}

async function markCareDone(pet, careKey, label, db, container) {
  const userId = window.PetAuth?.currentUser?.id;
  if (!userId) { alert("로그인이 필요합니다."); return; }
  const btn = container.querySelector(`.care-done-btn[data-key="${careKey}"]`);
  if (btn) { btn.disabled = true; btn.textContent = "저장 중..."; }
  const { error } = await db.from("pet_care_logs").insert({
    user_id: userId, pet_id: pet.id, care_key: careKey, done_at: new Date().toISOString(),
  });
  if (error) {
    alert(error.code === "42P01" ? "supabase-care.sql을 먼저 실행해 주세요." : `저장 실패: ${error.message}`);
    if (btn) { btn.disabled = false; btn.textContent = "완료"; }
    return;
  }
  await loadCareForPet(pet, db, container);
}

// ─── 식단 섹션 ────────────────────────────────────────────────
async function loadDietSection(pet, db, container) {
  const userId = window.PetAuth?.currentUser?.id;
  let settings = null;
  let logs = [];

  try {
    const [settingsRes, logsRes] = await Promise.all([
      db.from("pet_diet_settings").select("*").eq("pet_id", pet.id).maybeSingle(),
      db.from("pet_diet_logs").select("*").eq("pet_id", pet.id).gte("logged_at", getTodayKST()).order("logged_at"),
    ]);
    settings = settingsRes.data;
    logs = logsRes.data ?? [];
  } catch { /* tables may not exist yet */ }

  renderDietSection(container, pet, settings, logs, db);
}

function renderDietSection(container, pet, settings, logs, db) {
  const mealsPerDay  = settings?.meals_per_day  ?? 2;
  const waterTarget  = settings?.water_target_ml ?? 300;
  const foodAmountG  = settings?.food_amount_g   ?? null;
  const foodName     = settings?.food_name       ?? "";

  const mealsLogged  = new Set(logs.filter(l => l.log_type === "meal").map(l => l.meal_order));
  const waterTotal   = logs.filter(l => l.log_type === "water").reduce((s, l) => s + (l.water_ml || 0), 0);
  const snacks       = logs.filter(l => l.log_type === "snack");
  const waterPct     = Math.min(100, waterTarget > 0 ? Math.round(waterTotal / waterTarget * 100) : 0);

  const mealLabels = ["아침", "점심", "저녁"];

  const mealsHtml = Array.from({ length: mealsPerDay }, (_, i) => {
    const n = i + 1;
    const done = mealsLogged.has(n);
    const label = mealLabels[i] ?? `${n}번째`;
    return `<button class="diet-meal-btn${done ? " is-done" : ""}" data-meal="${n}"${done ? " disabled" : ""}>
      <span class="diet-meal-label">${label}</span>
      <span class="diet-meal-state">${done ? "✓" : "기록"}</span>
      ${foodAmountG ? `<span class="diet-meal-amount">${foodAmountG}g</span>` : ""}
    </button>`;
  }).join("");

  const snackListHtml = snacks.length
    ? `<div class="diet-snack-list">${snacks.map(s => `<span class="diet-snack-chip">${escapeHtml(s.note || "간식")}</span>`).join("")}</div>`
    : "";

  container.innerHTML = `
    <div class="diet-pet-summary">
      <span>${pet.photo_url ? `<img class="diet-pet-avatar" src="${escapeHtml(pet.photo_url)}" alt="${escapeHtml(pet.name)}"/>` : speciesEmoji(pet.species)}</span>
      <div>
        <strong class="care-pet-name">${escapeHtml(pet.name)}</strong>
        <span class="care-pet-species">${escapeHtml(pet.species ?? "")}</span>
      </div>
    </div>

    <div class="diet-block">
      <div class="diet-block-title">🍚 오늘 식사 <span class="diet-meals-done">${mealsLogged.size}/${mealsPerDay}끼</span></div>
      <div class="diet-meals-grid">${mealsHtml}</div>
    </div>

    <div class="diet-block">
      <div class="diet-block-title">💧 물 섭취 <span class="diet-water-stat">${waterTotal}ml / ${waterTarget}ml</span></div>
      <div class="diet-water-bar-wrap"><div class="diet-water-bar" style="width:${waterPct}%"></div></div>
      <div class="diet-water-btns">
        <button class="diet-water-btn" data-ml="50">+50ml</button>
        <button class="diet-water-btn" data-ml="100">+100ml</button>
        <button class="diet-water-btn" data-ml="200">+200ml</button>
      </div>
    </div>

    <div class="diet-block">
      <div class="diet-block-title">🍪 간식 ${snacks.length ? `<span class="diet-snack-count">${snacks.length}회</span>` : ""}</div>
      <div class="diet-snack-input-row">
        <input type="text" class="diet-snack-input" id="diet-snack-input" placeholder="간식 이름 (선택)" maxlength="20"/>
        <button class="diet-snack-btn" id="diet-snack-btn">기록</button>
      </div>
      ${snackListHtml}
    </div>

    <div class="ai-advice-block" id="ai-advice-block">
      <button class="ai-advice-btn" id="ai-advice-btn">🤖 AI 식단 조언 받기</button>
      <div class="ai-advice-result" id="ai-advice-result" hidden></div>
    </div>

    <details class="diet-settings-details">
      <summary class="diet-settings-toggle">⚙️ 식단 설정</summary>
      <div class="diet-settings-body">
        <div class="diet-settings-row">
          <label>하루 식사 횟수</label>
          <div class="diet-meals-picker">
            ${[1, 2, 3].map(n => `<button class="diet-pick-btn${mealsPerDay === n ? " is-active" : ""}" data-n="${n}">${n}식</button>`).join("")}
          </div>
        </div>
        <div class="diet-settings-row">
          <label>사료 이름</label>
          <input type="text" class="diet-input" id="ds-food-name" value="${escapeHtml(foodName)}" placeholder="예: 로얄캐닌 어덜트"/>
        </div>
        <div class="diet-settings-row">
          <label>1회 급여량</label>
          <div class="diet-input-unit"><input type="number" class="diet-input" id="ds-amount" value="${foodAmountG ?? ""}" placeholder="80" min="0" step="5"/><span>g</span></div>
        </div>
        <div class="diet-settings-row">
          <label>하루 목표 급수량</label>
          <div class="diet-input-unit"><input type="number" class="diet-input" id="ds-water" value="${waterTarget}" placeholder="300" min="0" step="50"/><span>ml</span></div>
        </div>
        <button class="diet-save-btn" id="diet-save-btn">저장</button>
      </div>
    </details>`;

  // 이벤트 바인딩
  container.querySelectorAll(".diet-meal-btn:not([disabled])").forEach(btn => {
    btn.addEventListener("click", () => logMeal(pet, parseInt(btn.dataset.meal), db));
  });
  container.querySelectorAll(".diet-water-btn").forEach(btn => {
    btn.addEventListener("click", () => logWater(pet, parseInt(btn.dataset.ml), db));
  });
  container.querySelector("#diet-snack-btn")?.addEventListener("click", () => {
    const note = container.querySelector("#diet-snack-input")?.value.trim();
    logSnack(pet, note, db);
  });
  container.querySelectorAll(".diet-pick-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".diet-pick-btn").forEach(b => b.classList.toggle("is-active", b === btn));
    });
  });
  container.querySelector("#diet-save-btn")?.addEventListener("click", () => saveDietSettings(pet, db, container));

  // AI 버튼 — 식단 데이터 전달
  container.querySelector("#ai-advice-btn")?.addEventListener("click", () => {
    fetchAiAdvice(pet, null, logs, settings);
  });
}

async function logMeal(pet, mealOrder, db) {
  const userId = window.PetAuth?.currentUser?.id;
  if (!userId) return;
  await db.from("pet_diet_logs").insert({ user_id: userId, pet_id: pet.id, log_type: "meal", meal_order: mealOrder, logged_at: new Date().toISOString() });
  await renderActiveArea();
}

async function logWater(pet, ml, db) {
  const userId = window.PetAuth?.currentUser?.id;
  if (!userId) return;
  await db.from("pet_diet_logs").insert({ user_id: userId, pet_id: pet.id, log_type: "water", water_ml: ml, logged_at: new Date().toISOString() });
  await renderActiveArea();
}

async function logSnack(pet, note, db) {
  const userId = window.PetAuth?.currentUser?.id;
  if (!userId) return;
  await db.from("pet_diet_logs").insert({ user_id: userId, pet_id: pet.id, log_type: "snack", note: note || "간식", logged_at: new Date().toISOString() });
  await renderActiveArea();
}

async function saveDietSettings(pet, db, container) {
  const userId = window.PetAuth?.currentUser?.id;
  if (!userId) return;
  const btn = container.querySelector("#diet-save-btn");
  if (btn) { btn.disabled = true; btn.textContent = "저장 중..."; }

  const mealsPerDay   = parseInt(container.querySelector(".diet-pick-btn.is-active")?.dataset.n ?? "2");
  const foodName      = container.querySelector("#ds-food-name")?.value.trim() || null;
  const foodAmountG   = parseFloat(container.querySelector("#ds-amount")?.value)  || null;
  const waterTargetMl = parseFloat(container.querySelector("#ds-water")?.value)   || 300;

  const { error } = await db.from("pet_diet_settings").upsert(
    { user_id: userId, pet_id: pet.id, meals_per_day: mealsPerDay, food_name: foodName, food_amount_g: foodAmountG, water_target_ml: waterTargetMl, updated_at: new Date().toISOString() },
    { onConflict: "pet_id" }
  );

  if (error) {
    alert(error.code === "42P01" ? "supabase-diet.sql을 먼저 실행해 주세요." : `저장 실패: ${error.message}`);
    if (btn) { btn.disabled = false; btn.textContent = "저장"; }
    return;
  }
  await renderActiveArea();
}

// ─── 기록 히스토리 모달 ──────────────────────────────────────
async function showCareHistory(pet, db) {
  const { data: logs } = await db
    .from("pet_care_logs").select("care_key, done_at")
    .eq("pet_id", pet.id).order("done_at", { ascending: false }).limit(50);
  const allDefaults = { ...CARE_DEFAULTS.dog, ...CARE_DEFAULTS.cat };
  const rows = (logs ?? []).map(log => {
    const item = allDefaults[log.care_key];
    return `<div class="care-history-row"><span>${item?.icon ?? "📋"} ${escapeHtml(item?.label ?? log.care_key)}</span><span class="care-history-date">${formatDateShort(log.done_at)}</span></div>`;
  }).join("") || `<p style="padding:16px;color:#aaa;font-size:13px;">아직 기록이 없어요.</p>`;

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<div class="modal" style="max-height:80vh;overflow-y:auto;">
    <button class="modal-close" style="font-size:20px;background:none;border:none;float:right;cursor:pointer;padding:4px 8px;">✕</button>
    <h2 class="modal-title" style="font-size:16px;margin-bottom:16px;">📋 ${escapeHtml(pet.name)}의 케어 기록</h2>
    ${rows}
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector(".modal-close").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
}

// ─── 초기화 ──────────────────────────────────────────────────
async function init() {
  _db = window.supabaseClient;
  const content = document.getElementById("care-content");

  await window.PetAuth?.init((event) => {
    if (event === "SIGNED_OUT") window.location.href = "index.html";
  });

  const user = window.PetAuth?.currentUser ?? null;

  if (!user) {
    content.innerHTML = `<div class="care-empty-state">
      <div class="care-empty-icon">🔒</div>
      <p class="care-empty-title">로그인이 필요해요</p>
      <p class="care-empty-desc">로그인 후 반려동물 케어와 식단을 관리할 수 있어요.</p>
      <button class="care-login-btn" onclick="location.href='index.html'">로그인하러 가기</button>
    </div>`;
    return;
  }

  const { data: pets } = await _db.from("pets").select("id, name, species, breed, photo_url").eq("user_id", user.id).order("created_at");
  _pets = pets ?? [];

  if (!_pets.length) {
    content.innerHTML = `<div class="care-empty-state">
      <div class="care-empty-icon">🐾</div>
      <p class="care-empty-title">반려동물을 등록해주세요</p>
      <p class="care-empty-desc">마이페이지에서 등록하면 케어 스케줄과 식단이 자동 설정돼요.</p>
      <a class="care-login-btn" href="mypage.html?tab=pets">반려동물 등록하기 →</a>
    </div>`;
    return;
  }

  // 펫 탭 + 메인 영역 생성
  const tabsHtml = `<div class="care-pet-tabs" id="care-pet-tabs">${_pets.map((pet, i) => `
    <button class="care-pet-tab${i === 0 ? " is-active" : ""}" data-pet-idx="${i}">
      ${pet.photo_url ? `<img class="care-pet-tab-img" src="${escapeHtml(pet.photo_url)}" alt="${escapeHtml(pet.name)}"/>` : speciesEmoji(pet.species)}
      <span>${escapeHtml(pet.name)}</span>
    </button>`).join("")}</div>
  <div id="care-main-area"></div>`;

  content.innerHTML = tabsHtml;
  await renderActiveArea();
  document.getElementById("care-history-btn")?.removeAttribute("hidden");

  // 펫 탭 전환
  document.getElementById("care-pet-tabs")?.addEventListener("click", async e => {
    const btn = e.target.closest(".care-pet-tab");
    if (!btn) return;
    _activePetIdx = parseInt(btn.dataset.petIdx, 10);
    document.querySelectorAll(".care-pet-tab").forEach(t => t.classList.toggle("is-active", t === btn));
    await renderActiveArea();
  });

  // 서브탭 전환
  document.querySelectorAll(".care-subtab").forEach(btn => {
    btn.addEventListener("click", async () => {
      _activeSubtab = btn.dataset.subtab;
      document.querySelectorAll(".care-subtab").forEach(b => b.classList.toggle("is-active", b === btn));
      await renderActiveArea();
    });
  });

  // 기록 히스토리
  document.getElementById("care-history-btn")?.addEventListener("click", () => {
    showCareHistory(_pets[_activePetIdx], _db);
  });
}

document.addEventListener("DOMContentLoaded", init);
