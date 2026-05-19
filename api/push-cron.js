const webpush = require("web-push");
const { createClient } = require("@supabase/supabase-js");

webpush.setVapidDetails(
  "mailto:admin@petreview.kr",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const SUPABASE_URL = "https://hguzornmqxayylmagook.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

module.exports = async (req, res) => {
  if (!SUPABASE_SERVICE_KEY) return res.status(500).json({ error: "Service key missing" });

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const today = new Date().toISOString().split("T")[0];

  // 오늘 기준 기한 초과 또는 오늘인 건강기록 조회
  const { data: records } = await db
    .from("pet_health_records")
    .select("user_id, record_type, content, next_due_date")
    .lte("next_due_date", today)
    .not("next_due_date", "is", null);

  // user_id 기준으로 그룹핑 (건강기록 알림)
  const byUser = {};
  (records || []).forEach(r => {
    if (!byUser[r.user_id]) byUser[r.user_id] = [];
    byUser[r.user_id].push(r);
  });

  // 생일인 펫 조회
  const { data: allPets } = await db
    .from("pets")
    .select("id, name, user_id, birth_date")
    .not("birth_date", "is", null);

  const nowKST = new Date(Date.now() + 9 * 3600 * 1000);
  const todayM = nowKST.getUTCMonth() + 1;
  const todayD = nowKST.getUTCDate();

  (allPets || []).forEach(pet => {
    const d = new Date(pet.birth_date);
    if (d.getUTCMonth() + 1 === todayM && d.getUTCDate() === todayD) {
      if (!byUser[pet.user_id]) byUser[pet.user_id] = [];
      byUser[pet.user_id].push({ _birthday: true, name: pet.name });
    }
  });

  if (!Object.keys(byUser).length) return res.status(200).json({ ok: true, sent: 0 });

  let sent = 0;
  for (const [userId, items] of Object.entries(byUser)) {
    const { data: subs } = await db
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId);

    if (!subs?.length) continue;

    const healthItems = items.filter(i => !i._birthday);
    const birthdayItems = items.filter(i => i._birthday);

    const notifications = [];
    if (healthItems.length) {
      const labels = healthItems.map(r => `${r.record_type}${r.content ? ` (${r.content})` : ""}`);
      notifications.push({ title: "🐾 우쭈쭈 건강 알림", body: `기한이 됐어요: ${labels.join(", ")}`, url: "/petreview/mypage.html#pets" });
    }
    if (birthdayItems.length) {
      birthdayItems.forEach(p => {
        notifications.push({ title: "🎂 생일 축하해요!", body: `${p.name}의 생일이에요! 오늘 특별하게 챙겨주세요 🎉`, url: "/petreview/care.html" });
      });
    }

    for (const sub of subs) {
      for (const notif of notifications) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify(notif)
          );
          sent++;
        } catch { /* expired subscription 무시 */ }
      }
    }
  }

  res.status(200).json({ ok: true, sent });
};
