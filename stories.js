/**
 * stories.js — মুক্তলিপি Stories System
 * Facebook-Style Premium UI | Firebase Realtime DB | Cloudinary Upload
 * Production-Ready | Mobile-First | Zero Placeholders
 * ================================================================
 */

import {
    ref, push, set, onValue, get, update, remove
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

/* ================================================================
   GLOBALS
   ================================================================ */
let db, auth;

const CLOUDINARY_CLOUD_NAME  = "dvvx2frpu";
const CLOUDINARY_UPLOAD_PRESET = "story_upload";
const STORY_DURATION_MS      = 5000;
const STORY_TTL_MS           = 24 * 60 * 60 * 1000; // 24h

/** Active viewer state — সব ভিউয়ার ডেটা এখানে থাকে */
let vs = {
    userId:     null,
    storyIndex: 0,
    stories:    [],
    userName:   "",
    userImg:    "",
    timerId:    null,
    paused:     false,
    duration:   STORY_DURATION_MS,
    elapsed:    0,
    startTime:  0,
    listeners:  []   // Firebase unsubscribe refs — cleanup করার জন্য
};

/** Media editor state */
let editorBase64   = null;
let editorRotation = 0;

/* ================================================================
   INIT — Main entry point (called from app.js)
   ================================================================ */
export function initStoriesSystem(firebaseDb, firebaseAuth) {
    db   = firebaseDb;
    auth = firebaseAuth;
    _buildBottomSheets();
    _renderStorySkeletons(); // <-- ডাটা আসার আগে ইনস্ট্যান্ট স্কেলেটন দেখানোর জন্য
    loadHomeStories();
    _setupUploaderListeners();
}
// মডিউল চালু হওয়ার সাথে সাথে ৩টি চমৎকার অফলাইন লোডিং বাবল রেন্ডার করার ফাংশন
function _renderStorySkeletons() {
    const wrapper = document.getElementById("storiesBar");
    if (!wrapper) return;

    wrapper.innerHTML = "";
    wrapper.appendChild(_buildCreateStoryCard(auth.currentUser));

    // ৪টি প্রফেশনাল ফেসবুক-স্টাইল স্টোরি শিমার এস্কেলেটন কার্ড জেনারেট করা হচ্ছে
    for (let i = 0; i < 4; i++) {
        const sk = document.createElement("div");
        sk.className = "story-skeleton-card";
        sk.innerHTML = `
            <div class="story-skeleton-avatar"></div>
            <div class="story-skeleton-name"></div>
        `;
        wrapper.appendChild(sk);
    }
}
/* ================================================================
   HOME STORIES BAR — Create Story + Own Story + Friends
   ================================================================ */
export function loadHomeStories() {
    const storiesRef = ref(db, "stories");

    onValue(storiesRef, async (snapshot) => {
        try {
            const wrapper = document.getElementById("storiesBar");
            if (!wrapper) return;

            const allData = snapshot.val() || {};
            window.allStoriesData = allData; // ইনডেক্স ফিডে স্টোরি রিং সচল করার জন্য
            const now     = Date.now();
            const me      = auth.currentUser;

            // wrapper পরিষ্কার করে Create Story কার্ড প্রথমে বসাই
            wrapper.innerHTML = "";
            wrapper.appendChild(_buildCreateStoryCard(me));

        /* ── নিজের সক্রিয় স্টোরি কার্ড (যদি থাকে) ── */
        if (me && allData[me.uid]) {
            const myActive = _filterActive(allData[me.uid], now);
            if (myActive.length > 0) {
                wrapper.appendChild(_buildOwnStoryCard(me, myActive));
            }
        }

        /* ── বন্ধুদের স্টোরি কার্ড ── */
        const friendEntries = Object.entries(allData).filter(
            ([uid]) => !me || uid !== me.uid
        );

        const friendCards = await Promise.all(
            friendEntries.map(async ([uid, userStories]) => {
                try {
                    const active = _filterActive(userStories, now);
                    if (active.length === 0) return null;

                    // কোনো একটি ইউজারের ডেটা ফেচ করতে সমস্যা হলে যেন পুরো লুপ ক্র্যাশ না করে
                    let userSnap = null;
                    let presenceSnap = null;
                    try {
                        userSnap = await get(ref(db, `users/${uid}`));
                    } catch (err) {
                        console.warn(`User ${uid} metadata fetch failed:`, err);
                    }
                    try {
                        presenceSnap = await get(ref(db, `presence/${uid}`));
                    } catch (err) {
                        console.warn(`User ${uid} presence fetch failed:`, err);
                    }

if (!userSnap || !userSnap.exists()) return null;

                        const userData  = userSnap.val();
                        // presenceSnap নাল (Null) বা ফেইলড হলে যাতে স্ক্রিপ্ট ক্র্যাশ না করে সেই ফিক্স
                        const isOnline  = presenceSnap && presenceSnap.exists() && presenceSnap.val().online;
                        const lastStory = active[active.length - 1];
                    const isSeen    = localStorage.getItem(`SEEN_${uid}_${lastStory.id}`) === "true";

                    return _buildFriendStoryCard(uid, userData, lastStory, isOnline, isSeen);
                } catch (singleErr) {
                    console.error(`Error loading story for user ${uid}:`, singleErr);
                    return null;
                }
            })
        );

        friendCards.forEach(card => card && wrapper.appendChild(card));
        } catch (err) {
            console.error("Error in loadHomeStories list:", err);
            // ক্র্যাশ করলে অন্তত লোডিং স্লাইডার ক্লিয়ার করে ক্রিয়েট কার্ড দেখাবে
            const wrapper = document.getElementById("storiesBar");
            if (wrapper) {
                wrapper.innerHTML = "";
                wrapper.appendChild(_buildCreateStoryCard(auth.currentUser));
            }
        }
    });
}

/* ── Create Story কার্ড বিল্ড ── */
function _buildCreateStoryCard(me) {
    const card = document.createElement("div");
    card.className = "story-card create-story-card";
    card.setAttribute("aria-label", "Create Story");

    const photoURL = me?.photoURL || "https://cdn-icons-png.flaticon.com/512/149/149071.png";

    card.innerHTML = `
        <div class="create-story-bg" style="background-image: url('${photoURL}')"></div>
        <div class="create-story-plus-btn">
            <i class="fas fa-plus"></i>
        </div>
        <div class="create-story-bottom">
            <span class="story-label-text">Create story</span>
        </div>
    `;

    card.addEventListener("click", openStoryCreatorModal);
    return card;
}

/* ── নিজের সক্রিয় স্টোরি কার্ড ── */
function _buildOwnStoryCard(me, myActive) {
    const card      = document.createElement("div");
    card.className  = "story-card own-story-card";
    const last      = myActive[myActive.length - 1];
    const photoURL  = me.photoURL || "https://cdn-icons-png.flaticon.com/512/149/149071.png";

    if (last.type === "text") {
        card.style.background = last.backgroundColor || "#1877f2";
    } else {
        card.style.cssText = `background-image: url('${last.content}'); background-size: cover; background-position: center;`;
    }

    card.innerHTML = `
        <div class="story-author-img-wrap" style="border: 2.5px solid var(--story-ring-unseen);">
            <img
                class="story-author-img"
                src="${photoURL}"
                onerror="this.src='https://cdn-icons-png.flaticon.com/512/149/149071.png'"
                alt="Your Story"
            >
        </div>
        <span class="story-username">Your story</span>
    `;

    card.addEventListener("click", () => openStoryViewer(me.uid, 0));
    return card;
}

/* ── বন্ধুর স্টোরি কার্ড ── */
function _buildFriendStoryCard(uid, userData, lastStory, isOnline, isSeen) {
    const card = document.createElement("div");
    card.className = "story-card friend-story";
    card.setAttribute("data-seen", String(isSeen));

    if (lastStory.type === "text") {
        card.style.background = lastStory.backgroundColor || "#1877f2";
    } else {
        card.style.cssText = `background-image: url('${lastStory.content}'); background-size: cover; background-position: center;`;
    }

    const safePhoto = userData.photoURL || "https://cdn-icons-png.flaticon.com/512/149/149071.png";
    const safeName  = _escHtml(userData.displayName || "User");

    card.innerHTML = `
        <div class="story-author-img-wrap" style="border: 2.5px solid var(--story-ring-unseen);">
            <img
                class="story-author-img"
                src="${safePhoto}"
                onerror="this.src='https://cdn-icons-png.flaticon.com/512/149/149071.png'"
                alt="${safeName}"
            >
            ${isOnline ? '<div class="story-online-dot"></div>' : ""}
        </div>
        <span class="story-username">${safeName}</span>
    `;

    card.addEventListener("click", () => openStoryViewer(uid, 0));
    return card;
}

/* ── 24h filter helper ── */
function _filterActive(userStoriesObj, now) {
    return Object.entries(userStoriesObj || {})
        .map(([k, v]) => ({ id: k, ...v }))
        .filter(s => now - s.timestamp < STORY_TTL_MS)
        .sort((a, b) => a.timestamp - b.timestamp);
}

/* ================================================================
   STORY CREATOR MODAL — Image / Text / Link picker
   ================================================================ */
window.openStoryCreatorModal = function () {
    const modal = document.getElementById("storyMediaEditorModal");
    if (modal) {
        // ১. সরাসরি এডিটরকে ক্যানভাস মোডে ওপেন করুন
        const previewImg = document.getElementById("editorImagePreview");
        const blurBg = document.getElementById("editorBlurBg");
        if (previewImg) previewImg.style.display = "none";
        if (blurBg) blurBg.style.display = "none";

        const textOverlay = document.getElementById("editorTextOverlay");
        if (textOverlay) {
            textOverlay.style.display = "block";
            textOverlay.innerHTML = ""; // আগের লেখা ক্লিয়ার করা হলো
            setTimeout(() => textOverlay.focus(), 150); // ইন্ট্যান্ট টাইপ করার সুবিধা
        }

        const previewArea = document.querySelector(".editor-preview-area");
        if (previewArea) {
            previewArea.classList.add("canvas-mode");
            previewArea.style.background = "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"; // ডিফল্ট পিঙ্ক ও অরেঞ্জ গ্রেডিয়েন্ট
        }

        const musicPill = document.getElementById("editorMusicPill");
        if (musicPill) musicPill.style.display = "none";

        editorBase64 = null; // ইমেজ ক্লিয়ার রাখা হলো

        modal.style.display = "flex";
        modal.classList.add("active");
        hideAppChrome(); // হেডার ও ট্যাব বার হাইড করা হলো
    }
};

function _openMediaEditor(src) {
    window.closeStoryCreatorModal();
    const modal = document.getElementById("storyMediaEditorModal");
    if (!modal) return;

    const preview = document.getElementById("editorImagePreview");
    const blurBg  = document.getElementById("editorBlurBg");
    const previewArea = document.querySelector(".editor-preview-area");

    // গ্যালারি থেকে ছবি সিলেক্ট করলে ক্যানভাস মোড রিমুভ করে ছবি সেট হবে
    if (preview) { 
        preview.src = src; 
        preview.style.display = "block";
        preview.style.transform = "rotate(0deg)"; 
    }
    if (blurBg) { 
        blurBg.src = src;
        blurBg.style.display = "block";
        blurBg.style.backgroundImage = `url('${src}')`; 
    }
    if (previewArea) {
        previewArea.classList.remove("canvas-mode");
        previewArea.style.background = "none";
    }

    const textOverlay = document.getElementById("editorTextOverlay");
    if (textOverlay) {
        textOverlay.style.display = "block";
        textOverlay.innerHTML = "";
    }

    modal.style.display = "flex";
    modal.classList.add("active");
    hideAppChrome();
}

window.closeMediaEditor = function () {
    const modal = document.getElementById("storyMediaEditorModal");
    if (modal) { modal.style.display = "none"; modal.classList.remove("active"); }
    showAppChrome(); // ইমেজ এডিটর ক্লোজ করলে স্ক্রিন ফেরত আসবে
};

window.triggerRotateImage = function () {
    editorRotation += 90;
    const img = document.getElementById("editorImagePreview");
    if (img) img.style.transform = `rotate(${editorRotation}deg)`;
};

/* ── Cloudinary আপলোড ও Firebase সেভ ── */
window.uploadEditedStory = async function () {
    const textOverlay = document.getElementById("editorTextOverlay");
    const textContent = textOverlay ? textOverlay.innerText.trim() : "";
    const previewArea = document.querySelector(".editor-preview-area");
    const isCanvasMode = previewArea && previewArea.classList.contains("canvas-mode");

    // ১. যদি শুধুমাত্র ক্যানভাস মোডে টেক্সট শেয়ার করা হয় (ছবি ছাড়া)
    if (isCanvasMode) {
        if (!textContent) {
            _showToast("শেয়ার করার আগে স্ক্রিনে কিছু লিখুন! ✍️");
            return;
        }
        
        window.closeMediaEditor();
        _showToast("স্টোরি প্রকাশ করা হচ্ছে... ⏳");

        const currentBg = previewArea.style.background || "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)";

        const newRef = push(ref(db, `stories/${auth.currentUser.uid}`));
        await set(newRef, {
            type:            "text",
            content:         textContent,
            backgroundColor: currentBg,
            timestamp:       Date.now()
        });

        _showToast("স্টোরি প্রকাশিত হয়েছে ✅");
        return;
    }

    // ২. ফটো আপলোড করার সিস্টেম
    if (!editorBase64 || !auth.currentUser) return;

    window.closeMediaEditor();
    _showToast("আপলোড হচ্ছে... ⏳");
    _setProgressBar(0);

    try {
        const formData = new FormData();
        formData.append("file",           editorBase64);
        formData.append("upload_preset",  CLOUDINARY_UPLOAD_PRESET);

        // Cloudinary সার্ভারে আপলোড করার জন্য প্রোগ্রেস ট্র্যাক
        const secureUrl = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`);
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) _setProgressBar(Math.round((e.loaded / e.total) * 90));
            };
            xhr.onload = () => {
                const data = JSON.parse(xhr.responseText);
                data.secure_url ? resolve(data.secure_url) : reject(data);
            };
            xhr.onerror = reject;
            xhr.send(formData);
        });

        _setProgressBar(100);

        const newRef = push(ref(db, `stories/${auth.currentUser.uid}`));
        await set(newRef, {
            type:      "image",
            content:   secureUrl,
            timestamp: Date.now()
        });

        _showToast("স্টোরি প্রকাশিত হয়েছে ✅");
        setTimeout(() => _setProgressBar(0), 1200);

    } catch (err) {
        console.error("Story upload error:", err);
        _setProgressBar(0);
        _showToast("আপলোড ব্যর্থ হয়েছে ❌");
    }
};

/* ── Text Story ── */
window.openTextStoryEditor = function () {
    window.closeStoryCreatorModal();
    const editor = document.getElementById("textStoryEditor");
    if (editor) editor.classList.add("active");
    hideAppChrome(); // টেক্সট স্টোরিতেও হাইড হবে
};

window.closeTextStoryEditor = function () {
    const editor = document.getElementById("textStoryEditor");
    if (editor) editor.classList.remove("active");
    showAppChrome(); // টেক্সট স্টোরি ক্লোজ করলে ব্যাক হবে
};

window.publishTextStory = async function () {
    const textarea = document.getElementById("storyTextInputField") || document.getElementById("textStoryInput");
    if (!textarea || !auth.currentUser) return;
    const text = textarea.value.trim();
    if (!text) return;

    const bgEl = document.getElementById("textStoryBgColor");
    const bg   = bgEl ? bgEl.value : "#1877f2";

    _showToast("প্রকাশ করা হচ্ছে... ⏳");

    const newRef = push(ref(db, `stories/${auth.currentUser.uid}`));
    await set(newRef, {
        type:            "text",
        content:         _escHtml(text),
        backgroundColor: bg,
        timestamp:       Date.now()
    });

    textarea.value = "";
    window.closeTextStoryEditor();
    _showToast("স্টোরি প্রকাশিত হয়েছে ✅");
};

/* ================================================================
   STORY VIEWER — Full-Screen Premium Modal
   ================================================================ */
export async function openStoryViewer(userId, startIndex = 0) {
    if (!userId) return;
    const viewer = document.getElementById("storyViewerModal");
    if (!viewer) return;

    // ── Firebase থেকে ডেটা আনো ──
    const [storiesSnap, userSnap] = await Promise.all([
        get(ref(db, `stories/${userId}`)),
        get(ref(db, `users/${userId}`))
    ]);

    const now     = Date.now();
    const stories = _filterActive(storiesSnap.val() || {}, now);
    if (stories.length === 0) return;

    const userData = userSnap.exists() ? userSnap.val() : {};

    // ── Viewer State সেট ──
    _cleanupViewerListeners();
    vs = {
        userId,
        storyIndex: Math.min(startIndex, stories.length - 1),
        stories,
        userName:  userData.displayName || "User",
        userImg:   userData.photoURL    || "https://cdn-icons-png.flaticon.com/512/149/149071.png",
        timerId:   null,
        paused:    false,
        duration:  STORY_DURATION_MS,
        elapsed:   0,
        startTime: 0,
        listeners: []
    };

    // ── হেডার ও বটম নেভিগেশন লুকাও (Z-Index bug fix) ──
    hideAppChrome();

    // ── Viewer খোলো ──
    viewer.style.display = "flex";
    viewer.classList.add("active");
    document.body.style.overflow = "hidden";

    _renderViewerContent();
    _setupTouchInteractions();
}

/* ── Viewer Content রেন্ডার ── */
async function _renderViewerContent() {
    const story       = vs.stories[vs.storyIndex];
    const contentArea = document.getElementById("viewerContentArea");
    if (!contentArea) return;

    clearInterval(vs.timerId);

    /* Progress bars */
    const barsWrap = document.getElementById("viewerProgressBars");
    if (barsWrap) {
        barsWrap.innerHTML = "";
        vs.stories.forEach((_, idx) => {
            const bg   = document.createElement("div");
            bg.className = "progress-bar-bg";
            const fill = document.createElement("div");
            fill.className = "progress-bar-fill";
            if (idx < vs.storyIndex) fill.classList.add("done");
            bg.appendChild(fill);
            barsWrap.appendChild(bg);
        });
    }

    /* Header info */
    const authorImg  = document.getElementById("viewerAuthorImg");
    const authorName = document.getElementById("viewerAuthorName");
    const viewerTime = document.getElementById("viewerTime");
    if (authorImg)  {
        authorImg.src = vs.userImg;
        authorImg.onerror = () => { authorImg.src = "https://cdn-icons-png.flaticon.com/512/149/149071.png"; };
    }
    if (authorName) authorName.textContent = vs.userName;
    if (viewerTime) viewerTime.textContent  = _relTime(story.timestamp);

    /* Media content */
    contentArea.innerHTML = "";

    if (story.type === "text") {
        const div = document.createElement("div");
        div.className = "viewer-text-content";
        div.style.background = story.backgroundColor || "#1877f2";
        div.textContent = story.content;
        contentArea.appendChild(div);
        vs.duration = STORY_DURATION_MS;
        _startProgressBar();

    } else if (story.type === "image") {
        const blurDiv = document.createElement("div");
        blurDiv.className = "viewer-media-blur-bg";
        blurDiv.style.backgroundImage = `url('${story.content}')`;

        const img = document.createElement("img");
        img.className = "viewer-media";
        img.alt       = "Story";
        img.src       = story.content;

        contentArea.appendChild(blurDiv);
        contentArea.appendChild(img);
        vs.duration = STORY_DURATION_MS;
        _startProgressBar();

    } else if (story.type === "video") {
        const video = document.createElement("video");
        video.className  = "viewer-media";
        video.src        = story.content;
        video.autoplay   = true;
        video.playsInline = true;
        video.muted      = false;

        video.addEventListener("loadedmetadata", () => {
            vs.duration = video.duration * 1000;
            _startProgressBar();
        });
        video.addEventListener("ended", _nextSegment);
        contentArea.appendChild(video);
    }

    /* নিজের স্টোরি হলে: Views bar — অন্যের হলে: Reply + Reactions */
    const isOwnStory  = auth.currentUser && vs.userId === auth.currentUser.uid;
    const footer      = document.querySelector(".viewer-footer");

    if (footer) {
        if (isOwnStory) {
            // নিজের স্টোরি হলে ভিউ কাউন্ট এবং চমৎকার ডিলিট (ডাস্টবিন) আইকন পাশাপাশি থাকবে
            footer.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 0 10px; box-sizing: border-box;">
                    <div class="viewer-views-bar" id="storyViewsTracker" onclick="openStoryViewersList()" style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: white; background: rgba(255, 255, 255, 0.15); padding: 8px 16px; border-radius: 20px; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);">
                        <i class="fa-regular fa-eye" style="font-size: 16px;"></i>
                        <span id="storyViewsCountText" style="font-size: 14px; font-weight: 600;">0 views</span>
                    </div>
                    <button onclick="window._deleteCurrentStory()" style="background: rgba(255, 77, 77, 0.2); border: 1px solid rgba(255, 77, 77, 0.4); color: #ff4d4d; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 16px; transition: transform 0.1s ease; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>
                </div>
            `;
        } else {
            // অন্যের স্টোরি হলে সাধারণ রিপ্লাই এবং কুইক রিঅ্যাকশন বাটন থাকবে
            footer.innerHTML = `
                <input type="text" id="storyReplyInput" class="story-reply-input" placeholder="Send message...">
                <button onclick="sendStoryReply()" style="background:none; border:none; color:white; font-size:20px;"><i class="fas fa-paper-plane"></i></button>
                <button class="story-reaction-btn" onclick="reactToStory('love')">❤️</button>
                <button class="story-reaction-btn" onclick="reactToStory('haha')">😂</button>
                <button class="story-reaction-btn" onclick="reactToStory('wow')">😮</button>
            `;
        }
    }

    /* Real-time view count listener (নিজের স্টোরিতে) */
    if (isOwnStory) {
        _listenViewCount(story.id);
    }

    /* ভিউ লগ করা (অন্যের স্টোরি দেখলে) */
    if (auth.currentUser && !isOwnStory) {
        update(ref(db, `stories/${vs.userId}/${story.id}/views/${auth.currentUser.uid}`), {
            timestamp: Date.now()
        }).catch(() => {});
    }

    /* Seen state localStorage */
    localStorage.setItem(`SEEN_${vs.userId}_${story.id}`, "true");
}

/* ── Real-time view count ── */
function _listenViewCount(storyId) {
    const countEl = document.getElementById("storyViewsCountText");
    if (!countEl) return;

    const viewsRef = ref(db, `stories/${vs.userId}/${storyId}/views`);
    const unsub    = onValue(viewsRef, (snap) => {
        const count = snap.exists() ? Object.keys(snap.val()).length : 0;
        countEl.textContent = `${count} view${count !== 1 ? "s" : ""}`;
    });
    vs.listeners.push(unsub);
}

/* ── Progress bar ── */
function _startProgressBar() {
    clearInterval(vs.timerId);
    vs.elapsed   = 0;
    vs.startTime = Date.now();

    const fills = document.querySelectorAll(".progress-bar-fill");
    const fill  = fills[vs.storyIndex];

    vs.timerId = setInterval(() => {
        if (vs.paused) {
            vs.startTime = Date.now() - vs.elapsed;
            return;
        }
        vs.elapsed = Date.now() - vs.startTime;
        const pct  = Math.min((vs.elapsed / vs.duration) * 100, 100);
        if (fill) fill.style.width = `${pct}%`;
        if (vs.elapsed >= vs.duration) {
            clearInterval(vs.timerId);
            _nextSegment();
        }
    }, 30);
}

/* ── Navigation ── */
function _nextSegment() {
    if (vs.storyIndex < vs.stories.length - 1) {
        vs.storyIndex++;
        _renderViewerContent();
    } else {
        closeStoryViewer();
    }
}

function _prevSegment() {
    if (vs.storyIndex > 0) {
        vs.storyIndex--;
        _renderViewerContent();
    }
}

/* ── Touch / Tap interactions ── */
function _setupTouchInteractions() {
    const contentArea = document.getElementById("viewerContentArea");
    if (!contentArea) return;

    let holdTimer    = null;
    let touchStartX  = 0;
    let touchStartY  = 0;
    let isHolding    = false;

    const onStart = (e) => {
        isHolding    = false;
        touchStartX  = (e.touches ? e.touches[0].clientX : e.clientX);
        touchStartY  = (e.touches ? e.touches[0].clientY : e.clientY);

        holdTimer = setTimeout(() => {
            isHolding      = true;
            vs.paused      = true;
            const video    = contentArea.querySelector("video");
            if (video) video.pause();
        }, 180);
    };

    const onEnd = (e) => {
        clearTimeout(holdTimer);
        if (isHolding) {
            // release hold → resume
            vs.paused   = false;
            vs.startTime = Date.now() - vs.elapsed;
            const video  = contentArea.querySelector("video");
            if (video) video.play();
            return;
        }

        const endX  = (e.changedTouches ? e.changedTouches[0].clientX : e.clientX);
        const endY  = (e.changedTouches ? e.changedTouches[0].clientY : e.clientY);
        const diffX = Math.abs(endX - touchStartX);
        const diffY = Math.abs(endY - touchStartY);

        // সোজা ট্যাপ (swipe নয়)
        if (diffX < 10 && diffY < 10) {
            const rect  = contentArea.getBoundingClientRect();
            const tapX  = endX - rect.left;
            if (tapX < rect.width * 0.30) {
                _prevSegment();
            } else {
                _nextSegment();
            }
        }
    };

    const onCancel = () => {
        clearTimeout(holdTimer);
        if (vs.paused && isHolding) {
            vs.paused   = false;
            vs.startTime = Date.now() - vs.elapsed;
            const video  = contentArea.querySelector("video");
            if (video) video.play();
        }
        isHolding = false;
    };

    // পুরনো listener সরিয়ে নতুন লাগাও
    const clone = contentArea.cloneNode(true);
    contentArea.parentNode.replaceChild(clone, contentArea);

    clone.addEventListener("touchstart", onStart, { passive: true });
    clone.addEventListener("touchend",   onEnd);
    clone.addEventListener("touchcancel", onCancel);
    clone.addEventListener("mousedown",  onStart);
    clone.addEventListener("mouseup",    onEnd);
}

/* ── Viewer Close ── */
export function closeStoryViewer() {
    const viewer = document.getElementById("storyViewerModal");
    if (viewer) {
        viewer.style.display = "none";
        viewer.classList.remove("active");
    }

    // হেডার ও নেভিগেশন ফিরিয়ে দাও
    showAppChrome();

    document.body.style.overflow = "";
    clearInterval(vs.timerId);
    _cleanupViewerListeners();
    _closeAllSheets();
}

function _cleanupViewerListeners() {
    vs.listeners.forEach(unsub => { try { unsub(); } catch (_) {} });
    vs.listeners = [];
}

/* ── Profile redirect on avatar/name click ── */
window.handleStoryUserClick = function () {
    if (!vs.userId) return;
    const uid = vs.userId;
    closeStoryViewer();
    window.location.href = `profile.html?uid=${uid}`;
};

/* ================================================================
   BOTTOM SHEETS — Dynamic Build + Open/Close
   ================================================================ */

/**
 * DOM-এ bottom sheet গুলো একবার বানিয়ে রাখা হয়।
 * যখন দরকার শুধু class toggle করে open/close।
 */
function _buildBottomSheets() {
    // Backdrop (shared)
    if (!document.getElementById("storySheetBackdrop")) {
        const bd = document.createElement("div");
        bd.id        = "storySheetBackdrop";
        bd.className = "story-sheet-backdrop";
        bd.addEventListener("click", _closeAllSheets);
        document.body.appendChild(bd);
    }

    // ── Action Sheet (Three-Dot Menu) ──
    if (!document.getElementById("storyActionBottomSheet")) {
        const sheet = document.createElement("div");
        sheet.id        = "storyActionBottomSheet";
        sheet.className = "story-bottom-sheet";
        document.body.appendChild(sheet);
    }

    // ── Views / Analytics Sheet ──
    if (!document.getElementById("storyViewsSheet")) {
        const sheet = document.createElement("div");
        sheet.id        = "storyViewsSheet";
        sheet.className = "story-bottom-sheet";
        document.body.appendChild(sheet);
    }
}

function _openSheet(sheetId) {
    document.getElementById("storySheetBackdrop")?.classList.add("active");
    document.getElementById(sheetId)?.classList.add("open");
    vs.paused = true;
}

function _closeAllSheets() {
    document.getElementById("storySheetBackdrop")?.classList.remove("active");
    document.getElementById("storyActionBottomSheet")?.classList.remove("open");
    document.getElementById("storyViewsSheet")?.classList.remove("open");

    if (!vs.paused) return;
    vs.paused    = false;
    vs.startTime = Date.now() - vs.elapsed;
    const video  = document.querySelector("#viewerContentArea video");
    if (video) video.play();
}

/* ================================================================
   THREE-DOT ACTION MENU (Bottom Sheet — no SweetAlert)
   ================================================================ */
window.openStoryMenu = function () {
    const isMe  = auth.currentUser && vs.userId === auth.currentUser.uid;
    const sheet = document.getElementById("storyActionBottomSheet");
    if (!sheet) return;

    if (isMe) {
        sheet.innerHTML = `
            <div class="sheet-handle"></div>
            <div class="sheet-title">স্টোরি অপশন</div>
            <ul class="sheet-action-list">
                <li>
                    <button class="sheet-action-item destructive" onclick="window._deleteCurrentStory()">
                        <span class="sheet-action-icon"><i class="fas fa-trash-alt"></i></span>
                        <span class="sheet-action-text">
                            <span class="sheet-action-label">Delete Story</span>
                            <span class="sheet-action-desc">এই স্টোরিটি স্থায়ীভাবে মুছে যাবে</span>
                        </span>
                    </button>
                </li>
                <li>
                    <button class="sheet-action-item" onclick="_showToast('স্টোরি সেটিংস শীঘ্রই আসছে ⚙️'); window._closeAllSheets()">
                        <span class="sheet-action-icon"><i class="fas fa-cog"></i></span>
                        <span class="sheet-action-text">
                            <span class="sheet-action-label">Story Settings</span>
                            <span class="sheet-action-desc">অডিয়েন্স ও প্রাইভেসি পরিবর্তন করুন</span>
                        </span>
                    </button>
                </li>
            </ul>
            <div class="sheet-action-cancel" onclick="window._closeAllSheets()">বাতিল</div>
        `;
    } else {
        sheet.innerHTML = `
            <div class="sheet-handle"></div>
            <div class="sheet-title">স্টোরি রিপোর্ট</div>
            <ul class="sheet-action-list">
                <li>
                    <button class="sheet-action-item destructive" onclick="window._reportCurrentStory()">
                        <span class="sheet-action-icon"><i class="fas fa-flag"></i></span>
                        <span class="sheet-action-text">
                            <span class="sheet-action-label">Report Story</span>
                            <span class="sheet-action-desc">আমাদের নীতি লঙ্ঘনকারী কন্টেন্ট রিপোর্ট করুন</span>
                        </span>
                    </button>
                </li>
                <li>
                    <button class="sheet-action-item" onclick="window._muteCurrentUser()">
                        <span class="sheet-action-icon"><i class="fas fa-eye-slash"></i></span>
                        <span class="sheet-action-text">
                            <span class="sheet-action-label">Mute User</span>
                            <span class="sheet-action-desc">এই ব্যক্তির স্টোরি আর দেখতে চান না</span>
                        </span>
                    </button>
                </li>
            </ul>
            <div class="sheet-action-cancel" onclick="window._closeAllSheets()">বাতিল</div>
        `;
    }

    _openSheet("storyActionBottomSheet");
};

/* ── Delete story ── */
window._deleteCurrentStory = async function () {
    _closeAllSheets();
    const story = vs.stories[vs.storyIndex];
    if (!story || !auth.currentUser) return;

    // স্টোরির টাইমার সাময়িকভাবে পজ করা হচ্ছে
    vs.paused = true;

    Swal.fire({
        title: 'স্টোরি ডিলিট করবেন?',
        text: 'এই স্টোরিটি চিরতরে মুছে ফেলা হবে!',
        showCancelButton: true,
        confirmButtonText: 'ডিলিট',
        cancelButtonText: 'বাতিল',
        reverseButtons: true, // iOS Style: বাতিল বামে, ডিলিট ডানে
        buttonsStyling: false, // সুইট অ্যালার্টের ডিফল্ট বাটন স্টাইল বন্ধ করে কাস্টম ক্লাস ব্যবহারের জন্য
        customClass: {
            popup: 'ios-alert-popup',
            title: 'ios-alert-title',
            htmlContainer: 'ios-alert-text',
            confirmButton: 'ios-alert-btn-confirm',
            cancelButton: 'ios-alert-btn-cancel'
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await remove(ref(db, `stories/${auth.currentUser.uid}/${story.id}`));
                _showToast("স্টোরি মুছে ফেলা হয়েছে 🗑️");
                closeStoryViewer();
            } catch (err) {
                console.error(err);
                _showToast("মুছতে ব্যর্থ হয়েছে ❌");
            }
        } else {
            // ডিলিট বাতিল করলে টাইমার পুনরায় সচল হবে
            vs.paused = false;
            vs.startTime = Date.now() - vs.elapsed;
        }
    });
};

/* ── Report story ── */
window._reportCurrentStory = async function () {
    _closeAllSheets();
    const story = vs.stories[vs.storyIndex];
    if (!story || !auth.currentUser) return;
    try {
        await set(push(ref(db, "reports")), {
            postId:          story.id,
            reportedUser:    vs.userId,
            reportedBy:      auth.currentUser.uid,
            reportedByName:  auth.currentUser.displayName,
            reason:          "Story violation",
            timestamp:       Date.now(),
            status:          "pending"
        });
        _showToast("রিপোর্ট জমা হয়েছে। ধন্যবাদ ✅");
        closeStoryViewer();
    } catch (err) {
        console.error(err);
        _showToast("রিপোর্ট ব্যর্থ হয়েছে ❌");
    }
};

/* ── Mute user ── */
window._muteCurrentUser = async function () {
    _closeAllSheets();
    if (!auth.currentUser || !vs.userId) return;
    try {
        await set(ref(db, `muted/${auth.currentUser.uid}/${vs.userId}`), { timestamp: Date.now() });
        _showToast("ব্যবহারকারীকে মিউট করা হয়েছে 🔇");
        closeStoryViewer();
    } catch (err) {
        console.error(err);
    }
};

window._closeAllSheets = _closeAllSheets;

/* ================================================================
   ANALYTICS / VIEWERS BOTTOM SHEET
   ================================================================ */
window.openStoryViewersList = async function () {
    const sheet = document.getElementById("storyViewsSheet");
    if (!sheet) return;

    const story = vs.stories[vs.storyIndex];
    if (!story) return;

    // Skeleton loader আগে দেখাও
    sheet.innerHTML = `
        <div class="sheet-handle"></div>
        <div class="views-sheet-header">
            <div>
                <div class="views-sheet-count">—</div>
                <div class="views-sheet-label">জন দেখেছে</div>
            </div>
            <button class="views-sheet-close" onclick="window._closeAllSheets()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="viewer-list" id="viewerListBody">
            ${Array(4).fill(`
                <div class="viewer-list-skeleton">
                    <div class="skeleton-avatar"></div>
                    <div style="flex:1">
                        <div class="skeleton-line w-60"></div>
                        <div class="skeleton-line w-40"></div>
                    </div>
                </div>
            `).join("")}
        </div>
    `;

    _openSheet("storyViewsSheet");

    // Firebase থেকে ডেটা লোড
    try {
        const [viewsSnap, reactSnap] = await Promise.all([
            get(ref(db, `stories/${vs.userId}/${story.id}/views`)),
            get(ref(db, `stories/${vs.userId}/${story.id}/reactions`))
        ]);

        const viewsData   = viewsSnap.val()   || {};
        const reactData   = reactSnap.val()   || {};
        const viewerUids  = Object.keys(viewsData);
        const viewCount   = viewerUids.length;

        // Reactions map: uid → emoji char
        const emojiMap  = { love: "❤️", haha: "😂", wow: "😮", sad: "😢", angry: "😡", like: "👍" };
        const reactMap  = {};
        Object.values(reactData).forEach(r => {
            reactMap[r.from] = emojiMap[r.type] || "";
        });

        // Count update
        const countEl = sheet.querySelector(".views-sheet-count");
        if (countEl) countEl.textContent = viewCount;

        const listBody = document.getElementById("viewerListBody");
        if (!listBody) return;

        if (viewerUids.length === 0) {
            listBody.innerHTML = `
                <div style="padding:32px; text-align:center; color:rgba(255,255,255,0.45); font-size:14px;">
                    <i class="fas fa-eye-slash" style="font-size:28px; margin-bottom:12px; display:block;"></i>
                    এখনো কেউ দেখেনি
                </div>
            `;
            return;
        }

        // Parallel fetch users
        const userFetches = viewerUids.map(uid => get(ref(db, `users/${uid}`)));
        const userSnaps   = await Promise.all(userFetches);

        listBody.innerHTML = "";
        userSnaps.forEach((snap, i) => {
            if (!snap.exists()) return;
            const u   = snap.val();
            const uid = viewerUids[i];
            const ts  = viewsData[uid]?.timestamp;
            const safePhoto = u.photoURL || "https://cdn-icons-png.flaticon.com/512/149/149071.png";
            const safeName  = _escHtml(u.displayName || "User");
            const emoji     = reactMap[uid] || "";

            const item = document.createElement("div");
            item.className = "viewer-list-item";
            item.setAttribute("role", "button");
            item.setAttribute("tabindex", "0");
            item.innerHTML = `
                <img
                    class="viewer-list-avatar"
                    src="${safePhoto}"
                    onerror="this.src='https://cdn-icons-png.flaticon.com/512/149/149071.png'"
                    alt="${safeName}"
                >
                <div class="viewer-list-info">
                    <div class="viewer-list-name">${safeName}</div>
                    ${ts ? `<div class="viewer-list-time">${_relTime(ts)}</div>` : ""}
                </div>
                ${emoji ? `<span class="viewer-list-reaction">${emoji}</span>` : ""}
            `;
            item.addEventListener("click", () => {
                _closeAllSheets();
                closeStoryViewer();
                window.location.href = `profile.html?uid=${uid}`;
            });
            listBody.appendChild(item);
        });

    } catch (err) {
        console.error("Viewers fetch error:", err);
        const listBody = document.getElementById("viewerListBody");
        if (listBody) {
            listBody.innerHTML = `<div style="padding:24px; text-align:center; color:rgba(255,255,255,0.5);">ডেটা লোড ব্যর্থ হয়েছে</div>`;
        }
    }
};

/* ================================================================
   REACTIONS — Flying Emoji + Firebase + Notification
   ================================================================ */
const EMOJI_MAP = {
    love: "❤️", haha: "😂", wow: "😮",
    sad: "😢", angry: "😡", like: "👍"
};

export async function sendStoryReaction(emojiKey) {
    if (!auth.currentUser) return;
    const story = vs.stories[vs.storyIndex];
    if (!story) return;

    const emojiChar = EMOJI_MAP[emojiKey] || "❤️";
    _launchFlyingEmoji(emojiChar);

    try {
        await set(
            ref(db, `stories/${vs.userId}/${story.id}/reactions/${auth.currentUser.uid}`),
            { from: auth.currentUser.uid, type: emojiKey, timestamp: Date.now() }
        );

        // Notification to story owner (not to self)
        if (vs.userId !== auth.currentUser.uid) {
            await set(push(ref(db, `notifications/${vs.userId}`)), {
                type:       "story_reaction",
                postId:     story.id,
                sender:     auth.currentUser.displayName,
                senderImg:  auth.currentUser.photoURL,
                emoji:      emojiChar,
                read:       false,
                timestamp:  Date.now()
            });
        }
    } catch (err) {
        console.error("Reaction error:", err);
    }
}

function _launchFlyingEmoji(emojiChar) {
    // Random X জায়গায় উড়বে
    const left = 30 + Math.random() * 40; // 30%–70%
    const el   = document.createElement("div");
    el.className   = "flying-emoji";
    el.textContent = emojiChar;
    el.style.cssText = `
        left: ${left}%;
        bottom: 100px;
        position: fixed;
        font-size: 32px;
        pointer-events: none;
        z-index: 999999990;
        animation: flyUpFade 1.1s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1200);
}

/* ── Global wrapper for HTML onclick ── */
window.sendStoryReaction = sendStoryReaction;

/* ================================================================
   STORY REPLY — Message to story author
   ================================================================ */
export async function sendStoryMessage() {
    const input = document.getElementById("storyReplyInput");
    if (!input) return;
    const text = input.value.trim();
    if (!text || !auth.currentUser) return;

    const story    = vs.stories[vs.storyIndex];
    const myUid    = auth.currentUser.uid;
    const tgtUid   = vs.userId;
    const chatId   = myUid < tgtUid ? `${myUid}_${tgtUid}` : `${tgtUid}_${myUid}`;
    const msgText  = `[Story Reply] ${text}`;

    try {
        await set(push(ref(db, `chats/${chatId}/messages`)), {
            text:      msgText,
            sender:    myUid,
            storyId:   story.id,
            timestamp: Date.now()
        });

        const updates = {};
        updates[`user_chats/${myUid}/${tgtUid}`] = { lastMsg: `You: ${text}`, timestamp: Date.now() };
        updates[`user_chats/${tgtUid}/${myUid}`] = { lastMsg: msgText, timestamp: Date.now(), unseenCount: 1 };
        await update(ref(db), updates);

        // Notification
        await set(push(ref(db, `notifications/${tgtUid}`)), {
            type:      "story_reply",
            postId:    story.id,
            sender:    auth.currentUser.displayName,
            senderImg: auth.currentUser.photoURL,
            text:      text,
            read:      false,
            timestamp: Date.now()
        });

        input.value = "";
        _showToast("রিপ্লাই পাঠানো হয়েছে 📨");
    } catch (err) {
        console.error("Reply error:", err);
        _showToast("পাঠাতে ব্যর্থ হয়েছে ❌");
    }
}

window.sendStoryMessage = sendStoryMessage;

/* ================================================================
   EDITOR TOOL STUBS (UI ready — extend as needed)
   ================================================================ */
window.openEditorTextPrompt = function () {
    const overlay = document.getElementById("editorTextOverlay");
    if (overlay) { overlay.style.display = "block"; overlay.focus(); }
};

window.triggerStoryMusicMock  = () => _showToast("মিউজিক ফিচার শীঘ্রই আসছে 🎵");
window.triggerStoryEffectMock = () => _showToast("ফিল্টার শীঘ্রই আসছে ✨");
window.openStoryCropEditor    = () => _showToast("Crop ফিচার শীঘ্রই আসছে ✂️");

/* ================================================================
   UTILITY HELPERS
   ================================================================ */

/** Toast notification */
function _showToast(message, duration = 2800) {
    let toast = document.getElementById("_storyToast");
    if (!toast) {
        toast    = document.createElement("div");
        toast.id = "_storyToast";
        toast.className = "story-toast";
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove("show"), duration);
}
window._showToast = _showToast;

/** Upload progress bar */
function _setProgressBar(pct) {
    let bar = document.getElementById("_storyProgressBar");
    if (!bar) {
        const wrap = document.createElement("div");
        wrap.className = "story-upload-progress";
        bar    = document.createElement("div");
        bar.id = "_storyProgressBar";
        bar.className = "story-upload-progress-fill";
        wrap.appendChild(bar);
        document.body.appendChild(wrap);
    }
    bar.style.width = `${pct}%`;
    bar.parentElement.style.display = pct === 0 ? "none" : "block";
}

/** Relative time string */
function _relTime(timestamp) {
    const diff = Date.now() - timestamp;
    const m    = Math.floor(diff / 60000);
    const h    = Math.floor(m / 60);
    if (m < 1)  return "এইমাত্র";
    if (m < 60) return `${m}m`;
    if (h < 24) return `${h}h`;
    return "1d";
}

/** Basic HTML escape */
function _escHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* ── Public exports for external modules ── */
export { _showToast as showStoryToast };
// HTML এবং Navbar সামঞ্জস্যের জন্য গ্লোবাল আলিয়াস ম্যাপিং
window.openStoryCreator = window.openStoryCreatorModal;
window.closeStoryCreator = window.closeStoryCreatorModal;
window.postTextStory = window.publishTextStory;
window.reactToStory = window.sendStoryReaction;
window.sendStoryReply = window.sendStoryMessage;

// টেক্সট স্টোরির ব্যাকগ্রাউন্ড কালার পরিবর্তন করার ফাংশন
window.setStoryBg = function(color) {
    const editor = document.getElementById("textStoryEditor");
    if (editor) {
        editor.style.background = color;
        editor.dataset.bgColor = color;
    }
};
/* ── অ্যাপের মেইন হেডার এবং বটম নেভিগেশন হাইড/শো করার হেল্পারস ── */
function hideAppChrome() {
    const header = document.getElementById("fbHeaderContainer");
    if (header) header.style.setProperty("display", "none", "important");
    const bottomNav = document.querySelector(".bottom-nav");
    if (bottomNav) bottomNav.style.setProperty("display", "none", "important");
}

function showAppChrome() {
        const header = document.getElementById("fbHeaderContainer");
        if (header) header.style.removeProperty("display");
        const bottomNav = document.querySelector(".bottom-nav");
        if (bottomNav) bottomNav.style.removeProperty("display");
    }

    /* ── ফাইল আপলোডার চেঞ্জ লিসেনার (যা স্ক্রিপ্ট ক্র্যাশ হওয়া থেকে বাঁচাবে) ── */
    function _setupUploaderListeners() {
        const input = document.getElementById("storyMediaInput");
        if (input) {
            input.addEventListener("change", function(e) {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = function(evt) {
                    editorBase64 = evt.target.result;
                    _openMediaEditor(editorBase64);
                };
                reader.readAsDataURL(file);
            });
        }
    }
    /* ── স্ক্রিনশট ম্যাচিং মিউজিক পিল ট্র্যাকার ── */
/* ── স্ক্রিনশট ম্যাচিং মিউজিক পিল ট্র্যাকার ও ক্যানভাস এডিটর লজিক ── */
window.triggerStoryMusicMock = function() {
    const musicPill = document.getElementById("editorMusicPill");
    if (musicPill) {
        musicPill.style.display = "flex";
        const musicTitle = document.getElementById("musicPillTitle");
        if (musicTitle) musicTitle.textContent = "Beloved Naasheds";
        _showToast("মিউজিক ট্র্যাক যুক্ত করা হয়েছে 🎵");
    }
};

window.removeStoryMusic = function() {
    const musicPill = document.getElementById("editorMusicPill");
    if (musicPill) {
        musicPill.style.display = "none";
        _showToast("মিউজিক রিমুভ করা হয়েছে 🗑️");
    }
};

// ক্যানভাস মোডে কাস্টম টেক্সট টুল ওপেন করা
window.triggerStoryTextPrompt = function() {
    const textOverlay = document.getElementById("editorTextOverlay");
    if (textOverlay) {
        textOverlay.style.display = "block";
        textOverlay.focus();
    }
};

// ফেসবুকের চমৎকার ক্যানভাস গ্রেডিয়েন্ট ব্যাকগ্রাউন্ড সমূহের প্রিসেট লিস্ট
const PRESET_GRADIENTS = [
    "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", // পিঙ্ক ও অরেঞ্জ (ফেসবুক ডিফল্ট)
    "linear-gradient(135deg, #5ee7df 0%, #b490ca 100%)", // লাইট পার্পেল ও ব্লু
    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", // রয়্যাল পার্পেল
    "linear-gradient(135deg, #f6d365 0%, #fda085 100%)", // গোল্ডেন সানসেট
    "linear-gradient(135deg, #111214 0%, #303134 100%)", // চারকোল ডার্ক
    "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"  // স্কাই ব্লু
];
let currentGradientIndex = 0;

window.cycleStoryCanvasBackground = function() {
    const previewArea = document.querySelector(".editor-preview-area");
    if (previewArea) {
        currentGradientIndex = (currentGradientIndex + 1) % PRESET_GRADIENTS.length;
        previewArea.style.background = PRESET_GRADIENTS[currentGradientIndex];
        _showToast("ক্যানভাস ব্যাকগ্রাউন্ড পরিবর্তন হয়েছে 🎨");
    }
};