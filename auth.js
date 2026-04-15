// PetReview 인증 공통 모듈
// supabase-client.js 이후에 로드해야 함.
(function () {
  const SITE_URL = "https://biniare-del.github.io/petreview/";

  // OAuth 콜백 파라미터를 URL에서 제거 (페이지가 ?code= 로 멈춰보이는 현상 방지)
  function cleanOAuthParams() {
    const url = new URL(window.location.href);
    const dirty = ["code", "error", "error_code", "error_description"];
    if (dirty.some((k) => url.searchParams.has(k))) {
      dirty.forEach((k) => url.searchParams.delete(k));
      window.history.replaceState({}, document.title, url.toString());
    }
    // hash fragment 방식 (#access_token=... 등)도 정리
    if (window.location.hash.includes("access_token") ||
        window.location.hash.includes("error")) {
      window.history.replaceState({}, document.title,
        window.location.pathname + window.location.search);
    }
  }

  window.PetAuth = {
    currentUser: null,
    currentProfile: null,

    async init(onAuthChange) {
      const db = window.supabaseClient;
      if (!db) return;

      // 세션 복원 (OAuth 리다이렉트 코드/토큰 처리 포함)
      try {
        const { data: { session }, error } = await db.auth.getSession();
        if (error) {
          console.warn("[펫리뷰] 세션 복원 실패:", error.message);
        } else if (session?.user) {
          this.currentUser = session.user;
          this.currentProfile = await this._fetchProfile(session.user.id);
        }
      } catch (err) {
        console.warn("[펫리뷰] 인증 초기화 오류:", err);
      } finally {
        cleanOAuthParams();
      }

      // 이후 상태 변화 감지
      db.auth.onAuthStateChange(async (event, session) => {
        this.currentUser = session?.user ?? null;
        this.currentProfile = session?.user
          ? await this._fetchProfile(session.user.id)
          : null;
        onAuthChange?.(event, session);
      });
    },

    async _fetchProfile(userId) {
      const db = window.supabaseClient;
      if (!db) return null;
      try {
        const { data } = await db
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();
        return data ?? null;
      } catch {
        return null;
      }
    },

    async signInWithKakao() {
      await window.supabaseClient?.auth.signInWithOAuth({
        provider: "kakao",
        options: { redirectTo: SITE_URL },
      });
    },

    async signInWithNaver() {
      const clientId = "ioqxPmIhg53d4OclcRAU";
      const redirectUri = encodeURIComponent("https://petreview.vercel.app/api/naver-callback");
      const state = Math.random().toString(36).slice(2);
      window.location.href =
        `https://nid.naver.com/oauth2.0/authorize?response_type=code` +
        `&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}`;
    },

    async signInWithGoogle() {
      await window.supabaseClient?.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: SITE_URL },
      });
    },

    async signOut() {
      await window.supabaseClient?.auth.signOut();
    },

    isLoggedIn() {
      return !!this.currentUser;
    },

    isAdmin() {
      return this.currentProfile?.is_admin === true;
    },

    getDisplayName() {
      if (!this.currentUser) return "";
      return (
        this.currentProfile?.nickname ||
        this.currentUser.user_metadata?.full_name ||
        this.currentUser.user_metadata?.name ||
        this.currentUser.email?.split("@")[0] ||
        "사용자"
      );
    },

    getAvatarUrl() {
      return (
        this.currentProfile?.avatar_url ||
        this.currentUser?.user_metadata?.avatar_url ||
        null
      );
    },
  };
})();
