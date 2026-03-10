import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, set, onValue, update, remove, get, query, orderByKey, limitToLast, endBefore, equalTo, orderByChild, onChildAdded, onDisconnect, runTransaction, off, startAt, endAt, limitToFirst, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, updateProfile, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const ADMIN_UID = "Pg5ko76Pu8Zf4ja9MMzEJRLDMYs1"; 

const firebaseConfig = {
    apiKey: "AIzaSyBZtycgadrngON2WEwvIE7ERPYxdkDVfFM",
    authDomain: "muktolipidiary.firebaseapp.com",
    databaseURL: "https://muktolipidiary-default-rtdb.firebaseio.com",
    projectId: "muktolipidiary",
    storageBucket: "muktolipidiary.firebasestorage.app",
    messagingSenderId: "639103995400",
    appId: "1:639103995400:web:13528e51c0e86080770bbd"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const CLOUDINARY_CLOUD_NAME = "dvvx2frpu"; 
const CLOUDINARY_UPLOAD_PRESET = "story_upload"; 

window.allPosts = []; 
// NOTE: window.allComments has been intentionally DELETED to drastically improve performance.
window.db = db; window.ref = ref; window.push = push; window.set = set; window.update = update; window.remove = remove; window.runTransaction = runTransaction;
window.currentUser = null;
window.blockedUsers = []; 
window.userVerificationCache = {}; 
window.mentionedUids = []; 

window.reactionEmojiMap = { like: "👍", love: "❤️", care: "😘", haha: "😂", wow: "😮", sad: "😢", angry: "😡" };

const reactionAssets = {
    like: 'like.gif', love: 'love.gif', care: 'care.gif', haha: 'haha.gif', wow: 'wow.gif', sad: 'sad.gif', angry: 'angry.gif',
    staticLike: 'far fa-thumbs-up', solidLike: 'fas fa-thumbs-up'
};

const BAD_WORDS = ["খারাপ", "গালাগালি", "অশ্লীল", "কুত্তা", "শয়তান", "ফালতু", "haram", "kharap", "gali"];

const DEVICE_ID = localStorage.getItem('USER_DEVICE_ID') || 'u_' + Date.now();
localStorage.setItem('USER_DEVICE_ID', DEVICE_ID);

let lastLoadedKey = null;
let isLoadingPosts = false;
let reachedEnd = false;
let activeCategoryFilter = 'সব';
let currentlyViewingUid = null;
let activeChatId = null;
let activeChatPartnerUid = null;
let typingTimeout = null;
let commentPressTimer = null;
let isCommentLongPress = false;

window.imgError = function(image) {
    image.onerror = ""; 
    const type = image.getAttribute('data-type') || 'like';
    const fallbacks = {
        like: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Facebook_Like_2016.svg/100px-Facebook_Like_2016.svg.png',
        love: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Facebook_Love_2016.svg/100px-Facebook_Love_2016.svg.png',
        care: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Facebook_Care_Reaction.png/100px-Facebook_Care_Reaction.png',
        haha: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Facebook_Haha_2016.svg/100px-Facebook_Haha_2016.svg.png', 
        wow: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Facebook_Wow_2016.svg/100px-Facebook_Wow_2016.svg.png',
        sad: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Facebook_Sad_2016.svg/100px-Facebook_Sad_2016.svg.png',
        angry: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Facebook_Angry_2016.svg/100px-Facebook_Angry_2016.svg.png'
    };
    image.src = fallbacks[type] || fallbacks.like;
    image.style.transform = "scale(0.8)";
    return true;
};

window.formatPostContent = function(text) {
    if (!text) return '';
    let formatted = text.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" style="color:var(--primary-color); text-decoration:underline;" onclick="event.stopPropagation()">$1</a>');
    formatted = formatted.replace(/#(\w+)/g, '<span class="hashtag" onclick="event.stopPropagation(); filterPosts(\'#$1\')">#$1</span>');
    formatted = formatted.replace(/@([\w\u0980-\u09FF\s]+)/g, function(match, name) {
        return `<span class="mentioned-link">${match}</span>`;
    });
    return formatted;
};

window.compressImage = function(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1200;
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => { resolve(new File([blob], file.name, {type:'image/jpeg', lastModified:Date.now()})); }, 'image/jpeg', 0.8); 
            };
            img.onerror = () => resolve(file); 
        };
        reader.onerror = () => resolve(file); 
    });
};

window.getVerifiedBadge = function(isVerified) {
    return isVerified ? `<i class="fas fa-certificate verified-badge" style="color: #1877f2; position: relative;">
        <i class="fas fa-check" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 10px; color: white;"></i>
    </i>` : '';
};

window.fetchBlockedUsers = function(uid) {
    return get(ref(db, `users/${uid}/blockedUsers`)).then(snap => {
        if(snap.exists()) { window.blockedUsers = Object.keys(snap.val()); } 
        else { window.blockedUsers = []; }
    });
};

onAuthStateChanged(auth, async (user) => {
    window.currentUser = user;

    if(user) {
        if (window.OneSignalDeferred) {
            window.OneSignalDeferred.push(function(OneSignal) { OneSignal.login(user.uid); });
        }
        await fetchBlockedUsers(user.uid);
        syncUserProfile(user);
        document.getElementById('loginModal').style.display = 'none';
        initNotificationListener(user.uid);
        initChatListener(user.uid); 

        const connectedRef = ref(db, '.info/connected');
        const myStatusRef = ref(db, 'status/' + user.uid);
        const myPresenceRef = ref(db, 'presence/' + user.uid); 

        onValue(connectedRef, (snap) => {
            if (snap.val() === true) {
                onDisconnect(myStatusRef).remove();
                set(myStatusRef, { state: 'online', last_changed: Date.now() });
                set(myPresenceRef, { online: true, lastSeen: serverTimestamp() });
                onDisconnect(myPresenceRef).set({ online: false, lastSeen: serverTimestamp() });
            }
        });

        if(document.getElementById('profileView').style.display === 'block') {
            const params = new URLSearchParams(window.location.search);
            if(!params.get('uid') || params.get('uid') === user.uid) loadProfile();
        }

        if(document.getElementById('yourStoryBg')) {
             document.getElementById('yourStoryBg').style.backgroundImage = `url('${user.photoURL}')`;
        }
        loadFacebookStories();
    } else {
        if (window.OneSignalDeferred) {
            window.OneSignalDeferred.push(function(OneSignal) { OneSignal.logout(); });
        }
        window.blockedUsers = [];
        localStorage.removeItem('IS_ADMIN');
        document.getElementById('notifBadge').classList.remove('active');
        document.getElementById('msgBadge').classList.remove('active');
    }
    updateAuthUI(user);
});

window.performLogin = () => signInWithPopup(auth, provider).catch(console.error);

function syncUserProfile(user) {
    const userRef = ref(db, 'users/' + user.uid);
    get(userRef).then(snapshot => {
        if(!snapshot.exists()) {
            set(userRef, { displayName: user.displayName, email: user.email, photoURL: user.photoURL, bio: "আমি মুক্তলিপি ব্যবহার করছি।", joinDate: Date.now(), isVerified: false });
        }
    });
}

window.logoutFunc = () => signOut(auth).then(() => { showToast("লগআউট হয়েছে"); window.location.href = window.location.origin; });

function updateAuthUI(user) {
    const drawerLogout = document.getElementById('drawerLogoutBtn');
    if(user) {
        document.getElementById('userAvatar').src = user.photoURL;
        document.getElementById('userName').innerText = user.displayName;
        document.getElementById('submitBtn').disabled = false;
        if(drawerLogout) drawerLogout.style.display = 'flex';
    } else {
        if(drawerLogout) drawerLogout.style.display = 'none';
    }
}

// ==========================================================================
// 🎯 FACEBOOK-STYLE STORY SYSTEM LOGIC (START)
// ==========================================================================

let currentStoryViewerState = { userId: null, storyIndex: 0, stories: [], timerId: null, paused: false };

window.loadFacebookStories = function() {
    if (!window.currentUser) return;

    const storiesRef = ref(db, 'stories');
    onValue(storiesRef, async (snapshot) => {
        const allStoriesData = snapshot.val() || {};
        const friendsContainer = document.getElementById('storiesBar');

        const yourStoryCard = friendsContainer.firstElementChild;
        friendsContainer.innerHTML = '';
        friendsContainer.appendChild(yourStoryCard);

        const now = Date.now();
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
        const validStories = [];

        if(allStoriesData[window.currentUser.uid]) {
            const myStories = Object.entries(allStoriesData[window.currentUser.uid])
                .map(([k,v]) => ({id:k, ...v}))
                .filter(s => now - s.timestamp < TWENTY_FOUR_HOURS)
                .sort((a,b) => a.timestamp - b.timestamp);

            if(myStories.length > 0) {
                yourStoryCard.classList.add('active-story');
                yourStoryCard.onclick = () => openStoryViewer(window.currentUser.uid, 0);
                document.querySelector('.your-story .story-label').innerText = "Your Story";
            } else {
                yourStoryCard.classList.remove('active-story');
                yourStoryCard.onclick = openStoryCreator;
                document.querySelector('.your-story .story-label').innerText = "Create Story";
            }
        }

        for (const [uid, userStories] of Object.entries(allStoriesData)) {
            if (uid === window.currentUser.uid) continue;
            if (window.blockedUsers.includes(uid)) continue;

            const activeStories = Object.entries(userStories)
                .map(([k,v]) => ({id:k, ...v}))
                .filter(s => now - s.timestamp < TWENTY_FOUR_HOURS)
                .sort((a,b) => a.timestamp - b.timestamp);

            if (activeStories.length > 0) validStories.push({ uid, stories: activeStories });
        }

        for (const userStoryData of validStories) {
            const userSnap = await get(ref(db, `users/${userStoryData.uid}`));
            if (!userSnap.exists()) continue;
            const user = userSnap.val();

            const lastStory = userStoryData.stories[userStoryData.stories.length - 1];
            const bgImage = lastStory.type === 'image' ? `url(${lastStory.content})` : (lastStory.type === 'video' ? `url(${user.photoURL})` : 'none');
            const bgColor = lastStory.type === 'text' ? lastStory.backgroundColor : '#333';
            const seenKey = `SEEN_STORY_${userStoryData.uid}_${lastStory.id}`;
            const isSeen = localStorage.getItem(seenKey) === 'true';

            const card = document.createElement('div');
            card.className = 'story-card friend-story';
            card.setAttribute('data-uid', userStoryData.uid);
            card.setAttribute('data-seen', isSeen);

            if (lastStory.type === 'text') { card.style.background = bgColor; } else { card.style.backgroundImage = bgImage; }

            let isOnline = false;
            const presenceSnap = await get(ref(db, `presence/${userStoryData.uid}`));
            if(presenceSnap.exists() && presenceSnap.val().online) isOnline = true;

            card.innerHTML = `
                <img src="${user.photoURL}" class="story-author-img" loading="lazy" onerror="this.src='https://cdn-icons-png.flaticon.com/512/149/149071.png'">
                <div class="story-online-dot ${isOnline ? 'active' : ''}"></div>
                <span class="story-username">${user.displayName.split(' ')[0]}</span>
            `;

            card.onclick = () => openStoryViewer(userStoryData.uid, 0);
            friendsContainer.appendChild(card);
        }
    });
};

window.openStoryCreator = function() {
    if(!checkAuth()) return;
    document.getElementById('storyCreatorModal').style.display = 'flex';
};
window.closeStoryCreator = () => document.getElementById('storyCreatorModal').style.display = 'none';

let textStoryBg = '#1877f2';
window.openTextStoryEditor = function() {
    document.getElementById('textStoryEditor').style.display = 'flex';
    setStoryBg('#1877f2'); 
};
window.closeTextStoryEditor = () => document.getElementById('textStoryEditor').style.display = 'none';

window.setStoryBg = function(color) {
    textStoryBg = color;
    document.getElementById('textStoryEditor').style.background = color;
};

window.postTextStory = function() {
    const text = document.getElementById('storyTextInputField').value.trim();
    if (!text) return showToast("Please write something!");
    saveStoryToFirebase({ type: 'text', content: text, backgroundColor: textStoryBg });
    closeTextStoryEditor(); closeStoryCreator();
    document.getElementById('storyTextInputField').value = '';
};

window.triggerMediaUpload = function(type) {
    const input = document.getElementById('storyMediaInput');
    input.accept = type === 'image' ? "image/*" : "video/*";
    input.onchange = (e) => handleMediaFile(e.target.files[0], type);
    input.click();
};

window.handleMediaFile = async function(file, type) {
    if (!file) return;
    if (type === 'image' && file.size > 10 * 1024 * 1024) return showToast("Image too large (Max 10MB)");
    if (type === 'video' && file.size > 50 * 1024 * 1024) return showToast("Video too large (Max 50MB)");

    document.getElementById('storyLoader').style.display = 'block';
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET); 
    formData.append('cloud_name', CLOUDINARY_CLOUD_NAME);

    try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.secure_url) {
            saveStoryToFirebase({ type: type, content: data.secure_url });
            document.getElementById('storyLoader').style.display = 'none';
            closeStoryCreator(); showToast("Story Uploaded Successfully! ✅");
        } else throw new Error("Upload failed");
    } catch (err) {
        console.error(err);
        document.getElementById('storyLoader').style.display = 'none';
        showToast("Upload Failed ❌");
    }
};

function saveStoryToFirebase(storyData) {
    const newStoryRef = push(ref(db, `stories/${window.currentUser.uid}`));
    set(newStoryRef, { ...storyData, timestamp: Date.now(), views: {}, reactions: {} });
}

window.openStoryViewer = async function(userId, startIndex = 0) {
    const viewer = document.getElementById('storyViewerModal');
    viewer.style.display = 'flex';

    const snap = await get(ref(db, `stories/${userId}`));
    const allStories = snap.val() || {};
    const now = Date.now();
    const stories = Object.entries(allStories)
        .map(([k,v]) => ({id:k, ...v}))
        .filter(s => now - s.timestamp < 24 * 60 * 60 * 1000)
        .sort((a,b) => a.timestamp - b.timestamp);

    if (stories.length === 0) return closeStoryViewer();
    const userSnap = await get(ref(db, `users/${userId}`));
    const user = userSnap.val();

    currentStoryViewerState = {
        userId: userId, storyIndex: startIndex, stories: stories,
        userName: user.displayName, userImg: user.photoURL, timerId: null, paused: false
    };
    renderViewerStory();
};

window.closeStoryViewer = function() {
    document.getElementById('storyViewerModal').style.display = 'none';
    clearInterval(currentStoryViewerState.timerId);
    const video = document.querySelector('.viewer-media');
    if(video && video.tagName === 'VIDEO') video.pause();
};

function renderViewerStory() {
    const state = currentStoryViewerState;
    const story = state.stories[state.storyIndex];
    const contentArea = document.getElementById('viewerContentArea');

    document.getElementById('viewerAuthorName').innerText = state.userName;
    document.getElementById('viewerAuthorImg').src = state.userImg;
    document.getElementById('viewerTime').innerText = getRelativeTime(story.timestamp);

    const progressContainer = document.getElementById('viewerProgressBars');
    progressContainer.innerHTML = '';
    state.stories.forEach((_, idx) => {
        const barBg = document.createElement('div'); barBg.className = 'progress-bar-bg';
        const barFill = document.createElement('div'); barFill.className = 'progress-bar-fill';
        if (idx < state.storyIndex) barFill.style.width = '100%';
        else if (idx > state.storyIndex) barFill.style.width = '0%';
        barBg.appendChild(barFill); progressContainer.appendChild(barBg);
    });

    if (story.type === 'text') {
        contentArea.innerHTML = `<div class="viewer-text-bg" style="background:${story.backgroundColor}">${story.content}</div>`;
        startProgress(5000); 
    } else if (story.type === 'image') {
        contentArea.innerHTML = `<img src="${story.content}" loading="lazy" class="viewer-media">`;
        startProgress(5000); 
    } else if (story.type === 'video') {
        contentArea.innerHTML = `<video src="${story.content}" class="viewer-media" autoplay playsinline></video>`;
        const video = contentArea.querySelector('video');
        video.onloadedmetadata = () => startProgress(video.duration * 1000);
        video.onended = nextStorySegment;
    }

    const leftTap = document.createElement('div'); leftTap.className = 'nav-tap-area left-tap'; leftTap.onclick = prevStorySegment;
    const rightTap = document.createElement('div'); rightTap.className = 'nav-tap-area right-tap'; rightTap.onclick = nextStorySegment;
    contentArea.appendChild(leftTap); contentArea.appendChild(rightTap);

    localStorage.setItem(`SEEN_STORY_${state.userId}_${story.id}`, 'true');
    if (state.userId !== window.currentUser.uid) {
        update(ref(db, `stories/${state.userId}/${story.id}/views/${window.currentUser.uid}`), { timestamp: Date.now() });
    }
}

function startProgress(duration) {
    clearInterval(currentStoryViewerState.timerId);
    const currentBarFill = document.querySelectorAll('.progress-bar-fill')[currentStoryViewerState.storyIndex];
    let startTime = Date.now();
    currentStoryViewerState.timerId = setInterval(() => {
        if (currentStoryViewerState.paused) { startTime += 50; return; }
        const elapsed = Date.now() - startTime;
        const percent = Math.min((elapsed / duration) * 100, 100);
        currentBarFill.style.width = percent + '%';
        if (elapsed >= duration) {
            clearInterval(currentStoryViewerState.timerId);
            if (currentStoryViewerState.stories[currentStoryViewerState.storyIndex].type !== 'video') nextStorySegment();
        }
    }, 50);
}

window.nextStorySegment = function() {
    if (currentStoryViewerState.storyIndex < currentStoryViewerState.stories.length - 1) {
        currentStoryViewerState.storyIndex++; renderViewerStory();
    } else { closeStoryViewer(); }
};

window.prevStorySegment = function() {
    if (currentStoryViewerState.storyIndex > 0) { currentStoryViewerState.storyIndex--; renderViewerStory(); } 
    else { renderViewerStory(); }
};

document.addEventListener('mousedown', (e) => { if (e.target.closest('.viewer-content')) currentStoryViewerState.paused = true; });
document.addEventListener('mouseup', () => currentStoryViewerState.paused = false);
document.addEventListener('touchstart', (e) => { if (e.target.closest('.viewer-content')) currentStoryViewerState.paused = true; });
document.addEventListener('touchend', () => currentStoryViewerState.paused = false);

window.reactToStory = function(type) {
    const state = currentStoryViewerState;
    const story = state.stories[state.storyIndex];
    const btn = event.target;
    btn.style.transform = "scale(1.5)"; setTimeout(() => btn.style.transform = "scale(1)", 200);

    push(ref(db, `stories/${state.userId}/${story.id}/reactions`), { from: window.currentUser.uid, type: type, timestamp: Date.now() });
    if (state.userId !== window.currentUser.uid) { sendStoryNotification(state.userId, `Reacted ${window.reactionEmojiMap[type]} to your story`, story.id); }
};

window.sendStoryReply = function() {
    const input = document.getElementById('storyReplyInput');
    const text = input.value.trim(); if (!text) return;
    const state = currentStoryViewerState;
    const chatId = getChatId(window.currentUser.uid, state.userId);
    const replyMsg = `Replied to your story: ${text}`;

    push(ref(db, `chats/${chatId}/messages`), { text: replyMsg, sender: window.currentUser.uid, timestamp: Date.now() });
    update(ref(db, `user_chats/${window.currentUser.uid}/${state.userId}`), { lastMsg: "You: " + replyMsg, timestamp: Date.now() });
    update(ref(db, `user_chats/${state.userId}/${window.currentUser.uid}`), { lastMsg: replyMsg, timestamp: Date.now(), unseenCount: 1 }); 
    input.value = ''; showToast("Reply sent! 📨");
};

function sendStoryNotification(targetUid, msg, storyId) {
     push(ref(db, `notifications/${targetUid}`), { type: 'story_reaction', postId: storyId, sender: window.currentUser.displayName, senderImg: window.currentUser.photoURL, read: false, timestamp: Date.now() });
}

// ==========================================================================
// AUTH & UI LOGIC
// ==========================================================================

window.togglePasswordVisibility = function(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.nextElementSibling.querySelector('i');
    if (input.type === 'password') { input.type = 'text'; icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash'); } 
    else { input.type = 'password'; icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); }
}

window.handleEmailLogin = async function() {
    const username = document.getElementById('loginEmailUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!username || !password) { Swal.fire({icon: 'warning', title: 'সতর্কতা!', text: 'দয়া করে সকল তথ্য পূরণ করুন', confirmButtonText: 'ঠিক আছে'}); return; }
    const email = `${username}@gmail.com`;
    Swal.fire({title: 'লগইন করা হচ্ছে...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
    try {
        await signInWithEmailAndPassword(auth, email, password);
        Swal.fire({icon: 'success', title: 'সফল!', text: 'লগইন সফল হয়েছে', timer: 1500, showConfirmButton: false});
        setTimeout(() => { window.location.reload(); }, 1500);
    } catch (error) {
        Swal.fire({icon: 'error', title: 'লগইন ব্যর্থ', text: 'সঠিক তথ্য দিন অথবা ইন্টারনেট সংযোগ পরীক্ষা করুন', confirmButtonText: 'আবার চেষ্টা করুন'});
    }
}

window.handleForgotPassword = async function() {
    const { value: username } = await Swal.fire({title: 'পাসওয়ার্ড রিসেট', input: 'text', inputLabel: 'আপনার ইমেইল (শুধুমাত্র @gmail.com এর আগের অংশ)', inputPlaceholder: 'উদাহরণ: yourusername', showCancelButton: true, confirmButtonText: 'রিসেট লিংক পাঠান', cancelButtonText: 'বাতিল'});
    if (username) {
        const email = `${username}@gmail.com`;
        try { await sendPasswordResetEmail(auth, email); Swal.fire('সফল!', 'পাসওয়ার্ড রিসেট লিংক আপনার ইমেইলে পাঠানো হয়েছে', 'success'); } 
        catch (error) { Swal.fire('ত্রুটি', 'পাসওয়ার্ড রিসেট ব্যর্থ হয়েছে।', 'error'); }
    }
}

window.showSignupModal = function() { document.getElementById('signupModal').style.display = 'flex'; document.getElementById('loginModal').style.display = 'none'; }
window.closeSignupModal = function() { document.getElementById('signupModal').style.display = 'none'; }
window.showLoginModal = function() { closeSignupModal(); document.getElementById('loginModal').style.display = 'flex'; }

window.handleEmailSignup = async function() {
    const name = document.getElementById('signupName').value.trim();
    const username = document.getElementById('signupEmailUsername').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;
    if (!name || !username || !password || !confirmPassword) { Swal.fire({icon: 'warning', title: 'সতর্কতা!', text: 'সকল তথ্য পূরণ করুন', confirmButtonText: 'ঠিক আছে'}); return; }
    if (password.length < 6) { Swal.fire({icon: 'warning', title: 'দুর্বল পাসওয়ার্ড', text: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে', confirmButtonText: 'ঠিক আছে'}); return; }
    if (password !== confirmPassword) { Swal.fire({icon: 'error', title: 'ত্রুটি', text: 'পাসওয়ার্ড মিলছে না', confirmButtonText: 'ঠিক আছে'}); return; }

    const email = `${username}@gmail.com`;
    Swal.fire({title: 'একাউন্ট তৈরি করা হচ্ছে...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await updateProfile(user, { displayName: name });
        await set(ref(db, `users/${user.uid}`), { displayName: name, email: email, photoURL: 'https://cdn-icons-png.flaticon.com/512/149/149071.png', createdAt: new Date().toISOString(), isVerified: false });
        closeSignupModal();
        Swal.fire({icon: 'success', title: 'স্বাগতম!', text: 'একাউন্ট তৈরি সফল হয়েছে', confirmButtonText: 'প্রোফাইল আপডেট করুন', showCancelButton: true, cancelButtonText: 'পরে'}).then((r) => { if(r.isConfirmed) openProfileEdit(); else window.location.reload(); });
    } catch (error) { Swal.fire({icon: 'error', title: 'ত্রুটি', text: 'একাউন্ট তৈরি ব্যর্থ। ইমেইলটি ব্যবহৃত হতে পারে।', confirmButtonText: 'চেষ্টা করুন'}); }
}

window.handleGoogleSignup = async function() {
    Swal.fire({title: 'Google সাইনআপ...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const userRef = ref(db, `users/${user.uid}`);
        const snap = await get(userRef);
        if(!snap.exists()) {
            await set(userRef, { displayName: user.displayName, email: user.email, photoURL: user.photoURL, createdAt: new Date().toISOString(), isVerified: false });
            closeSignupModal();
            Swal.fire({icon: 'success', title: 'স্বাগতম!', confirmButtonText: 'প্রোফাইল আপডেট', showCancelButton: true}).then((r) => { if(r.isConfirmed) openProfileEdit(); else window.location.reload(); });
        } else {
            Swal.fire({icon: 'success', title: 'সফল!', text: 'লগইন সফল', timer:1500, showConfirmButton:false});
            setTimeout(() => window.location.reload(), 1500);
        }
    } catch (error) { Swal.fire({icon: 'error', title: 'ত্রুটি', text: 'Google সাইনআপ ব্যর্থ'}); }
}

let selectedProfilePhoto = null;
let selectedCoverPhoto = null;

window.openProfileEdit = async function() {
    const user = auth.currentUser;
    if(!user) return;
    const snap = await get(ref(db, `users/${user.uid}`));
    if(snap.exists()){
        const d = snap.val();
        document.getElementById('editName').value = d.displayName || '';
        document.getElementById('editBio').value = d.bio || '';
        document.getElementById('editFacebook').value = d.socialLinks?.facebook || '';
        document.getElementById('editYoutube').value = d.socialLinks?.youtube || '';
        document.getElementById('editTiktok').value = d.socialLinks?.tiktok || '';
        document.getElementById('editWhatsapp').value = d.socialLinks?.whatsapp || '';
        document.getElementById('profilePhotoPreview').src = d.photoURL || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        document.getElementById('coverPhotoImg').src = d.coverURL || '';
        document.getElementById('bioCharCounter').innerText = (d.bio||'').length + "/150";
    }
    document.getElementById('profileEditModal').style.display = 'flex';
}
window.closeProfileEdit = function() { document.getElementById('profileEditModal').style.display = 'none'; selectedProfilePhoto = null; selectedCoverPhoto = null; }

window.triggerProfileUpload = () => document.getElementById('profilePhotoInput').click();
window.handleProfilePhotoSelect = (e) => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader(); reader.onload = (e) => document.getElementById('profilePhotoPreview').src = e.target.result;
    reader.readAsDataURL(file); selectedProfilePhoto = file;
}
window.triggerCoverUpload = () => document.getElementById('coverPhotoInput').click();
window.handleCoverPhotoSelect = (e) => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader(); reader.onload = (e) => document.getElementById('coverPhotoImg').src = e.target.result;
    reader.readAsDataURL(file); selectedCoverPhoto = file;
}

document.getElementById('editBio').addEventListener('input', function() {
    const len = this.value.length;
    const ctr = document.getElementById('bioCharCounter');
    ctr.innerText = len + "/150";
    ctr.style.color = len > 150 ? '#e74c3c' : 'var(--secondary-text)';
});

window.uploadToImgbb = async function(file) {
    const compressed = await compressImage(file);
    const fd = new FormData(); fd.append('image', compressed); fd.append('key', '8304af1d699b61abb70d5efe569d4179');
    const res = await fetch('https://api.imgbb.com/1/upload', { method:'POST', body:fd });
    const data = await res.json();
    if(data.success) return data.data.url;
    throw new Error('Upload failed');
}

window.saveProfileChanges = async function() {
    const user = auth.currentUser;
    if(!user) return;
    const name = document.getElementById('editName').value.trim();
    const bio = document.getElementById('editBio').value.trim();
    if(!name) { Swal.fire({icon:'warning', title:'সতর্কতা', text:'নাম অবশ্যই পূরণ করতে হবে'}); return; }
    if(bio.length > 150) { Swal.fire({icon:'warning', title:'সতর্কতা', text:'বায়ো ১৫০ অক্ষরের বেশি হতে পারবেবিধা'}); return; }

    Swal.fire({title:'আপডেট করা হচ্ছে...', allowOutsideClick:false, didOpen:()=>Swal.showLoading()});
    try {
        let pUrl = document.getElementById('profilePhotoPreview').src;
        let cUrl = document.getElementById('coverPhotoImg').src;
        if(selectedProfilePhoto) { Swal.update({html:'প্রোফাইল ছবি আপলোড হচ্ছে...'}); pUrl = await uploadToImgbb(selectedProfilePhoto); await updateProfile(user, {photoURL:pUrl}); }
        if(selectedCoverPhoto) { Swal.update({html:'কভার ফটো আপলোড হচ্ছে...'}); cUrl = await uploadToImgbb(selectedCoverPhoto); }
        if(name !== user.displayName) await updateProfile(user, {displayName:name});

        Swal.update({html:'তথ্য সংরক্ষণ করা হচ্ছে...'});
        await update(ref(db, `users/${user.uid}`), {
            displayName: name, photoURL: pUrl, coverURL: cUrl, bio: bio,
            'socialLinks/facebook': document.getElementById('editFacebook').value.trim(),
            'socialLinks/youtube': document.getElementById('editYoutube').value.trim(),
            'socialLinks/tiktok': document.getElementById('editTiktok').value.trim(),
            'socialLinks/whatsapp': document.getElementById('editWhatsapp').value.trim(),
            updatedAt: new Date().toISOString()
        });

        Swal.fire({icon:'success', title:'সফল!', text:'প্রোফাইল আপডেট হয়েছে', timer:1500, showConfirmButton:false});
        closeProfileEdit(); setTimeout(()=>loadProfile(user.uid), 1500);
    } catch(e) { Swal.fire({icon:'error', title:'ত্রুটি', text:'আপডেট ব্যর্থ হয়েছে'}); }
}

window.renderSocialLinks = function(links) {
    const c = document.getElementById('socialLinksDisplay');
    if(!c) return;
    let h = '';
    if(links?.facebook) h += `<a href="${links.facebook}" target="_blank" class="social-link-btn" style="background:#1877f2;"><i class="fab fa-facebook-f"></i></a>`;
    if(links?.youtube) h += `<a href="${links.youtube}" target="_blank" class="social-link-btn" style="background:#ff0000;"><i class="fab fa-youtube"></i></a>`;
    if(links?.tiktok) h += `<a href="${links.tiktok}" target="_blank" class="social-link-btn" style="background:#000000;"><i class="fab fa-tiktok"></i></a>`;
    if(links?.whatsapp) h += `<a href="${links.whatsapp}" target="_blank" class="social-link-btn" style="background:#25d366;"><i class="fab fa-whatsapp"></i></a>`;
    c.innerHTML = h;
}

function initNotificationListener(uid) {
    onValue(ref(db, `notifications/${uid}`), (snapshot) => {
        const data = snapshot.val();
        let count = 0;
        if(data) count = Object.values(data).filter(n => !n.read).length;
        const badge = document.getElementById('notifBadge');
        if(count > 0) { badge.innerText = count > 9 ? '9+' : count; badge.classList.add('active'); } 
        else { badge.classList.remove('active'); }
    });
}

function sendNotification(targetUid, type, postId) {
    if(!window.currentUser || targetUid === window.currentUser.uid) return;
    let messageText = "আপনার প্রোফাইলে নতুন অ্যাক্টিভিটি";
    if(type === 'like') messageText = `${window.currentUser.displayName} আপনার পোস্টে লাইক দিয়েছেন ❤️`;
    else if(type === 'comment') messageText = `${window.currentUser.displayName} আপনার পোস্টে মন্তব্য করেছেন 💬`;
    else if(type === 'reply') messageText = `${window.currentUser.displayName} আপনার মন্তব্যের উত্তর দিয়েছেন ↩️`;
    else if(type === 'mention') messageText = `${window.currentUser.displayName} আপনাকে একটি কমেন্টে মেনশন করেছেন 🔔`;

    push(ref(db, `notifications/${targetUid}`), { type: type, postId: postId, sender: window.currentUser.displayName, senderImg: window.currentUser.photoURL, read: false, timestamp: Date.now() });

    const options = {
        method: 'POST',
        headers: { accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Basic os_v2_app_2jdqafko2fbhjfv5czkpq3fvjiqp5yq2byzeeemgeysttodrzyklib3ykxct6c7k6tmdequnkrba5ercnk7kdn6wrsonxnywj2kna5q' },
        body: JSON.stringify({ app_id: "d2470015-4ed1-4274-96bd-1654f86cb54a", include_aliases: { external_id: [targetUid] }, target_channel: "push", contents: { en: messageText }, headings: { en: "মুক্তলিপি ডায়েরি" }, url: window.location.origin + "?post=" + postId })
    };
    fetch('https://onesignal.com/api/v1/notifications', options).catch(err => console.error(err));
}

window.showNotifications = function() {
    if(!checkAuth()) return;
    document.getElementById('sheetTitle').innerText = 'নোটিফিকেশন';
    document.getElementById('sheetFooter').style.display = 'none';
    document.getElementById('universalBottomSheet').classList.add('active');
    const listRef = ref(db, `notifications/${window.currentUser.uid}`);
    get(query(listRef, limitToLast(20))).then(snap => {
        const data = snap.val();
        if(!data) { document.getElementById('sheetBody').innerHTML = '<div style="text-align:center; color:#888; padding:20px;">কোনো নোটিফিকেশন নেই</div>'; return; }
        const notifs = Object.entries(data).map(([k,v]) => ({key:k, ...v})).reverse();
        const html = notifs.map(n => {
            let text = "অ্যাক্টিভিটি";
            if(n.type === 'like') text = `আপনার পোস্টে লাইক দিয়েছেন ❤️`;
            else if(n.type === 'comment') text = `আপনার পোস্টে মন্তব্য করেছেন 💬`;
            else if(n.type === 'reply') text = `আপনার মন্তব্যের উত্তর দিয়েছেন ↩️`;
            else if(n.type === 'mention') text = `আপনাকে একটি কমেন্টে মেনশন করেছেন 🔔`;
            return `<div class="notif-item ${!n.read ? 'unread' : ''}" onclick="handleNotifClick('${n.key}', '${n.postId}')"><img src="${n.senderImg}" loading="lazy" class="notif-avatar"><div class="notif-text"><strong>${n.sender}</strong> ${text}<div class="notif-time">${new Date(n.timestamp).toLocaleDateString()}</div></div></div>`;
        }).join('');
        document.getElementById('sheetBody').innerHTML = html;
    });
};

window.handleNotifClick = function(notifKey, postId) {
    update(ref(db, `notifications/${window.currentUser.uid}/${notifKey}`), { read: true });
    document.getElementById('universalBottomSheet').classList.remove('active');
    const post = window.allPosts.find(p => p.key === postId);
    if(post) openDetailView(postId);
    else get(ref(db, `posts/${postId}`)).then(s => { if(s.exists()) { const p = s.val(); p.key = postId; window.allPosts.push(p); openDetailView(postId); } else showToast('পোস্টটি পাওয়া যায়নি'); });
};

// ==========================================================================
// CHAT & FEED LOGIC
// ==========================================================================

function getChatId(uid1, uid2) { return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`; }

function initChatListener(uid) {
    onValue(ref(db, `user_chats/${uid}`), (snap) => {
        const data = snap.val();
        if(!data) {
             document.getElementById('chatListContainer').innerHTML = '<div style="text-align:center; padding:30px; color:var(--secondary-text);">কোনো বার্তা নেই</div>';
             document.getElementById('msgBadge').classList.remove('active');
             return;
        }
        let totalUnread = 0;
        const chats = Object.entries(data).map(([targetUid, info]) => {
            if(info.unseenCount) totalUnread += info.unseenCount;
            return { targetUid, ...info };
        });
        const badge = document.getElementById('msgBadge');
        if(totalUnread > 0) { badge.innerText = totalUnread > 9 ? '9+' : totalUnread; badge.classList.add('active'); }
        else badge.classList.remove('active');

        if(document.getElementById('chatListView').style.display === 'block') {
            renderChatList(chats.sort((a,b) => b.timestamp - a.timestamp));
        }
    });
}

async function renderChatList(chats) {
    const container = document.getElementById('chatListContainer');
    let html = '';
    for(const chat of chats) {
        const userSnap = await get(ref(db, `users/${chat.targetUid}`));
        const user = userSnap.val() || { displayName: 'User', photoURL: 'https://cdn-icons-png.flaticon.com/512/149/149071.png', isVerified: false };
        const statusSnap = await get(ref(db, `status/${chat.targetUid}`));
        const isOnline = statusSnap.exists();
        const badgeHtml = getVerifiedBadge(user.isVerified);
        html += `
        <div class="chat-list-item ${chat.unseenCount > 0 ? 'unread' : ''}" onclick="openChatRoom('${chat.targetUid}')">
            <div class="chat-avatar-wrapper">
                <img src="${user.photoURL}" loading="lazy" class="chat-avatar">
                <div class="online-dot ${isOnline ? 'active' : ''}"></div>
            </div>
            <div class="chat-info">
                <div class="chat-name">${user.displayName} ${badgeHtml}</div>
                <div class="chat-preview" style="${chat.unseenCount>0?'font-weight:bold; color:var(--text-color);':''}">${chat.lastMsg || 'Sent a photo'}</div>
            </div>
            <div class="chat-meta">
                <div>${new Date(chat.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                ${chat.unseenCount > 0 ? `<div style="background:var(--primary-color); color:white; border-radius:50%; width:18px; height:18px; display:flex; align-items:center; justify-content:center; font-size:10px; margin-left:auto; margin-top:5px;">${chat.unseenCount}</div>` : ''}
            </div>
        </div>`;
    }
    container.innerHTML = html;
}

window.openChatRoom = async function(targetUid) {
    window.history.pushState({ modal: 'chat' }, "", "#chat");
    if(!checkAuth()) return;
    activeChatPartnerUid = targetUid;
    const myUid = window.currentUser.uid;
    activeChatId = getChatId(myUid, targetUid);

    const userSnap = await get(ref(db, `users/${targetUid}`));
    const user = userSnap.val() || { displayName: 'User', photoURL: 'https://cdn-icons-png.flaticon.com/512/149/149071.png', isVerified: false };
    document.getElementById('chatRoomImg').src = user.photoURL;
    document.getElementById('chatRoomName').innerHTML = `${user.displayName} ${getVerifiedBadge(user.isVerified)}`;

    const statusSnap = await get(ref(db, `status/${targetUid}`));
    document.getElementById('chatRoomStatus').innerText = statusSnap.exists() ? 'Active Now' : 'Offline';
    update(ref(db, `user_chats/${myUid}/${targetUid}`), { unseenCount: 0 });

    const isBlocked = window.blockedUsers.includes(targetUid);
    const input = document.getElementById('chatInput');
    const btn = document.getElementById('sendMsgBtn');
    if (isBlocked) {
        input.disabled = true; input.placeholder = "You have blocked this user.";
        btn.style.opacity = 0.5; btn.style.pointerEvents = 'none';
    } else {
        input.disabled = false; input.placeholder = "মেসেজ লিখুন...";
        btn.style.opacity = 1; btn.style.pointerEvents = 'auto';
    }

    document.getElementById('chatMessages').innerHTML = '';
    document.getElementById('chatRoomView').style.display = 'flex';

    const messagesRef = query(ref(db, `chats/${activeChatId}/messages`), limitToLast(50));
    onValue(messagesRef, (snap) => {
        const data = snap.val();
        const container = document.getElementById('chatMessages');
        container.innerHTML = '';
        if(data) {
            Object.entries(data).forEach(([key, msg]) => {
                const isMe = msg.sender === myUid;
                const div = document.createElement('div');
                div.className = `msg-bubble ${isMe ? 'msg-sent' : 'msg-received'}`;
                div.innerHTML = `${formatPostContent(msg.text)} <div class="msg-time">${new Date(msg.timestamp).toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'})}</div>`;
                if(isMe) {
                    div.oncontextmenu = (e) => { e.preventDefault(); confirmDeleteMessage(activeChatId, key); };
                    let pressTimer;
                    div.ontouchstart = () => { pressTimer = setTimeout(() => confirmDeleteMessage(activeChatId, key), 800); };
                    div.ontouchend = () => clearTimeout(pressTimer);
                }
                container.appendChild(div);
            });
        }
        container.scrollTop = container.scrollHeight;
    });

    onValue(ref(db, `chats/${activeChatId}/typing/${targetUid}`), snap => {
        const isTyping = snap.val();
        document.getElementById('typingInd').style.display = isTyping ? 'flex' : 'none';
        if(isTyping) document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;
    });
};

document.getElementById('sendMsgBtn').onclick = sendMessage;
document.getElementById('chatInput').addEventListener('keypress', (e) => {
    if(e.key === 'Enter') sendMessage();
    update(ref(db, `chats/${activeChatId}/typing/${window.currentUser.uid}`), true);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => update(ref(db, `chats/${activeChatId}/typing/${window.currentUser.uid}`), false), 2000);
});

function sendMessage() {
    if(window.blockedUsers.includes(activeChatPartnerUid)) return;
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if(!text) return;
    const myUid = window.currentUser.uid;
    const targetUid = activeChatPartnerUid;
    push(ref(db, `chats/${activeChatId}/messages`), { text: text, sender: myUid, timestamp: Date.now() });
    update(ref(db, `user_chats/${myUid}/${targetUid}`), { lastMsg: "You: " + text, timestamp: Date.now() });
    const targetRef = ref(db, `user_chats/${targetUid}/${myUid}`);
    get(targetRef).then(snap => {
        const currentUnseen = (snap.val() && snap.val().unseenCount) || 0;
        update(targetRef, { lastMsg: text, timestamp: Date.now(), unseenCount: currentUnseen + 1 });
    });
    input.value = '';
    update(ref(db, `chats/${activeChatId}/typing/${window.currentUser.uid}`), false);
}

window.confirmDeleteMessage = function(chatId, msgId) {
     Swal.fire({
        title: 'Unsend Message?', showCancelButton: true, confirmButtonText: 'Unsend', confirmButtonColor: '#e74c3c'
    }).then((result) => { if (result.isConfirmed) { remove(ref(db, `chats/${chatId}/messages/${msgId}`)); } });
};

window.initChatFromProfile = function() {
    if(!checkAuth()) return;
    const targetUid = currentlyViewingUid;
    if(targetUid === window.currentUser.uid) return;
    openChatRoom(targetUid);
};

window.checkAuth = function() {
    if (window.currentUser) return true;
    document.getElementById('loginModal').style.display = 'flex';
    return false;
};

window.renderSkeletons = function() {
    const feed = document.getElementById('feed');
    let html = '';
    for(let i=0; i<4; i++) {
        html += `<div class="skeleton-card"><div class="sk-header"><div class="skeleton sk-avatar"></div><div class="sk-info"><div class="skeleton sk-name"></div><div class="skeleton sk-date"></div></div></div>${i % 2 === 0 ? '<div class="skeleton sk-img"></div>' : ''}<div class="skeleton sk-title"></div><div class="skeleton sk-line"></div><div class="skeleton sk-line"></div><div class="skeleton sk-line short"></div></div>`;
    }
    feed.innerHTML = html;
};
window.renderSkeletons();

window.loadPostsChunk = function(reset = false) {
    if (isLoadingPosts || (reachedEnd && !reset)) return;
    isLoadingPosts = true;
    const spinner = document.getElementById('loadingSpinner');
    spinner.style.display = 'block';

    if (reset) {
        window.allPosts = []; lastLoadedKey = null; reachedEnd = false;
        document.getElementById('feed').innerHTML = ''; renderSkeletons();
    }

    let postsRef = ref(db, 'posts');
    let postsQuery;
    if (activeCategoryFilter !== 'সব' && activeCategoryFilter !== 'সংরক্ষিত') {
        postsQuery = query(postsRef, orderByChild('category'), equalTo(activeCategoryFilter), limitToLast(20));
    } else {
        if (lastLoadedKey) postsQuery = query(postsRef, orderByKey(), limitToLast(10), endBefore(lastLoadedKey));
        else postsQuery = query(postsRef, orderByKey(), limitToLast(10));
    }

    get(postsQuery).then(async (snapshot) => {
        spinner.style.display = 'none';
        const data = snapshot.val();
        if (!data) {
            reachedEnd = true;
            if(window.allPosts.length === 0) document.getElementById('feed').innerHTML = '<div style="text-align:center; padding:30px;">কোনো পোস্ট নেই</div>';
            isLoadingPosts = false;
            return;
        }

        let newPosts = Object.entries(data).map(([key, val]) => ({ key, ...val }));
        newPosts = newPosts.filter(p => !window.blockedUsers.includes(p.uid));
        newPosts.sort((a, b) => b.timestamp - a.timestamp);
        if (newPosts.length < 10) reachedEnd = true;
        const keys = Object.keys(data).sort();
        lastLoadedKey = keys[0]; 
        window.allPosts = [...window.allPosts, ...newPosts];

        const uniqueUids = [...new Set(newPosts.map(p => p.uid).filter(uid => uid && !window.userVerificationCache.hasOwnProperty(uid)))];
        if(uniqueUids.length > 0) {
            await Promise.all(uniqueUids.map(uid => 
                get(ref(db, `users/${uid}/isVerified`)).then(snap => {
                    window.userVerificationCache[uid] = snap.val() === true;
                })
            ));
        }

        if (activeCategoryFilter === 'সংরক্ষিত') {
           const savedKeys = JSON.parse(localStorage.getItem('SAVED_POSTS') || '[]');
           const savedPosts = window.allPosts.filter(p => savedKeys.includes(p.key));
           renderFeed(savedPosts);
        } else { renderFeed(window.allPosts); }

        updateGreeting(); isLoadingPosts = false;
    }).catch(err => { spinner.style.display = 'none'; isLoadingPosts = false; console.error(err); });
};
loadPostsChunk(true);

window.addEventListener('scroll', () => {
    if(window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) {
        if (document.getElementById('feedView').style.display !== 'none' && activeCategoryFilter === 'সব') loadPostsChunk();
    }
});

function updateGreeting() {
    const hr = new Date().getHours();
    let greet = `<i class="fas fa-moon"></i> শুভ রাত্রি`;
    if (hr >= 5 && hr < 12) greet = `<i class="fas fa-sun"></i> শুভ সকাল`;
    else if (hr >= 12 && hr < 17) greet = `<i class="fas fa-cloud-sun"></i> শুভ দুপুর`;
    else if (hr >= 17 && hr < 20) greet = `<i class="fas fa-city"></i> শুভ সন্ধ্যা`;
    const name = window.currentUser ? window.currentUser.displayName.split(' ')[0] : "বন্ধু";
    document.getElementById('greetingText').innerHTML = `${greet}, ${name}`;
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('dateText').innerText = new Date().toLocaleDateString('bn-BD', options);
}

let pressTimer = null;
let isLongPress = false;

window.startLongPress = function(e, key, btn) {
    if(!checkAuth()) return;
    isLongPress = false;
    pressTimer = setTimeout(() => {
        isLongPress = true;
        if(navigator.vibrate) navigator.vibrate(50);
        showReactions(key, btn);
    }, 500);
};

window.endLongPress = function(e, key, btn) {
    if (pressTimer) clearTimeout(pressTimer);
    if (!isLongPress) {
        document.querySelectorAll('.reaction-box').forEach(b => b.classList.remove('show'));
        toggleReaction(key, 'like');
    }
    isLongPress = false;
};

window.showReactions = function(key, btnEl) {
    document.querySelectorAll('.reaction-box').forEach(b => b.classList.remove('show'));
    const wrapper = btnEl.closest('.action-btn-wrapper');
    const bar = wrapper.querySelector('.reaction-box');
    if(bar) { 
        bar.classList.add('show'); 
        setTimeout(() => { if(!isLongPress) bar.classList.remove('show'); }, 4000);
    }
};

window.handleReactionMove = function(e, container) {
    if(!isLongPress && e.type !== 'mousemove') return; 
    e.preventDefault(); 
    const touch = e.touches ? e.touches[0] : e;
    const x = touch.clientX; const y = touch.clientY;
    const items = container.querySelectorAll('.reaction-item');
    let activeItem = null;
    items.forEach(item => {
        const rect = item.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top - 20 && y <= rect.bottom + 20) activeItem = item;
    });
    items.forEach(item => {
        if (item === activeItem) {
            if (!item.classList.contains('active')) {
                if(navigator.vibrate) navigator.vibrate(10); 
                item.classList.add('active');
            }
        } else { item.classList.remove('active'); }
    });
};

window.handleReactionRelease = function(e, key, container) {
    if (pressTimer) clearTimeout(pressTimer);
    const activeItem = container.querySelector('.reaction-item.active');
    if (activeItem) {
        const type = activeItem.dataset.type;
        const src = activeItem.querySelector('img').src;
        performFlyingAnimation(activeItem, key, src);
        toggleReaction(key, type);
        container.classList.remove('show');
        container.querySelectorAll('.reaction-item').forEach(i => i.classList.remove('active'));
    }
    isLongPress = false;
};

window.handleReactionClick = function(e, type, key) {
    e.stopPropagation();
    const target = e.currentTarget;
    const src = target.querySelector('img').src;
    performFlyingAnimation(target, key, src);
    toggleReaction(key, type);
    target.closest('.reaction-box').classList.remove('show');
};

function performFlyingAnimation(startEl, key, imgSrc) {
    const startRect = startEl.getBoundingClientRect();
    let btn = document.querySelector(`#post-${key} .action-btn.like-btn`);
    if (!btn) btn = document.querySelector(`#comment-like-btn-${key}`);
    if(!btn) return;

    const endRect = btn.getBoundingClientRect();
    const flyer = document.createElement('img');
    flyer.src = imgSrc; flyer.className = 'flying-emoji';
    flyer.style.left = startRect.left + 'px'; flyer.style.top = startRect.top + 'px';
    document.body.appendChild(flyer); flyer.offsetHeight; 
    flyer.style.left = (endRect.left + 10) + 'px'; flyer.style.top = (endRect.top) + 'px';
    flyer.style.opacity = '0'; flyer.style.transform = 'scale(0.5)';
    setTimeout(() => {
        flyer.remove();
        btn.classList.add('btn-bounce');
        setTimeout(() => btn.classList.remove('btn-bounce'), 600);
    }, 600);
}

function getReactionStyle(type) {
    const map = {
        'like': { text: 'Like', color: '#1877f2', icon: reactionAssets.like }, 
        'love': { text: 'Love', color: '#e74c3c', icon: reactionAssets.love },
        'care': { text: 'Care', color: '#f7b928', icon: reactionAssets.care },
        'haha': { text: 'Haha', color: '#f7b928', icon: reactionAssets.haha }, 
        'wow':  { text: 'Wow',  color: '#f7b928', icon: reactionAssets.wow },  
        'sad':  { text: 'Sad',  color: '#f7b928', icon: reactionAssets.sad },
        'angry':{ text: 'Angry',color: '#e74c3c', icon: reactionAssets.angry }
    };
    return map[type] || { text: 'Like', color: '#1877f2', icon: reactionAssets.like }; 
}

window.toggleReaction = function(postId, newType) {
    if(!checkAuth()) return;
    const uid = window.currentUser.uid;
    const userReactionRef = ref(db, `reactions/${postId}/${uid}`);

    get(userReactionRef).then(snap => {
        const currentType = snap.val();
        if (currentType === newType) {
            remove(userReactionRef);
            runTransaction(ref(db, `reactionCount/${postId}/${currentType}`), (count) => { return (count || 0) > 0 ? count - 1 : 0; });
        } else {
            set(userReactionRef, newType);
            if (currentType) {
                runTransaction(ref(db, `reactionCount/${postId}/${currentType}`), (count) => { return (count || 0) > 0 ? count - 1 : 0; });
            } else {
                const post = window.allPosts.find(p => p.key === postId);
                if(post && post.uid && post.uid !== uid) sendNotification(post.uid, 'like', postId); 
            }
            runTransaction(ref(db, `reactionCount/${postId}/${newType}`), (count) => { return (count || 0) + 1; });
        }
    });
};

function listenToPostReactions(postId) {
    if(window.currentUser) {
        const myReactionRef = ref(db, `reactions/${postId}/${window.currentUser.uid}`);
        onValue(myReactionRef, (snap) => {
            const type = snap.val();
            updatePostButtonUI(postId, type);
        });
    }
    const countRef = ref(db, `reactionCount/${postId}`);
    onValue(countRef, (snap) => {
        const data = snap.val() || {};
        updatePostSummaryUI(postId, data);
    });
}

function updatePostButtonUI(postId, type) {
    const btn = document.querySelector(`#post-${postId} .action-btn.like-btn`);
    if(!btn) return;
    if(type) {
        const style = getReactionStyle(type);
        let iconHTML = type === 'like' ? `<i class="${reactionAssets.solidLike}"></i>` : `<img src="${style.icon}" style="width:18px;height:18px;vertical-align:middle;" loading="lazy">`;
        btn.innerHTML = `${iconHTML} <span class="count-text" style="margin-left:4px;">${style.text}</span>`;
        btn.style.color = style.color; btn.classList.add('liked');
    } else {
        btn.innerHTML = `<i class="${reactionAssets.staticLike}"></i> <span class="count-text" style="margin-left:4px;">Like</span>`;
        btn.style.color = ''; btn.classList.remove('liked');
    }
}

function updatePostSummaryUI(postId, counts) {
    const summaryContainer = document.querySelector(`#summary-${postId}`);
    if(!summaryContainer) return;
    let total = 0; const types = [];
    for (const [type, count] of Object.entries(counts)) {
        if(count > 0) { total += count; types.push({type, count}); }
    }
    types.sort((a,b) => b.count - a.count);
    const topTypes = types.slice(0, 3); 
    let html = '';
    if (total > 0) {
        html += `<div class="reaction-icons-stack">`;
        topTypes.forEach(t => {
            const style = getReactionStyle(t.type);
            html += `<img src="${style.icon}" onerror="this.style.display='none'" loading="lazy">`;
        });
        html += `</div><span>${total}</span>`;
    }
    summaryContainer.innerHTML = html;
}

window.openWhoReactedModal = function(postId) {
    const modal = document.getElementById('whoReactedModal');
    const list = document.getElementById('whoReactedList');
    list.innerHTML = '<div style="text-align:center; padding:20px; color:var(--secondary-text);">Loading...</div>';
    modal.style.display = 'flex';

    get(ref(db, `reactions/${postId}`)).then(async snap => {
        const data = snap.val();
        if(!data) { list.innerHTML = '<div style="text-align:center; padding:20px; color:var(--secondary-text);">No reactions yet.</div>'; return; }
        const reactionEntries = Object.entries(data);
        let html = '';
        for(const [uid, type] of reactionEntries) {
            const userSnap = await get(ref(db, `users/${uid}`));
            const user = userSnap.val() || { displayName: "Unknown User", photoURL: "https://cdn-icons-png.flaticon.com/512/149/149071.png" };
            const emoji = window.reactionEmojiMap[type] || "👍";
            html += `
            <div class="reaction-user-item" onclick="viewUserProfile('${uid}'); document.getElementById('whoReactedModal').style.display='none';">
                <img src="${user.photoURL}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;" loading="lazy">
                <span style="font-weight:600; font-size:14px;">${user.displayName}</span>
                <span class="reaction-user-emoji">${emoji}</span>
            </div>`;
        }
        list.innerHTML = html;
    });
};

window.renderFeed = function(posts, targetId = 'feed') {
    const feed = document.getElementById(targetId);
    if(!posts || !posts.length) return feed.innerHTML = '<div style="text-align:center; padding:30px; width:100%;">কোনো পোস্ট নেই</div>';

    feed.innerHTML = posts.map(post => {
        let contentHTML = post.content || '';
        let tempDiv = document.createElement("div"); tempDiv.innerHTML = contentHTML;
        let plainText = tempDiv.textContent || tempDiv.innerText || "";
        let displayContent = "";
        if(plainText.length > 150) {
            let truncated = plainText.substring(0, 150) + "...";
            displayContent = `${formatPostContent(truncated)} <span class="read-more-btn" onclick="openDetailView('${post.key}')">আরও পড়ুন</span>`;
        } else {
            displayContent = formatPostContent(contentHTML);
        }

        const authorImg = post.userImg || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        const shareCount = parseInt(localStorage.getItem('SHARE_COUNT_' + post.key) || '0');
        const isVerified = window.userVerificationCache[post.uid] === true;
        const badgeHtml = getVerifiedBadge(isVerified);

        setTimeout(() => listenToPostReactions(post.key), 0);

        const reactionsHTML = `
        <div class="reaction-box" 
             ontouchmove="handleReactionMove(event, this)" 
             ontouchend="handleReactionRelease(event, '${post.key}', this)"
             onmousemove="handleReactionMove(event, this)"
             onmouseleave="this.classList.remove('show')">
            <div class="reaction-item" data-type="like" onclick="handleReactionClick(event, 'like', '${post.key}')"><img src="${reactionAssets.like}" class="reaction-img" loading="lazy" onerror="window.imgError(this)"></div>
            <div class="reaction-item" data-type="love" onclick="handleReactionClick(event, 'love', '${post.key}')"><img src="${reactionAssets.love}" class="reaction-img" loading="lazy" onerror="window.imgError(this)"></div>
            <div class="reaction-item" data-type="care" onclick="handleReactionClick(event, 'care', '${post.key}')"><img src="${reactionAssets.care}" class="reaction-img" loading="lazy" onerror="window.imgError(this)"></div>
            <div class="reaction-item" data-type="haha" onclick="handleReactionClick(event, 'haha', '${post.key}')"><img src="${reactionAssets.haha}" class="reaction-img" loading="lazy" onerror="window.imgError(this)"></div>
            <div class="reaction-item" data-type="wow" onclick="handleReactionClick(event, 'wow', '${post.key}')"><img src="${reactionAssets.wow}" class="reaction-img" loading="lazy" onerror="window.imgError(this)"></div>
            <div class="reaction-item" data-type="sad" onclick="handleReactionClick(event, 'sad', '${post.key}')"><img src="${reactionAssets.sad}" class="reaction-img" loading="lazy" onerror="window.imgError(this)"></div>
            <div class="reaction-item" data-type="angry" onclick="handleReactionClick(event, 'angry', '${post.key}')"><img src="${reactionAssets.angry}" class="reaction-img" loading="lazy" onerror="window.imgError(this)"></div>
        </div>`;

        return `
        <div class="post-card glass-panel" id="post-${post.key}">
            ${post.isPinned ? '<i class="fas fa-thumbtack pinned-badge"></i>' : ''}
            <button class="post-options-btn" onclick="event.stopPropagation(); openPostMenu('${post.key}', '${post.uid}', '${post.author}')"><i class="fas fa-ellipsis-h"></i></button>
            <div class="author-info" onclick="event.stopPropagation(); viewUserProfile('${post.uid}')">
                <div class="avatar-circle"><img src="${authorImg}" loading="lazy" onerror="this.src='https://cdn-icons-png.flaticon.com/512/149/149071.png'"></div>
                <div class="author-text"><h4>${post.author} ${badgeHtml}</h4><div class="post-meta"><i class="far fa-clock"></i> ${post.date}</div></div>
            </div>
            ${post.image ? `<div class="post-img-container" onclick="openDetailView('${post.key}')"><img src="${post.image}" class="post-img" loading="lazy"></div>` : ''}
            <h2 class="post-title" onclick="openDetailView('${post.key}')">${post.title}</h2>
            <div class="content-preview">${displayContent}</div>
            
            <div id="summary-${post.key}" class="reaction-summary-bar" onclick="openWhoReactedModal('${post.key}')"></div>

            <div class="interaction-bar">
                <div class="action-btn-wrapper">
                    ${reactionsHTML}
                    <button class="action-btn like-btn" 
                        onmousedown="startLongPress(event, '${post.key}', this)" 
                        onmouseup="endLongPress(event, '${post.key}', this)"
                        ontouchstart="startLongPress(event, '${post.key}', this)"
                        ontouchend="endLongPress(event, '${post.key}', this)"
                        oncontextmenu="return false;">
                        <i class="${reactionAssets.staticLike}"></i> <span class="count-text" style="margin-left:4px;">Like</span>
                    </button>
                </div>
                <button class="action-btn" onclick="event.stopPropagation(); openCommentsSheet('${post.key}');"><i class="far fa-comment"></i> <span class="count-text" id="comment-count-${post.key}">0</span></button>
                <button class="action-btn" onclick="event.stopPropagation(); incrementShare('${post.key}'); openShareSheet('${post.key}');"><i class="fas fa-share-nodes"></i> <span id="shareCnt-${post.key}" class="count-text">${shareCount}</span></button>
            </div>
        </div>`;
    }).join('');

    // Fetch comment counts dynamically specifically for rendering posts without global bottlenecks
    posts.forEach(post => {
        get(ref(db, `comments/${post.key}`)).then(snap => {
            const countEl = document.getElementById(`comment-count-${post.key}`);
            if (countEl) countEl.innerText = snap.exists() ? Object.keys(snap.val()).length : 0;
        });
    });
}

window.openPostMenu = function(postKey, authorUid, authorName) {
    document.getElementById('sheetTitle').innerText = 'অপশন';
    document.getElementById('sheetFooter').style.display = 'none';
    const isMe = window.currentUser && window.currentUser.uid === authorUid;
    const isAdmin = window.currentUser && window.currentUser.uid === ADMIN_UID;
    let html = `<div class="menu-option" onclick="closeBottomSheet(); handleReport('${postKey}', '${authorUid}')"><i class="fas fa-exclamation-triangle"></i> রিপোর্ট করুন</div>`;
    if (!isMe) { html += `<div class="menu-option" onclick="closeBottomSheet(); handleBlock('${authorUid}', '${authorName}')"><i class="fas fa-ban"></i> ব্লক করুন (${authorName})</div>`; }
    if (isMe || isAdmin) { html += `<div class="menu-option danger" onclick="closeBottomSheet(); handleDelete('${postKey}')"><i class="fas fa-trash"></i> পোস্ট মুছুন</div>`; }
    document.getElementById('sheetBody').innerHTML = html;
    document.getElementById('universalBottomSheet').classList.add('active');
};

window.handleReport = async function(postKey, authorUid) {
    if(!checkAuth()) return;
    document.getElementById('universalBottomSheet').classList.remove('active');
    const { value: reason } = await Swal.fire({ title: 'রিপোর্টের কারণ', input: 'select', inputOptions: { 'spam': 'স্প্যাম', 'harassment': 'হয়রানি', 'nudity': 'অশ্লীলতা', 'hate': 'ঘৃণাত্মক বক্তব্য', 'other': 'অন্যান্য' }, inputPlaceholder: 'কারণ নির্বাচন করুন', showCancelButton: true, confirmButtonText: 'জমা দিন' });
    if (reason) { push(ref(db, 'reports'), { postId: postKey, reportedUser: authorUid, reportedBy: window.currentUser.uid, reportedByName: window.currentUser.displayName || "Anonymous", reason: reason, timestamp: Date.now(), status: "pending" }).then(() => { Swal.fire('ধন্যবাদ', 'আপনার রিপোর্ট জমা হয়েছে।', 'success'); }); }
};

window.handleBlock = function(targetUid, name) {
    if(!checkAuth()) return;
    document.getElementById('universalBottomSheet').classList.remove('active');
    Swal.fire({ title: 'ব্লক করবেন?', text: `${name}-এর পোস্ট আর দেখা যাবে না।`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#e74c3c', confirmButtonText: 'হ্যাঁ, ব্লক' }).then((result) => { if (result.isConfirmed) { update(ref(db, `users/${window.currentUser.uid}/blockedUsers`), { [targetUid]: true }).then(() => { window.blockedUsers.push(targetUid); showToast("ব্লক করা হয়েছে 🚫"); loadPostsChunk(true); }); } });
};

window.handleDelete = function(key) {
    document.getElementById('universalBottomSheet').classList.remove('active');
    Swal.fire({ title: 'ডিলিট করবেন?', text: "এটি ফিরে পাওয়া যাবে না!", icon: 'warning', showCancelButton: true, confirmButtonText: 'হ্যাঁ, ডিলিট' }).then((result) => { if (result.isConfirmed) { remove(ref(db, 'posts/'+key)).then(() => showToast("ডিলিট হয়েছে")); } });
};

window.incrementShare = function(key) {
    let count = parseInt(localStorage.getItem('SHARE_COUNT_' + key) || '0');
    count++; localStorage.setItem('SHARE_COUNT_' + key, count);
    const el = document.getElementById('shareCnt-' + key); if(el) el.innerText = count;
};

// ==========================================================================
// COMMENTS SYSTEM (FB STYLE + NESTING FIX)
// ==========================================================================

function getRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const sec = 1000; const min = 60 * sec; const hour = 60 * min; const day = 24 * hour;
    if (diff < min) return "Just now";
    if (diff < hour) return Math.floor(diff / min) + "m";
    if (diff < day) return Math.floor(diff / hour) + "h";
    if (diff < 7 * day) return Math.floor(diff / day) + "d";
    return new Date(timestamp).toLocaleDateString();
}

window.openCommentsSheet = (key) => {
    if(!checkAuth()) return;

    document.getElementById('sheetTitle').innerText = 'মন্তব্য';
    document.getElementById('sheetBody').innerHTML = '<p style="text-align:center; padding:20px;">লোড হচ্ছে...</p>';
    document.getElementById('sheetFooter').style.display = 'flex';
    document.getElementById('universalBottomSheet').classList.add('active');

    cancelReply(); 
    window.currentPostId = key;
    window.mentionedUids = []; 
    const inputEl = document.getElementById('sheetInput');
    inputEl.oninput = (e) => window.handleMentionInput(e);

    onValue(ref(db, 'comments/'+key), async snap => {
        const data = snap.val();
        if(!data) { 
            document.getElementById('sheetBody').innerHTML = '<p style="text-align:center; color:var(--secondary-text); padding:20px;">কোনো মন্তব্য নেই। আপনিই প্রথম মন্তব্য করুন!</p>'; 
            return; 
        }

        const allComments = Object.entries(data).map(([k,v]) => ({key:k, ...v}));
        window.currentPostComments = allComments; 

        const parents = allComments.filter(c => !c.parentId).sort((a,b) => b.timestamp - a.timestamp);
        const children = allComments.filter(c => c.parentId);

        let html = '<div class="comment-container" style="padding-bottom:80px;">';
        for (const p of parents) {
            html += await renderCommentBubble(p, false); 
            const myChildren = children.filter(c => c.parentId === p.key).sort((a,b) => a.timestamp - b.timestamp);
            if (myChildren.length > 0) {
                html += `<div id="replies-${p.key}" class="reply-indent" style="display:flex;">`; 
                for(const child of myChildren) { html += await renderCommentBubble(child, true); }
                html += `</div>`;
            }
        }
        html += '</div>';
        document.getElementById('sheetBody').innerHTML = html;
    });

    const sendBtn = document.getElementById('sheetSendBtn');
    const newBtn = sendBtn.cloneNode(true);
    sendBtn.parentNode.replaceChild(newBtn, sendBtn);

    newBtn.onclick = () => {
        const inputEl = document.getElementById('sheetInput');
        const txt = inputEl.value.trim();
        const parentId = inputEl.dataset.parentId || null; 
        if(!txt) return;

        get(ref(db, `users/${window.currentUser.uid}/isVerified`)).then(snap => {
            const isVerified = snap.val() === true;
            const myAvatar = window.currentUser.photoURL; 

            const commentData = { 
                text: txt, author: window.currentUser.displayName, uid: window.currentUser.uid,
                userImg: myAvatar, timestamp: Date.now(), parentId: parentId,  
                isVerified: isVerified, reactions: {}
            };

            push(ref(db, 'comments/'+key), commentData);

            if (window.mentionedUids.length > 0) {
                window.mentionedUids.forEach(uid => {
                    if(uid !== window.currentUser.uid) sendNotification(uid, 'mention', key);
                });
                window.mentionedUids = []; 
            }

            const post = window.allPosts.find(p => p.key === key);
            if (parentId) {
                const parentComm = window.currentPostComments.find(c => c.key === parentId);
                if(parentComm && parentComm.uid && parentComm.uid !== window.currentUser.uid && !window.mentionedUids.includes(parentComm.uid)) {
                     sendNotification(parentComm.uid, 'reply', key);
                }
            } else {
                if(post && post.uid && post.uid !== window.currentUser.uid && !window.mentionedUids.includes(post.uid)) { 
                    sendNotification(post.uid, 'comment', key); 
                }
            }
        });

        cancelReply();
    };
};

async function renderCommentBubble(c, isReply) {
    let isVerified = c.isVerified === true;
    const badgeHtml = getVerifiedBadge(isVerified);
    const userImg = c.userImg || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    const timeAgo = getRelativeTime(c.timestamp);

    let reactionCount = 0; let topReactionIcon = '';
    if (c.reactions) {
        const reacts = Object.values(c.reactions); reactionCount = reacts.length;
        if(reactionCount > 0) {
             const type = reacts[reacts.length-1].type; 
             const style = getReactionStyle(type);
             if(type === 'like') topReactionIcon = '<i class="fas fa-thumbs-up" style="color:#1877f2"></i>';
             else topReactionIcon = `<img src="${style.icon}" loading="lazy" style="width:10px; height:10px;">`;
        }
    }

    let myReaction = null;
    if(c.reactions && window.currentUser && c.reactions[window.currentUser.uid]) myReaction = c.reactions[window.currentUser.uid];
    let btnText = "Like"; let btnStyle = "";
    if(myReaction) {
         const s = getReactionStyle(myReaction.type);
         btnText = s.text; btnStyle = `color:${s.color};`;
    }

    const wrapperClass = isReply ? 'comment-wrapper reply-style' : 'comment-wrapper';

    const reactionBoxHTML = `
    <div class="reaction-box" id="reaction-dock-${c.key}" ontouchmove="handleReactionMove(event, this)" ontouchend="handleCommentReactionRelease(event, '${window.currentPostId}', '${c.key}', this)" onmousemove="handleReactionMove(event, this)" onmouseleave="this.classList.remove('show')">
        <div class="reaction-item" data-type="like" onclick="handleCommentReactionClick(event, 'like', '${window.currentPostId}', '${c.key}')"><img src="${reactionAssets.like}" loading="lazy" class="reaction-img"></div>
        <div class="reaction-item" data-type="love" onclick="handleCommentReactionClick(event, 'love', '${window.currentPostId}', '${c.key}')"><img src="${reactionAssets.love}" loading="lazy" class="reaction-img"></div>
        <div class="reaction-item" data-type="care" onclick="handleCommentReactionClick(event, 'care', '${window.currentPostId}', '${c.key}')"><img src="${reactionAssets.care}" loading="lazy" class="reaction-img"></div>
        <div class="reaction-item" data-type="haha" onclick="handleCommentReactionClick(event, 'haha', '${window.currentPostId}', '${c.key}')"><img src="${reactionAssets.haha}" loading="lazy" class="reaction-img"></div>
        <div class="reaction-item" data-type="wow" onclick="handleCommentReactionClick(event, 'wow', '${window.currentPostId}', '${c.key}')"><img src="${reactionAssets.wow}" loading="lazy" class="reaction-img"></div>
        <div class="reaction-item" data-type="sad" onclick="handleCommentReactionClick(event, 'sad', '${window.currentPostId}', '${c.key}')"><img src="${reactionAssets.sad}" loading="lazy" class="reaction-img"></div>
        <div class="reaction-item" data-type="angry" onclick="handleCommentReactionClick(event, 'angry', '${window.currentPostId}', '${c.key}')"><img src="${reactionAssets.angry}" loading="lazy" class="reaction-img"></div>
    </div>`;

    return `
    <div class="${wrapperClass}" id="comment-wrap-${c.key}">
        <img src="${userImg}" loading="lazy" class="comment-avatar" onclick="closeBottomSheet(); viewUserProfile('${c.uid}')" style="cursor:pointer;">
        <div class="comment-content-box">
            <div class="comment-bubble">
                <span class="comment-author-name" onclick="closeBottomSheet(); viewUserProfile('${c.uid}')">${c.author} ${badgeHtml}</span>
                <span class="comment-text">${formatPostContent(c.text)}</span>
                ${reactionCount > 0 ? `<div class="comment-reaction-badge">${topReactionIcon} ${reactionCount}</div>` : ''}
            </div>
            <div class="comment-actions">
                <div class="action-btn-wrapper">
                     ${reactionBoxHTML}
                     <button class="c-action-btn" id="comment-like-btn-${c.key}" style="${btnStyle}" onmousedown="startCommentPress(event, '${c.key}', this)" onmouseup="endCommentPress(event, '${window.currentPostId}', '${c.key}', this)" ontouchstart="startCommentPress(event, '${c.key}', this)" ontouchend="endCommentPress(event, '${window.currentPostId}', '${c.key}', this)" oncontextmenu="return false;">${btnText}</button>
                </div>
                <button class="c-action-btn" onclick="startReply('${c.key}', '${c.author}')">Reply</button>
                <span>${timeAgo}</span>
            </div>
        </div>
    </div>`;
}

window.toggleReplies = function(parentId) {
    const container = document.getElementById(`replies-${parentId}`);
    const link = document.getElementById(`view-replies-${parentId}`);
    if(!container) return;
    if(container.style.display === 'flex') container.style.display = 'none';
    else { container.style.display = 'flex'; link.style.display = 'none'; }
};

window.startReply = function(commentId, authorName) {
    const input = document.getElementById('sheetInput');
    input.dataset.parentId = commentId; input.placeholder = `Replying to ${authorName}...`;
    input.focus(); document.getElementById('cancelReplyBtn').style.display = 'block';
};

window.cancelReply = function() {
    const input = document.getElementById('sheetInput');
    input.dataset.parentId = ""; input.value = ""; input.placeholder = "মন্তব্য লিখুন...";
    document.getElementById('cancelReplyBtn').style.display = 'none';
};

window.startCommentPress = function(e, commentId, btn) {
    if(!checkAuth()) return;
    isCommentLongPress = false;
    commentPressTimer = setTimeout(() => {
        isCommentLongPress = true; if(navigator.vibrate) navigator.vibrate(50);
        const dock = document.getElementById(`reaction-dock-${commentId}`);
        if(dock) dock.classList.add('show');
    }, 500);
};

window.endCommentPress = function(e, postId, commentId, btn) {
    if(commentPressTimer) clearTimeout(commentPressTimer);
    if(!isCommentLongPress) {
        const dock = document.getElementById(`reaction-dock-${commentId}`);
        if(dock) dock.classList.remove('show');
        handleCommentLikeToggle(postId, commentId);
    }
    isCommentLongPress = false;
};

window.handleCommentReactionRelease = function(e, postId, commentId, container) {
    if(commentPressTimer) clearTimeout(commentPressTimer);
    const activeItem = container.querySelector('.reaction-item.active');
    if(activeItem) {
        const type = activeItem.dataset.type; const src = activeItem.querySelector('img').src;
        performFlyingAnimation(activeItem, commentId, src); updateCommentReactionDB(postId, commentId, type);
        container.classList.remove('show'); container.querySelectorAll('.reaction-item').forEach(i => i.classList.remove('active'));
    }
    isCommentLongPress = false;
};

window.handleCommentReactionClick = function(e, type, postId, commentId) {
    e.stopPropagation();
    const target = e.currentTarget; const src = target.querySelector('img').src;
    performFlyingAnimation(target, commentId, src); updateCommentReactionDB(postId, commentId, type);
    const dock = document.getElementById(`reaction-dock-${commentId}`); if(dock) dock.classList.remove('show');
};

function handleCommentLikeToggle(postId, commentId) {
    const path = `comments/${postId}/${commentId}/reactions/${window.currentUser.uid}`;
    get(ref(db, path)).then(snap => {
        if(snap.exists()) remove(ref(db, path)); 
        else update(ref(db, path), { type: 'like', timestamp: Date.now() });
    });
}

function updateCommentReactionDB(postId, commentId, type) {
    const path = `comments/${postId}/${commentId}/reactions/${window.currentUser.uid}`;
    update(ref(db, path), { type: type, timestamp: Date.now() });
}

// ==========================================================================
// ADMIN MODAL & REPORTS
// ==========================================================================

window.openWriteModal = function() {
     if(!checkAuth()) return;
     document.getElementById('adminModalWrapper').style.display = 'flex';
     const isAdmin = window.currentUser.uid === ADMIN_UID;
     if(isAdmin) { document.getElementById('adminFields').style.display = 'block'; document.getElementById('adminTabs').style.display = 'flex'; } 
     else { document.getElementById('adminFields').style.display = 'none'; document.getElementById('adminTabs').style.display = 'none'; }
};
window.closeAdminModal = () => document.getElementById('adminModalWrapper').style.display = 'none';

window.switchAdminTab = function(tab) {
    const form = document.getElementById('writeFormContainer'); const reports = document.getElementById('reportListContainer');
    form.style.display = 'none'; reports.style.display = 'none';
    if(tab === 'new') { form.style.display = 'block'; } else if (tab === 'reports') { reports.style.display = 'block'; renderReportList(); }
};

window.renderReportList = function() {
    const feed = document.getElementById('reportFeed'); feed.innerHTML = '<p style="text-align:center;">লোড হচ্ছে...</p>';
    get(ref(db, 'reports')).then(snap => {
        const data = snap.val();
        if(!data) { feed.innerHTML = '<p style="text-align:center;">কোনো রিপোর্ট নেই</p>'; return; }
        const reports = Object.entries(data).map(([key, val]) => ({ key, ...val })).reverse();
        feed.innerHTML = reports.map(r => {
            const reporter = r.reportedByName || `UID: ${r.reportedBy.substr(0,5)}...`;
            return `<div class="pending-item"><div style="font-weight:bold; color:#e74c3c;">${r.reason.toUpperCase()}</div><div style="font-size:12px; color:#666;">Reported By: ${reporter}</div><div style="font-size:11px; color:#999;">${new Date(r.timestamp).toLocaleDateString()}</div><div class="pending-actions"><button class="btn-view" onclick="openDetailView('${r.postId}')">দেখুন</button><button class="btn-reject" onclick="deleteReportedPost('${r.key}', '${r.postId}')">মুছুন</button><button class="btn-dismiss" onclick="dismissReport('${r.key}')">বাতিল</button></div></div>`;
        }).join('');
    });
};

window.dismissReport = function(reportKey) { remove(ref(db, `reports/${reportKey}`)).then(() => { showToast("রিপোর্ট বাতিল হয়েছে"); renderReportList(); }); };
window.deleteReportedPost = function(reportKey, postKey) { if(confirm("পোস্টটি ডিলিট করবেন?")) { remove(ref(db, `posts/${postKey}`)); remove(ref(db, `reports/${reportKey}`)); showToast("পোস্ট ডিলিট করা হয়েছে 🗑️"); renderReportList(); } };

window.handleSubmission = function() {
    const title = document.getElementById('postTitle').value;
    const content = document.getElementById('richEditor').innerHTML;
    const category = document.getElementById('postCategory').value;
    if (!title || !document.getElementById('richEditor').innerText.trim()) return showToast('❌ শিরোনাম ও লেখা প্রয়োজন');
    const fullText = (title + " " + document.getElementById('richEditor').innerText).toLowerCase();
    const foundBadWord = BAD_WORDS.find(word => fullText.includes(word));
    if (foundBadWord) { Swal.fire({ icon: 'warning', title: 'সতর্কতা', text: 'আপনার পোস্টে আপত্তিকর শব্দ রয়েছে। দয়া করে ভাষা সংযত করুন।', confirmButtonColor: '#e74c3c' }); return; }
    const postData = {
        title, content, category,
        date: new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' }),
        timestamp: Date.now(), deviceId: DEVICE_ID,
        author: window.currentUser ? window.currentUser.displayName : "বেনামী",
        userImg: window.currentUser ? window.currentUser.photoURL : "https://cdn-icons-png.flaticon.com/512/149/149071.png",
        uid: window.currentUser ? window.currentUser.uid : null,
        image: document.getElementById('postImage').value || null, likes: 0, views: 0
    };
    const isAdmin = window.currentUser.uid === ADMIN_UID;
    if (isAdmin) { postData.voice = document.getElementById('voiceUrl').value; postData.isPinned = document.getElementById('isPinned').checked; }
    push(ref(db, 'posts'), postData).then(() => { 
        if(window.currentUser) { update(ref(db, 'users/' + window.currentUser.uid), { lastPostTimestamp: Date.now() }); } 
        showToast("পাবলিশ হয়েছে ✅"); closeAdminModal(); 
    });
};

document.getElementById('imgInput').addEventListener('change', function() {
    if(!this.files[0]) return;
    const btn = document.getElementById('uploadBtnArea');
    btn.classList.add('uploading'); btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> প্রসেসিং...`;
    compressImage(this.files[0]).then(compressedBlob => {
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> আপলোড হচ্ছে...`;
        uploadImageXHR(compressedBlob).then(url => {
            document.getElementById('postImage').value = url;
            btn.classList.remove('uploading'); btn.style.background = '#2ecc71'; btn.innerHTML = `<i class="fas fa-check"></i> ছবি যুক্ত হয়েছে`;
        }).catch(() => { btn.classList.remove('uploading'); btn.innerHTML = `ব্যর্থ হয়েছে`; });
    });
});

function uploadImageXHR(file, onProgress) {
    return new Promise((resolve, reject) => {
        const formData = new FormData(); formData.append('image', file);
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://api.imgbb.com/1/upload?key=8304af1d699b61abb70d5efe569d4179');
        xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded/e.total)*100)); };
        xhr.onload = () => { if (xhr.status === 200) resolve(JSON.parse(xhr.responseText).data.url); else reject(); };
        xhr.onerror = () => reject(); xhr.send(formData);
    });
}

// ==========================================================================
// PROFILE VIEW
// ==========================================================================

window.viewUserProfile = function(uid) {
    if (!uid || uid === 'undefined') return;
    if(window.blockedUsers.includes(uid)) return showToast("You have blocked this user.");
    navTo('profile'); loadProfile(uid);
};

window.loadProfile = function(targetUid) {
    const params = new URLSearchParams(window.location.search);
    const urlUid = params.get('uid');
    const uid = targetUid || urlUid || (window.currentUser ? window.currentUser.uid : null);
    currentlyViewingUid = uid;

    if(!uid) { document.getElementById('profileNameDisplay').innerText = "অতিথি"; return; }
    if(window.blockedUsers.includes(uid)) {
        document.getElementById('profileNameDisplay').innerText = "Blocked User";
        document.getElementById('profileBioDisplay').innerText = "You have blocked this user.";
        document.getElementById('profileContentFeed').innerHTML = '';
        document.getElementById('profilePic').src = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        return;
    }

    if(history.pushState) { const newurl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?uid=' + uid; window.history.pushState({path:newurl},'',newurl); }

    const isMe = window.currentUser && window.currentUser.uid === uid;
    const isAdmin = window.currentUser && window.currentUser.uid === ADMIN_UID;
    const editBtn = document.getElementById('mainProfileEditBtn');
    if(editBtn) editBtn.style.display = isMe ? 'flex' : 'none';

    const followBtn = document.getElementById('profileFollowBtn');
    const savedBtn = document.getElementById('profileSavedViewBtn');
    const msgBtn = document.getElementById('profileMsgBtn');
    const existingVerifyBtn = document.getElementById('adminVerifyBtn');

    if(existingVerifyBtn) existingVerifyBtn.remove();

    if (isMe) { 
        followBtn.style.display = 'none'; msgBtn.style.display = 'none'; 
        if(savedBtn) savedBtn.style.display = 'flex'; 
    } else {
        followBtn.style.display = 'block'; msgBtn.style.display = 'flex'; 
        if(savedBtn) savedBtn.style.display = 'none';
        if (window.currentUser) { 
            get(ref(db, `followers/${uid}/${window.currentUser.uid}`)).then(snap => { 
                if (snap.exists()) { followBtn.classList.add('following'); followBtn.innerText = 'Follow'; } 
                else { followBtn.classList.remove('following'); followBtn.innerText = 'Follow'; } 
            }); 
        }
    }

    get(ref(db, `followers/${uid}`)).then(snap => { const count = snap.exists() ? Object.keys(snap.val()).length : 0; document.getElementById('statFollowers').innerText = count; });

    get(ref(db, 'users/' + uid)).then(snap => {
        const data = snap.val() || {};
        document.getElementById('profilePic').src = data.photoURL || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        document.getElementById('profileNameDisplay').innerHTML = `${data.displayName || "Unknown"} ${getVerifiedBadge(data.isVerified)}`;
        document.getElementById('profileBioDisplay').innerText = data.bio || "";
        if (data.coverPhoto || data.coverURL) { document.getElementById('profileCover').style.background = `url(${data.coverURL || data.coverPhoto}) center/cover no-repeat`; }
        else { document.getElementById('profileCover').style.background = 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'; }
        renderSocialLinks(data.socialLinks);

        if (isAdmin && !isMe) {
            const btn = document.createElement('button'); btn.id = 'adminVerifyBtn'; btn.className = 'btn-profile-action'; btn.style.display = 'flex'; btn.style.color = data.isVerified ? '#e74c3c' : '#1877f2'; btn.innerHTML = data.isVerified ? '<i class="fas fa-times-circle"></i> আন-ভেরিফাই' : '<i class="fas fa-check-circle"></i> ভেরিফাই করুন'; btn.onclick = () => toggleVerification(uid, data.isVerified);
            document.getElementById('profileActionContainer').appendChild(btn);
        }

        get(query(ref(db, 'posts'), orderByChild('uid'), equalTo(uid), limitToLast(20))).then(postSnap => {
             const userPosts = postSnap.val() ? Object.values(postSnap.val()) : [];
             document.getElementById('statPosts').innerText = userPosts.length;
             document.getElementById('statLikes').innerText = userPosts.reduce((s, p) => s + (p.likes||0), 0);
             window.currentUserProfilePosts = Object.entries(postSnap.val() || {}).map(([k,v]) => ({key:k, ...v})).reverse();
             switchProfileTab('posts', document.querySelector('.p-tab-btn.active'));
        });
    });
};

window.toggleVerification = function(targetUid, currentStatus) {
    const newStatus = !currentStatus;
    update(ref(db, `users/${targetUid}`), { isVerified: newStatus }).then(() => {
        showToast(newStatus ? "ব্যবহারকারী ভেরিফাইড হয়েছেন ✅" : "ভেরিফিকেশন বাতিল করা হয়েছে ❌");
        loadProfile(targetUid); 
    });
};

window.toggleFollow = function() {
    if (!checkAuth()) return;
    const targetUid = currentlyViewingUid; const myUid = window.currentUser.uid;
    const btn = document.getElementById('profileFollowBtn'); const followersStat = document.getElementById('statFollowers');
    if (btn.classList.contains('following')) {
        remove(ref(db, `followers/${targetUid}/${myUid}`)); remove(ref(db, `following/${myUid}/${targetUid}`));
        btn.classList.remove('following'); btn.innerText = 'Follow';
        followersStat.innerText = Math.max(0, parseInt(followersStat.innerText) - 1);
    } else {
        update(ref(db, `followers/${targetUid}`), { [myUid]: true }); update(ref(db, `following/${myUid}`), { [targetUid]: { timestamp: Date.now() } }); 
        btn.classList.add('following'); btn.innerText = 'Follow';
        followersStat.innerText = parseInt(followersStat.innerText) + 1;
    }
};

window.switchProfileTab = function(tab, btn) {
    document.querySelectorAll('.p-tab-btn').forEach(b => b.classList.remove('active')); if(btn) btn.classList.add('active');
    const feed = document.getElementById('profileContentFeed');
    if(tab === 'posts') { renderFeed(window.currentUserProfilePosts || [], 'profileContentFeed'); }
    else if(tab === 'drafts') {
        const editBtn = document.getElementById('mainProfileEditBtn');
        if(!editBtn || editBtn.style.display === 'none') { feed.innerHTML = '<div style="text-align:center; color:#888;">গোপন তথ্য</div>'; return; }
        const drafts = JSON.parse(localStorage.getItem('MUKTOLIPI_DRAFTS_V2') || '[]');
        feed.innerHTML = drafts.length ? drafts.map(d => `<div class="glass-panel" style="padding:15px; margin-bottom:10px; border-radius:12px;"><div style="font-weight:bold;">${d.title}</div><div style="font-size:12px;">${d.date}</div></div>`).join('') : '<div style="text-align:center;">কোনো ড্রাফট নেই</div>';
    } else if(tab === 'saved') {
        const editBtn = document.getElementById('mainProfileEditBtn');
        if(!editBtn || editBtn.style.display === 'none') { feed.innerHTML = '<div style="text-align:center; color:#888;">গোপন তথ্য</div>'; return; }
        const savedKeys = JSON.parse(localStorage.getItem('SAVED_POSTS') || '[]');
        renderFeed(window.allPosts.filter(p => savedKeys.includes(p.key)), 'profileContentFeed');
    }
};

window.navTo = function(page, btn, addToHistory = true) {
    if (addToHistory) window.history.pushState({ page: page }, "", "?page=" + page);

    if (page === 'home') {
        const feedView = document.getElementById('feedView');
        if (feedView.style.display === 'block') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    }

    if (page === 'profile') {
        if (!window.currentUser) { performLogin(); return; }
        currentlyViewingUid = window.currentUser.uid; loadProfile(window.currentUser.uid);
    }

    if (page === 'chatList') {
        if (!checkAuth()) return;
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        closeDetailView(); document.getElementById('feedView').style.display = 'none'; document.getElementById('profileView').style.display = 'none'; document.getElementById('chatListView').style.display = 'block';
        initChatListener(window.currentUser.uid);
        return;
    }

    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    else { const targetBtn = document.querySelector(`.nav-item[onclick*="'${page}'"]`); if(targetBtn) targetBtn.classList.add('active'); }

    closeDetailView();
    const feedView = document.getElementById('feedView'); const profileView = document.getElementById('profileView'); const chatView = document.getElementById('chatListView');
    feedView.style.display = 'none'; profileView.style.display = 'none'; chatView.style.display = 'none';

    if (page === 'home') { feedView.style.display = 'block'; filterCategory('সব', document.querySelector('.cat-btn')); } 
    else if (page === 'saved') { feedView.style.display = 'block'; filterCategory('সংরক্ষিত'); } 
    else if (page === 'profile') { profileView.style.display = 'block'; }
};

window.filterCategory = function(cat, btn) { if(btn) { document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); } document.getElementById('headerSearchBar').value = ''; activeCategoryFilter = cat; loadPostsChunk(true); };
window.filterPosts = function(query) {
    if (!query) { document.getElementById('headerSearchClearBtn').style.display = 'none'; renderFeed(window.allPosts); return; }
    document.getElementById('headerSearchClearBtn').style.display = 'block';
    const q = query.toLowerCase();
    const filtered = window.allPosts.filter(p => { const title = (p.title || "").toLowerCase(); const author = (p.author || "").toLowerCase(); const content = (p.content || "").replace(/<[^>]*>/g, "").toLowerCase(); return title.includes(q) || author.includes(q) || content.includes(q); });
    renderFeed(filtered);
};
window.clearSearchHeader = function() { const input = document.getElementById('headerSearchBar'); input.value = ''; input.focus(); filterPosts(''); };

window.openDetailView = async function(key) {
    window.history.pushState({ modal: 'detail' }, "", "#detail");
    const post = window.allPosts.find(p => p.key === key); if(!post) return;
    document.getElementById('detailTitle').innerText = post.title;
    document.getElementById('detailDate').innerText = post.date;
    document.getElementById('detailBody').innerHTML = formatPostContent(post.content);
    const isVerified = window.userVerificationCache[post.uid] === true;
    document.getElementById('detailAuthorName').innerHTML = `${post.author} ${getVerifiedBadge(isVerified)}`;
    document.getElementById('detailAuthorImg').src = post.userImg || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    const imgEl = document.getElementById('detailMainImg');
    if(post.image) { imgEl.src = post.image; imgEl.style.display = 'block'; } else imgEl.style.display = 'none';
    
    const likeBtn = document.getElementById('detailLikeBtn'); likeBtn.id = `detail-like-btn-${key}`; likeBtn.onclick = () => toggleReaction(key, 'like');
    if(window.currentUser) { get(ref(db, `reactions/${key}/${window.currentUser.uid}`)).then(snap => { const type = snap.val(); if(type) likeBtn.innerHTML = `<i class="fas fa-thumbs-up" style="color:#1877f2"></i> <span>Liked</span>`; else likeBtn.innerHTML = `<i class="far fa-heart"></i> <span>Like</span>`; }); }

    document.getElementById('detailCommentBtn').onclick = () => openCommentsSheet(key);
    document.getElementById('detailShareBtn').onclick = () => openShareSheet(key);
    const saved = (JSON.parse(localStorage.getItem('SAVED_POSTS') || '[]')).includes(key);
    const saveBtn = document.getElementById('detailSaveBtn');
    saveBtn.innerHTML = `<i class="${saved ? 'fas' : 'far'} fa-bookmark" style="${saved?'color:#f39c12':''}"></i> <span>${saved?'সেভড':'সেভ'}</span>`;
    saveBtn.onclick = () => toggleSave(key, saveBtn);
    document.getElementById('detailView').style.display = 'flex'; document.getElementById('mainHeader').style.display = 'none';
};

window.closeDetailView = function() { document.getElementById('detailView').style.display = 'none'; document.getElementById('mainHeader').style.display = 'flex'; };
window.toggleSave = function(key, btn) {
    let saved = JSON.parse(localStorage.getItem('SAVED_POSTS') || '[]');
    if(!saved.includes(key)) { saved.push(key); showToast("সেভ হয়েছে ✅"); btn.innerHTML = `<i class="fas fa-bookmark" style="color:#f39c12"></i> <span>সেভড</span>`; }
    else { saved = saved.filter(k => k !== key); showToast("সেভ বাতিল হয়েছে ❌"); btn.innerHTML = `<i class="far fa-bookmark"></i> <span>সেভ</span>`; }
    localStorage.setItem('SAVED_POSTS', JSON.stringify(saved));
};

window.openShareSheet = function(key) {
    const post = window.allPosts.find(p => p.key === key);
    document.getElementById('sheetTitle').innerText = 'শেয়ার করুন'; document.getElementById('sheetFooter').style.display = 'none';
    document.getElementById('sheetBody').innerHTML = `<div class="share-grid"><button class="share-item" onclick="copyPostLink('${key}')"><div class="share-icon-circle"><i class="fas fa-link"></i></div><span style="font-size:11px;">কপি লিংক</span></button><button class="share-item" onclick="nativeShare('${post.title}', '${key}')"><div class="share-icon-circle"><i class="fas fa-share-alt"></i></div><span style="font-size:11px;">শেয়ার অ্যাপ</span></button><button class="share-item" onclick="downloadPostImage('${key}')"><div class="share-icon-circle"><i class="fas fa-download"></i></div><span style="font-size:11px;">ডাউনলোড</span></button></div>`;
    document.getElementById('universalBottomSheet').classList.add('active');
};
window.copyPostLink = (key) => { navigator.clipboard.writeText(window.location.origin + '?post=' + key); showToast("লিংক কপি হয়েছে"); document.getElementById('universalBottomSheet').classList.remove('active'); };
window.nativeShare = (title, key) => { if (navigator.share) navigator.share({ title: title, text: 'মুক্তলিপি ডায়েরি - ' + title, url: window.location.origin + '?post=' + key }); else copyPostLink(key); };
window.downloadPostImage = (key) => {
    const post = window.allPosts.find(p => p.key === key);
    const captureArea = document.getElementById('quote-capture-area');
    captureArea.style.backgroundImage = post.image ? `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url(${post.image})` : 'linear-gradient(135deg, #1877f2 0%, #00c6ff 100%)';
    document.getElementById('q-text').innerText = post.title; document.getElementById('q-author').innerText = '- ' + post.author;
    document.getElementById('universalBottomSheet').classList.remove('active'); showToast("ছবি তৈরি হচ্ছে...");
    html2canvas(captureArea, { scale: 2 }).then(canvas => { const link = document.createElement('a'); link.download = 'Muktolipi_' + Date.now() + '.png'; link.href = canvas.toDataURL(); link.click(); });
};

const fontFamilies = ["'Hind Siliguri', sans-serif", "'Noto Serif Bengali', serif", "'Galada', cursive"];
window.toggleFont = function() {
    let current = localStorage.getItem('userFont') || fontFamilies[0];
    let idx = fontFamilies.indexOf(current); let nextIdx = (idx + 1) % fontFamilies.length;
    document.documentElement.style.setProperty('--current-font', fontFamilies[nextIdx]);
    localStorage.setItem('userFont', fontFamilies[nextIdx]); showToast("ফন্ট পরিবর্তন হয়েছে");
};
(function initFont() { const savedFont = localStorage.getItem('userFont'); if(savedFont) document.documentElement.style.setProperty('--current-font', savedFont); })();

window.showToast = (msg) => { const t = document.getElementById('toast'); document.getElementById('toastMsg').innerText = msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 2000); };
window.execCmd = (cmd) => document.execCommand(cmd, false, null);
window.addLink = () => { const u = prompt('Link:'); if(u) document.execCommand('createLink', false, u); };
window.toggleTheme = () => document.body.classList.toggle('dark-theme');
window.saveDraft = () => {
     const title = document.getElementById('postTitle').value;
     const drafts = JSON.parse(localStorage.getItem('MUKTOLIPI_DRAFTS_V2') || '[]');
     drafts.unshift({ title: title || 'Untitled', content: document.getElementById('richEditor').innerHTML, date: new Date().toLocaleString() });
     localStorage.setItem('MUKTOLIPI_DRAFTS_V2', JSON.stringify(drafts)); showToast("ড্রাফট সেভ হয়েছে");
};
window.closeBottomSheet = (e) => { if(!e || e.target === e.currentTarget) document.getElementById('universalBottomSheet').classList.remove('active'); };
window.showLibraryToast = () => showToast("লাইব্রেরি শীঘ্রই আসছে...");

let lastScrollTop = 0;
window.addEventListener('scroll', function() {
    let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    if (scrollTop > lastScrollTop && scrollTop > 50) document.querySelector('.bottom-nav').classList.add('nav-hidden');
    else document.querySelector('.bottom-nav').classList.remove('nav-hidden');
    lastScrollTop = scrollTop;
    document.getElementById("readingProgress").style.width = (scrollTop / (document.documentElement.scrollHeight - document.documentElement.clientHeight)) * 100 + "%";
});

window.openDrawer = () => { document.getElementById('sideDrawer').classList.add('open'); document.getElementById('drawerOverlay').classList.add('open'); };
window.closeDrawer = () => { document.getElementById('sideDrawer').classList.remove('open'); document.getElementById('drawerOverlay').classList.remove('open'); };

window.toggleHeaderSearch = function(show) {
    const defaultHead = document.getElementById('defaultHeader');
    const searchHead = document.getElementById('searchHeader');
    const searchInput = document.getElementById('headerSearchBar');
    if (show) { defaultHead.style.display = 'none'; searchHead.style.display = 'flex'; searchInput.focus(); } 
    else { defaultHead.style.display = 'flex'; searchHead.style.display = 'none'; searchInput.value = ''; filterPosts(''); }
};

const bottomNav = document.querySelector('.bottom-nav');
const allInputs = document.querySelectorAll('input, textarea');
allInputs.forEach(input => {
    input.addEventListener('focus', () => { bottomNav.style.display = 'none'; });
    input.addEventListener('blur', () => { setTimeout(() => { bottomNav.style.display = 'flex'; }, 200); });
});
document.addEventListener('focusin', function(e) { if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') bottomNav.style.display = 'none'; });
document.addEventListener('focusout', function(e) { if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') setTimeout(() => { bottomNav.style.display = 'flex'; }, 200); });

let mentionQuery = "";
window.handleMentionInput = function(e) {
    const input = e.target; const text = input.value; const cursor = input.selectionStart; 
    const textBeforeCursor = text.slice(0, cursor); const words = textBeforeCursor.split(/\s+/);
    const lastWord = words[words.length - 1];
    if (lastWord.startsWith('@')) { mentionQuery = lastWord.substring(1); showMentionSuggestions(mentionQuery); } 
    else { document.getElementById('mentionList').style.display = 'none'; }
};

window.showMentionSuggestions = function(searchText) {
    const list = document.getElementById('mentionList');
    if(!searchText || searchText.length === 0) { list.style.display = 'none'; return; }
    const usersRef = ref(db, 'users');
    get(query(usersRef, orderByChild('displayName'), startAt(searchText), endAt(searchText + "\uf8ff"), limitToFirst(10)))
    .then(snap => {
        const data = snap.val();
        if (!data) { list.style.display = 'none'; return; }
        const matches = Object.entries(data).map(([uid, u]) => ({uid, ...u}));
        const finalMatches = matches.filter(u => u.displayName && u.displayName.toLowerCase().includes(searchText.toLowerCase()));
        if (finalMatches.length > 0) {
            list.style.display = 'flex';
            list.innerHTML = finalMatches.map(u => `<div class="mention-item" onclick="selectMention('${u.displayName}', '${u.uid}')"><img src="${u.photoURL || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" loading="lazy" class="mention-avatar"><div style="display:flex; flex-direction:column;"><span class="mention-name">${u.displayName}</span>${u.isVerified ? '<span style="font-size:10px; color:#1877f2;">Verified</span>' : ''}</div></div>`).join('');
        } else { list.style.display = 'none'; }
    }).catch(err => console.error("Error finding users:", err));
};

window.selectMention = function(name, uid) {
    const input = document.getElementById('sheetInput'); const fullText = input.value; const cursor = input.selectionStart; 
    const textBefore = fullText.slice(0, cursor); const textAfter = fullText.slice(cursor);
    const lastAtPos = textBefore.lastIndexOf('@');
    if (lastAtPos === -1) return;
    const newText = textBefore.substring(0, lastAtPos) + `@${name} ` + textAfter;
    input.value = newText; document.getElementById('mentionList').style.display = 'none';
    const newCursorPos = lastAtPos + name.length + 2; input.focus(); input.setSelectionRange(newCursorPos, newCursorPos);
    if(!window.mentionedUids) window.mentionedUids = [];
    if(!window.mentionedUids.includes(uid)) window.mentionedUids.push(uid);
};

window.addEventListener('load', () => { window.history.replaceState({ page: 'root' }, "", ""); window.history.pushState({ page: 'home' }, "", "#home"); });

window.addEventListener('popstate', (event) => {
    const detailView = document.getElementById('detailView'); const chatRoomView = document.getElementById('chatRoomView'); const storyViewer = document.getElementById('storyViewerModal');
    if(storyViewer && storyViewer.style.display === 'flex') { closeStoryViewer(); return; }
    if(chatRoomView && chatRoomView.style.display === 'flex') { chatRoomView.style.display = 'none'; return; }
    if(detailView && detailView.style.display === 'flex') { closeDetailView(); document.getElementById('mainHeader').style.display = 'flex'; return; }

    const feedView = document.getElementById('feedView');
    if (feedView.style.display === 'none') { navTo('home', null); return; }

    if (feedView.style.display === 'block') {
        Swal.fire({
            title: 'অ্যাপ থেকে বের হবেন?', text: "আপনি কি অ্যাপটি বন্ধ করতে চান?", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'হ্যাঁ, বের হবো', cancelButtonText: 'না'
        }).then((result) => {
            if (result.isConfirmed) { window.history.go(-2); } 
            else { window.history.pushState({ page: 'home' }, "", "#home"); }
        });
    }
});

// ==========================================================================
// PWA INSTALLATION LOGIC
// ==========================================================================
window.deferredPrompt = null;
const installBtn = document.getElementById('installAppBtn');

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registered!'))
            .catch(err => console.log('SW registration failed: ', err));
    });
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.deferredPrompt = e;
    if(installBtn) installBtn.style.display = 'flex';
});

window.installPWA = async function() {
    if (window.deferredPrompt) {
        window.deferredPrompt.prompt();
        const { outcome } = await window.deferredPrompt.userChoice;
        if (outcome === 'accepted') { if(installBtn) installBtn.style.display = 'none'; }
        window.deferredPrompt = null;
    }
};

window.addEventListener('appinstalled', () => { if(installBtn) installBtn.style.display = 'none'; });

if (window.matchMedia('(display-mode: standalone)').matches) {
    if(installBtn) installBtn.style.display = 'none';
}