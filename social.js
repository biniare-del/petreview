"use strict";

(() => {
  const db = window.supabaseClient;

  // ── 유틸 ──────────────────────────────────────────────
  function escH(v) {
    return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
  function timeAgo(d) {
    const s = Math.floor((Date.now() - new Date(d)) / 1000);
    if (s < 60)    return "방금";
    if (s < 3600)  return `${Math.floor(s/60)}분 전`;
    if (s < 86400) return `${Math.floor(s/3600)}시간 전`;
    return `${Math.floor(s/86400)}일 전`;
  }

  // ── 태그 색상 ─────────────────────────────────────────
  const TAG_COLORS = {
    "사진자랑": { bg: "#FDF2FF", color: "#7C3AED" },
    "병원추천": { bg: "#E6F1FB", color: "#0C447C" },
    "질문":     { bg: "#FAEEDA", color: "#854F0B" },
    "정보":     { bg: "#EAF3DE", color: "#27500A" },
    "일상":     { bg: "#F0F0F0", color: "#4B5563" },
  };
  function tagBadgeHtml(tag) {
    const c = TAG_COLORS[tag] || { bg: "#f0f0f0", color: "#666" };
    return `<span class="social-tag-badge" style="background:${c.bg};color:${c.color};">${escH(tag)}</span>`;
  }

  // ── 상태 ──────────────────────────────────────────────
  let currentUser = null;
  let allPosts    = [];
  let currentTag  = "전체";
  let currentPostId = null;
  let postLikeCounts = {};
  let userLikedPosts = new Set();
  let selectedWriteTag = null;
  let editingPostId    = null;
  let selectedFiles    = [];
  let reportTarget     = null;
  let lbUrls = [], lbIdx = 0;

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
      const name   = auth.getDisplayName?.() || "";
      const avatar = auth.getAvatarUrl?.() || "";
      const avatarHtml = avatar
        ? `<a href="mypage.html"><img src="${escH(avatar)}" class="header-avatar" alt="프로필"/></a>`
        : `<a href="mypage.html"><span class="header-avatar-placeholder">${escH(name[0]||"?")}</span></a>`;
      area.innerHTML = `${avatarHtml}<span class="header-username">${escH(name)}</span>`;
    }
  }

  // ══════════════════════════════════════════════════════
  //  피드 로드 / 렌더
  // ══════════════════════════════════════════════════════
  async function loadPosts() {
    const listEl = document.getElementById("post-list");
    if (!db) { listEl.innerHTML = '<p class="placeholder-text">서비스 연결에 실패했습니다.</p>'; return; }
    listEl.innerHTML = '<p class="placeholder-text" style="padding:40px 0;">불러오는 중...</p>';

    const { data, error } = await db
      .from("posts")
      .select("*, comments(id)")
      .order("created_at", { ascending: false });

    if (error) { listEl.innerHTML = '<p class="placeholder-text">게시글을 불러오지 못했습니다.</p>'; return; }
    allPosts = data || [];

    if (allPosts.length) {
      // 프로필 배치 로드
      const userIds = [...new Set(allPosts.map(p => p.user_id).filter(Boolean))];
      if (userIds.length) {
        const { data: profilesData } = await db.from("profiles").select("id,nickname,avatar_url").in("id", userIds);
        const profileMap = {};
        (profilesData||[]).forEach(p => { profileMap[p.id] = p; });
        allPosts.forEach(post => { post.profiles = profileMap[post.user_id] || null; });
      }

      // 좋아요 수
      postLikeCounts = {};
      const { data: likesData } = await db.from("post_likes").select("post_id").in("post_id", allPosts.map(p => p.id));
      (likesData||[]).forEach(l => { postLikeCounts[l.post_id] = (postLikeCounts[l.post_id]||0)+1; });

      // 내 좋아요
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
      const tagLabel = currentTag === "전체" ? "" : ` [${currentTag}]`;
      listEl.innerHTML = `<div class="social-empty-state"><div class="social-empty-icon">🐾</div><p>아직 게시글이 없어요${escH(tagLabel)}</p><p style="font-size:13px;color:#bbb;margin-top:4px;">첫 글을 남겨보세요!</p></div>`;
      return;
    }

    listEl.innerHTML = filtered.map(post => {
      const photos   = post.photo_urls || [];
      const liked    = userLikedPosts.has(post.id);
      const likeCount = postLikeCounts[post.id] || 0;
      const commentCount = post.comments?.length || 0;
      const nick     = post.profiles?.nickname || "익명";
      const avatar   = post.profiles?.avatar_url || "";

      const photosHtml = photos.length
        ? `<div class="post-card-photos" data-post-id="${escH(post.id)}">
            <img class="post-card-photo" src="${escH(photos[0])}" alt="" loading="lazy"/>
            ${photos.length > 1 ? `<span class="post-card-photo-count">+${photos.length}</span>` : ""}
          </div>`
        : "";

      const preview = (post.content || "").trim().replace(/\n+/g, " ");
      const previewHtml = preview
        ? `<p class="post-card-preview">${escH(preview)}</p>` : "";

      return `
      <div class="post-card" data-post-id="${escH(post.id)}">
        ${photosHtml}
        <div class="post-card-body">
          <div class="post-card-top">
            <div class="post-card-avatar">${avatar ? `<img src="${escH(avatar)}" alt=""/>` : escH(nick[0]||"?")}</div>
            <div class="post-card-author">${escH(nick)}</div>
            ${tagBadgeHtml(post.tag)}
            <span class="post-card-time">${timeAgo(post.created_at)}</span>
          </div>
          <p class="post-card-title">${escH(post.title)}</p>
          ${previewHtml}
          <div class="post-card-footer">
            <button class="post-like-chip${liked?" is-liked":""}" data-post-id="${escH(post.id)}">❤️ ${likeCount}</button>
            <span class="post-card-comments">💬 ${commentCount}</span>
          </div>
        </div>
      </div>`;
    }).join("");

    // 카드 클릭 → 상세 (사진 클릭은 lightbox)
    listEl.querySelectorAll(".post-card").forEach(card => {
      card.addEventListener("click", e => {
        if (e.target.closest(".post-like-chip")) return;
        const post = allPosts.find(p => p.id === card.dataset.postId);
        if (post) openPostDetail(post);
      });
    });
    listEl.querySelectorAll(".post-like-chip").forEach(btn => {
      btn.addEventListener("click", e => { e.stopPropagation(); togglePostLike(btn.dataset.postId); });
    });
    listEl.querySelectorAll(".post-card-photos").forEach(wrap => {
      wrap.addEventListener("click", e => {
        e.stopPropagation();
        const post = allPosts.find(p => p.id === wrap.dataset.postId);
        if (post?.photo_urls?.length) openLightbox(post.photo_urls, 0);
      });
    });
  }

  // ── 포스트 상세 ───────────────────────────────────────
  function openPostDetail(post) {
    currentPostId = post.id;

    // 사진
    const photosEl = document.getElementById("detail-photos");
    const photos = post.photo_urls || [];
    if (photos.length) {
      photosEl.innerHTML = `<div class="detail-photo-grid">
        ${photos.map((url, i) => `<img class="detail-photo" src="${escH(url)}" data-idx="${i}" alt="" loading="lazy"/>`).join("")}
      </div>`;
      photosEl.hidden = false;
      photosEl.querySelectorAll(".detail-photo").forEach(img => {
        img.addEventListener("click", () => openLightbox(photos, +img.dataset.idx));
      });
    } else {
      photosEl.hidden = true;
      photosEl.innerHTML = "";
    }

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
    renderDetailLikeButton(post.id);
    loadComments(post.id);
  }

  function closePostDetail() {
    document.getElementById("post-detail-overlay").hidden = true;
    document.body.style.overflow = "";
    currentPostId = null;
  }

  function renderDetailLikeButton(postId) {
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
    if (!userId) { alert("좋아요를 누르려면 로그인이 필요해요."); return; }
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
    renderDetailLikeButton(postId);
    renderPosts();
  }

  // ── 댓글 ────────────────────────────────────────────
  async function loadComments(postId) {
    const listEl   = document.getElementById("comment-list");
    const countEl  = document.getElementById("comment-count");
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
          <input class="comment-input" id="comment-input" placeholder="댓글을 입력하세요." maxlength="500"/>
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
    const btn   = document.getElementById("comment-submit-btn");
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
    if (post) { if (!post.comments) post.comments = []; post.comments.push({ id: "t" }); }
  }

  // ── 글쓰기 ────────────────────────────────────────────
  function openWriteModal() {
    if (!window.PetAuth?.isLoggedIn()) { window.PetAuth?.signInWithGoogle(); return; }
    selectedWriteTag = null; editingPostId = null; selectedFiles = [];
    document.getElementById("write-title").value = "";
    document.getElementById("write-content").value = "";
    document.getElementById("write-result").textContent = "";
    document.getElementById("write-photo-input").value = "";
    document.getElementById("write-photo-previews").innerHTML = "";
    document.getElementById("write-photo-previews").hidden = true;
    document.getElementById("write-photo-placeholder").hidden = false;
    document.querySelectorAll(".write-tag-btn").forEach(b => b.classList.remove("is-active"));
    const btn = document.getElementById("write-submit-btn");
    if (btn) { btn.textContent = "등록하기"; btn.disabled = false; }
    document.getElementById("write-modal-title").textContent = "글쓰기";
    document.getElementById("write-modal-overlay").hidden = false;
    document.body.style.overflow = "hidden";
  }

  function openEditModal(post) {
    editingPostId = post.id;
    closePostDetail();
    selectedWriteTag = post.tag;
    selectedFiles = [];
    document.getElementById("write-title").value = post.title;
    document.getElementById("write-content").value = post.content;
    document.getElementById("write-result").textContent = "";
    document.getElementById("write-photo-previews").hidden = true;
    document.getElementById("write-photo-placeholder").hidden = false;
    document.querySelectorAll(".write-tag-btn").forEach(b => b.classList.toggle("is-active", b.dataset.tag === post.tag));
    document.getElementById("write-submit-btn").textContent = "수정 완료";
    document.getElementById("write-modal-title").textContent = "글 수정";
    document.getElementById("write-modal-overlay").hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeWriteModal() {
    document.getElementById("write-modal-overlay").hidden = true;
    document.body.style.overflow = "";
    editingPostId = null; selectedWriteTag = null; selectedFiles = [];
  }

  async function submitPost() {
    const title   = document.getElementById("write-title").value.trim();
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

    // 사진 업로드
    let photoUrls = [];
    if (selectedFiles.length && !editingPostId) {
      resultEl.textContent = "사진 업로드 중...";
      for (const file of selectedFiles) {
        const ext  = file.name.split(".").pop() || "jpg";
        const path = `community/${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await db.storage.from("pet-photos").upload(path, file, { contentType: file.type });
        if (!upErr) {
          const { data: u } = db.storage.from("pet-photos").getPublicUrl(path);
          photoUrls.push(u.publicUrl);
        }
      }
      resultEl.textContent = "";
    }

    try {
      if (editingPostId) {
        const { error } = await db.from("posts").update({ tag: selectedWriteTag, title, content }).eq("id", editingPostId);
        if (error) { resultEl.textContent = "수정 실패: " + error.message; btn.disabled = false; btn.textContent = "수정 완료"; return; }
        const idx = allPosts.findIndex(p => p.id === editingPostId);
        if (idx !== -1) allPosts[idx] = { ...allPosts[idx], tag: selectedWriteTag, title, content };
        closeWriteModal(); renderPosts();
      } else {
        const insertData = { user_id: userId, tag: selectedWriteTag, title, content };
        if (photoUrls.length) insertData.photo_urls = photoUrls;
        const { error } = await db.from("posts").insert([insertData]);
        btn.disabled = false; btn.textContent = "등록하기";
        if (error) { resultEl.textContent = "등록 실패: " + error.message; return; }
        closeWriteModal(); await loadPosts();
      }
    } catch (e) {
      btn.disabled = false; btn.textContent = editingPostId ? "수정 완료" : "등록하기";
      resultEl.textContent = "오류가 발생했습니다: " + e.message;
    }
  }

  // ── 신고 ────────────────────────────────────────────
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

  // ── 라이트박스 ────────────────────────────────────────
  function openLightbox(urls, idx) {
    lbUrls = Array.isArray(urls) ? urls : [urls];
    lbIdx  = idx || 0;
    renderLightbox();
    document.getElementById("social-lightbox").hidden = false;
    document.body.style.overflow = "hidden";
  }
  function renderLightbox() {
    document.getElementById("lightbox-img").src = lbUrls[lbIdx];
    document.getElementById("lightbox-prev").hidden = lbIdx === 0;
    document.getElementById("lightbox-next").hidden = lbIdx === lbUrls.length - 1;
    document.getElementById("lightbox-counter").textContent = lbUrls.length > 1 ? `${lbIdx+1} / ${lbUrls.length}` : "";
  }

  // ── 이벤트 바인딩 ────────────────────────────────────
  document.getElementById("tag-filter-bar")?.addEventListener("click", e => {
    const btn = e.target.closest(".social-tag-btn");
    if (!btn) return;
    currentTag = btn.dataset.tag;
    document.querySelectorAll(".social-tag-btn").forEach(b => b.classList.toggle("is-active", b.dataset.tag === currentTag));
    renderPosts();
  });

  document.getElementById("tag-select-group")?.addEventListener("click", e => {
    const btn = e.target.closest(".write-tag-btn");
    if (!btn) return;
    selectedWriteTag = btn.dataset.tag;
    document.querySelectorAll(".write-tag-btn").forEach(b => b.classList.toggle("is-active", b.dataset.tag === selectedWriteTag));
  });

  // 사진 첨부
  document.getElementById("write-photo-placeholder")?.addEventListener("click", () => {
    document.getElementById("write-photo-input").click();
  });
  document.getElementById("write-photo-input")?.addEventListener("change", e => {
    selectedFiles = Array.from(e.target.files).slice(0, 3);
    const previews = document.getElementById("write-photo-previews");
    const placeholder = document.getElementById("write-photo-placeholder");
    if (selectedFiles.length) {
      previews.innerHTML = selectedFiles.map(f => `<img class="write-photo-thumb" src="${URL.createObjectURL(f)}" alt=""/>`).join("") +
        `<button type="button" class="write-photo-clear" id="write-photo-clear">✕ 제거</button>`;
      previews.hidden = false;
      placeholder.hidden = true;
      previews.querySelector("#write-photo-clear").addEventListener("click", () => {
        selectedFiles = [];
        previews.innerHTML = "";
        previews.hidden = true;
        placeholder.hidden = false;
        document.getElementById("write-photo-input").value = "";
      });
    }
  });

  document.getElementById("global-write-btn")?.addEventListener("click", openWriteModal);
  document.getElementById("detail-close-btn")?.addEventListener("click", closePostDetail);
  document.getElementById("write-close-btn")?.addEventListener("click", closeWriteModal);
  document.getElementById("write-submit-btn")?.addEventListener("click", submitPost);

  document.getElementById("post-detail-overlay")?.addEventListener("click", e => {
    if (e.target.id === "post-detail-overlay") closePostDetail();
  });
  document.getElementById("write-modal-overlay")?.addEventListener("click", e => {
    if (e.target.id === "write-modal-overlay") closeWriteModal();
  });

  // 라이트박스 이벤트
  document.getElementById("lightbox-prev")?.addEventListener("click", e => {
    e.stopPropagation();
    if (lbIdx > 0) { lbIdx--; renderLightbox(); }
  });
  document.getElementById("lightbox-next")?.addEventListener("click", e => {
    e.stopPropagation();
    if (lbIdx < lbUrls.length - 1) { lbIdx++; renderLightbox(); }
  });
  document.getElementById("social-lightbox")?.addEventListener("click", e => {
    if (e.target.id === "social-lightbox" || e.target.id === "lightbox-close") {
      document.getElementById("social-lightbox").hidden = true;
      document.body.style.overflow = "";
    }
  });
  document.getElementById("lightbox-close")?.addEventListener("click", () => {
    document.getElementById("social-lightbox").hidden = true;
    document.body.style.overflow = "";
  });

  // 신고 모달
  document.getElementById("report-modal-close-btn")?.addEventListener("click", () => {
    document.getElementById("report-modal-overlay").hidden = true;
  });
  document.getElementById("report-modal-overlay")?.addEventListener("click", e => {
    if (e.target.id === "report-modal-overlay") e.currentTarget.hidden = true;
  });
  document.getElementById("report-submit-btn")?.addEventListener("click", async () => {
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

    // URL 파라미터 처리 (community.html redirect 호환)
    const initTab = new URLSearchParams(location.search).get("tab");
    if (initTab) currentTag = initTab === "brag" ? "사진자랑" : initTab;

    await loadPosts();
  })();
})();
