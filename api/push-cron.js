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

  if (!records?.length) return res.status(200).json({ ok: true, sent: 0 });

  // user_id 기준으로 그룹핑
  const byUser = {};
  records.forEach(r => {
    if (!byUser[r.user_id]) byUser[r.user_id] = [];
    byUser[r.user_id].push(r);
  });

  let sent = 0;
  for (const [userId, recs] of Object.entries(byUser)) {
    const { data: subs } = await db
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId);

    if (!subs?.length) continue;

    const labels = recs.map(r => `${r.record_type}${r.content ? ` (${r.content})` : ""}`);
    const body = `기한이 됐어요: ${labels.join(", ")}`;

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: "🐾 펫리뷰 건강 알림", body, url: "/petreview/mypage.html#pets" })
        );
        sent++;
      } catch { /* expired subscription 무시 */ }
    }
  }

  res.status(200).json({ ok: true, sent });
};
