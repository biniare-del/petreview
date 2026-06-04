const webpush = require("web-push");
const { createClient } = require("@supabase/supabase-js");

webpush.setVapidDetails(
  "mailto:admin@petreview.kr",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const db = createClient(
  "https://hguzornmqxayylmagook.supabase.co",
  process.env.SUPABASE_SERVICE_KEY
);

// 케어 항목 기본 주기 (일)
const CARE_DEFAULTS = {
  dog: { bath:14, heartworm:30, vaccine:365, grooming:42, teeth:1, ear:30, nail:21, deworming:90, checkup:365 },
  cat: { bath:30, heartworm:30, vaccine:365, grooming:60, teeth:1, ear:30, nail:14, deworming:90, checkup:365 },
};
const CARE_LABELS = {
  bath:"목욕", heartworm:"심장사상충", vaccine:"예방접종", grooming:"미용",
  teeth:"양치", ear:"귀청소", nail:"발톱", deworming:"구충제", checkup:"건강검진",
};

function speciesKey(s) { return s === "고양이" ? "cat" : "dog"; }

async function sendPush(sub, payload) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    );
    return true;
  } catch { return false; }
}

module.exports = async (req, res) => {
  if (!process.env.SUPABASE_SERVICE_KEY) return res.status(500).json({ error: "Service key missing" });

  // KST 기준 오늘
  const nowKST   = new Date(Date.now() + 9 * 3_600_000);
  const todayKST = new Date(Date.UTC(nowKST.getUTCFullYear(), nowKST.getUTCMonth(), nowKST.getUTCDate()));
  const todayM   = nowKST.getUTCMonth() + 1;
  const todayD   = nowKST.getUTCDate();

  // 1. 구독자 목록
  const { data: subs } = await db.from("push_subscriptions").select("user_id, endpoint, p256dh, auth");
  if (!subs?.length) return res.status(200).json({ ok: true, sent: 0 });

  const userIds = [...new Set(subs.map(s => s.user_id))];

  // 2. 해당 유저의 펫 목록
  const { data: pets } = await db.from("pets")
    .select("id, user_id, name, species, birth_date")
    .in("user_id", userIds);
  if (!pets?.length) return res.status(200).json({ ok: true, sent: 0 });

  const petIds = pets.map(p => p.id);

  // 3. 케어 로그 (최신 순)
  const { data: logs } = await db.from("pet_care_logs")
    .select("pet_id, care_key, done_at")
    .in("pet_id", petIds)
    .order("done_at", { ascending: false });

  // pet_id+care_key → 최신 done_at
  const latestLog = {};
  for (const l of (logs ?? [])) {
    const k = `${l.pet_id}_${l.care_key}`;
    if (!latestLog[k]) latestLog[k] = l.done_at;
  }

  // 4. 유저별로 오늘 해야 할 항목 계산
  const notifByUser = {}; // userId → [{ title, body, url }]

  for (const pet of pets) {
    const defaults = CARE_DEFAULTS[speciesKey(pet.species)];
    const dueToday = [];

    for (const [key, days] of Object.entries(defaults)) {
      const last = latestLog[`${pet.id}_${key}`];
      if (!last) continue; // 기록 없는 항목은 알림 제외

      const nextDue = new Date(new Date(last).getTime() + days * 86_400_000);
      nextDue.setUTCHours(0, 0, 0, 0);
      const dday = Math.round((nextDue - todayKST) / 86_400_000);
      if (dday === 0) dueToday.push(CARE_LABELS[key]);
    }

    if (dueToday.length) {
      const body = dueToday.length === 1
        ? `오늘 ${dueToday[0]} 해주세요! 🐾`
        : `오늘 ${dueToday[0]} 외 ${dueToday.length - 1}가지 케어가 있어요 🐾`;
      if (!notifByUser[pet.user_id]) notifByUser[pet.user_id] = [];
      notifByUser[pet.user_id].push({
        title: `${pet.name} 케어 시간이에요`,
        body,
        url: "/petreview/care.html",
      });
    }

    // 생일 체크
    if (pet.birth_date) {
      const d = new Date(pet.birth_date);
      if (d.getUTCMonth() + 1 === todayM && d.getUTCDate() === todayD) {
        if (!notifByUser[pet.user_id]) notifByUser[pet.user_id] = [];
        notifByUser[pet.user_id].push({
          title: `🎂 ${pet.name} 생일이에요!`,
          body: "오늘 특별하게 챙겨주세요 🎉",
          url: "/petreview/care.html",
        });
      }
    }
  }

  if (!Object.keys(notifByUser).length) return res.status(200).json({ ok: true, sent: 0 });

  // 5. 유저별 구독 맵
  const subsByUser = {};
  for (const sub of subs) {
    if (!subsByUser[sub.user_id]) subsByUser[sub.user_id] = [];
    subsByUser[sub.user_id].push(sub);
  }

  // 6. 발송
  let sent = 0;
  for (const [userId, notifs] of Object.entries(notifByUser)) {
    const userSubs = subsByUser[userId] ?? [];
    for (const sub of userSubs) {
      for (const notif of notifs) {
        if (await sendPush(sub, notif)) sent++;
      }
    }
  }

  res.status(200).json({ ok: true, sent });
};
