const webpush = require("web-push");

webpush.setVapidDetails(
  "mailto:admin@petreview.kr",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { subscription, title, body, url } = req.body || {};
  if (!subscription?.endpoint) return res.status(400).json({ error: "Invalid subscription" });

  const payload = JSON.stringify({ title: title || "펫리뷰", body: body || "", url: url || "/" });

  try {
    await webpush.sendNotification(subscription, payload);
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
