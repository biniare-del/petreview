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

  // 최근 1시간 이내 등록된 리뷰
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: newReviews } = await db
    .from("reviews")
    .select("id, place_name, category, user_id, short_review")
    .gte("created_at", since)
    .eq("status", "approved");

  if (!newReviews?.length) return res.status(200).json({ ok: true, sent: 0 });

  // 신규 리뷰가 올라온 병원 이름 목록
  const placeNames = [...new Set(newReviews.map(r => r.place_name).filter(Boolean))];

  // 해당 병원을 단골로 등록한 사용자 조회 (리뷰 작성자 본인 제외)
  const { data: favs } = await db
    .from("favorites")
    .select("user_id, place_name")
    .in("place_name", placeNames);

  if (!favs?.length) return res.status(200).json({ ok: true, sent: 0 });

  // place_name → 최신 리뷰 매핑
  const reviewByPlace = {};
  newReviews.forEach(r => { if (!reviewByPlace[r.place_name]) reviewByPlace[r.place_name] = r; });

  // user_id → 알림 대상 병원 목록
  const userNotifyMap = {};
  favs.forEach(f => {
    const review = reviewByPlace[f.place_name];
    if (!review) return;
    if (review.user_id === f.user_id) return; // 본인 리뷰는 제외
    if (!userNotifyMap[f.user_id]) userNotifyMap[f.user_id] = [];
    userNotifyMap[f.user_id].push({ place_name: f.place_name, review });
  });

  let sent = 0;
  for (const [userId, items] of Object.entries(userNotifyMap)) {
    const { data: subs } = await db
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId);

    if (!subs?.length) continue;

    const place = items[0].place_name;
    const preview = items[0].review.short_review?.substring(0, 30) || "새 리뷰가 등록됐어요.";
    const body = items.length > 1
      ? `단골병원 ${items.length}곳에 새 리뷰가 등록됐어요.`
      : `"${preview}"`;

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: `🏥 ${place} 새 리뷰`,
            body,
            url: `/petreview/?place=${encodeURIComponent(place)}`,
          })
        );
        sent++;
      } catch { /* 만료된 구독 무시 */ }
    }
  }

  res.status(200).json({ ok: true, sent });
};
