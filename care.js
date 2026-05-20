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
  else if (_activeSubtab === "expense") await renderExpenseTab(mainArea);
}

// ──────────────────────────────────────────────────────────────
// [관리] 탭
// ──────────────────────────────────────────────────────────────
async function renderManageTab(pet, container) {
  const realPets = _pets.filter(p => p.id !== "demo");
  const multiPet = realPets.length > 1;
  const items = CARE_ITEMS[speciesKey(pet.species)] ?? CARE_ITEMS.dog;

  // 현재 펫 케어 로그
  let lastDoneMap = {};
  try {
    const { data: logs } = await _db.from("pet_care_logs").select("care_key, done_at")
      .eq("pet_id", pet.id).order("done_at", { ascending: false });
    (logs ?? []).forEach(l => { if (!lastDoneMap[l.care_key]) lastDoneMap[l.care_key] = l.done_at; });
  } catch { /* table may not exist */ }

  // 복수 펫 전체 현황 데이터
  let allSummary = null;
  if (multiPet) {
    try {
      const results = await Promise.all(
        realPets.map(p => _db.from("pet_care_logs").select("care_key, done_at").eq("pet_id", p.id).order("done_at", { ascending: false }))
      );
      allSummary = realPets.map((p, i) => {
        const logMap = {};
        (results[i].data ?? []).forEach(l => { if (!logMap[l.care_key]) logMap[l.care_key] = l.done_at; });
        const petItems = CARE_ITEMS[speciesKey(p.species)] ?? CARE_ITEMS.dog;
        const done = petItems.filter(it => isTodayKST(logMap[it.key])).length;
        const urgent = petItems
          .map(it => {
            const last = logMap[it.key] ?? null;
            const doneToday = isTodayKST(last);
            const iv = getIntervalDays(p.id, it.key, it.default_days);
            const dday = doneToday ? null : calcDday(last, iv);
            return { it, dday, doneToday };
          })
          .filter(({ dday, doneToday }) => !doneToday && dday !== null && dday <= 1)
          .sort((a, b) => a.dday - b.dday);
        return { pet: p, done, total: petItems.length, urgent };
      });
    } catch { /* ignore */ }
  }

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

  // 복수 펫 전체 현황 배너
  const allUrgent = allSummary ? allSummary.flatMap(s => s.urgent.map(u => ({ ...u, petName: s.pet.name }))) : [];
  const summaryHtml = allSummary ? `
  <div class="manage-all-summary">
    <div class="manage-all-summary-title">🐾 오늘의 케어 현황</div>
    ${allSummary.map(s => `
      <div class="manage-all-pet-row">
        <span class="manage-all-pet-name">${escapeHtml(s.pet.name)}</span>
        <div class="manage-all-progress-track">
          <div class="manage-all-progress-fill" style="width:${Math.round(s.done/s.total*100)}%"></div>
        </div>
        <span class="manage-all-pet-count">${s.done}/${s.total}</span>
      </div>`).join("")}
    ${allUrgent.length ? `
    <div class="manage-urgent-list">
      <div class="manage-urgent-title">⚡ 지금 필요한 케어</div>
      ${allUrgent.slice(0, 4).map(({ it, dday, petName }) => `
        <div class="manage-urgent-item">
          <span class="manage-urgent-who">${escapeHtml(petName)} · ${it.icon} ${escapeHtml(it.label)}</span>
          <span class="${dday < 0 ? "manage-urgent-badge-overdue" : dday === 0 ? "manage-urgent-badge-today" : "manage-urgent-badge-soon"}">
            ${dday < 0 ? `${Math.abs(dday)}일 지남` : dday === 0 ? "오늘!" : `D-${dday}`}
          </span>
        </div>`).join("")}
    </div>` : ""}
  </div>` : "";

  let html = summaryHtml + `
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

const WATER_LEVELS = [
  { key: "good", label: "잘 마심",   icon: "💧💧💧" },
  { key: "ok",   label: "보통",      icon: "💧💧" },
  { key: "low",  label: "조금 마심", icon: "💧" },
];

function getMealLabels(n) {
  if (n === 1) return ["오늘"];
  if (n === 2) return ["아침", "저녁"];
  return ["아침", "점심", "저녁"];
}

function renderDietSection(container, pet, settings, logs) {
  const mealsPerDay = settings?.meals_per_day ?? 2;
  const foodAmountG = settings?.food_amount_g ?? null;
  const foodName    = settings?.food_name ?? "";

  const mealsLogged = new Set(logs.filter(l => l.log_type === "meal").map(l => l.meal_order));
  const snacks      = logs.filter(l => l.log_type === "snack");
  const waterLog    = logs.find(l => l.log_type === "water" && WATER_LEVELS.some(w => w.key === l.note));
  const waterLevel  = waterLog ? WATER_LEVELS.find(w => w.key === waterLog.note) : null;

  const mealLabels = getMealLabels(mealsPerDay);
  const mealsHtml = Array.from({ length: mealsPerDay }, (_, i) => {
    const n = i + 1, done = mealsLogged.has(n), label = mealLabels[i] ?? `${n}번째`;
    return `<button class="diet-meal-btn${done ? " is-done" : ""}" data-meal="${n}"${done ? " disabled" : ""}>
      <span class="diet-meal-icon">${done ? "✅" : "🍚"}</span>
      <span class="diet-meal-label">${label}</span>
      ${foodAmountG ? `<span class="diet-meal-amount">${foodAmountG}g</span>` : ""}
    </button>`;
  }).join("");

  const settingsSummary = [
    `${mealsPerDay}식`,
    foodName ? escapeHtml(foodName) : "",
    foodAmountG ? `${foodAmountG}g` : "",
  ].filter(Boolean).join(" · ");

  container.innerHTML = `
    <details class="diet-settings-details">
      <summary class="diet-settings-toggle">
        <span>⚙️ 식단 설정</span>
        ${settingsSummary ? `<span class="diet-settings-summary-text">${settingsSummary}</span>` : `<span class="diet-settings-summary-hint">탭해서 설정</span>`}
      </summary>
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
        <button class="diet-save-btn" id="diet-save-btn">저장</button>
      </div>
    </details>

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
        ${waterLevel ? `<button class="diet-water-reset" id="diet-water-reset">초기화</button>` : ""}
      </div>
      ${waterLevel
        ? `<div class="diet-water-selected">
             <span class="diet-water-selected-icon">${waterLevel.icon}</span>
             <span class="diet-water-selected-label">${waterLevel.label}</span>
             <span class="diet-water-selected-check">✓ 오늘 기록됨</span>
           </div>`
        : `<div class="diet-water-level-btns">
             ${WATER_LEVELS.map(w => `
               <button class="diet-water-level-btn" data-level="${w.key}">
                 <span class="diet-water-level-icon">${w.icon}</span>
                 <span class="diet-water-level-label">${w.label}</span>
               </button>`).join("")}
           </div>`}
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
    </div>`;

  container.querySelectorAll(".diet-meal-btn:not([disabled])").forEach(btn => {
    btn.addEventListener("click", () => logDiet("meal", pet, parseInt(btn.dataset.meal)));
  });
  container.querySelectorAll(".diet-water-level-btn").forEach(btn => {
    btn.addEventListener("click", () => logDiet("water", pet, null, null, btn.dataset.level));
  });
  container.querySelector("#diet-water-reset")?.addEventListener("click", async () => {
    const userId = window.PetAuth?.currentUser?.id;
    if (!userId) return;
    await _db.from("pet_diet_logs").delete().eq("pet_id", pet.id).eq("log_type", "water").gte("logged_at", getTodayKST());
    await renderActiveArea();
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

  const mealsPerDay = parseInt(container.querySelector(".diet-pick-btn.is-active")?.dataset.n ?? "2");
  const foodName    = container.querySelector("#ds-food-name")?.value.trim() || null;
  const foodAmountG = parseFloat(container.querySelector("#ds-amount")?.value) || null;

  const { error } = await _db.from("pet_diet_settings").upsert(
    { user_id: userId, pet_id: pet.id, meals_per_day: mealsPerDay, food_name: foodName, food_amount_g: foodAmountG, updated_at: new Date().toISOString() },
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
  const realPets = _pets.filter(p => p.id !== "demo");
  const multiPet = realPets.length > 1;

  let weights = [], allRecords = [];
  try {
    const queries = [
      _db.from("pet_weights").select("id, weight, recorded_at").eq("pet_id", pet.id).order("recorded_at", { ascending: false }).limit(20),
      ...realPets.map(p => _db.from("pet_health_records").select("id, pet_id, record_type, content, record_date").eq("pet_id", p.id).order("record_date", { ascending: false }).limit(50)),
    ];
    const [wr, ...rrs] = await Promise.all(queries);
    weights = wr.data ?? [];
    allRecords = rrs.flatMap((r, i) => (r.data ?? []).map(rec => ({ ...rec, petName: realPets[i].name })));
    allRecords.sort((a, b) => (b.record_date ?? "").localeCompare(a.record_date ?? ""));
  } catch { /* tables may not exist */ }

  const latestWeight = weights[0];
  const weightTrend  = weights.length >= 2 ? (weights[0].weight - weights[1].weight).toFixed(1) : null;

  let activeFilter = "all";
  let confirmDeleteRecordId = null;

  function renderRecordList() {
    const filtered = activeFilter === "all" ? allRecords : allRecords.filter(r => r.pet_id === activeFilter);
    const listEl = container.querySelector("#health-record-list");
    if (!listEl) return;
    listEl.innerHTML = filtered.length
      ? filtered.map(r => {
          const showBadge = multiPet && activeFilter === "all";
          const isConfirm = confirmDeleteRecordId === r.id;
          return `<div class="records-item" data-id="${escapeHtml(r.id)}">
            <div class="records-item-type">${escapeHtml(r.record_type ?? "기록")}${showBadge ? ` <span class="expense-pet-badge">${escapeHtml(r.petName)}</span>` : ""}</div>
            <div class="records-item-content">${escapeHtml(r.content ?? "")}</div>
            <div class="records-item-meta">${formatDate(r.record_date)}</div>
            ${isConfirm
              ? `<div class="expense-delete-confirm" style="border-radius:0 12px 12px 0;">
                   <button class="expense-delete-cancel" data-id="${escapeHtml(r.id)}">취소</button>
                   <button class="expense-delete-ok" data-id="${escapeHtml(r.id)}">삭제</button>
                 </div>`
              : `<button class="records-item-delete" data-id="${escapeHtml(r.id)}">✕</button>`}
          </div>`;
        }).join("")
      : `<p class="records-empty">건강 기록이 없어요.<br>진료·투약·처방 내용을 기록해보세요.</p>`;

    listEl.querySelectorAll(".records-item-delete").forEach(btn => {
      btn.addEventListener("click", () => { confirmDeleteRecordId = btn.dataset.id; renderRecordList(); });
    });
    listEl.querySelectorAll(".expense-delete-cancel").forEach(btn => {
      btn.addEventListener("click", () => { confirmDeleteRecordId = null; renderRecordList(); });
    });
    listEl.querySelectorAll(".expense-delete-ok").forEach(btn => {
      btn.addEventListener("click", async () => {
        await _db.from("pet_health_records").delete().eq("id", btn.dataset.id);
        allRecords = allRecords.filter(r => r.id !== btn.dataset.id);
        confirmDeleteRecordId = null;
        renderRecordList();
      });
    });
  }

  container.innerHTML = `
    <div class="records-section">
      <div class="records-section-header">
        <span class="records-section-title">⚖️ 체중 (${escapeHtml(pet.name)})</span>
        <button class="records-add-btn" id="weight-add-btn">+ 기록</button>
      </div>
      <div class="records-weight-summary">
        ${latestWeight
          ? `<span class="records-weight-val">${latestWeight.weight} kg</span>
             <span class="records-weight-date">${formatDate(latestWeight.recorded_at)}</span>
             ${weightTrend !== null ? `<span class="records-weight-trend ${parseFloat(weightTrend) > 0 ? "up" : parseFloat(weightTrend) < 0 ? "down" : "same"}">${parseFloat(weightTrend) > 0 ? "▲" : parseFloat(weightTrend) < 0 ? "▼" : "→"} ${Math.abs(weightTrend)}kg</span>` : ""}`
          : `<span class="records-weight-empty">체중 기록이 없어요</span>`}
      </div>
      ${weights.length ? `<div class="records-weight-list">${weights.slice(0,5).map(w => `<div class="records-weight-row"><span>${formatDate(w.recorded_at)}</span><strong>${w.weight} kg</strong></div>`).join("")}</div>` : ""}
    </div>

    <div class="records-section">
      <div class="records-section-header">
        <span class="records-section-title">📋 진료·건강 기록</span>
        <button class="records-add-btn" id="health-add-btn">+ 기록</button>
      </div>
      ${multiPet ? `
      <div class="expense-filter-bar" style="padding:0 0 10px;">
        <button class="expense-filter-btn is-active" data-filter="all">전체</button>
        ${realPets.map(p => `<button class="expense-filter-btn" data-filter="${escapeHtml(p.id)}">${escapeHtml(p.name)}</button>`).join("")}
      </div>` : ""}
      <div id="health-record-list"></div>
    </div>`;

  container.querySelector("#weight-add-btn")?.addEventListener("click", () => showWeightModal(pet));
  container.querySelector("#health-add-btn")?.addEventListener("click", () => showHealthRecordModal(pet));

  container.querySelectorAll(".expense-filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter;
      container.querySelectorAll(".expense-filter-btn").forEach(b => b.classList.toggle("is-active", b === btn));
      confirmDeleteRecordId = null;
      renderRecordList();
    });
  });

  renderRecordList();
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
// [집사영수증] 탭
// ──────────────────────────────────────────────────────────────
async function renderExpenseTab(container) {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;
  const from  = `${year}-${String(month).padStart(2,"0")}-01`;
  const to    = `${year}-${String(month).padStart(2,"0")}-${String(new Date(year, month, 0).getDate()).padStart(2,"0")}`;

  const realPets = _pets.filter(p => p.id !== "demo");
  let allExpenses = [];
  try {
    if (realPets.length) {
      const { data } = await _db.from("pet_expenses")
        .select("id, pet_id, category, amount, expense_date, memo")
        .in("pet_id", realPets.map(p => p.id))
        .gte("expense_date", from).lte("expense_date", to)
        .order("expense_date", { ascending: false });
      allExpenses = data ?? [];
    }
  } catch { /* table may not exist yet */ }

  const petById = {};
  const petTotals = {};
  realPets.forEach(p => { petById[p.id] = p; petTotals[p.id] = 0; });
  allExpenses.forEach(r => { petTotals[r.pet_id] = (petTotals[r.pet_id] || 0) + (r.amount || 0); });

  const grandTotal = allExpenses.reduce((s, r) => s + (r.amount || 0), 0);
  const multiPet = realPets.length > 1;
  let activeFilter = "all";
  let confirmDeleteId = null;

  function renderList() {
    const filtered = activeFilter === "all" ? allExpenses : allExpenses.filter(r => r.pet_id === activeFilter);
    const filterTotal = filtered.reduce((s, r) => s + (r.amount || 0), 0);
    const catTotals = {};
    filtered.forEach(r => { catTotals[r.category] = (catTotals[r.category] || 0) + r.amount; });
    const catEntries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    const listEl = container.querySelector("#expense-list-area");
    if (!listEl) return;

    listEl.innerHTML = `
      ${catEntries.length && filterTotal ? `
      <div class="expense-cats">
        ${catEntries.map(([cat, amt]) => `
          <div class="expense-cat-row">
            <span class="expense-cat-name">${escapeHtml(cat)}</span>
            <span class="expense-cat-bar-wrap"><span class="expense-cat-bar" style="width:${Math.round(amt/filterTotal*100)}%"></span></span>
            <span class="expense-cat-amt">${amt.toLocaleString()}원</span>
          </div>`).join("")}
      </div>` : ""}
      <div class="expense-list">
        ${filtered.length ? filtered.map(r => {
          const petName = multiPet && activeFilter === "all" ? (petById[r.pet_id]?.name ?? "") : "";
          const isConfirm = confirmDeleteId === r.id;
          return `<div class="expense-item" data-id="${escapeHtml(r.id)}">
            <div class="expense-item-left">
              <span class="expense-item-cat">${escapeHtml(r.category)}${petName ? ` <span class="expense-pet-badge">${escapeHtml(petName)}</span>` : ""}</span>
              <span class="expense-item-memo">${r.memo ? escapeHtml(r.memo) : ""}</span>
            </div>
            <div class="expense-item-right">
              <span class="expense-item-amt">${r.amount.toLocaleString()}원</span>
              <span class="expense-item-date">${formatDate(r.expense_date)}</span>
            </div>
            ${isConfirm
              ? `<div class="expense-delete-confirm">
                   <button class="expense-delete-cancel" data-id="${escapeHtml(r.id)}">취소</button>
                   <button class="expense-delete-ok" data-id="${escapeHtml(r.id)}">삭제</button>
                 </div>`
              : `<button class="expense-item-delete" data-id="${escapeHtml(r.id)}">✕</button>`}
          </div>`;
        }).join("") : `<p class="records-empty">지출 내역이 없어요.</p>`}
      </div>`;

    listEl.querySelectorAll(".expense-item-delete").forEach(btn => {
      btn.addEventListener("click", () => { confirmDeleteId = btn.dataset.id; renderList(); });
    });
    listEl.querySelectorAll(".expense-delete-cancel").forEach(btn => {
      btn.addEventListener("click", () => { confirmDeleteId = null; renderList(); });
    });
    listEl.querySelectorAll(".expense-delete-ok").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        await _db.from("pet_expenses").delete().eq("id", id);
        allExpenses = allExpenses.filter(r => r.id !== id);
        realPets.forEach(p => { petTotals[p.id] = 0; });
        allExpenses.forEach(r => { petTotals[r.pet_id] = (petTotals[r.pet_id] || 0) + (r.amount || 0); });
        const newGrand = allExpenses.reduce((s, r) => s + (r.amount || 0), 0);
        const totalEl = container.querySelector(".expense-total");
        if (totalEl) totalEl.textContent = newGrand.toLocaleString() + "원";
        container.querySelectorAll(".expense-pet-card").forEach(el => {
          const petId = el.dataset.petId;
          if (petId) el.querySelector(".expense-pet-card-amt").textContent = (petTotals[petId] || 0).toLocaleString() + "원";
        });
        confirmDeleteId = null;
        renderList();
      });
    });
  }

  container.innerHTML = `
    <div class="expense-header">
      <div class="expense-month">${month}월 전체 지출</div>
      <div class="expense-total">${grandTotal.toLocaleString()}원</div>
      ${multiPet ? `
      <div class="expense-pet-summary">
        ${realPets.map(p => `
          <div class="expense-pet-card" data-pet-id="${escapeHtml(p.id)}">
            <div class="expense-pet-card-name">${escapeHtml(p.name)}</div>
            <div class="expense-pet-card-amt">${(petTotals[p.id] || 0).toLocaleString()}원</div>
          </div>`).join("")}
      </div>` : ""}
    </div>
    <div class="expense-filter-bar">
      ${multiPet ? `
        <button class="expense-filter-btn is-active" data-filter="all">전체</button>
        ${realPets.map(p => `<button class="expense-filter-btn" data-filter="${escapeHtml(p.id)}">${escapeHtml(p.name)}</button>`).join("")}
      ` : ""}
      <button class="records-add-btn expense-add-btn" id="expense-add-btn">+ 지출 추가</button>
    </div>
    <div id="expense-list-area"></div>`;

  container.querySelectorAll(".expense-filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter;
      container.querySelectorAll(".expense-filter-btn").forEach(b => b.classList.toggle("is-active", b === btn));
      confirmDeleteId = null;
      renderList();
    });
  });
  container.querySelector("#expense-add-btn")?.addEventListener("click", () => showExpenseModal(realPets, activeFilter));
  renderList();
}

function showExpenseModal(pets, activeFilter = "all") {
  const initPetId = (activeFilter !== "all" && pets.find(p => p.id === activeFilter)) ? activeFilter : (pets[0]?.id ?? null);
  const allCats = EXPENSE_CATEGORIES[pets[0]?.species] ?? EXPENSE_CATEGORIES.default;

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<div class="modal">
    <button class="modal-close" style="float:right;background:none;border:none;font-size:20px;cursor:pointer;">✕</button>
    <h3 class="modal-title">💰 지출 추가</h3>
    ${pets.length > 1 ? `
    <div class="modal-field">
      <label>반려동물</label>
      <div class="expense-pet-btns" id="exp-pet-btns">
        ${pets.map(p => `<button type="button" class="expense-pet-select-btn${p.id === initPetId ? " is-active" : ""}" data-pet-id="${escapeHtml(p.id)}">${escapeHtml(p.name)}</button>`).join("")}
        <button type="button" class="expense-pet-select-btn" data-pet-id="shared">공유 🔗</button>
      </div>
    </div>
    <p id="exp-split-note" style="font-size:12px;color:#888;text-align:center;margin:-8px 0 8px;min-height:18px;"></p>` : ""}
    <div class="modal-field">
      <label>항목</label>
      <select id="exp-cat" class="diet-input" style="width:100%;">
        ${allCats.map(c => `<option value="${c}">${c}</option>`).join("")}
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
    <p id="exp-error" style="color:#e57373;font-size:12px;text-align:center;margin-top:6px;"></p>
  </div>`;
  document.body.appendChild(overlay);

  let selectedPetId = initPetId;

  overlay.querySelectorAll(".expense-pet-select-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedPetId = btn.dataset.petId;
      overlay.querySelectorAll(".expense-pet-select-btn").forEach(b => b.classList.toggle("is-active", b === btn));
      const splitNote = overlay.querySelector("#exp-split-note");
      if (splitNote) splitNote.textContent = selectedPetId === "shared"
        ? `💡 입력한 금액을 ${pets.length}마리에게 균등 분배해서 기록해요.` : "";
    });
  });

  overlay.querySelector(".modal-close").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector("#exp-save")?.addEventListener("click", async () => {
    const userId = window.PetAuth?.currentUser?.id;
    if (!userId) return;
    const category = overlay.querySelector("#exp-cat")?.value;
    const amount   = parseFloat(overlay.querySelector("#exp-amount")?.value);
    const memo     = overlay.querySelector("#exp-memo")?.value.trim() || null;
    const date     = overlay.querySelector("#exp-date")?.value;
    const errEl    = overlay.querySelector("#exp-error");
    if (!amount || amount <= 0) { errEl.textContent = "금액을 입력해주세요."; return; }

    const saveBtn = overlay.querySelector("#exp-save");
    saveBtn.disabled = true; saveBtn.textContent = "저장 중...";
    errEl.textContent = "";

    try {
      if (selectedPetId === "shared" && pets.length > 1) {
        const perAmount = Math.round(amount / pets.length);
        await Promise.all(pets.map(p =>
          _db.from("pet_expenses").insert({ user_id: userId, pet_id: p.id, category, amount: perAmount, memo: memo ? `[공유] ${memo}` : "[공유]", expense_date: date, source: "manual" })
        ));
      } else {
        await _db.from("pet_expenses").insert({ user_id: userId, pet_id: selectedPetId ?? pets[0]?.id, category, amount, memo, expense_date: date, source: "manual" });
      }
      overlay.remove();
      await renderActiveArea();
    } catch (err) {
      errEl.textContent = err.message || "저장 실패. 다시 시도해주세요.";
      saveBtn.disabled = false; saveBtn.textContent = "저장";
    }
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
// 비로그인 데모 렌더
async function renderDemoArea(demoPet, container) {
  if (!container) return;
  const demoLogs = {
    bath: "2025-05-05", heartworm: "2025-04-01", vaccine: "2025-01-10",
    grooming: "2025-05-12", teeth: null, ear: "2025-04-20",
    nail: "2025-04-28", deworming: "2025-02-15", checkup: "2024-12-01",
  };
  if (_activeSubtab === "manage") {
    const items = CARE_ITEMS.dog;
    const cards = items.map(item => {
      const lastDoneAt = demoLogs[item.key] ?? null;
      const intervalDays = item.default_days;
      const doneToday = isTodayKST(lastDoneAt);
      const dday = doneToday ? null : calcDday(lastDoneAt, intervalDays);
      let stateClass = "manage-card--unset", badgeText = "기록 없음";
      if (doneToday)                           { stateClass = "manage-card--done";    badgeText = "✓ 오늘 완료"; }
      else if (!lastDoneAt)                    { stateClass = "manage-card--unset";   badgeText = "기록 없음"; }
      else if (dday !== null && dday < 0)      { stateClass = "manage-card--overdue"; badgeText = `${Math.abs(dday)}일 지남 ⚠️`; }
      else if (dday === 0)                     { stateClass = "manage-card--today";   badgeText = "오늘!"; }
      else if (dday !== null && dday <= 7)     { stateClass = "manage-card--soon";    badgeText = `D-${dday}`; }
      else                                     { stateClass = "manage-card--ok";      badgeText = dday !== null ? `D-${dday}` : "설정됨"; }
      return `<button class="manage-card ${stateClass} demo-card">
        <div class="manage-card-icon">${item.icon}</div>
        <div class="manage-card-name">${item.label}</div>
        <div class="manage-card-badge">${badgeText}</div>
      </button>`;
    });
    const doneCount = cards.filter((_, i) => isTodayKST(demoLogs[items[i].key])).length;
    const pct = Math.round(doneCount / items.length * 100);
    container.innerHTML = `
      <div class="manage-progress">
        <div class="manage-progress-text">오늘 ${doneCount} / ${items.length} 완료</div>
        <div class="manage-progress-track"><div class="manage-progress-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="manage-grid">${cards.join("")}</div>`;
    container.querySelectorAll(".demo-card").forEach(card => {
      card.addEventListener("click", () => promptLogin());
    });
  } else if (_activeSubtab === "diet") {
    container.innerHTML = `
      <div class="diet-block">
        <div class="diet-block-header"><span class="diet-block-title">🍚 오늘 식사</span><span class="diet-block-sub">0/2끼</span></div>
        <div class="diet-meals-grid">
          <button class="diet-meal-btn demo-card"><span class="diet-meal-icon">🍚</span><span class="diet-meal-label">아침</span></button>
          <button class="diet-meal-btn demo-card"><span class="diet-meal-icon">🍚</span><span class="diet-meal-label">저녁</span></button>
        </div>
      </div>
      <div class="diet-block">
        <div class="diet-block-header"><span class="diet-block-title">💧 수분 섭취</span><span class="diet-block-sub diet-water-stat">0ml / 300ml</span></div>
        <div class="diet-water-bar-wrap"><div class="diet-water-bar diet-water-bar--low" style="width:0%"></div></div>
        <div class="diet-water-btns">
          <button class="diet-water-btn demo-card">+50ml</button>
          <button class="diet-water-btn demo-card">+100ml</button>
          <button class="diet-water-btn demo-card">+200ml</button>
          <button class="diet-water-btn demo-card">+250ml</button>
        </div>
      </div>
      <div class="diet-block">
        <div class="diet-block-header"><span class="diet-block-title">🍪 간식</span></div>
        <div class="diet-snack-input-row">
          <input type="text" class="diet-snack-input" placeholder="간식 이름 (선택)" maxlength="20"/>
          <button class="diet-snack-btn demo-card">기록</button>
        </div>
      </div>`;
    container.querySelectorAll(".demo-card").forEach(el => {
      el.addEventListener("click", () => promptLogin());
    });
  } else if (_activeSubtab === "records") {
    container.innerHTML = `
      <div class="records-section">
        <div class="records-section-header">
          <span class="records-section-title">⚖️ 체중</span>
          <button class="records-add-btn demo-card">+ 기록</button>
        </div>
        <div class="records-weight-summary"><span class="records-weight-empty">로그인 후 체중을 기록해보세요</span></div>
      </div>
      <div class="records-section">
        <div class="records-section-header">
          <span class="records-section-title">📋 진료·건강 기록</span>
          <button class="records-add-btn demo-card">+ 기록</button>
        </div>
        <p class="records-empty">진료·투약·처방 내용을 기록해보세요.</p>
      </div>`;
    container.querySelectorAll(".demo-card").forEach(el => {
      el.addEventListener("click", () => promptLogin());
    });
  } else if (_activeSubtab === "expense") {
    const now = new Date();
    container.innerHTML = `
      <div class="expense-header">
        <div class="expense-month">${now.getMonth()+1}월 지출</div>
        <div class="expense-total">0원</div>
        <button class="records-add-btn demo-card" style="margin-top:8px;">+ 지출 추가</button>
      </div>
      <p class="records-empty" style="margin-top:24px;">로그인하면 반려동물 지출을 월별로 관리할 수 있어요.</p>`;
    container.querySelectorAll(".demo-card").forEach(el => {
      el.addEventListener("click", () => promptLogin());
    });
  }
}

// 로그인 유도 모달
function promptLogin(featureName) {
  const existing = document.getElementById("care-login-prompt");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.id = "care-login-prompt";
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<div class="modal" style="text-align:center;padding:32px 24px;">
    <div style="font-size:48px;margin-bottom:12px;">🐾</div>
    <h3 style="font-size:18px;font-weight:900;margin:0 0 8px;">${featureName ? escapeHtml(featureName) + " 시작하기" : "로그인"}</h3>
    <p style="font-size:14px;color:#888;margin:0 0 24px;line-height:1.6;">로그인하면 우리 아이 케어를<br>바로 시작할 수 있어요.</p>
    <button onclick="window.PetAuth?.signInWithGoogle()" style="width:100%;padding:14px;background:#16a34a;color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:10px;">구글로 로그인</button>
    <button onclick="document.getElementById('care-login-prompt').remove()" style="width:100%;padding:12px;background:none;border:1.5px solid #e5e7eb;border-radius:14px;font-size:14px;color:#888;cursor:pointer;">나중에</button>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
}

// 초기화
// ──────────────────────────────────────────────────────────────
async function init() {
  _db = window.supabaseClient;
  const content = document.getElementById("care-content");

  await window.PetAuth?.init((event) => {
    if (event === "SIGNED_OUT") window.location.href = "care.html";
  });

  const user = window.PetAuth?.currentUser ?? null;
  document.getElementById("care-login-btn").hidden = !!user;

  if (!user) {
    const demoPet = { id: "demo", name: "초코", species: "강아지", breed: "말티즈" };
    _pets = [demoPet];
    _activePetIdx = 0;

    document.getElementById("care-subtabs").hidden = false;

    const tabsHtml = `
      <div class="care-welcome-card">
        <div class="care-welcome-hero">
          <div class="care-welcome-logo">🐾</div>
          <div>
            <div class="care-welcome-title">우쭈쭈</div>
            <div class="care-welcome-sub">우리 아이 케어 매니저</div>
          </div>
        </div>
        <div class="care-welcome-features">
          <div class="care-welcome-feature"><span>🐾</span> 케어루틴 · 목욕·접종·산책 주기 관리</div>
          <div class="care-welcome-feature"><span>📋</span> 건강기록 · 체중 추적 · 진료 이력</div>
          <div class="care-welcome-feature"><span>🍚</span> 식습관 · 식사·수분 섭취 체크</div>
          <div class="care-welcome-feature"><span>💰</span> 집사영수증 · 월별 지출 관리</div>
        </div>
        <button class="care-welcome-login-btn" id="demo-login-btn">
          <svg width="18" height="18" viewBox="0 0 18 18" style="flex-shrink:0"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 6.294C4.672 4.167 6.656 3.58 9 3.58z"/></svg>
          구글로 시작하기
        </button>
        <a class="care-welcome-hospital-link" href="index.html">🏥 동물병원 찾기 · 후기 보기</a>
      </div>
      <div class="care-demo-label">아래는 데모 미리보기</div>
      <div class="care-pet-tabs" id="care-pet-tabs">
        <button class="care-pet-tab is-active">🐶 <span>초코 (데모)</span></button>
      </div>
      <div id="care-main-area"></div>`;
    content.innerHTML = tabsHtml;
    document.getElementById("demo-login-btn")?.addEventListener("click", () => window.PetAuth?.signInWithGoogle());

    await renderDemoArea(demoPet, document.getElementById("care-main-area"));

    document.querySelectorAll(".care-subtab").forEach(btn => {
      btn.addEventListener("click", async () => {
        _activeSubtab = btn.dataset.subtab;
        document.querySelectorAll(".care-subtab").forEach(b => b.classList.toggle("is-active", b === btn));
        await renderDemoArea(demoPet, document.getElementById("care-main-area"));
      });
    });
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
