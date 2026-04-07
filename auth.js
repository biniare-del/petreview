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

      // onAuthStateChange를 getSession()보다 먼저 등록
      // (OAuth 리다이렉트 후 SIGNED_IN 이벤트 누락 방지)
      db.auth.onAuthStateChange(async (event, session) => {
        this.currentUser = session?.user ?? null;
        this.currentProfile = session?.user
          ? await this._fetchProfile(session.user.id)
          : null;
        onAuthChange?.(event, session);
      });

      // getSession(): URL의 ?code= 를 처리하고 세션 반환
      // 실패해도 사이트 이용에는 영향 없도록 try-catch
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
        // 코드 교환 성공/실패 관계없이 URL 파라미터 정리
        cleanOAuthParams();
      }
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
