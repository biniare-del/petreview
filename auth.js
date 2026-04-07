// PetReview 인증 공통 모듈
// supabase-client.js 이후에 로드해야 함.
(function () {
  const SITE_URL = "https://biniare-del.github.io/petreview/";

  window.PetAuth = {
    currentUser: null,
    currentProfile: null,
    _listeners: [],

    async init(onAuthChange) {
      const db = window.supabaseClient;
      if (!db) return;

      // 현재 세션 복원 (OAuth 리다이렉트 코드 교환 포함)
      const { data: { session } } = await db.auth.getSession();
      if (session?.user) {
        this.currentUser = session.user;
        this.currentProfile = await this._fetchProfile(session.user.id);
      }

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
      const { data } = await db.from("profiles").select("*").eq("id", userId).single();
      return data;
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
