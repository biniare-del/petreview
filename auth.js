// PetReview 인증 공통 모듈
// supabase-client.js 이후에 로드해야 함.
(function () {
  const SITE_URL = "https://biniare-del.github.io/petreview/";

  // 인앱브라우저(WebView) 감지
  function isInAppBrowser() {
    const ua = navigator.userAgent || "";
    // 카카오톡, 인스타, 페북, 라인, 네이버앱, Android WebView
    if (/KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER\(inapp/i.test(ua)) return true;
    // Android WebView 패턴: Chrome이 없거나 wv 플래그
    if (/Android/.test(ua) && /wv/.test(ua)) return true;
    // iOS 인앱: Safari 없는 iPhone
    if (/iPhone|iPad/.test(ua) && !/Safari/.test(ua)) return true;
    return false;
  }

  // 인앱브라우저 경고 모달 표시
  function showInAppBrowserWarning() {
    if (document.getElementById("inapp-warning-overlay")) return;

    const currentUrl = window.location.href;
    // Android: Chrome으로 강제 오픈
    const intentUrl = currentUrl.replace(/^https:\/\//, "intent://") +
      "#Intent;scheme=https;package=com.android.chrome;end";
    const isAndroid = /Android/i.test(navigator.userAgent);

    const overlay = document.createElement("div");
    overlay.id = "inapp-warning-overlay";
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.55);
      z-index:99999;display:flex;align-items:flex-end;justify-content:center;
    `;
    overlay.innerHTML = `
      <div style="
        background:#fff;border-radius:20px 20px 0 0;padding:28px 24px 36px;
        width:100%;max-width:480px;box-shadow:0 -4px 24px rgba(0,0,0,0.12);
      ">
        <div style="font-size:22px;margin-bottom:10px;">🌐</div>
        <h3 style="margin:0 0 8px;font-size:17px;font-weight:800;color:#1a1a1a;">
          외부 브라우저에서 열어주세요
        </h3>
        <p style="margin:0 0 20px;font-size:14px;color:#666;line-height:1.6;">
          카카오톡, 인스타그램 등 앱 내 브라우저에서는<br>구글 로그인이 차단됩니다.<br>
          Chrome 또는 Safari에서 열어주세요.
        </p>
        ${isAndroid ? `
        <button id="inapp-open-chrome" style="
          width:100%;padding:14px;background:linear-gradient(135deg,#22c55e,#16a34a);
          color:#fff;border:none;border-radius:14px;font-size:15px;
          font-weight:700;cursor:pointer;margin-bottom:10px;
        ">Chrome으로 열기</button>
        ` : ""}
        <button id="inapp-copy-url" style="
          width:100%;padding:14px;background:#f6fdf9;
          color:#0f6e56;border:1.5px solid #22c55e;border-radius:14px;
          font-size:15px;font-weight:700;cursor:pointer;margin-bottom:10px;
        ">주소 복사하기</button>
        <button id="inapp-close" style="
          width:100%;padding:12px;background:none;
          color:#aaa;border:none;font-size:14px;cursor:pointer;
        ">닫기</button>
      </div>
    `;

    document.body.appendChild(overlay);

    if (isAndroid) {
      document.getElementById("inapp-open-chrome")?.addEventListener("click", () => {
        window.location.href = intentUrl;
      });
    }

    document.getElementById("inapp-copy-url")?.addEventListener("click", () => {
      navigator.clipboard.writeText(currentUrl).then(() => {
        const btn = document.getElementById("inapp-copy-url");
        if (btn) { btn.textContent = "복사됨 ✓"; btn.style.background = "#dcfce7"; }
      }).catch(() => {
        // clipboard API 안 되는 경우 prompt로 fallback
        window.prompt("아래 주소를 복사하세요:", currentUrl);
      });
    });

    document.getElementById("inapp-close")?.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  }

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
      if (isInAppBrowser()) {
        showInAppBrowserWarning();
        return;
      }
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
