(() => {
  const db = window.supabaseClient;

  // ── 유틸 ──────────────────────────────────────────────
  function escH(v) {
    return String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
  }
  function timeAgo(d) {
    const s = Math.floor((Date.now() - new Date(d)) / 1000);
    if (s < 60) return "방금";
    if (s < 3600) return `${Math.floor(s/60)}분 전`;
    if (s < 86400) return `${Math.floor(s/3600)}시간 전`;
    return `${Math.floor(s/86400)}일 전`;
  }

  // ── 서브탭 전환 ───────────────────────────────────────
  let activeTab = "brag";

  function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll(".social-subtab").forEach(btn => {
      btn.classList.toggle("is-active", btn.dataset.tab === tab);
    });
    document.getElementById("social-brag-content").hidden = (tab !== "brag");
    document.getElementById("social-community-content").hidden = (tab !== "community");
    if (tab === "brag" && feedOffset === 0) loadFeed(true);
    if (tab === "community" && allPosts.length === 0) loadPosts();
  }

  document.getElementById("social-subtabs").addEventListener("click", e => {
    const btn = e.target.closest(".social-subtab");
    if (btn) switchTab(btn.dataset.tab);
  });

  // URL param으로 초기 탭 설정 (brag.html, community.html 리다이렉트 지원)
  const initTab = new URLSearchParams(location.search).get("tab");
  if (initTab === "community") activeTab = "community";

  // ── 헤더 인증 ─────────────────────────────────────────
  function updateHeaderAuth(user) {
    const area = document.getElementById("header-auth");
    if (!area) return;
    const loginBtn = document.getElementById("social-login-btn");
    if (!user) {
      if (loginBtn) loginBtn.hidden = false;
    } else {
      if (loginBtn) loginBtn.hidden = true;
      const auth = window.PetAuth;
      if (!auth) return;
      const name = auth.getDisplayName?.() || "";
      const avatar = auth.getAvatarUrl?.() || "";
      const avatarHtml = avatar
        ? `<a href="mypage.html"><img src="${escH(avatar)}" class="header-avatar" alt="프로필" /></a>`
        : `<a href="mypage.html"><span class="header-avatar-placeholder">${escH(name[0]||"?")}</span></a>`;
      area.innerHTML = `${avatarHtml}<span class="header-username">${escH(name)}</span>`;
    }
  }

  // ══════════════════════════════════════════════════════
  //  자랑 탭 (Brag)
  // ══════════════════════════════════════════════════════
  let currentUser = null;
  let myPets = [];
  let selectedFiles = [];
  let userLikedSet = new Set();
  let feedOffset = 0, feedLoading = false, feedDone = false, profileCache = {};

  const PAGE_SIZE = 20;

  function getBadge(n) {
    if (n >= 200) return { cls: "badge-legend", label: "👑 레전드" };
    if (n >= 100) return { cls: "badge-star",   label: "💎 스타" };
    if (n >= 50)  return { cls: "badge-hot",    label: "🔥 핫" };
    if (n >= 10)  return { cls: "badge-popular",label: "🌟 인기" };
    return null;
  }
  function getRankCls(n) {
    if (n >= 200) return "rank-legend";
    if (n >= 100) return "rank-star";
    if (n >= 50)  return "rank-hot";
    return "";
  }

  function renderCard(post, profileMap) {
    const badge = getBadge(post.like_count);
    const rankCls = getRankCls(post.like_count);
    const liked = userLikedSet.has(post.id);
    const nick = profileMap[post.user_id]?.nickname || "익명";
    const petName = post.pets?.name || "";
    const avatarUrl = post.pets?.photo_url || "";
    const isOwner = currentUser && currentUser.id === post.user_id;
    const urls = post.photo_urls || [];

    const photosHtml = urls.length === 0 ? "" : `
      <div class="brag-photos" data-urls='${escH(JSON.stringify(urls))}' data-idx="0">
        <img src="${escH(urls[0])}" alt="뽐내기 사진" loading="lazy" />
        ${urls.length > 1 ? `<div class="photo-nav-dots">${urls.map((_,i)=>`<div class="photo-dot${i===0?" active":""}"></div>`).join("")}</div>` : ""}
      </div>`;

    return `
      <div class="brag-card ${rankCls}" data-id="${escH(post.id)}">
        ${photosHtml}
        <div class="brag-card-body">
          <div class="brag-card-top">
            <div class="brag-avatar">${avatarUrl ? `<img src="${escH(avatarUrl)}" alt="">` : "🐾"}</div>
            <div class="brag-author-info">
              <div class="brag-author">${escH(nick)}</div>
              ${petName ? `<div class="brag-pet-name">${escH(petName)}</div>` : ""}
            </div>
            ${badge ? `<span class="brag-badge ${badge.cls}">${badge.label}</span>` : ""}
          </div>
          ${post.caption ? `<p class="brag-caption">${escH(post.caption)}</p>` : ""}
          <div class="brag-like-row">
            <button class="brag-like-btn${liked?" liked":""}" data-id="${escH(post.id)}">
              <span class="heart">${liked?"❤️":"🤍"}</span>
              <span class="like-count">${post.like_count}</span>
            </button>
            <span class="brag-time">${timeAgo(post.created_at)}</span>
            ${isOwner ? `<button class="brag-delete-btn" data-del="${escH(post.id)}">🗑</button>` : ""}
          </div>
        </div>
      </div>`;
  }

  async function loadFeed(reset = false) {
    if (feedLoading || feedDone) return;
    const feed = document.getElementById("brag-feed");
    if (!db) { feed.innerHTML = '<p class="placeholder-text">서비스 연결 실패</p>'; return; }

    if (reset) {
      feedOffset = 0; feedDone = false; profileCache = {};
      feed.innerHTML = '<p class="placeholder-text">불러오는 중...</p>';
      if (currentUser) {
        const { data: likes } = await db.from("brag_post_likes").select("post_id").eq("user_id", currentUser.id);
        userLikedSet = new Set((likes||[]).map(l=>l.post_id));
      }
    }

    feedLoading = true;
    const { data: posts, error } = await db
      .from("brag_posts")
      .select("*, pets(name, photo_url)")
      .order("like_count", { ascending: false })
      .order("created_at", { ascending: false })
      .range(feedOffset, feedOffset + PAGE_SIZE - 1);
    feedLoading = false;

    if (error) { feed.innerHTML = '<p class="placeholder-text">불러오기 실패</p>'; return; }
    if (!posts?.length) {
      if (feedOffset === 0) feed.innerHTML = '<p class="placeholder-text">아직 자랑이 없어요 🐾<br>첫 번째로 올려보세요!</p>';
      feedDone = true;
      return;
    }

    const newUids = [...new Set(posts.map(p => p.user_id))].filter(id => !profileCache[id]);
    if (newUids.length) {
      const { data: profiles } = await db.from("profiles").select("id,nickname").in("id", newUids);
      (profiles||[]).forEach(p => { profileCache[p.id] = p; });
    }

    if (feedOffset === 0) feed.innerHTML = "";
    feed.insertAdjacentHTML("beforeend", posts.map(p => renderCard(p, profileCache)).join(""));
    attachCardEvents();
    feedOffset += posts.length;
    if (posts.length < PAGE_SIZE) feedDone = true;
  }

  function initInfiniteScroll() {
    const sentinel = document.getElementById("brag-feed-sentinel");
    if (!sentinel || !("IntersectionObserver" in window)) return;
    new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && activeTab === "brag") loadFeed();
    }, { rootMargin: "200px" }).observe(sentinel);
  }

  function attachCardEvents() {
    document.querySelectorAll(".brag-like-btn").forEach(btn => {
      btn.addEventListener("click", () => toggleLike(btn.dataset.id));
    });
    document.querySelectorAll(".brag-delete-btn").forEach(btn => {
      btn.addEventListener("click", () => deletePost(btn.dataset.del));
    });
    document.querySelectorAll(".brag-photos").forEach(wrap => {
      const urls = JSON.parse(wrap.dataset.urls || "[]");
      if (urls.length <= 1) {
        wrap.querySelector("img")?.addEventListener("click", () => openLightbox(urls, 0));
        return;
      }
      wrap.querySelector("img").addEventListener("click", () => openLightbox(urls, +wrap.dataset.idx));
      wrap.querySelectorAll(".photo-dot").forEach((dot, i) => {
        dot.addEventListener("click", e => { e.stopPropagation(); switchPhoto(wrap, urls, i); });
      });
      let touchX = null;
      wrap.addEventListener("touchstart", e => { touchX = e.touches[0].clientX; }, { passive: true });
      wrap.addEventListener("touchend", e => {
        if (touchX === null) return;
        const diff = touchX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 40) {
          const cur = +wrap.dataset.idx;
          switchPhoto(wrap, urls, diff > 0 ? Math.min(cur+1, urls.length-1) : Math.max(cur-1, 0));
        }
        touchX = null;
      }, { passive: true });
    });
  }

  function switchPhoto(wrap, urls, idx) {
    wrap.dataset.idx = idx;
    wrap.querySelector("img").src = urls[idx];
    wrap.querySelectorAll(".photo-dot").forEach((d, i) => d.classList.toggle("active", i === idx));
  }

  async function toggleLike(postId) {
    if (!currentUser) { alert("로그인이 필요해요."); return; }
    const btn = document.querySelector(`.brag-like-btn[data-id="${postId}"]`);
    const countEl = btn?.querySelector(".like-count");
    const heartEl = btn?.querySelector(".heart");
    const liked = userLikedSet.has(postId);
    if (liked) {
      await db.from("brag_post_likes").delete().eq("post_id", postId).eq("user_id", currentUser.id);
      userLikedSet.delete(postId);
      if (btn) { btn.classList.remove("liked"); heartEl.textContent = "🤍"; countEl.textContent = Math.max(0, +countEl.textContent-1); }
    } else {
      await db.from("brag_post_likes").insert({ post_id: postId, user_id: currentUser.id });
      userLikedSet.add(postId);
      if (btn) { btn.classList.add("liked"); heartEl.textContent = "❤️"; countEl.textContent = +countEl.textContent+1; }
    }
  }

  async function deletePost(postId) {
    if (!confirm("삭제할까요?")) return;
    await db.from("brag_posts").delete().eq("id", postId);
    document.querySelector(`.brag-card[data-id="${postId}"]`)?.remove();
  }

  // 라이트박스
  let lbUrls = [], lbIdx = 0;
  function openLightbox(urls, idx) {
    lbUrls = Array.isArray(urls) ? urls : [urls];
    lbIdx = idx || 0;
    renderLightbox();
    document.getElementById("brag-lightbox").hidden = false;
  }
  function renderLightbox() {
    document.getElementById("lightbox-img").src = lbUrls[lbIdx];
    document.getElementById("lightbox-prev").hidden = lbIdx === 0;
    document.getElementById("lightbox-next").hidden = lbIdx === lbUrls.length-1;
    document.getElementById("lightbox-counter").textContent = lbUrls.length > 1 ? `${lbIdx+1} / ${lbUrls.length}` : "";
  }
  document.getElementById("lightbox-prev").addEventListener("click", e => { e.stopPropagation(); if (lbIdx > 0) { lbIdx--; renderLightbox(); } });
  document.getElementById("lightbox-next").addEventListener("click", e => { e.stopPropagation(); if (lbIdx < lbUrls.length-1) { lbIdx++; renderLightbox(); } });
  document.getElementById("brag-lightbox").addEventListener("click", e => {
    if (e.target === e.currentTarget || e.target.id === "lightbox-close") {
      document.getElementById("brag-lightbox").hidden = true;
    }
  });
  document.getElementById("lightbox-close").addEventListener("click", () => {
    document.getElementById("brag-lightbox").hidden = true;
  });

  // 업로드 모달
  document.getElementById("upload-close-btn").addEventListener("click", () => {
    document.getElementById("upload-overlay").hidden = true;
  });
  document.getElementById("photo-upload-area").addEventListener("click", () => {
    document.getElementById("photo-input").click();
  });
  document.getElementById("photo-input").addEventListener("change", e => {
    const all = Array.from(e.target.files);
    selectedFiles = all.slice(0, 3);
    const row = document.getElementById("photo-preview-row");
    row.innerHTML = selectedFiles.map(f => `<img class="photo-thumb" src="${URL.createObjectURL(f)}" />`).join("");
  });

  async function loadMyPets() {
    if (!currentUser || !db) return;
    const { data } = await db.from("pets").select("id,name").eq("user_id", currentUser.id);
    myPets = data || [];
    const sel = document.getElementById("pet-select");
    sel.querySelectorAll("option:not(:first-child)").forEach(o => o.remove());
    myPets.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id; opt.textContent = p.name;
      sel.appendChild(opt);
    });
  }

  document.getElementById("brag-submit-btn").addEventListener("click", async () => {
    const msg = document.getElementById("brag-msg");
    if (!currentUser) { msg.textContent = "로그인이 필요해요."; return; }
    if (!selectedFiles.length) { msg.textContent = "사진을 최소 1장 선택해주세요."; return; }
    const btn = document.getElementById("brag-submit-btn");
    btn.disabled = true; msg.textContent = "업로드 중...";

    const urls = [];
    for (const file of selectedFiles) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `brag/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await db.storage.from("pet-photos").upload(path, file, { contentType: file.type });
      if (!error) {
        const { data: u } = db.storage.from("pet-photos").getPublicUrl(path);
        urls.push(u.publicUrl);
      }
    }
    if (!urls.length) { msg.textContent = "사진 업로드에 실패했어요."; btn.disabled = false; return; }

    const caption = document.getElementById("caption-input").value.trim();
    const petId = document.getElementById("pet-select").value || null;
    const { error } = await db.from("brag_posts").insert({
      user_id: currentUser.id, pet_id: petId, photo_urls: urls, caption: caption || null,
    });

    if (error) { msg.textContent = "등록에 실패했어요."; btn.disabled = false; return; }
    document.getElementById("upload-overlay").hidden = true;
    document.getElementById("caption-input").value = "";
    document.getElementById("photo-preview-row").innerHTML = "";
    selectedFiles = [];
    btn.disabled = false; msg.textContent = "";
    loadFeed(true);
  });

  // ══════════════════════════════════════════════════════
  //  커뮤니티 탭 (Community)
  // ══════════════════════════════════════════════════════
  const TAG_COLORS = {
    "병원추천": { bg: "#E6F1FB", color: "#0C447C" },
    "질문":    { bg: "#FAEEDA", color: "#854F0B" },
    "자랑":    { bg: "#FBEAF0", color: "#72243E" },
    "정보":    { bg: "#EAF3DE", color: "#27500A" },
  };

  function tagBadgeHtml(tag) {
    const c = TAG_COLORS[tag] || { bg: "#f0f0f0", color: "#666" };
    return `<span class="tag-badge" style="background:${c.bg};color:${c.color};">${escH(tag)}</span>`;
  }

  let currentTag = "전체";
  let currentPostId = null;
  let allPosts = [];
  let selectedWriteTag = null;
  let postLikeCounts = {};
  let userLikedPosts = new Set();
  let editingPostId = null;

  async function loadPosts() {
    const listEl = document.getElementById("post-list");
    if (!db) { listEl.innerHTML = '<p class="placeholder-text">서비스 연결에 실패했습니다.</p>'; return; }

    const { data, error } = await db
      .from("posts")
      .select("*, comments(id)")
      .order("created_at", { ascending: false });

    if (error) { listEl.innerHTML = '<p class="placeholder-text">게시글을 불러오지 못했습니다.</p>'; return; }
    allPosts = data || [];

    if (allPosts.length) {
      const userIds = [...new Set(allPosts.map(p => p.user_id).filter(Boolean))];
      if (userIds.length) {
        const { data: profilesData } = await db.from("profiles").select("id,nickname").in("id", userIds);
        const profileMap = {};
        (profilesData||[]).forEach(p => { profileMap[p.id] = p; });
        allPosts.forEach(post => { post.profiles = profileMap[post.user_id] || null; });
      }

      postLikeCounts = {};
      const { data: likesData } = await db.from("post_likes").select("post_id").in("post_id", allPosts.map(p => p.id));
      (likesData||[]).forEach(l => { postLikeCounts[l.post_id] = (postLikeCounts[l.post_id]||0)+1; });

      userLikedPosts = new Set();
      const userId = window.PetAuth?.currentUser?.id;
      if (userId) {
        const { data: myLikes } = await db.from("post_likes").select("post_id").eq("user_id", userId);
        (myLikes||[]).forEach(l => userLikedPosts.add(l.post_id));
      }
    }
    renderPosts();
  }

  function renderPosts() {
    const listEl = document.getElementById("post-list");
    const filtered = currentTag === "전체" ? allPosts : allPosts.filter(p => p.tag === currentTag);
    if (!filtered.length) {
      listEl.innerHTML = '<p class="placeholder-text">아직 게시글이 없습니다. 첫 글을 남겨보세요!</p>';
      return;
    }
    listEl.innerHTML = filtered.map(post => `
      <div class="post-card" data-post-id="${escH(post.id)}">
        <div class="post-card-top">${tagBadgeHtml(post.tag)}</div>
        <p class="post-card-title">${escH(post.title)}</p>
        <div class="post-card-meta">
          <span>${escH(post.profiles?.nickname||"익명")}</span>
          <span>댓글 ${post.comments?.length||0}</span>
          <span>❤️ ${postLikeCounts[post.id]||0}</span>
          <span>${timeAgo(post.created_at)}</span>
        </div>
      </div>`).join("");
    listEl.querySelectorAll(".post-card").forEach(card => {
      card.addEventListener("click", () => {
        const post = allPosts.find(p => p.id === card.dataset.postId);
        if (post) openPostDetail(post);
      });
    });
  }

  function openPostDetail(post) {
    currentPostId = post.id;
    const c = TAG_COLORS[post.tag] || { bg: "#f0f0f0", color: "#666" };
    const tagEl = document.getElementById("detail-tag");
    tagEl.style.background = c.bg; tagEl.style.color = c.color; tagEl.textContent = post.tag;
    document.getElementById("detail-title").textContent = post.title;
    document.getElementById("detail-meta").textContent = `${post.profiles?.nickname||"익명"} · ${timeAgo(post.created_at)}`;
    document.getElementById("detail-content").textContent = post.content;
    const actionsArea = document.getElementById("detail-actions");
    if (actionsArea) {
      const isOwner = window.PetAuth?.currentUser?.id === post.user_id;
      actionsArea.innerHTML = isOwner
        ? `<button class="detail-edit-btn" id="detail-edit-btn">수정</button>`
        : `<button class="detail-edit-btn" id="detail-report-post-btn" style="color:#e57373;border-color:#e57373;">신고</button>`;
      if (isOwner) {
        document.getElementById("detail-edit-btn")?.addEventListener("click", () => openEditModal(post));
      } else {
        document.getElementById("detail-report-post-btn")?.addEventListener("click", () => reportPost(post.id));
      }
    }
    document.getElementById("post-detail-overlay").hidden = false;
    document.body.style.overflow = "hidden";
    renderLikeButton(post.id);
    loadComments(post.id);
  }

  function closePostDetail() {
    document.getElementById("post-detail-overlay").hidden = true;
    document.body.style.overflow = "";
    currentPostId = null;
  }

  async function loadComments(postId) {
    const listEl = document.getElementById("comment-list");
    const countEl = document.getElementById("comment-count");
    listEl.innerHTML = '<p style="font-size:13px;color:#aaa;">불러오는 중...</p>';

    const { data, error } = await db.from("comments").select("*").eq("post_id", postId).order("created_at", { ascending: true });
    let comments = data || [];
    if (comments.length) {
      const uids = [...new Set(comments.map(c => c.user_id).filter(Boolean))];
      if (uids.length) {
        const { data: pd } = await db.from("profiles").select("id,nickname").in("id", uids);
        const pm = {};
        (pd||[]).forEach(p => { pm[p.id] = p; });
        comments = comments.map(c => ({ ...c, profiles: pm[c.user_id]||null }));
      }
    }
    countEl.textContent = error ? "?" : comments.length;

    const isLoggedIn = window.PetAuth?.isLoggedIn();
    const currentUserId = window.PetAuth?.currentUser?.id;
    listEl.innerHTML = comments.length === 0
      ? '<p style="font-size:13px;color:#aaa;padding:12px 0;">첫 댓글을 남겨보세요.</p>'
      : comments.map(c => `
          <div class="comment-item" data-comment-id="${escH(c.id)}">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <span>
                <span class="comment-author">${escH(c.profiles?.nickname||"익명")}</span>
                <span class="comment-time">${timeAgo(c.created_at)}</span>
              </span>
              ${isLoggedIn && c.user_id !== currentUserId
                ? `<button class="comment-report-btn" data-comment-id="${escH(c.id)}" style="font-size:11px;color:#ccc;background:none;border:none;cursor:pointer;padding:2px 4px;">신고</button>`
                : ""}
            </div>
            <p class="comment-content">${escH(c.content)}</p>
          </div>`).join("");

    listEl.querySelectorAll(".comment-report-btn").forEach(btn => {
      btn.addEventListener("click", () => reportComment(btn.dataset.commentId));
    });

    const formArea = document.getElementById("comment-form-area");
    if (window.PetAuth?.isLoggedIn()) {
      formArea.innerHTML = `
        <div class="comment-form">
          <input class="comment-input" id="comment-input" placeholder="댓글을 입력하세요." maxlength="500" />
          <button class="comment-submit-btn" id="comment-submit-btn">등록</button>
        </div>`;
      document.getElementById("comment-submit-btn").addEventListener("click", submitComment);
      document.getElementById("comment-input").addEventListener("keydown", e => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(); }
      });
    } else {
      formArea.innerHTML = `<p style="font-size:13px;color:#aaa;text-align:center;padding:14px 0;">댓글을 달려면 <button onclick="window.PetAuth?.signInWithGoogle()" style="background:none;border:none;color:#0f6e56;font-weight:600;font-size:13px;cursor:pointer;padding:0;">로그인</button>이 필요합니다.</p>`;
    }
  }

  async function submitComment() {
    const input = document.getElementById("comment-input");
    const btn = document.getElementById("comment-submit-btn");
    const content = input?.value.trim();
    if (!content || !currentPostId) return;
    const userId = window.PetAuth?.currentUser?.id;
    if (!userId) return;
    btn.disabled = true;
    const { error } = await db.from("comments").insert([{ post_id: currentPostId, user_id: userId, content }]);
    btn.disabled = false;
    if (error) { alert("댓글 등록에 실패했습니다."); return; }
    input.value = "";
    await loadComments(currentPostId);
    const post = allPosts.find(p => p.id === currentPostId);
    if (post) { if (!post.comments) post.comments = []; post.comments.push({ id:"t" }); }
  }

  function renderLikeButton(postId) {
    const area = document.getElementById("post-like-area");
    if (!area) return;
    const count = postLikeCounts[postId] || 0;
    const liked = userLikedPosts.has(postId);
    if (window.PetAuth?.isLoggedIn()) {
      area.innerHTML = `<button class="post-like-btn${liked?" is-liked":""}" id="post-like-btn" data-post-id="${escH(postId)}">❤️ ${count}</button>`;
      document.getElementById("post-like-btn").addEventListener("click", () => togglePostLike(postId));
    } else {
      area.innerHTML = `<button class="post-like-btn" onclick="window.PetAuth?.signInWithGoogle()">❤️ ${count}</button>`;
    }
  }

  async function togglePostLike(postId) {
    const userId = window.PetAuth?.currentUser?.id;
    if (!userId) return;
    const btn = document.getElementById("post-like-btn");
    if (btn) btn.disabled = true;
    const liked = userLikedPosts.has(postId);
    if (liked) {
      await db.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
      userLikedPosts.delete(postId);
      postLikeCounts[postId] = Math.max(0, (postLikeCounts[postId]||1)-1);
    } else {
      await db.from("post_likes").insert([{ post_id: postId, user_id: userId }]);
      userLikedPosts.add(postId);
      postLikeCounts[postId] = (postLikeCounts[postId]||0)+1;
    }
    renderLikeButton(postId);
    renderPosts();
  }

  // 신고 모달
  let reportTarget = null;
  function openReportModal(type, id) {
    reportTarget = { type, id };
    document.getElementById("report-modal-title").textContent = type === "post" ? "게시글 신고" : "댓글 신고";
    document.querySelectorAll("input[name='comm-report-reason']").forEach(r => r.checked = false);
    document.getElementById("report-result").textContent = "";
    document.getElementById("report-modal-overlay").hidden = false;
  }
  function reportPost(postId) {
    if (!window.PetAuth?.isLoggedIn()) { window.PetAuth?.signInWithGoogle(); return; }
    openReportModal("post", postId);
  }
  function reportComment(commentId) {
    if (!window.PetAuth?.isLoggedIn()) { window.PetAuth?.signInWithGoogle(); return; }
    openReportModal("comment", commentId);
  }

  document.getElementById("report-modal-close-btn").addEventListener("click", () => {
    document.getElementById("report-modal-overlay").hidden = true;
  });
  document.getElementById("report-modal-overlay").addEventListener("click", e => {
    if (e.target.id === "report-modal-overlay") e.currentTarget.hidden = true;
  });
  document.getElementById("report-submit-btn").addEventListener("click", async () => {
    const reason = document.querySelector("input[name='comm-report-reason']:checked")?.value;
    if (!reason) { document.getElementById("report-result").textContent = "사유를 선택해주세요."; return; }
    if (!reportTarget) return;
    const userId = window.PetAuth?.currentUser?.id;
    if (!db || !userId) return;
    const resultEl = document.getElementById("report-result");
    let error;
    if (reportTarget.type === "post") {
      ({ error } = await db.from("post_reports").insert([{ post_id: reportTarget.id, user_id: userId, reason }]));
    } else {
      ({ error } = await db.from("comment_reports").insert([{ comment_id: reportTarget.id, user_id: userId, reason }]));
    }
    if (error) {
      resultEl.style.color = "#e57373";
      resultEl.textContent = error.code === "23505" ? "이미 신고한 항목입니다." : "신고 처리 중 오류가 발생했습니다.";
    } else {
      resultEl.style.color = "#22c55e";
      resultEl.textContent = "신고가 접수됐습니다.";
      setTimeout(() => { document.getElementById("report-modal-overlay").hidden = true; }, 1200);
    }
  });

  // 글쓰기 모달
  function openWriteModal() {
    if (!window.PetAuth?.isLoggedIn()) { window.PetAuth?.signInWithGoogle(); return; }
    selectedWriteTag = null; editingPostId = null;
    document.getElementById("write-title").value = "";
    document.getElementById("write-content").value = "";
    document.getElementById("write-result").textContent = "";
    document.querySelectorAll(".tag-select-btn").forEach(b => b.classList.remove("is-active"));
    const submitBtn = document.getElementById("write-submit-btn");
    if (submitBtn) { submitBtn.textContent = "등록하기"; submitBtn.disabled = false; }
    document.getElementById("write-modal-overlay").hidden = false;
    document.body.style.overflow = "hidden";
  }

  function openEditModal(post) {
    editingPostId = post.id;
    closePostDetail();
    selectedWriteTag = post.tag;
    document.getElementById("write-title").value = post.title;
    document.getElementById("write-content").value = post.content;
    document.getElementById("write-result").textContent = "";
    document.querySelectorAll(".tag-select-btn").forEach(b =>
      b.classList.toggle("is-active", b.dataset.tag === post.tag));
    document.getElementById("write-submit-btn").textContent = "수정 완료";
    document.getElementById("write-modal-overlay").hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeWriteModal() {
    document.getElementById("write-modal-overlay").hidden = true;
    document.body.style.overflow = "";
    editingPostId = null; selectedWriteTag = null;
    document.getElementById("write-title").value = "";
    document.getElementById("write-content").value = "";
    document.getElementById("write-result").textContent = "";
    document.querySelectorAll(".tag-select-btn").forEach(b => b.classList.remove("is-active"));
    const btn = document.getElementById("write-submit-btn");
    if (btn) { btn.textContent = "등록하기"; btn.disabled = false; }
  }

  async function submitPost() {
    const title = document.getElementById("write-title").value.trim();
    const content = document.getElementById("write-content").value.trim();
    const resultEl = document.getElementById("write-result");
    const btn = document.getElementById("write-submit-btn");
    if (!selectedWriteTag) { resultEl.textContent = "태그를 선택해주세요."; return; }
    if (!title) { resultEl.textContent = "제목을 입력해주세요."; return; }
    if (!content) { resultEl.textContent = "내용을 입력해주세요."; return; }
    const userId = window.PetAuth?.currentUser?.id;
    if (!userId) { resultEl.textContent = "로그인이 필요합니다."; return; }
    btn.disabled = true;
    btn.textContent = editingPostId ? "수정 중..." : "등록 중...";
    try {
      if (editingPostId) {
        const { error } = await db.from("posts").update({ tag: selectedWriteTag, title, content }).eq("id", editingPostId);
        btn.disabled = false; btn.textContent = "수정 완료";
        if (error) { resultEl.textContent = "수정 실패: " + error.message; return; }
        const idx = allPosts.findIndex(p => p.id === editingPostId);
        if (idx !== -1) allPosts[idx] = { ...allPosts[idx], tag: selectedWriteTag, title, content };
        closeWriteModal(); renderPosts();
      } else {
        const { error } = await db.from("posts").insert([{ user_id: userId, tag: selectedWriteTag, title, content }]);
        btn.disabled = false; btn.textContent = "등록하기";
        if (error) { resultEl.textContent = "등록 실패: " + error.message; return; }
        closeWriteModal(); await loadPosts();
      }
    } catch (e) {
      btn.disabled = false; btn.textContent = editingPostId ? "수정 완료" : "등록하기";
      resultEl.textContent = "오류가 발생했습니다: " + e.message;
    }
  }

  // ── 글로벌 쓰기 버튼 (바텀시트 선택) ─────────────────
  function openWriteChoiceSheet() {
    document.getElementById("write-choice-overlay").hidden = false;
  }
  function closeWriteChoiceSheet() {
    document.getElementById("write-choice-overlay").hidden = true;
  }

  document.getElementById("global-write-btn").addEventListener("click", openWriteChoiceSheet);
  document.getElementById("write-choice-overlay").addEventListener("click", e => {
    if (e.target.id === "write-choice-overlay") closeWriteChoiceSheet();
  });
  document.getElementById("choice-brag-btn").addEventListener("click", () => {
    closeWriteChoiceSheet();
    if (!currentUser) { alert("로그인이 필요해요."); return; }
    switchTab("brag");
    document.getElementById("upload-overlay").hidden = false;
  });
  document.getElementById("choice-community-btn").addEventListener("click", () => {
    closeWriteChoiceSheet();
    switchTab("community");
    openWriteModal();
  });

  // ── 이벤트 바인딩 (커뮤니티) ─────────────────────────
  document.getElementById("tag-filter-bar")?.addEventListener("click", e => {
    const btn = e.target.closest(".tag-filter-btn");
    if (!btn) return;
    currentTag = btn.dataset.tag;
    document.querySelectorAll(".tag-filter-btn").forEach(b => b.classList.toggle("is-active", b.dataset.tag === currentTag));
    renderPosts();
  });

  document.getElementById("tag-select-group")?.addEventListener("click", e => {
    const btn = e.target.closest(".tag-select-btn");
    if (!btn) return;
    selectedWriteTag = btn.dataset.tag;
    document.querySelectorAll(".tag-select-btn").forEach(b => b.classList.toggle("is-active", b.dataset.tag === selectedWriteTag));
  });

  document.getElementById("detail-close-btn")?.addEventListener("click", closePostDetail);
  document.getElementById("write-close-btn")?.addEventListener("click", closeWriteModal);
  document.getElementById("write-submit-btn")?.addEventListener("click", submitPost);
  document.getElementById("post-detail-overlay")?.addEventListener("click", e => {
    if (e.target.id === "post-detail-overlay") closePostDetail();
  });
  document.getElementById("write-modal-overlay")?.addEventListener("click", e => {
    if (e.target.id === "write-modal-overlay") closeWriteModal();
  });

  // ── 초기화 ────────────────────────────────────────────
  (async () => {
    if (!db) return;
    const { data: { session } } = await db.auth.getSession();
    currentUser = session?.user || null;

    if (window.PetAuth?.init) {
      await window.PetAuth.init(event => {
        currentUser = window.PetAuth.currentUser || currentUser;
        updateHeaderAuth(currentUser);
      }).catch(() => {});
    }
    updateHeaderAuth(currentUser);
    await loadMyPets();
    switchTab(activeTab);
    initInfiniteScroll();
  })();
})();
