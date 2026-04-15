// 네이버 OAuth 콜백 핸들러
// Supabase가 Naver를 공식 지원하지 않아 직접 구현
//
// 환경변수 (Vercel 대시보드 → Settings → Environment Variables):
//   NAVER_CLIENT_ID          : 네이버 개발자센터 Client ID
//   NAVER_CLIENT_SECRET      : 네이버 개발자센터 Client Secret
//   SUPABASE_SERVICE_ROLE_KEY: Supabase Settings → API → service_role key

const SUPABASE_URL = "https://hguzornmqxayylmagook.supabase.co";
const SITE_URL = "https://biniare-del.github.io/petreview/";
const REDIRECT_URI = "https://petreview.vercel.app/api/naver-callback";

export default async function handler(req, res) {
  const { code, state, error } = req.query;

  if (error || !code) {
    return res.redirect(`${SITE_URL}?login_error=cancelled`);
  }

  const CLIENT_ID = process.env.NAVER_CLIENT_ID;
  const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!CLIENT_ID || !CLIENT_SECRET || !SERVICE_KEY) {
    console.error("Missing environment variables");
    return res.redirect(`${SITE_URL}?login_error=server_config`);
  }

  try {
    // 1. 네이버 인가코드 → 액세스 토큰 교환
    const tokenUrl = new URL("https://nid.naver.com/oauth2.0/token");
    tokenUrl.searchParams.set("grant_type", "authorization_code");
    tokenUrl.searchParams.set("client_id", CLIENT_ID);
    tokenUrl.searchParams.set("client_secret", CLIENT_SECRET);
    tokenUrl.searchParams.set("code", code);
    tokenUrl.searchParams.set("state", state || "");

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("Token error:", tokenData);
      return res.redirect(`${SITE_URL}?login_error=naver_token`);
    }

    // 2. 네이버 회원 정보 조회
    const userRes = await fetch("https://openapi.naver.com/v1/nid/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json();
    const naver = userData.response;

    if (!naver?.id) {
      console.error("User info error:", userData);
      return res.redirect(`${SITE_URL}?login_error=naver_user`);
    }

    // 네이버 ID 기반 가상 이메일 (고정값 → 재로그인 시 같은 계정)
    const virtualEmail = `naver_${naver.id}@naver.petreview`;
    const nickname = naver.nickname || naver.name || "네이버회원";
    const avatarUrl = naver.profile_image || null;

    const adminHeaders = {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    };

    // 3. Supabase 유저 생성 (이미 있으면 오류 무시)
    const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        email: virtualEmail,
        email_confirm: true,
        user_metadata: {
          full_name: nickname,
          avatar_url: avatarUrl,
          provider: "naver",
        },
      }),
    });
    const createData = await createRes.json();

    // 신규 유저면 profiles 테이블에도 생성
    if (createData.id) {
      await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
        method: "POST",
        headers: {
          ...adminHeaders,
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          id: createData.id,
          nickname,
          avatar_url: avatarUrl,
        }),
      });
    }

    // 4. 매직링크 생성 → 브라우저가 직접 따라감 (implicit flow 호환)
    const linkRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        type: "magiclink",
        email: virtualEmail,
        options: { redirect_to: SITE_URL },
      }),
    });
    const linkData = await linkRes.json();

    const actionLink = linkData.action_link;
    if (!actionLink) {
      console.error("Generate link failed:", JSON.stringify(linkData));
      return res.redirect(`${SITE_URL}?login_error=naver_link`);
    }

    // Supabase verify URL → 브라우저가 방문 → #access_token= 으로 리다이렉트
    return res.redirect(actionLink);
  } catch (err) {
    console.error("Naver auth error:", err);
    return res.redirect(`${SITE_URL}?login_error=naver_unknown`);
  }
}
