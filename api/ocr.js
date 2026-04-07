// Vercel 서버리스 – 영수증 OCR (Claude Vision API)
// POST /api/ocr
// Body: { imageBase64: string, mimeType: string }
// Response: { date: "YYYY-MM-DD" | null, amount: number | null }

export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
};

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { imageBase64, mimeType } = req.body ?? {};
  if (!imageBase64) {
    console.error("[ocr] imageBase64 없음 - 요청 body:", JSON.stringify(req.body ?? {}).slice(0, 200));
    return res.status(400).json({ error: "imageBase64 required" });
  }

  console.log(`[ocr] 요청 수신 - mimeType: ${mimeType}, base64 길이: ${imageBase64.length}`);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[ocr] ANTHROPIC_API_KEY 환경변수 없음");
    return res.status(200).json({ date: null, amount: null });
  }

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 256,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mimeType || "image/jpeg",
                  data: imageBase64,
                },
              },
              {
                type: "text",
                text: '이 영수증에서 방문날짜와 총 결제금액만 추출해줘. JSON으로 {"date": "YYYY-MM-DD", "amount": 숫자} 형식으로만 응답해. 날짜나 금액을 찾을 수 없으면 해당 값을 null로 해.',
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[ocr] Anthropic API 오류 - status: ${response.status}, body: ${errText}`);
      return res.status(200).json({ date: null, amount: null });
    }

    const json = await response.json();
    const text = json?.content?.[0]?.text?.trim() ?? "";
    console.log("[ocr] Claude 응답 텍스트:", text);

    // JSON 블록 추출 (```json ... ``` 혹은 {} 형태 모두 처리)
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) {
      console.error("[ocr] JSON 블록 추출 실패 - 원문:", text);
      return res.status(200).json({ date: null, amount: null });
    }

    let parsed;
    try {
      parsed = JSON.parse(match[0]);
    } catch (parseErr) {
      console.error("[ocr] JSON 파싱 실패 - match:", match[0], "error:", parseErr.message);
      return res.status(200).json({ date: null, amount: null });
    }

    console.log("[ocr] 파싱 결과:", parsed);

    const date = typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
      ? parsed.date
      : null;
    const amount = typeof parsed.amount === "number" && parsed.amount > 0
      ? Math.round(parsed.amount)
      : null;

    console.log(`[ocr] 최종 결과 - date: ${date}, amount: ${amount}`);
    return res.status(200).json({ date, amount });
  } catch (err) {
    console.error("[ocr] 처리 중 예외 발생:", err.message, err.stack);
    return res.status(200).json({ date: null, amount: null });
  }
}
