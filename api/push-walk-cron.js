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

  // KST 기준 오늘 00:00
  const nowKST = new Date(Date.now() + 9 * 3600 * 1000);
  const todayKST = new Date(Date.UTC(nowKST.getUTCFullYear(), nowKST.getUTCMonth(), nowKST.getUTCDate()));

  // 강아지만 대상 (고양이는 산책 필수 아님)
  const { data: dogs } = await db
    .from("pets")
    .select("id, name, user_id, species")
    .eq("species", "강아지");

  if (!dogs?.length) return res.status(200).json({ ok: true, sent: 0 });

  const dogIds = dogs.map(d => d.id);

  // 오늘 산책 기록이 있는 pet_id 목록
  const { data: walkedToday } = await db
    .from("pet_care_logs")
    .select("pet_id")
    .eq("care_key", "walk")
    .gte("done_at", todayKST.toISOString())
    .in("pet_id", dogIds);

  const walkedSet = new Set((walkedToday || []).map(r => r.pet_id));
  const unwalkdDogs = dogs.filter(d => !walkedSet.has(d.id));

  if (!unwalkdDogs.length) return res.status(200).json({ ok: true, sent: 0 });

  // user_id별 그룹핑
  const byUser = {};
  unwalkdDogs.forEach(dog => {
    if (!byUser[dog.user_id]) byUser[dog.user_id] = [];
    byUser[dog.user_id].push(dog.name);
  });

  let sent = 0;
  for (const [userId, names] of Object.entries(byUser)) {
    const { data: subs } = await db
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId);

    if (!subs?.length) continue;

    const body = names.length === 1
      ? `${names[0]}이(가) 오늘 아직 산책을 못 했어요 🐾`
      : `${names.join(", ")} 오늘 산책 기록이 없어요 🐾`;

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: "🦮 산책 시간이에요!", body, url: "/petreview/care.html" })
        );
        sent++;
      } catch { /* expired subscription 무시 */ }
    }
  }

  res.status(200).json({ ok: true, sent });
};
