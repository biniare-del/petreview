// =====================================================
// Supabase 클라이언트 설정
// =====================================================
// 1. https://app.supabase.com 에서 새 프로젝트를 만드세요.
// 2. 프로젝트 → Settings → API 에서 값을 확인하세요.
// 3. 아래 두 값을 본인의 Supabase 프로젝트 값으로 교체하세요.
// =====================================================

(function () {
  const SUPABASE_URL = 'https://hguzornmqxayylmagook.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_V_W2cWncw9PB1omx7V1MgQ_7zUfv_da';

  if (SUPABASE_URL.startsWith('YOUR_') || SUPABASE_ANON_KEY.startsWith('YOUR_')) {
    console.warn(
      '[펫리뷰] Supabase가 설정되지 않았습니다.\n' +
      'supabase-client.js 파일에서 SUPABASE_URL과 SUPABASE_ANON_KEY를 입력해 주세요.\n' +
      '새로고침 시 리뷰 데이터가 초기화됩니다.'
    );
    return;
  }

  window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.info('[펫리뷰] Supabase 연결됨.');
})();
