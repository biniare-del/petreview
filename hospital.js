const CATEGORY_LABEL = { hospital: "동물병원", grooming: "미용샵" };

const SCORE_FIELDS = [
  { key: "score_kindness", label: "친절도" },
  { key: "score_price",    label: "진료비 수준" },
  { key: "score_facility", label: "시설 청결도" },
  { key: "score_wait",     label: "대기시간" },
];

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getParams() {
  const p = new URLSearchParams(location.search);
  return {
    kakaoId:  p.get("kakao_id") || "",
    name:     p.get("name")     || "",
    city:     p.get("city")     || "서울",
    region:   p.get("region")   || "",
    category: p.get("category") || "hospital",
    address:  p.get("address")  || "",
    phone:    p.get("phone")    || "",
  };
}

function starStars(avg) {
  const full = Math.round(avg);
  return "★".repeat(full) + "☆".repeat(5 - full);
}

function renderHero(place, totalCount, verifiedCount, overallAvg) {
  const catLabel = CATEGORY_LABEL[place.category] || place.category;
  const locationStr = [place.city, place.region].filter(Boolean).join(" ");
  const mapQ = encodeURIComponent(`${locationStr} ${place.name}`);
  const mapUrl = `https://map.naver.com/v5/search/${mapQ}`;
  const hospitalUrl = location.href;
  const writeUrl = `index.html?prefill_name=${encodeURIComponent(place.name)}&prefill_city=${encodeURIComponent(place.city)}&prefill_region=${encodeURIComponent(place.region)}&prefill_category=${encodeURIComponent(place.category)}${place.kakaoId ? `&prefill_kakao_id=${encodeURIComponent(place.kakaoId)}` : ""}`;

  return `
    <div class="hospital-hero">
      <span class="hospital-category-badge">${escapeHtml(catLabel)}</span>
      <h2 class="hospital-name">${escapeHtml(place.name)}</h2>
      <p class="hospital-region">${escapeHtml(locationStr)}${place.address ? " · " + escapeHtml(place.address) : ""}</p>
      ${place.phone ? `<p style="font-size:13px;color:#555;margin:0 0 4px;">📞 <a href="tel:${escapeHtml(place.phone)}" style="color:#16a34a;text-decoration:none;">${escapeHtml(place.phone)}</a></p>` : ""}
      ${overallAvg > 0 ? `<p style="font-size:18px;color:#f59e0b;margin:6px 0 0;">${starStars(overallAvg)} <span style="font-size:14px;color:#555;vertical-align:middle;">${overallAvg.toFixed(1)}</span></p>` : ""}
      <div class="hospital-actions">
        <a href="${mapUrl}" target="_blank" rel="noopener" class="map-link-btn">🗺️ 지도 보기</a>
        <button id="share-btn" class="map-link-btn">📤 공유하기</button>
      </div>
    </div>

    <div class="hospital-stat-row">
      <div class="hospital-stat-card">
        <div class="hospital-stat-num">${totalCount}</div>
        <div class="hospital-stat-label">전체 리뷰</div>
      </div>
      <div class="hospital-stat-card">
        <div class="hospital-stat-num">${verifiedCount}</div>
        <div class="hospital-stat-label">영수증 인증</div>
      </div>
      <div class="hospital-stat-card">
        <div class="hospital-stat-num">${overallAvg > 0 ? overallAvg.toFixed(1) : "-"}</div>
        <div class="hospital-stat-label">평균 별점</div>
      </div>
    </div>

    <a href="${writeUrl}" class="write-review-btn">✍️ 이 병원 후기 남기기</a>
  `;
}

function renderScoreSection(data) {
  const sums = {}, counts = {};
  data.forEach((r) => {
    SCORE_FIELDS.forEach(({ key }) => {
      if (r[key]) {
        sums[key]   = (sums[key]   || 0) + r[key];
        counts[key] = (counts[key] || 0) + 1;
      }
    });
  });

  const rows = SCORE_FIELDS
    .filter(({ key }) => counts[key] > 0)
    .map(({ key, label }) => {
      const avg = (sums[key] / counts[key]).toFixed(1);
      return `
        <div class="score-row">
          <span class="score-label">${label}</span>
          <div class="score-bar-wrap"><div class="score-bar" style="width:${avg * 20}%"></div></div>
          <span class="score-val">${avg}</span>
        </div>`;
    });

  if (!rows.length) return "";
  return `
    <div class="score-section">
      <h3>항목별 평균 별점</h3>
      <div class="card-scores">${rows.join("")}</div>
    </div>`;
}

function renderPriceTable(data) {
  const groups = {};
  data.forEach((r) => {
    if (r.service_detail && r.total_price) {
      if (!groups[r.service_detail]) groups[r.service_detail] = [];
      groups[r.service_detail].push(Number(r.total_price));
    }
  });

  const rows = Object.entries(groups)
    .filter(([, prices]) => prices.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([service, prices]) => {
      const avg = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const rangeHtml = min !== max
        ? `<br><span style="font-size:11px;color:#aaa;">₩ ${min.toLocaleString("ko-KR")} ~ ${max.toLocaleString("ko-KR")}</span>`
        : "";
      return `<tr>
        <td>${escapeHtml(service)}</td>
        <td>₩ ${avg.toLocaleString("ko-KR")}${rangeHtml}</td>
        <td>${prices.length}건</td>
      </tr>`;
    });

  if (!rows.length) return "";
  return `
    <div class="score-section">
      <h3>진료항목별 진료비</h3>
      <table class="price-table">
        <thead><tr><th>항목</th><th>평균 (범위)</th><th>리뷰 수</th></tr></thead>
        <tbody>${rows.join("")}</tbody>
      </table>
    </div>`;
}

function renderReviewList(data) {
  if (!data.length) {
    return '<p class="placeholder-text">아직 인증된 리뷰가 없습니다.</p>';
  }
  return data.map((r) => `
    <div class="hospital-review-card">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span class="verified-badge">✔ 영수증 인증</span>
        <span style="font-size:12px;color:#aaa;">${escapeHtml(r.visit_date || "")}</span>
      </div>
      <p class="hospital-review-meta">${escapeHtml(r.service_detail || "")}</p>
      <p class="hospital-review-text">${escapeHtml(r.short_review || "")}</p>
      ${r.pet_photo_url ? `<img src="${escapeHtml(r.pet_photo_url)}" class="review-thumb" alt="반려동물 사진" style="margin-top:8px;border-radius:10px;max-width:100%;" />` : ""}
      ${r.total_price ? `<span class="hospital-review-price">₩ ${Number(r.total_price).toLocaleString("ko-KR")}</span>` : ""}
    </div>`).join("");
}

function bindShare(place) {
  const btn = document.getElementById("share-btn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const locationStr = [place.city, place.region].filter(Boolean).join(" ");
    const catLabel = CATEGORY_LABEL[place.category] || place.category;
    const url = location.href;
    const text = `📍 ${place.name}\n${catLabel} · ${locationStr}\n\n펫리뷰에서 실제 후기를 확인하세요`;
    if (navigator.share) {
      try { await navigator.share({ title: `펫리뷰 - ${place.name}`, text, url }); }
      catch { /* user cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        btn.textContent = "✅ 복사됨!";
        setTimeout(() => { btn.textContent = "📤 공유하기"; }, 2000);
      } catch {
        alert("공유 기능을 지원하지 않는 브라우저입니다.");
      }
    }
  });
}

async function loadHospitalPage() {
  const place = getParams();
  if (!place.name) {
    document.getElementById("hospital-content").innerHTML =
      '<p class="placeholder-text" style="margin-top:40px;">병원 정보가 없습니다.</p>';
    return;
  }

  // 동적 타이틀/OG 업데이트
  document.title = `${place.name} – 펫리뷰`;
  const locationStr = [place.city, place.region].filter(Boolean).join(" ");
  document.getElementById("og-title")?.setAttribute("content", `${place.name} 후기 – 펫리뷰`);
  document.getElementById("og-description")?.setAttribute("content", `${locationStr} ${place.name}의 실제 영수증 인증 후기`);
  document.getElementById("og-url")?.setAttribute("content", location.href);

  const db = window.supabaseClient;
  if (!db) {
    document.getElementById("hospital-content").innerHTML =
      '<p class="placeholder-text">데이터베이스 연결 실패</p>';
    return;
  }

  let data = [];
  try {
    let q = db.from("reviews").select("*");
    if (place.kakaoId) {
      q = q.eq("kakao_place_id", place.kakaoId);
    } else {
      q = q.eq("place_name", place.name);
    }
    let { data: rows, error } = await q.eq("is_verified", true).eq("status", "approved")
      .order("created_at", { ascending: false });
    // kakao_place_id 컬럼 없으면 place_name fallback
    if (error && (error.code === "PGRST200" || error.message?.includes("kakao_place_id"))) {
      ({ data: rows, error } = await db.from("reviews").select("*")
        .eq("place_name", place.name).eq("is_verified", true).eq("status", "approved")
        .order("created_at", { ascending: false }));
    }
    if (error) throw error;
    data = rows || [];
  } catch (err) {
    console.error("[펫리뷰] hospital 리뷰 로드 실패:", err);
  }

  // 전체 리뷰 수 (미인증 포함)
  let totalCount = data.length;
  try {
    let cq = db.from("reviews").select("id", { count: "exact", head: true });
    if (place.kakaoId) { cq = cq.eq("kakao_place_id", place.kakaoId); }
    else { cq = cq.eq("place_name", place.name); }
    const { count } = await cq.eq("status", "approved");
    if (count != null) totalCount = count;
  } catch { /* ignore */ }

  const verifiedCount = data.length;

  // 전체 별점 평균
  const allScores = data.flatMap((r) =>
    SCORE_FIELDS.map(({ key }) => r[key]).filter(Boolean)
  );
  const overallAvg = allScores.length
    ? allScores.reduce((s, v) => s + v, 0) / allScores.length
    : 0;

  const html = `
    ${renderHero(place, totalCount, verifiedCount, overallAvg)}
    ${renderScoreSection(data)}
    ${renderPriceTable(data)}
    <div class="review-section">
      <h3>인증 후기 (${verifiedCount}건)</h3>
      ${renderReviewList(data)}
    </div>
  `;

  document.getElementById("hospital-content").innerHTML = html;
  bindShare(place);
}

// auth.js 로드 후 실행
window.addEventListener("DOMContentLoaded", () => {
  window.PetAuth?.init(() => {}).catch(() => {});
  loadHospitalPage();
});
