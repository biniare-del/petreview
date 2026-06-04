const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `당신은 반려동물 전문 AI 건강 파트너입니다.
집사가 입력한 오늘의 케어·식단·체중·건강기록 데이터를 분석해서 가장 중요한 조언을 드립니다.

답변 규칙:
- 인사말·서론 없이 바로 핵심 조언으로 시작
- 4~6줄 이내, 따뜻하고 실용적인 말투
- 기간 초과·오늘 해야 할 항목이 있으면 그것부터 먼저
- 체중 추이가 있으면 증감 패턴에 맞게 식단·운동 조언 포함
- 최근 건강기록(진료·투약)이 있으면 연속성 있는 관리 조언
- 반려동물 이름을 자연스럽게 사용
- 구체적이고 실행 가능한 내용만`;

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "API key missing" });

  const { pet, careItems, dietToday, dietSettings, healthData } = req.body ?? {};
  if (!pet) return res.status(400).json({ error: "pet required" });

  // 케어 현황 — 급한 순서로 정렬
  const sorted = (careItems ?? []).slice().sort((a, b) => (a.dday ?? 999) - (b.dday ?? 999));
  const overdue = sorted.filter(c => c.dday !== null && c.dday < 0);
  const today   = sorted.filter(c => c.dday === 0);
  const soon    = sorted.filter(c => c.dday !== null && c.dday > 0 && c.dday <= 7);

  const careLines = sorted.map(({ label, dday }) => {
    if (dday === null)  return `- ${label}: 미기록`;
    if (dday < 0)       return `- ${label}: ${Math.abs(dday)}일 초과 ⚠️`;
    if (dday === 0)     return `- ${label}: 오늘 해야 함`;
    if (dday <= 7)      return `- ${label}: D-${dday}`;
    return `- ${label}: D-${dday}`;
  }).join("\n");

  // 수분 — 정성적 레벨 처리 (good/ok/low)
  const waterLog  = (dietToday ?? []).find(l => l.log_type === "water" && ["good","ok","low"].includes(l.note));
  const waterText = waterLog
    ? ({ good: "충분히 마심 ✓", ok: "보통", low: "적게 마심 (주의)" }[waterLog.note])
    : "미기록";

  const mealsPerDay  = dietSettings?.meals_per_day ?? 2;
  const mealsLogged  = (dietToday ?? []).filter(l => l.log_type === "meal").length;
  const snackCount   = (dietToday ?? []).filter(l => l.log_type === "snack").length;
  const foodName     = dietSettings?.food_name ?? null;
  const foodAmount   = dietSettings?.food_amount_g ?? null;

  const dietLines = [
    `- 식사: ${mealsLogged}/${mealsPerDay}끼${foodName ? ` (${foodName}${foodAmount ? ` ${foodAmount}g` : ""})` : ""}`,
    `- 수분: ${waterText}`,
    snackCount > 0 ? `- 간식: ${snackCount}회` : null,
  ].filter(Boolean).join("\n");

  const urgencyNote = overdue.length
    ? `\n기간 초과: ${overdue.map(c => c.label).join(", ")}`
    : today.length
    ? `\n오늘 해야 할 것: ${today.map(c => c.label).join(", ")}`
    : soon.length
    ? `\n곧 필요한 것: ${soon.map(c => c.label).join(", ")}`
    : "";

  // 체중 추이
  const weights = healthData?.weights ?? [];
  let weightSection = "";
  if (weights.length >= 2) {
    const latest = weights[0];
    const oldest = weights[weights.length - 1];
    const diff   = (latest.weight - oldest.weight).toFixed(1);
    const trend  = diff > 0 ? `+${diff}kg 증가 추세` : diff < 0 ? `${diff}kg 감소 추세` : "체중 변화 없음";
    const history = weights.slice(0, 4).map(w => `${w.weight}kg`).join(" → ");
    weightSection = `\n체중 추이: ${history} [${trend}]`;
  } else if (weights.length === 1) {
    weightSection = `\n최근 체중: ${weights[0].weight}kg`;
  }

  // 최근 건강기록 (5개 이내)
  const records = healthData?.healthRecords ?? [];
  let healthSection = "";
  if (records.length) {
    const lines = records.slice(0, 5).map(r =>
      `- [${r.record_type}] ${r.content}${r.record_date ? ` (${r.record_date.slice(0,10)})` : ""}`
    ).join("\n");
    healthSection = `\n최근 건강기록:\n${lines}`;
  }

  const userPrompt = `${pet.name} (${pet.species}${pet.breed ? `, ${pet.breed}` : ""}) 오늘 현황:${urgencyNote}${weightSection}${healthSection}

케어 상태:
${careLines || "- 케어 데이터 없음"}

오늘 식단:
${dietLines}`;

  try {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-cache");

    const stream = client.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userPrompt }],
    });

    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta" && chunk.delta?.type === "text_delta") {
        res.write(chunk.delta.text);
      }
    }
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.end();
    }
  }
};
