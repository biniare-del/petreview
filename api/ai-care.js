const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "API key missing" });

  const { pet, careItems, dietToday, dietSettings } = req.body ?? {};
  if (!pet) return res.status(400).json({ error: "pet required" });

  // 케어 현황 텍스트 구성
  const careLines = (careItems ?? []).map(({ label, dday }) => {
    if (dday === null) return `- ${label}: 기록 없음`;
    if (dday < 0) return `- ${label}: ${Math.abs(dday)}일 지남 (⚠️ 초과)`;
    if (dday === 0) return `- ${label}: 오늘`;
    return `- ${label}: ${dday}일 후`;
  }).join("\n");

  // 식단 현황 텍스트 구성
  const mealsPerDay = dietSettings?.meals_per_day ?? 2;
  const mealsLogged = dietToday?.filter(l => l.log_type === "meal").length ?? 0;
  const waterTotal  = (dietToday ?? []).filter(l => l.log_type === "water").reduce((s, l) => s + (l.water_ml ?? 0), 0);
  const waterTarget = dietSettings?.water_target_ml ?? 300;
  const snackCount  = (dietToday ?? []).filter(l => l.log_type === "snack").length;
  const foodName    = dietSettings?.food_name ?? null;
  const foodAmount  = dietSettings?.food_amount_g ?? null;

  const dietLines = [
    `- 식사: ${mealsLogged}/${mealsPerDay}끼 완료${foodName ? ` (${foodName}${foodAmount ? ` ${foodAmount}g/회` : ""})` : ""}`,
    `- 물 섭취: ${waterTotal}ml / 목표 ${waterTarget}ml`,
    `- 간식: ${snackCount}회`,
  ].join("\n");

  const prompt = `당신은 친근한 반려동물 건강 파트너입니다.
아래 정보를 바탕으로 오늘 가장 중요한 것 1~2가지를 골라 따뜻하고 짧게(3~4줄) 알려주세요.
불필요한 인사말이나 서론 없이 바로 핵심만 말해주세요.

반려동물:
- 이름: ${pet.name}
- 종: ${pet.species}${pet.breed ? ` (${pet.breed})` : ""}

케어 현황 (오늘 기준 D-day):
${careLines || "- 케어 기록 없음"}

오늘 식단:
${dietLines}`;

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content?.[0]?.text ?? "";
    res.status(200).json({ ok: true, text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
