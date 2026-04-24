/**
 * Petreview Seed Data Generator
 *
 * Claude가 진짜 같은 한국어 컨텐츠를 생성해서 Supabase에 직접 삽입.
 * 병원 리뷰, 커뮤니티 글, 뽐내기 포스트 등.
 *
 * 사용법:
 *   node seed.js --reviews     → 리뷰 데이터 생성 (병원 ID 필요)
 *   node seed.js --community   → 커뮤니티 글/댓글 생성
 *   node seed.js --brag        → 뽐내기 포스트 생성
 *   node seed.js               → 전체 생성
 *
 * 주의: Supabase service_role 키 필요 (RLS 우회)
 *   export SUPABASE_SERVICE_KEY=eyJh...
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://hguzornmqxayylmagook.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_KEY) {
  console.error("❌ SUPABASE_SERVICE_KEY 환경변수가 필요합니다.");
  console.error("   Supabase 대시보드 → Settings → API → service_role 키를 복사해서:");
  console.error("   export SUPABASE_SERVICE_KEY=eyJh...");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY);
const ai = new Anthropic();

const args = process.argv.slice(2);
const NO_FLAGS = args.length === 0;
const DO_REVIEWS   = args.includes("--reviews")   || NO_FLAGS;
const DO_COMMUNITY = args.includes("--community")  || NO_FLAGS;
const DO_BRAG      = args.includes("--brag")       || NO_FLAGS;

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

async function generateJSON(prompt) {
  const msg = await ai.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });
  const text = msg.content[0].text;
  const match = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (!match) throw new Error("JSON 파싱 실패:\n" + text.slice(0, 300));
  return JSON.parse(match[1]);
}

// ─── 병원 리뷰 생성 ──────────────────────────────────────────────────────────

async function seedReviews() {
  console.log("\n📝 병원 리뷰 생성 중...");

  // 병원 목록 가져오기
  const { data: hospitals, error } = await db.from("hospitals").select("id, name").limit(20);
  if (error || !hospitals?.length) {
    console.log("  ⚠️  병원 데이터가 없습니다. 리뷰 생성 스킵.");
    return;
  }

  // 테스트용 사용자 ID (실제 auth.users에 존재해야 함)
  const { data: profiles } = await db.from("profiles").select("id").limit(10);
  if (!profiles?.length) {
    console.log("  ⚠️  사용자 데이터가 없습니다. 먼저 테스트 계정으로 가입해주세요.");
    return;
  }

  const userIds = profiles.map(p => p.id);

  for (const hospital of hospitals.slice(0, 5)) {
    console.log(`  병원: ${hospital.name}`);

    const reviews = await generateJSON(`
당신은 반려동물 보호자입니다. "${hospital.name}" 동물병원에 대한 현실적인 한국어 리뷰 5개를 생성해주세요.
각 리뷰는 실제 보호자가 쓴 것처럼 구어체로, 다양한 의견(긍정/부정/보통)을 포함해야 합니다.

JSON 배열로만 응답하세요:
[
  {
    "content": "리뷰 내용 (2~5문장, 구어체)",
    "score_kindness": 1~5 정수,
    "score_price": 1~5 정수,
    "score_facility": 1~5 정수,
    "score_waiting": 1~5 정수,
    "visit_type": "진료" | "예방접종" | "미용" | "건강검진" | "수술",
    "pet_species": "강아지" | "고양이" | "기타"
  }
]
`);

    for (const r of reviews) {
      const userId = userIds[Math.floor(Math.random() * userIds.length)];
      const { error: insertErr } = await db.from("reviews").insert({
        hospital_id: hospital.id,
        user_id: userId,
        content: r.content,
        score_kindness: r.score_kindness,
        score_price: r.score_price,
        score_facility: r.score_facility,
        score_waiting: r.score_waiting,
        visit_type: r.visit_type,
        pet_species: r.pet_species,
        is_verified: false,
      });
      if (insertErr) console.log(`    ⚠️  삽입 오류: ${insertErr.message}`);
      else process.stdout.write(".");
    }
    console.log();
  }
  console.log("  ✅ 리뷰 생성 완료");
}

// ─── 커뮤니티 글 생성 ────────────────────────────────────────────────────────

async function seedCommunity() {
  console.log("\n💬 커뮤니티 글 생성 중...");

  const { data: profiles } = await db.from("profiles").select("id").limit(10);
  if (!profiles?.length) {
    console.log("  ⚠️  사용자 데이터가 없습니다.");
    return;
  }
  const userIds = profiles.map(p => p.id);

  const posts = await generateJSON(`
반려동물 커뮤니티 앱의 게시글 20개를 생성해주세요.
한국 반려동물 보호자들이 실제로 올릴 법한 다양한 주제로 작성해주세요.
(강아지/고양이 건강, 음식 추천, 병원 후기, 귀여운 사진 자랑, 훈련 팁, 고민 상담 등)

JSON 배열로만 응답하세요:
[
  {
    "title": "게시글 제목",
    "content": "본문 내용 (3~8문장, 자연스러운 구어체)",
    "category": "자유" | "질문" | "정보" | "자랑" | "고민",
    "pet_species": "강아지" | "고양이" | "전체"
  }
]
`);

  for (const post of posts) {
    const userId = userIds[Math.floor(Math.random() * userIds.length)];
    const { data: inserted, error } = await db.from("posts").insert({
      user_id: userId,
      title: post.title,
      content: post.content,
      category: post.category,
      pet_species: post.pet_species,
    }).select("id").single();

    if (error) { console.log(`  ⚠️  ${error.message}`); continue; }
    process.stdout.write(".");

    // 댓글 2~4개 추가
    const comments = await generateJSON(`
다음 게시글에 달릴 법한 자연스러운 한국어 댓글 ${2 + Math.floor(Math.random() * 3)}개를 만들어주세요.
게시글: "${post.title}"

JSON 배열로만:
[{ "content": "댓글 내용 (1~2문장)" }]
`);

    for (const c of comments) {
      const cUserId = userIds[Math.floor(Math.random() * userIds.length)];
      await db.from("comments").insert({
        post_id: inserted.id,
        user_id: cUserId,
        content: c.content,
      });
    }
  }
  console.log("\n  ✅ 커뮤니티 글 생성 완료");
}

// ─── 뽐내기 포스트 생성 ──────────────────────────────────────────────────────

async function seedBrag() {
  console.log("\n🏅 뽐내기 포스트 생성 중...");

  const { data: profiles } = await db.from("profiles").select("id").limit(10);
  if (!profiles?.length) {
    console.log("  ⚠️  사용자 데이터가 없습니다.");
    return;
  }
  const userIds = profiles.map(p => p.id);

  // 공개 이미지 URL (플레이스홀더 — 실제 배포 시 교체)
  const placeholderPhotos = [
    "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400",
    "https://images.unsplash.com/photo-1548681528-6a5c45b66b42?w=400",
    "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400",
    "https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=400",
    "https://images.unsplash.com/photo-1552053831-71594a27632d?w=400",
    "https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=400",
  ];

  const captions = await generateJSON(`
반려동물 자랑 SNS 게시물 캡션 15개를 한국어로 생성해주세요.
귀엽고 자랑스럽고 애교 넘치는 내용으로, 이모지 포함.
강아지/고양이 자랑, 병원 다녀온 후 건강해진 모습, 첫 목욕, 간식 먹는 중 등 다양하게.

JSON 배열로만:
[{ "caption": "캡션 내용", "pet_species": "강아지" | "고양이" }]
`);

  for (const item of captions) {
    const userId = userIds[Math.floor(Math.random() * userIds.length)];
    const photoCount = 1 + Math.floor(Math.random() * 2);
    const photos = Array.from({ length: photoCount }, () =>
      placeholderPhotos[Math.floor(Math.random() * placeholderPhotos.length)]
    );

    const { error } = await db.from("brag_posts").insert({
      user_id: userId,
      photo_urls: photos,
      caption: item.caption,
      like_count: Math.floor(Math.random() * 30),
    });
    if (error) console.log(`  ⚠️  ${error.message}`);
    else process.stdout.write(".");
  }
  console.log("\n  ✅ 뽐내기 포스트 생성 완료");
}

// ─── 실행 ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Petreview 시드 데이터 생성기 시작\n");
  console.log(`모드: ${[DO_REVIEWS && "리뷰", DO_COMMUNITY && "커뮤니티", DO_BRAG && "뽐내기"].filter(Boolean).join(" + ")}`);
  console.log("─".repeat(60));

  if (DO_REVIEWS)   await seedReviews();
  if (DO_COMMUNITY) await seedCommunity();
  if (DO_BRAG)      await seedBrag();

  console.log("\n🎉 시드 데이터 생성 완료!");
}

main().catch(err => {
  console.error("오류:", err.message);
  process.exit(1);
});
