"use strict";

// ─── 케어 항목 정의 (9종) ────────────────────────────────────────
const CARE_ITEMS = {
  dog: [
    { key: "bath",       label: "목욕",     icon: "🛁", default_days: 14  },
    { key: "heartworm",  label: "심장사상충", icon: "💊", default_days: 30  },
    { key: "vaccine",    label: "예방접종",  icon: "💉", default_days: 365 },
    { key: "grooming",   label: "미용",     icon: "✂️", default_days: 42  },
    { key: "teeth",      label: "양치",     icon: "🦷", default_days: 1   },
    { key: "ear",        label: "귀청소",   icon: "👂", default_days: 30  },
    { key: "nail",       label: "발톱",     icon: "💅", default_days: 21  },
    { key: "deworming",  label: "구충제",   icon: "🧪", default_days: 90  },
    { key: "checkup",    label: "건강검진",  icon: "🏥", default_days: 365 },
  ],
  cat: [
    { key: "bath",       label: "목욕",     icon: "🛁", default_days: 30  },
    { key: "heartworm",  label: "심장사상충", icon: "💊", default_days: 30  },
    { key: "vaccine",    label: "예방접종",  icon: "💉", default_days: 365 },
    { key: "grooming",   label: "미용",     icon: "✂️", default_days: 60  },
    { key: "teeth",      label: "양치",     icon: "🦷", default_days: 1   },
    { key: "ear",        label: "귀청소",   icon: "👂", default_days: 30  },
    { key: "nail",       label: "발톱",     icon: "💅", default_days: 14  },
    { key: "deworming",  label: "구충제",   icon: "🧪", default_days: 90  },
    { key: "checkup",    label: "건강검진",  icon: "🏥", default_days: 365 },
  ],
};

const INTERVAL_PRESETS = [
  { days: 1, label: "매일" }, { days: 3, label: "3일" }, { days: 7, label: "1주" },
  { days: 14, label: "2주" }, { days: 30, label: "1달" }, { days: 90, label: "3달" },
  { days: 180, label: "6달" }, { days: 365, label: "1년" }, { days: 1095, label: "3년" },
];

const EXPENSE_CATEGORIES = {
  "강아지": ["진료비", "미용", "사료", "간식", "배변패드", "장난감", "산책용품", "의류·액세서리", "기타"],
  "고양이": ["진료비", "미용", "사료", "간식", "모래·화장실", "장난감", "스크래쳐", "기타"],
  default:  ["진료비", "미용", "사료", "간식", "장난감", "기타"],
};

// ─── 상태 ────────────────────────────────────────────────────
let _pets = [];
let _db = null;
let _activePetIdx = 0;
let _activeSubtab = "manage";
let _sheetItem = null; // 현재 열린 시트의 케어 항목

// ─── 유틸 ────────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function formatDate(isoStr) {
  if (!isoStr) return "기록 없음";
  const d = new Date(isoStr);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function getTodayKST() {
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function isTodayKST(isoStr) {
  if (!isoStr) return false;
  const item = new Date(new Date(isoStr).getTime() + 9 * 3_600_000);
  const now  = new Date(Date.now() + 9 * 3_600_000);
  return item.getUTCFullYear() === now.getUTCFullYear() &&
         item.getUTCMonth()    === now.getUTCMonth() &&
         item.getUTCDate()     === now.getUTCDate();
}

function calcDday(lastDoneAt, intervalDays) {
  if (!lastDoneAt || !intervalDays) return null;
  const nextDue = new Date(new Date(lastDoneAt).getTime() + intervalDays * 86_400_000);
  const today = new Date(); today.setHours(0,0,0,0);
  nextDue.setHours(0,0,0,0);
  return Math.round((nextDue - today) / 86_400_000);
}

function intervalLabel(days) {
  const found = INTERVAL_PRESETS.find(p => p.days === days);
  if (found) return found.label;
  if (days >= 365) return `${Math.round(days/365)}년`;
  return `${days}일`;
}

function speciesKey(species) { return species === "고양이" ? "cat" : "dog"; }
function speciesEmoji(species) {
  return species === "고양이" ? "🐱" : species === "강아지" ? "🐶" : "🐾";
}

// localStorage 헬퍼
function getCustomIntervals(petId) {
  try { return JSON.parse(localStorage.getItem(`care_iv_${petId}`) || "{}"); }
  catch { return {}; }
}
function saveCustomInterval(petId, careKey, days) {
  const iv = getCustomIntervals(petId);
  iv[careKey] = days;
  localStorage.setItem(`care_iv_${petId}`, JSON.stringify(iv));
}
function getIntervalDays(petId, careKey, defaultDays) {
  return getCustomIntervals(petId)[careKey] ?? defaultDays;
}
function getNotifyPrefs(petId) {
  try { return JSON.parse(localStorage.getItem(`care_notify_${petId}`) || "{}"); }
  catch { return {}; }
}
function saveNotifyPref(petId, careKey, val) {
  const prefs = getNotifyPrefs(petId);
  prefs[careKey] = val;
  localStorage.setItem(`care_notify_${petId}`, JSON.stringify(prefs));
}

// ─── 렌더링 진입점 ────────────────────────────────────────────
async function renderActiveArea() {
  const mainArea = document.getElementById("care-main-area");
  if (!mainArea || !_pets.length) return;
  const pet = _pets[_activePetIdx];
  mainArea.innerHTML = `<p class="care-loading">불러오는 중...</p>`;
  if      (_activeSubtab === "manage")  await renderManageTab(pet, mainArea);
  else if (_activeSubtab === "diet")    await renderDietTab(pet, mainArea);
  else if (_activeSubtab === "records") await renderRecordsTab(pet, mainArea);
  else if (_activeSubtab === "expense") await renderExpenseTab(pet, mainArea);
}

// ──────────────────────────────────────────────────────────────
// [관리] 탭
// ──────────────────────────────────────────────────────────────
async function renderManageTab(pet, container) {
  const items = CARE_ITEMS[speciesKey(pet.species)] ?? CARE_ITEMS.dog;
  let lastDoneMap = {};
  try {
    const { data: logs } = await _db.from("pet_care_logs").select("care_key, done_at")
      .eq("pet_id", pet.id).order("done_at", { ascending: false });
    (logs ?? []).forEach(l => { if (!lastDoneMap[l.care_key]) lastDoneMap[l.care_key] = l.done_at; });
  } catch { /* table may not exist */ }

  const cards = items.map(item => {
    const lastDoneAt   = lastDoneMap[item.key] ?? null;
    const intervalDays = getIntervalDays(pet.id, item.key, item.default_days);
    const doneToday    = isTodayKST(lastDoneAt);
    const dday         = doneToday ? null : calcDday(lastDoneAt, intervalDays);
    return { item, lastDoneAt, intervalDays, doneToday, dday };
  });

  const doneCount  = cards.filter(c => c.doneToday).length;
  const totalCount = cards.length;
  const pct = Math.round(doneCount / totalCount * 100);

  let html = `
  <div class="manage-progress">
    <div class="manage-progress-text">${doneCount === totalCount ? "🎉 오늘 케어 완료!" : `오늘 ${doneCount} / ${totalCount} 완료`}</div>
    <div class="manage-progress-track"><div class="manage-progress-fill" style="width:${pct}%"></div></div>
  </div>
  <div class="manage-grid">`;

  cards.forEach(({ item, lastDoneAt, intervalDays, doneToday, dday }) => {
    let stateClass = "manage-card--unset";
    let badgeText  = "첫 기록 없음";
    if (doneToday) {
      stateClass = "manage-card--done";
      badgeText  = "✓ 오늘 완료";
    } else if (lastDoneAt === null) {
      stateClass = "manage-card--unset";
      badgeText  = "기록 없음";
    } else if (dday !== null && dday < 0) {
      stateClass = "manage-card--overdue";
      badgeText  = `${Math.abs(dday)}일 지남 ⚠️`;
    } else if (dday === 0) {
      stateClass = "manage-card--today";
      badgeText  = "오늘!";
    } else if (dday !== null && dday <= 7) {
      stateClass = "manage-card--soon";
      badgeText  = `D-${dday}`;
    } else {
      stateClass = "manage-card--ok";
      badgeText  = dday !== null ? `D-${dday}` : "설정됨";
    }

    html += `
    <button class="manage-card ${stateClass}" data-key="${escapeHtml(item.key)}">
      <div class="manage-card-icon">${item.icon}</div>
      <div class="manage-card-name">${escapeHtml(item.label)}</div>
      <div class="manage-card-badge">${badgeText}</div>
    </button>`;
  });

  html += `</div>
  <div class="ai-advice-block" id="ai-advice-block">
    <button class="ai-advice-btn" id="ai-advice-btn">🤖 AI 케어 조언</button>
    <div class="ai-advice-result" id="ai-advice-result" hidden></div>
  </div>`;

  container.innerHTML = html;

  // 카드 클릭 → 시트 열기
  container.querySelectorAll(".manage-card").forEach(card => {
    card.addEventListener("click", () => {
      const key  = card.dataset.key;
      const item = items.find(i => i.key === key);
      const last = lastDoneMap[key] ?? null;
      const iv   = getIntervalDays(pet.id, key, item.default_days);
      openManageSheet(pet, item, last, iv);
    });
  });

  // AI 버튼
  container.querySelector("#ai-advice-btn")?.addEventListener("click", () => {
    const careItems = cards.map(({ item, dday, doneToday }) => ({
      label: item.label,
      dday: doneToday ? 0 : dday,
    }));
    fetchAiAdvice(pet, careItems, null, null);
  });
}

// ─── 케어 시트 ──────────────────────────────────────────────
function openManageSheet(pet, item, lastDoneAt, intervalDays) {
  _sheetItem = { pet, item, lastDoneAt, intervalDays };

  document.getElementById("care-sheet-icon").textContent  = item.icon;
  document.getElementById("care-sheet-title").textContent = item.label;
  document.getElementById("care-sheet-last-date").textContent =
    lastDoneAt ? formatDate(lastDoneAt) : "기록 없음";

  // 주기 프리셋
  const presetsEl = document.getElementById("care-iv-presets");
  presetsEl.innerHTML = INTERVAL_PRESETS.map(p =>
    `<button class="care-iv-opt${p.days === intervalDays ? " is-active" : ""}" data-days="${p.days}">${p.label}</button>`
  ).join("");
  presetsEl.querySelectorAll(".care-iv-opt").forEach(btn => {
    btn.addEventListener("click", () => {
      const days = parseInt(btn.dataset.days);
      saveCustomInterval(pet.id, item.key, days);
      presetsEl.querySelectorAll(".care-iv-opt").forEach(b => b.classList.toggle("is-active", b === btn));
      _sheetItem.intervalDays = days;
    });
  });

  // 알림 토글
  const notifyPrefs = getNotifyPrefs(pet.id);
  const notifyEl = document.getElementById("care-sheet-notify");
  notifyEl.checked = notifyPrefs[item.key] ?? false;
  notifyEl.onchange = () => {
    if (notifyEl.checked && Notification.permission !== "granted") {
      Notification.requestPermission().then(p => {
        if (p !== "granted") notifyEl.checked = false;
      });
    }
    saveNotifyPref(pet.id, item.key, notifyEl.checked);
  };

  // 날짜 기본값 = 오늘
  document.getElementById("care-done-date").value = todayIso();

  document.getElementById("care-sheet-overlay").classList.add("is-open");
  document.body.style.overflow = "hidden";
}

function closeManageSheet() {
  document.getElementById("care-sheet-overlay").classList.remove("is-open");
  document.body.style.overflow = "";
  _sheetItem = null;
}

async function submitManageDone() {
  if (!_sheetItem) return;
  const { pet, item } = _sheetItem;
  const userId = window.PetAuth?.currentUser?.id;
  if (!userId) { alert("로그인이 필요합니다."); return; }

  const dateVal = document.getElementById("care-done-date").value;
  if (!dateVal) { alert("날짜를 선택해주세요."); return; }

  const doneBtn = document.getElementById("care-sheet-done-btn");
  doneBtn.disabled = true;
  doneBtn.textContent = "저장 중...";

  const { error } = await _db.from("pet_care_logs").insert({
    user_id: userId,
    pet_id: pet.id,
    care_key: item.key,
    done_at: new Date(dateVal + "T12:00:00").toISOString(),
  });

  if (error) {
    alert(error.code === "42P01" ? "supabase-care.sql을 먼저 실행해 주세요." : `저장 실패: ${error.message}`);
    doneBtn.disabled = false;
    doneBtn.textContent = "✓ 완료 기록";
    return;
  }

  closeManageSheet();
  await renderActiveArea();
}

async function showItemHistory(pet, item) {
  let html = `<div class="care-hist-header"><span>${item.icon} ${escapeHtml(item.label)} 기록</span></div><div class="care-hist-list">`;
  try {
    const { data: logs } = await _db.from("pet_care_logs").select("done_at")
      .eq("pet_id", pet.id).eq("care_key", item.key)
      .order("done_at", { ascending: false }).limit(30);
    if ((logs ?? []).length) {
      html += (logs ?? []).map(l => `<div class="care-hist-row">${formatDate(l.done_at)}</div>`).join("");
    } else {
      html += `<p class="care-hist-empty">아직 기록이 없어요.</p>`;
    }
  } catch {
    html += `<p class="care-hist-empty">기록을 불러올 수 없어요.</p>`;
  }
  html += `</div>`;

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<div class="modal" style="max-height:70vh;overflow-y:auto;">
    <button class="modal-close" style="font-size:20px;background:none;border:none;float:right;cursor:pointer;padding:4px 8px;">✕</button>
    ${html}
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector(".modal-close").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
}

// ──────────────────────────────────────────────────────────────
// [식단] 탭
// ──────────────────────────────────────────────────────────────
async function renderDietTab(pet, container) {
  let settings = null, logs = [];
  try {
    const [sr, lr] = await Promise.all([
      _db.from("pet_diet_settings").select("*").eq("pet_id", pet.id).maybeSingle(),
      _db.from("pet_diet_logs").select("*").eq("pet_id", pet.id).gte("logged_at", getTodayKST()).order("logged_at"),
    ]);
    settings = sr.data;
    logs = lr.data ?? [];
  } catch { /* tables may not exist */ }
  renderDietSection(container, pet, settings, logs);
}

function renderDietSection(container, pet, settings, logs) {
  const mealsPerDay = settings?.meals_per_day ?? 2;
  const waterTarget = settings?.water_target_ml ?? 300;
  const foodAmountG = settings?.food_amount_g ?? null;
  const foodName    = settings?.food_name ?? "";

  const mealsLogged = new Set(logs.filter(l => l.log_type === "meal").map(l => l.meal_order));
  const waterTotal  = logs.filter(l => l.log_type === "water").reduce((s, l) => s + (l.water_ml || 0), 0);
  const snacks      = logs.filter(l => l.log_type === "snack");
  const waterPct    = Math.min(100, waterTarget > 0 ? Math.round(waterTotal / waterTarget * 100) : 0);

  const mealLabels = ["아침", "점심", "저녁"];
  const mealsHtml = Array.from({ length: mealsPerDay }, (_, i) => {
    const n = i + 1, done = mealsLogged.has(n), label = mealLabels[i] ?? `${n}번째`;
    return `<button class="diet-meal-btn${done ? " is-done" : ""}" data-meal="${n}"${done ? " disabled" : ""}>
      <span class="diet-meal-icon">${done ? "✅" : "🍚"}</span>
      <span class="diet-meal-label">${label}</span>
      ${foodAmountG ? `<span class="diet-meal-amount">${foodAmountG}g</span>` : ""}
    </button>`;
  }).join("");

  const waterLevelClass = waterPct >= 80 ? "good" : waterPct >= 40 ? "mid" : "low";

  container.innerHTML = `
    <div class="diet-block">
      <div class="diet-block-header">
        <span class="diet-block-title">🍚 오늘 식사</span>
        <span class="diet-block-sub">${mealsLogged.size}/${mealsPerDay}끼 ${foodName ? `· ${escapeHtml(foodName)}` : ""}</span>
      </div>
      <div class="diet-meals-grid">${mealsHtml}</div>
    </div>

    <div class="diet-block">
      <div class="diet-block-header">
        <span class="diet-block-title">💧 수분 섭취</span>
        <span class="diet-block-sub diet-water-stat">${waterTotal}ml / ${waterTarget}ml</span>
      </div>
      <div class="diet-water-bar-wrap">
        <div class="diet-water-bar diet-water-bar--${waterLevelClass}" style="width:${waterPct}%"></div>
      </div>
      <div class="diet-water-btns">
        <button class="diet-water-btn" data-ml="50">+50ml</button>
        <button class="diet-water-btn" data-ml="100">+100ml</button>
        <button class="diet-water-btn" data-ml="200">+200ml</button>
        <button class="diet-water-btn" data-ml="250">+250ml</button>
      </div>
    </div>

    <div class="diet-block">
      <div class="diet-block-header">
        <span class="diet-block-title">🍪 간식</span>
        ${snacks.length ? `<span class="diet-block-sub">${snacks.length}회</span>` : ""}
      </div>
      <div class="diet-snack-input-row">
        <input type="text" class="diet-snack-input" id="diet-snack-input" placeholder="간식 이름 (선택)" maxlength="20"/>
        <button class="diet-snack-btn" id="diet-snack-btn">기록</button>
      </div>
      ${snacks.length ? `<div class="diet-snack-list">${snacks.map(s => `<span class="diet-snack-chip">${escapeHtml(s.note || "간식")}</span>`).join("")}</div>` : ""}
    </div>

    <div class="ai-advice-block" id="ai-advice-block">
      <button class="ai-advice-btn" id="ai-advice-btn">🤖 AI 식단 조언</button>
      <div class="ai-advice-result" id="ai-advice-result" hidden></div>
    </div>

    <details class="diet-settings-details">
      <summary class="diet-settings-toggle">⚙️ 식단 설정</summary>
      <div class="diet-settings-body">
        <div class="diet-settings-row">
          <label>하루 식사 횟수</label>
          <div class="diet-meals-picker">
            ${[1,2,3].map(n => `<button class="diet-pick-btn${mealsPerDay===n?" is-active":""}" data-n="${n}">${n}식</button>`).join("")}
          </div>
        </div>
        <div class="diet-settings-row">
          <label>사료 이름</label>
          <input type="text" class="diet-input" id="ds-food-name" value="${escapeHtml(foodName)}" placeholder="예: 로얄캐닌 어덜트"/>
        </div>
        <div class="diet-settings-row">
          <label>1회 급여량</label>
          <div class="diet-input-unit"><input type="number" class="diet-input" id="ds-amount" value="${foodAmountG??""}" placeholder="80" min="0" step="5"/><span>g</span></div>
        </div>
        <div class="diet-settings-row">
          <label>하루 목표 급수량</label>
          <div class="diet-input-unit"><input type="number" class="diet-input" id="ds-water" value="${waterTarget}" placeholder="300" min="0" step="50"/><span>ml</span></div>
        </div>
        <button class="diet-save-btn" id="diet-save-btn">저장</button>
      </div>
    </details>`;

  container.querySelectorAll(".diet-meal-btn:not([disabled])").forEach(btn => {
    btn.addEventListener("click", () => logDiet("meal", pet, parseInt(btn.dataset.meal)));
  });
  container.querySelectorAll(".diet-water-btn").forEach(btn => {
    btn.addEventListener("click", () => logDiet("water", pet, null, parseInt(btn.dataset.ml)));
  });
  container.querySelector("#diet-snack-btn")?.addEventListener("click", () => {
    const note = container.querySelector("#diet-snack-input")?.value.trim();
    logDiet("snack", pet, null, null, note);
  });
  container.querySelectorAll(".diet-pick-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".diet-pick-btn").forEach(b => b.classList.toggle("is-active", b === btn));
    });
  });
  container.querySelector("#diet-save-btn")?.addEventListener("click", () => saveDietSettings(pet, container));
  container.querySelector("#ai-advice-btn")?.addEventListener("click", () => {
    fetchAiAdvice(pet, null, logs, settings);
  });
}

async function logDiet(type, pet, mealOrder, waterMl, note) {
  const userId = window.PetAuth?.currentUser?.id;
  if (!userId) return;
  await _db.from("pet_diet_logs").insert({
    user_id: userId, pet_id: pet.id, log_type: type,
    meal_order: mealOrder ?? null,
    water_ml: waterMl ?? null,
    note: note || null,
    logged_at: new Date().toISOString(),
  });
  await renderActiveArea();
}

async function saveDietSettings(pet, container) {
  const userId = window.PetAuth?.currentUser?.id;
  if (!userId) return;
  const btn = container.querySelector("#diet-save-btn");
  if (btn) { btn.disabled = true; btn.textContent = "저장 중..."; }

  const mealsPerDay   = parseInt(container.querySelector(".diet-pick-btn.is-active")?.dataset.n ?? "2");
  const foodName      = container.querySelector("#ds-food-name")?.value.trim() || null;
  const foodAmountG   = parseFloat(container.querySelector("#ds-amount")?.value) || null;
  const waterTargetMl = parseFloat(container.querySelector("#ds-water")?.value) || 300;

  const { error } = await _db.from("pet_diet_settings").upsert(
    { user_id: userId, pet_id: pet.id, meals_per_day: mealsPerDay, food_name: foodName, food_amount_g: foodAmountG, water_target_ml: waterTargetMl, updated_at: new Date().toISOString() },
    { onConflict: "pet_id" }
  );
  if (error) {
    alert(`저장 실패: ${error.message}`);
    if (btn) { btn.disabled = false; btn.textContent = "저장"; }
    return;
  }
  await renderActiveArea();
}

// ──────────────────────────────────────────────────────────────
// [기록] 탭
// ──────────────────────────────────────────────────────────────
async function renderRecordsTab(pet, container) {
  let records = [], weights = [];
  try {
    const [rr, wr] = await Promise.all([
      _db.from("pet_health_records").select("id, record_type, content, record_date").eq("pet_id", pet.id).order("record_date", { ascending: false }).limit(50),
      _db.from("pet_weights").select("id, weight, recorded_at").eq("pet_id", pet.id).order("recorded_at", { ascending: false }).limit(20),
    ]);
    records = rr.data ?? [];
    weights = wr.data ?? [];
  } catch { /* tables may not exist */ }

  const latestWeight = weights[0];
  const weightTrend  = weights.length >= 2
    ? (weights[0].weight - weights[1].weight).toFixed(1)
    : null;

  container.innerHTML = `
    <div class="records-section">
      <div class="records-section-header">
        <span class="records-section-title">⚖️ 체중</span>
        <button class="records-add-btn" id="weight-add-btn">+ 기록</button>
      </div>
      <div class="records-weight-summary">
        ${latestWeight
          ? `<span class="records-weight-val">${latestWeight.weight} kg</span>
             <span class="records-weight-date">${formatDate(latestWeight.recorded_at)}</span>
             ${weightTrend !== null ? `<span class="records-weight-trend ${parseFloat(weightTrend) > 0 ? "up" : parseFloat(weightTrend) < 0 ? "down" : "same"}">${parseFloat(weightTrend) > 0 ? "▲" : parseFloat(weightTrend) < 0 ? "▼" : "→"} ${Math.abs(weightTrend)}kg</span>` : ""}
             `
          : `<span class="records-weight-empty">체중 기록이 없어요</span>`}
      </div>
      ${weights.length ? `<div class="records-weight-list">${weights.slice(0,5).map(w => `<div class="records-weight-row"><span>${formatDate(w.recorded_at)}</span><strong>${w.weight} kg</strong></div>`).join("")}</div>` : ""}
    </div>

    <div class="records-section">
      <div class="records-section-header">
        <span class="records-section-title">📋 진료·건강 기록</span>
        <button class="records-add-btn" id="health-add-btn">+ 기록</button>
      </div>
      <div id="health-record-list">
        ${records.length
          ? records.map(r => `
            <div class="records-item" data-id="${r.id}">
              <div class="records-item-type">${escapeHtml(r.record_type ?? "기록")}</div>
              <div class="records-item-content">${escapeHtml(r.content ?? "")}</div>
              <div class="records-item-meta">${formatDate(r.record_date)}</div>
              <button class="records-item-delete" data-id="${r.id}">✕</button>
            </div>`).join("")
          : `<p class="records-empty">아직 건강 기록이 없어요.<br>진료·투약·처방 내용을 기록해보세요.</p>`}
      </div>
    </div>`;

  // 체중 추가
  container.querySelector("#weight-add-btn")?.addEventListener("click", () => showWeightModal(pet));
  // 기록 추가
  container.querySelector("#health-add-btn")?.addEventListener("click", () => showHealthRecordModal(pet));
  // 삭제
  container.querySelectorAll(".records-item-delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("이 기록을 삭제할까요?")) return;
      await _db.from("pet_health_records").delete().eq("id", btn.dataset.id);
      await renderActiveArea();
    });
  });
}

function showWeightModal(pet) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<div class="modal">
    <button class="modal-close" style="float:right;background:none;border:none;font-size:20px;cursor:pointer;">✕</button>
    <h3 class="modal-title">⚖️ 체중 기록</h3>
    <div class="modal-field">
      <label>체중 (kg)</label>
      <input type="number" id="weight-input" class="diet-input" placeholder="3.5" min="0" step="0.1" style="width:100%;"/>
    </div>
    <div class="modal-field">
      <label>날짜</label>
      <input type="date" id="weight-date" class="diet-input" value="${todayIso()}" style="width:100%;"/>
    </div>
    <button class="care-sheet-done-btn" id="weight-save" style="margin-top:12px;">저장</button>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector(".modal-close").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector("#weight-save")?.addEventListener("click", async () => {
    const userId = window.PetAuth?.currentUser?.id;
    if (!userId) return;
    const weight = parseFloat(overlay.querySelector("#weight-input")?.value);
    const date   = overlay.querySelector("#weight-date")?.value;
    if (!weight || weight <= 0) { alert("체중을 입력해주세요."); return; }
    await _db.from("pet_weights").insert({ user_id: userId, pet_id: pet.id, weight, recorded_at: date });
    overlay.remove();
    await renderActiveArea();
  });
}

function showHealthRecordModal(pet) {
  const types = ["진료메모", "예방접종", "처방·투약", "수술·시술", "기타"];
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<div class="modal">
    <button class="modal-close" style="float:right;background:none;border:none;font-size:20px;cursor:pointer;">✕</button>
    <h3 class="modal-title">📋 건강 기록 추가</h3>
    <div class="modal-field">
      <label>종류</label>
      <select id="hr-type" class="diet-input" style="width:100%;">
        ${types.map(t => `<option value="${t}">${t}</option>`).join("")}
      </select>
    </div>
    <div class="modal-field">
      <label>내용</label>
      <textarea id="hr-content" class="diet-input" rows="3" placeholder="예: 광견병 접종 완료, 링거 처방 등" style="width:100%;resize:none;"></textarea>
    </div>
    <div class="modal-field">
      <label>날짜</label>
      <input type="date" id="hr-date" class="diet-input" value="${todayIso()}" style="width:100%;"/>
    </div>
    <button class="care-sheet-done-btn" id="hr-save" style="margin-top:12px;">저장</button>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector(".modal-close").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector("#hr-save")?.addEventListener("click", async () => {
    const userId  = window.PetAuth?.currentUser?.id;
    if (!userId) return;
    const type    = overlay.querySelector("#hr-type")?.value;
    const content = overlay.querySelector("#hr-content")?.value.trim();
    const date    = overlay.querySelector("#hr-date")?.value;
    if (!content) { alert("내용을 입력해주세요."); return; }
    await _db.from("pet_health_records").insert({ user_id: userId, pet_id: pet.id, record_type: type, content, record_date: date });
    overlay.remove();
    await renderActiveArea();
  });
}

// ──────────────────────────────────────────────────────────────
// [지출] 탭
// ──────────────────────────────────────────────────────────────
async function renderExpenseTab(pet, container) {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;
  const from  = `${year}-${String(month).padStart(2,"0")}-01`;
  const to    = `${year}-${String(month).padStart(2,"0")}-${String(new Date(year, month, 0).getDate()).padStart(2,"0")}`;

  let expenses = [], total = 0;
  try {
    const { data } = await _db.from("pet_expenses").select("id, category, amount, expense_date, memo")
      .eq("pet_id", pet.id).gte("expense_date", from).lte("expense_date", to)
      .order("expense_date", { ascending: false });
    expenses = data ?? [];
    total = expenses.reduce((s, r) => s + (r.amount || 0), 0);
  } catch { /* table may not exist */ }

  const catTotals = {};
  expenses.forEach(r => { catTotals[r.category] = (catTotals[r.category] || 0) + r.amount; });
  const catEntries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

  container.innerHTML = `
    <div class="expense-header">
      <div class="expense-month">${month}월 지출</div>
      <div class="expense-total">${total.toLocaleString()}원</div>
      <button class="records-add-btn" id="expense-add-btn" style="margin-top:8px;">+ 지출 추가</button>
    </div>

    ${catEntries.length ? `
    <div class="expense-cats">
      ${catEntries.map(([cat, amt]) => `
        <div class="expense-cat-row">
          <span class="expense-cat-name">${escapeHtml(cat)}</span>
          <span class="expense-cat-bar-wrap">
            <span class="expense-cat-bar" style="width:${Math.round(amt/total*100)}%"></span>
          </span>
          <span class="expense-cat-amt">${amt.toLocaleString()}원</span>
        </div>`).join("")}
    </div>` : ""}

    <div class="expense-list">
      ${expenses.length
        ? expenses.map(r => `
          <div class="expense-item">
            <div class="expense-item-left">
              <span class="expense-item-cat">${escapeHtml(r.category)}</span>
              <span class="expense-item-memo">${r.memo ? escapeHtml(r.memo) : ""}</span>
            </div>
            <div class="expense-item-right">
              <span class="expense-item-amt">${r.amount.toLocaleString()}원</span>
              <span class="expense-item-date">${formatDate(r.expense_date)}</span>
            </div>
            <button class="expense-item-delete" data-id="${r.id}">✕</button>
          </div>`).join("")
        : `<p class="records-empty">이번달 지출 내역이 없어요.</p>`}
    </div>`;

  container.querySelector("#expense-add-btn")?.addEventListener("click", () => showExpenseModal(pet));
  container.querySelectorAll(".expense-item-delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("삭제할까요?")) return;
      await _db.from("pet_expenses").delete().eq("id", btn.dataset.id);
      await renderActiveArea();
    });
  });
}

function showExpenseModal(pet) {
  const cats = EXPENSE_CATEGORIES[pet.species] ?? EXPENSE_CATEGORIES.default;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<div class="modal">
    <button class="modal-close" style="float:right;background:none;border:none;font-size:20px;cursor:pointer;">✕</button>
    <h3 class="modal-title">💰 지출 추가</h3>
    <div class="modal-field">
      <label>항목</label>
      <select id="exp-cat" class="diet-input" style="width:100%;">
        ${cats.map(c => `<option value="${c}">${c}</option>`).join("")}
      </select>
    </div>
    <div class="modal-field">
      <label>금액 (원)</label>
      <input type="number" id="exp-amount" class="diet-input" placeholder="30000" min="0" step="100" style="width:100%;"/>
    </div>
    <div class="modal-field">
      <label>메모 (선택)</label>
      <input type="text" id="exp-memo" class="diet-input" placeholder="예: 로얄캐닌 2kg" maxlength="40" style="width:100%;"/>
    </div>
    <div class="modal-field">
      <label>날짜</label>
      <input type="date" id="exp-date" class="diet-input" value="${todayIso()}" style="width:100%;"/>
    </div>
    <button class="care-sheet-done-btn" id="exp-save" style="margin-top:12px;">저장</button>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector(".modal-close").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector("#exp-save")?.addEventListener("click", async () => {
    const userId = window.PetAuth?.currentUser?.id;
    if (!userId) return;
    const category = overlay.querySelector("#exp-cat")?.value;
    const amount   = parseFloat(overlay.querySelector("#exp-amount")?.value);
    const memo     = overlay.querySelector("#exp-memo")?.value.trim() || null;
    const date     = overlay.querySelector("#exp-date")?.value;
    if (!amount || amount <= 0) { alert("금액을 입력해주세요."); return; }
    await _db.from("pet_expenses").insert({ user_id: userId, pet_id: pet.id, category, amount, memo, expense_date: date, source: "manual" });
    overlay.remove();
    await renderActiveArea();
  });
}

// ──────────────────────────────────────────────────────────────
// AI 조언
// ──────────────────────────────────────────────────────────────
async function fetchAiAdvice(pet, careItems, dietLogs, dietSettings) {
  const btn    = document.getElementById("ai-advice-btn");
  const result = document.getElementById("ai-advice-result");
  if (!btn || !result) return;
  btn.disabled = true;
  btn.textContent = "분석 중...";
  result.hidden = true;
  try {
    const res = await fetch("https://petreview.vercel.app/api/ai-care", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pet, careItems, dietToday: dietLogs, dietSettings }),
    });
    const data = await res.json();
    result.textContent = data.text || "조언을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
    result.hidden = false;
  } catch {
    result.textContent = "네트워크 오류가 발생했어요.";
    result.hidden = false;
  }
  btn.disabled = false;
  btn.textContent = _activeSubtab === "diet" ? "🤖 AI 식단 조언" : "🤖 AI 케어 조언";
}

// ──────────────────────────────────────────────────────────────
// 초기화
// ──────────────────────────────────────────────────────────────
async function init() {
  _db = window.supabaseClient;
  const content = document.getElementById("care-content");

  await window.PetAuth?.init((event) => {
    if (event === "SIGNED_OUT") window.location.href = "index.html";
  });

  const user = window.PetAuth?.currentUser ?? null;
  document.getElementById("care-login-btn").hidden = !!user;
  const hospitalLink = document.getElementById("care-hospital-link");
  if (hospitalLink) hospitalLink.hidden = !user;

  if (!user) {
    document.getElementById("care-subtabs").hidden = true;
    content.innerHTML = `
    <div class="care-landing">
      <div class="care-landing-hero">
        <div class="care-landing-logo">🐾</div>
        <h2 class="care-landing-title">우쭈쭈</h2>
        <p class="care-landing-sub">우리 아이 건강, 놓치지 않게</p>
      </div>
      <div class="care-landing-features">
        <div class="care-feature-card"><span class="care-feature-icon">🐾</span><div><div class="care-feature-name">케어 관리</div><div class="care-feature-desc">목욕·예방접종·양치 D-day 알림</div></div></div>
        <div class="care-feature-card"><span class="care-feature-icon">🍚</span><div><div class="care-feature-name">식단 기록</div><div class="care-feature-desc">밥·물·간식 섭취량 한눈에</div></div></div>
        <div class="care-feature-card"><span class="care-feature-icon">📋</span><div><div class="care-feature-name">건강 기록</div><div class="care-feature-desc">진료·체중·처방 기록 관리</div></div></div>
        <div class="care-feature-card"><span class="care-feature-icon">💰</span><div><div class="care-feature-name">지출 관리</div><div class="care-feature-desc">월별 펫 지출 통계</div></div></div>
      </div>
      <div class="care-landing-cta">
        <button class="care-cta-btn" onclick="window.PetAuth?.signInWithGoogle()">구글로 시작하기</button>
        <p class="care-landing-note">구글 · 카카오 · 네이버로 3초 로그인</p>
      </div>
    </div>`;
    return;
  }

  const { data: pets } = await _db.from("pets").select("id, name, species, breed, photo_url").eq("user_id", user.id).order("created_at");
  _pets = pets ?? [];

  if (!_pets.length) {
    content.innerHTML = `<div class="care-empty-state">
      <div class="care-empty-icon">🐾</div>
      <p class="care-empty-title">반려동물을 등록해주세요</p>
      <p class="care-empty-desc">마이페이지에서 등록하면 케어·식단·기록이 자동 설정돼요.</p>
      <a class="care-login-btn" href="mypage.html?tab=pets">반려동물 등록하기 →</a>
    </div>`;
    return;
  }

  // URL 해시로 초기 서브탭 결정 (#expense, #diet, #records)
  const hashTab = location.hash.replace("#", "");
  if (["manage","diet","records","expense"].includes(hashTab)) {
    _activeSubtab = hashTab;
  }

  // 서브탭 표시
  document.getElementById("care-subtabs").hidden = false;
  document.querySelectorAll(".care-subtab").forEach(b => {
    b.classList.toggle("is-active", b.dataset.subtab === _activeSubtab);
  });

  // 펫 탭 + 메인 영역
  const tabsHtml = `<div class="care-pet-tabs" id="care-pet-tabs">${_pets.map((pet, i) =>
    `<button class="care-pet-tab${i===0?" is-active":""}" data-pet-idx="${i}">
      ${pet.photo_url ? `<img class="care-pet-tab-img" src="${escapeHtml(pet.photo_url)}" alt="${escapeHtml(pet.name)}"/>` : speciesEmoji(pet.species)}
      <span>${escapeHtml(pet.name)}</span>
    </button>`).join("")}
  </div>
  <div id="care-main-area"></div>`;
  content.innerHTML = tabsHtml;

  await renderActiveArea();

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

  // 시트 닫기
  document.getElementById("care-sheet-close")?.addEventListener("click", closeManageSheet);
  document.getElementById("care-sheet-overlay")?.addEventListener("click", e => {
    if (e.target === document.getElementById("care-sheet-overlay")) closeManageSheet();
  });

  // 완료 기록
  document.getElementById("care-sheet-done-btn")?.addEventListener("click", submitManageDone);

  // 항목 기록 보기
  document.getElementById("care-sheet-history-btn")?.addEventListener("click", () => {
    if (!_sheetItem) return;
    closeManageSheet();
    showItemHistory(_sheetItem.pet, _sheetItem.item);
  });
}

document.addEventListener("DOMContentLoaded", init);
